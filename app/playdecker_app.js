/* =========================================================================
   JukeDecker – Hülle des PlayDeckers in der App (Auftrag 15, Phase 4)

   Der PlayDecker selbst ist der gemeinsame Kern gemeinsam/playdecker/
   playdecker_kern.js mit dem Gerüst playdecker_aufbau.js - UNVERÄNDERTE
   Kopien aus dem PlayLister (siehe gemeinsam/HERKUNFT.txt). Diese Hülle
   ist seine „Umgebung“ in der App, so wie am PC Abschnitt (10) von app.js:
   (1) PLAYLISTEN aus dem Paket im Gerätespeicher. Die Wahl einer Playlist
       lädt sofort (kein „Laden“-Knopf) - außer das Deck spielt gerade:
       dann „Erst anhalten“ (Party-Regel). Die zuletzt am PC gewählte
       Playlist je Deck (Paket, R6) kommt nur in ein LEERES Deck und
       spielt nicht.
   (2) MERKEN: Warteschlangen, Stelle, Crossfader, Lautstärke, Auto-Mix im
       Gerätespeicher (IndexedDB, Teil „stand_playdecker“) - wie am PC im
       Stand des Browsers. Überblenddauer, feste Spielzeit, Plattendrehung,
       Perspektive und Design gehören den Einstellungen der App (Bild 10)
       und werden von dort in den Kern gestellt.
   (3) HANDY (unter 1000 px, Bilder 5 und 6): Die Warteschlangen stecken
       hinter „Liste A“ / „Liste B“ und klappen als Leiste über das Deck.
       Titel antippen = jetzt spielen, Häkchen = markieren, ▲ ▼ und
       „→ Deck B“ wirken auf die markierten Titel. Schließen mit ✕,
       Wischen oder Antippen daneben. TABLET (Bild 11): Aufbau wie am PC.
   (4) AUTO-MIX AUF DEM GERÄT (Auftrag (5)):
       (4A) Während die Seite verborgen ist und nach der Rückkehr, bis
            der Ton wieder läuft (höchstens 3,5 s), RUHT die Automatik
            (Haken automatikRuht des Kerns). Danach entscheidet wieder
            die Position der Player - kein Überblenden „im Nachhinein“.
            Laufen alle Decks, die vorher spielten, schon wieder, endet
            die Ruhe sofort: Sonst spielte der Titel weiter, eine
            angehaltene Blende aber nicht, und der Titel endete mitten in
            der Blende (gemessen in app_pruefen.py, Ablauf P8).
       (4B) WERBUNG wird am Zustand des Players erkannt, wie in der
            Messseite, aber ohne festes Zeitfenster (Lehre M17C): Steht
            ein Deck in zwei aufeinanderfolgenden Takten auf
            „ungestartet“ (-1) und seine Zeit läuft dabei weiter, ist es
            Werbung. Sie endet, sobald der Player „läuft“ (1) meldet. Das
            Deck zeigt dann die Plakette „WERBUNG“; eine Überblendung
            dorthin wartet (Haken werbungLaeuft). Werbung wird weder
            übersprungen noch blockiert.
       (4C) Jede Entscheidung kommt mit Grund ins Protokoll (Haken
            automixMelden), ebenso jede Werbung und jeder Zustandswechsel.
   (5) PARTY-REGEL: Der Kern fragt selbst den Jukeboxer (JukeboxerKern).
       Diese Hülle meldet dem Rahmen, ob der PlayDecker spielt.
   ========================================================================= */
(function (global) {
  'use strict';

  const S = global.JukeDeckerSpeicher;
  const TAKT_MS = 250;                    // wie der Takt des Kerns
  const RUHE_NACH_RUECKKEHR_MS = 3500;    // Rahmen prüft nach 3 s - danach erst wieder Automatik
  // Mindestruhe nach der Rückkehr: In dieser Zeit läuft sicher mindestens ein
  // Takt der Blende (25 ms) im Haltezustand und rechnet die verborgene Zeit
  // heraus. Ohne sie zählte der erste Takt die Pause mit, und eine
  // angehaltene Blende spränge ans Ende (gemessen: app_pruefen.py, P8).
  const RUHE_MINDESTENS_MS = 500;
  const SPEICHERN_VERZOEGERUNG_MS = 1000;
  const WERBUNG_TEXT = 'Werbung – der Auto-Mix wartet, bis der Titel beginnt.';

  function einrichten(app) {
    const ansicht = document.getElementById('ansicht-playdecker');
    let panel = null;
    let kern = null;
    let gestartet = false;
    let paket = null;
    let standTeil = null;                 // { sichern, einspielen }
    let standWirdEingespielt = false;
    let speicherUhr = null;

    // ---------------------------------------------------------------
    // (A) Sichtbarkeit: Automatik ruht, „soll spielen“ für die Rückkehr
    //     (Eigener Abhörer, eingerichtet VOR dem des Rahmens - er läuft
    //     deshalb zuerst und hat den Stand schon, wenn der Rahmen fragt.)
    // ---------------------------------------------------------------
    let verborgen = document.visibilityState === 'hidden';
    let ruheBis = 0;                      // Uhr: bis dahin ruht die Automatik nach der Rückkehr
    let rueckkehrUm = 0;                  // Uhr: Zeitpunkt der letzten Rückkehr
    let sollSpielen = [];                 // Decks, die beim Verlassen spielten (Kennungen)
    let sollSpielenBis = 0;
    const zustandVon = (d) => { try { return d.spieler && d.spieler.getPlayerState ? d.spieler.getPlayerState() : null; } catch (f) { return null; } };
    const zeitVon = (d) => { try { return d.spieler && d.spieler.getCurrentTime ? (d.spieler.getCurrentTime() || 0) : 0; } catch (f) { return 0; } };
    const zuletztGespielt = { a: 0, b: 0 };     // Uhr des letzten Takts mit „läuft“ (gegen Reihenfolge-Rennen)

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        verborgen = true;
        if (!kern) return;
        // Was spielte gerade? Auch ein Deck, das im letzten Takt noch lief
        // (das System kann den Player kurz VOR dieser Meldung anhalten).
        const jetzt = Date.now();
        sollSpielen = ['a', 'b'].filter((k) => zustandVon(kern.decks[k]) === 1 || werbung[k].an
          || jetzt - zuletztGespielt[k] <= TAKT_MS * 2);
        sollSpielenBis = Infinity;
        app.protokoll('automix', `Seite verborgen - Auto-Mix ruht. Spielend: ${sollSpielen.length ? sollSpielen.map((k) => k.toUpperCase()).join(', ') : 'keins'}.`);
        return;
      }
      verborgen = false;
      rueckkehrUm = Date.now();
      ruheBis = Date.now() + RUHE_NACH_RUECKKEHR_MS;
      if (sollSpielen.length) sollSpielenBis = Date.now() + RUHE_NACH_RUECKKEHR_MS;
      if (kern) app.protokoll('automix', `Seite wieder sichtbar - Auto-Mix ruht noch bis zur Pruefung der Rueckkehr (3 s), danach entscheidet die Position der Player.`);
    });
    let ruhteZuletzt = false;
    function automatikRuht() {
      let ruht = verborgen || Date.now() < ruheBis;
      // Rückkehr: Spielen alle Decks, die beim Verlassen spielten, schon
      // wieder (Ton von selbst zurück oder nach dem Weiter-Befehl des
      // Rahmens), ist nichts mehr zu prüfen - die Automatik arbeitet sofort
      // weiter. Ein Deck mit Werbung (-1) zählt nicht als „spielt“.
      // Vorher ruht sie mindestens RUHE_MINDESTENS_MS (siehe oben).
      if (ruht && !verborgen && kern && sollSpielen.length
          && Date.now() - rueckkehrUm >= RUHE_MINDESTENS_MS
          && sollSpielen.every((k) => zustandVon(kern.decks[k]) === 1)) {
        ruheBis = 0;
        ruht = false;
      }
      if (!ruht && ruhteZuletzt) app.protokoll('automix', 'Auto-Mix wieder aktiv.');
      ruhteZuletzt = ruht;
      return ruht;
    }

    // ---------------------------------------------------------------
    // (B) Werbung erkennen (Takt, keine feste Wartezeit - Lehre M17C)
    // ---------------------------------------------------------------
    const werbung = {
      a: { an: false, takte: 0, letzteZeit: null, seit: 0, video: '' },
      b: { an: false, takte: 0, letzteZeit: null, seit: 0, video: '' }
    };
    const letzterZustand = { a: '', b: '' };

    function deckBeobachten(k) {
      const d = kern.decks[k];
      const w = werbung[k];
      const z = zustandVon(d);
      const t = zeitVon(d);
      const video = d.titel[d.laufend] ? d.titel[d.laufend].video_id : '';
      if (z === 1) zuletztGespielt[k] = Date.now();
      // Werbung erkennen: „ungestartet“ und die Zeit läuft weiter - in zwei
      // Takten nacheinander. Ein frisch geladener Titel steht ebenfalls auf
      // -1, aber seine Zeit bleibt bei 0.
      if (!w.an) {
        if (z === -1 && w.letzteZeit !== null && t > w.letzteZeit + 0.05) w.takte += 1;
        else w.takte = 0;
        if (w.takte >= 2) {
          w.an = true; w.seit = Date.now(); w.video = video;
          app.protokoll('werbung', `Deck ${k.toUpperCase()}: Werbung erkannt vor ${video} (Zustand -1, Zeit laeuft: ${t.toFixed(1)} s).`);
          d.el.karte.dataset.werbung = 'ja';
          kern.deckMelden(d, WERBUNG_TEXT);
        }
      } else if (z === 1 || z === 0 || z === 5 || video !== w.video) {
        // Ende der Werbung: Der Titel läuft (oder ein anderer ist dran).
        const dauer = Math.round((Date.now() - w.seit) / 1000);
        app.protokoll('werbung', `Deck ${k.toUpperCase()}: Werbung vorbei nach etwa ${dauer} s - ${z === 1 ? `Titel ${video} laeuft ab Position ${t.toFixed(1)} s` : `Zustand ${z}`}.`);
        w.an = false; w.takte = 0;
        delete d.el.karte.dataset.werbung;
        if (d.el.meldung.textContent === WERBUNG_TEXT) kern.deckMelden(d, '');
      }
      w.letzteZeit = t;
      // Zustandswechsel ins Protokoll (Video-IDs ja, Playlist-Namen nein)
      const stand = `${z}|${video}`;
      if (stand !== letzterZustand[k]) {
        letzterZustand[k] = stand;
        app.protokoll('player', `PlayDecker ${k.toUpperCase()}: Zustand ${z === null ? '-' : z}, Video ${video || '-'}, Position ${t.toFixed(1)} s.`);
      }
    }

    // ---------------------------------------------------------------
    // (C) Merken im Gerätespeicher. Cover-Adressen (blob:) gelten nur bis
    //     zum Schließen - gespeichert wird deshalb der Cover-Schlüssel, die
    //     Adresse wird beim Einspielen neu geholt.
    // ---------------------------------------------------------------
    function ohneBildadressen(stand) {
      const kopie = JSON.parse(JSON.stringify(stand));
      ['a', 'b'].forEach((k) => {
        if (kopie[k] && Array.isArray(kopie[k].titel)) kopie[k].titel.forEach((t) => { if (t && String(t.bild || '').startsWith('blob:')) delete t.bild; });
      });
      return kopie;
    }
    async function bildadressenEinsetzen(titelListe) {
      for (const t of titelListe || []) {
        if (t && t.cover) {
          const adresse = await paket.coverAdresse(t.cover);
          if (adresse) t.bild = adresse; else delete t.bild;
        }
      }
    }
    function standGeplant() {
      if (standWirdEingespielt || !standTeil) return;
      clearTimeout(speicherUhr);
      speicherUhr = setTimeout(() => {
        try {
          const daten = ohneBildadressen(standTeil.sichern());
          S.zustandSchreiben('stand_playdecker', daten).catch((f) => app.protokoll('fehler', `PlayDecker-Stand nicht gespeichert: ${f.name}`));
        } catch (f) {
          app.protokoll('fehler', `PlayDecker-Stand: ${f.name}: ${f.message}`);
        }
      }, SPEICHERN_VERZOEGERUNG_MS);
    }

    // ---------------------------------------------------------------
    // (D) Die Umgebung des Kerns (Vertrag im Kopf von playdecker_kern.js)
    // ---------------------------------------------------------------
    let uebersicht = [];                  // Playlisten des Pakets
    function umgebungBauen() {
      return {
        auswahlFuellen(feld) {
          uebersicht.forEach((p) => {
            const o = document.createElement('option');
            o.value = p.id;
            o.textContent = `${p.name} (${p.anzahl})`;
            feld.appendChild(o);
          });
        },
        playlistBeschreiben(kennung) {
          const p = uebersicht.find((x) => x.id === kennung);
          return p ? { name: p.name, lokaleId: p.id } : { meldung: 'Diese Playlist ist nicht im Paket.' };
        },
        async playlistLaden(kennung) {
          const p = await paket.playlist(kennung);
          if (!p) throw new Error('Diese Playlist ist nicht im Paket.');
          await bildadressenEinsetzen(p.titel);
          return { name: p.name, titel: p.titel };
        },
        // Die Wahl einer Playlist ersetzt die Warteschlange ohne Rückfrage
        // (Mockup Bild 5: „Auswahl lädt sofort“). Ein spielendes Deck lädt
        // gar nicht erst (siehe auswahlGeaendert).
        ueberschreibenBestaetigt: () => true,
        quellenEinrichten({ auswahlFuellen }) { auswahlFuellen(); },
        standAnmelden(name, sichern, einspielen) { if (name === 'playdecker') standTeil = { sichern, einspielen }; },
        standGeplant,
        youtubeLaden: app.youtubeLaden,
        songtext: (titel) => paket.songtext(titel && titel.video_id),
        // NUR APP - die drei Haken (siehe Kopf des Kerns):
        automatikRuht,
        werbungLaeuft: (deck) => !!(deck && werbung[deck.kennung] && werbung[deck.kennung].an),
        automixMelden: (text) => app.protokoll('automix', text)
      };
    }

    // ---------------------------------------------------------------
    // (E) Einstellungen der App (Bild 10) in den Kern stellen - über seine
    //     eigenen (in der App verborgenen) Regler, wie ein Mensch es täte.
    //     So bleibt der Kern unverändert und merkt sich die Werte selbst.
    // ---------------------------------------------------------------
    function wertSetzen(id, wert, ereignis) {
      const el = panel && panel.querySelector('#' + id);
      if (!el || String(el.value) === String(wert)) return;
      el.value = String(wert);
      el.dispatchEvent(new Event(ereignis, { bubbles: true }));
    }
    function einstellungAnwenden(feld, wert) {
      if (!kern) return;
      if (feld === 'blendSekunden') wertSetzen('deck-dauer', wert, 'input');
      else if (feld === 'spielzeit') wertSetzen('deck-spielzeit', Math.round(wert / 10), 'input');
      else if (feld === 'drehungSekunden') wertSetzen('deck-drehung', wert, 'input');
      else if (feld === 'design') wertSetzen('deck-design', wert, 'change');
      else if (feld === 'perspektive') {
        const knopf = panel.querySelector(`#deck-perspektive [data-p="${wert}"]`);
        if (knopf && knopf.getAttribute('aria-pressed') !== 'true') knopf.click();
      }
    }
    function alleEinstellungenAnwenden() {
      const pd = app.einstellungen().playdecker;
      ['blendSekunden', 'spielzeit', 'drehungSekunden', 'perspektive', 'design'].forEach((f) => einstellungAnwenden(f, pd[f]));
    }

    // ---------------------------------------------------------------
    // (F) Playlist-Wahl lädt sofort - außer das Deck spielt
    // ---------------------------------------------------------------
    function auswahlEinrichten() {
      ['a', 'b'].forEach((k) => {
        const d = kern.decks[k];
        d.el.auswahl.addEventListener('change', () => {
          if (!d.el.auswahl.value) return;
          if (zustandVon(d) === 1 || werbung[k].an) {
            // PARTY-REGEL: Laufende Musik wird nie versehentlich ersetzt.
            app.protokoll('player', `PlayDecker ${k.toUpperCase()}: Playlist-Wahl abgewiesen - das Deck spielt.`);
            kern.deckMelden(d, 'Erst anhalten – dieses Deck spielt gerade. Die Wahl einer anderen Playlist ersetzt sonst die laufende Musik.');
            // Die Auswahl zeigt wieder die Playlist, die im Deck liegt.
            d.el.auswahl.value = d.quellePlaylist && uebersicht.some((p) => p.id === d.quellePlaylist) ? d.quellePlaylist : '';
            return;
          }
          app.protokoll('player', `PlayDecker ${k.toUpperCase()}: Playlist gewaehlt (${uebersicht.findIndex((p) => p.id === d.el.auswahl.value) + 1}. im Paket) - wird geladen.`);
          d.el.laden.click();
        });
      });
    }

    /** R6: die zuletzt am PC gewählte Playlist je Deck - nur in ein LEERES
        Deck, ohne abzuspielen, und nur einmal je Paket. */
    function letztePlaylistLaden() {
      const e = app.einstellungen();
      const kopf = app.paket();
      if (!kopf || e.letztePlaylistPaket === kopf.kennung) return;
      const lp = kopf.playdecker && kopf.playdecker.letztePlaylist;
      ['a', 'b'].forEach((k) => {
        const d = kern.decks[k];
        const id = lp && lp[k];
        if (!id || d.titel.length || !uebersicht.some((p) => p.id === id)) return;
        d.el.auswahl.value = id;
        d.el.laden.click();
        app.protokoll('player', `PlayDecker ${k.toUpperCase()}: zuletzt am PC gewaehlte Playlist geladen (nicht gestartet).`);
      });
      e.letztePlaylistPaket = kopf.kennung;
      app.einstellungenSpeichern();
    }

    // ---------------------------------------------------------------
    // (G) Warteschlangen als ausklappbare Leiste (nur Handy, Bild 6)
    // ---------------------------------------------------------------
    function leistenEinrichten() {
      const queues = panel.querySelectorAll('.queues > .queue');
      const schleier = document.createElement('div');
      schleier.className = 'jd-ws-schleier';
      panel.appendChild(schleier);
      ['a', 'b'].forEach((k, i) => {
        const d = kern.decks[k];
        const anders = k === 'a' ? 'b' : 'a';
        const leiste = queues[i];
        leiste.classList.add('jd-ws', `jd-ws-${k}`);
        // Kopf: Name der Playlist und ✕ dazu (Bild 6). Den Buchstaben A/B
        // zeichnet schon die Gestaltung des PC (h4::before).
        const kopf = leiste.querySelector('h4');
        kopf.insertAdjacentHTML('beforeend', '<button type="button" class="jd-ws-zu" title="Schließen" aria-label="Warteschlange schließen">✕</button>');
        const nameZiel = document.createElement('span');
        nameZiel.className = 'jd-ws-name';
        kopf.querySelector('span').after(nameZiel);
        const nameZeigen = () => { nameZiel.textContent = d.titel.length ? `· ${d.el.listeName.textContent}` : ''; };
        new MutationObserver(nameZeigen).observe(d.el.listeName, { childList: true, characterData: true, subtree: true });
        nameZeigen();
        // „→ Deck B“ (bzw. „→ Deck A“) ersetzt Ziehen und die PC-Knöpfe A↔B
        const nach = document.createElement('button');
        nach.type = 'button';
        nach.className = 'mini jd-ws-nach';
        nach.textContent = `→ Deck ${anders.toUpperCase()}`;
        nach.title = `Markierte Titel in die Warteschlange ${anders.toUpperCase()} verschieben`;
        nach.addEventListener('click', () => {
          const pc = panel.querySelector(`#deck-nach-${anders}`);
          if (pc && !pc.disabled) pc.click();
          else kern.deckMelden(d, 'Erst Titel ankreuzen (Häkchen links), dann „→ Deck“.');
        });
        leiste.querySelector('.q-leiste').appendChild(nach);
        kopf.querySelector('.jd-ws-zu').addEventListener('click', () => leisteSchliessen());
        // Knopf „Liste A“ mit Anzahl unten im Deck (Bild 5)
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.className = `jd-liste-knopf jd-liste-${k}`;
        knopf.innerHTML = `Liste ${k.toUpperCase()}<b></b>`;
        knopf.addEventListener('click', () => leisteOeffnen(k));
        d.el.karte.querySelector('.deck-steuer').appendChild(knopf);
        // Titel ANTIPPEN = jetzt spielen (Bild 6: wie am PC der Doppelklick).
        // Häkchen und Werkzeuge behalten ihre eigene Wirkung.
        d.el.queue.addEventListener('click', (e) => {
          if (app.istTablet()) return;
          const zeile = e.target.closest('.q');
          if (!zeile || e.target.closest('.haken, .q-werkzeug, input')) return;
          e.stopPropagation();
          e.preventDefault();
          zeile.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
          app.protokoll('player', `PlayDecker ${k.toUpperCase()}: Titel in der Warteschlange angetippt.`);
          setTimeout(leisteSchliessen, 300);
        }, true);
        // Wischen zum Rand schließt (A nach links, B nach rechts)
        let start = null;
        leiste.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; });
        leiste.addEventListener('pointerup', (e) => {
          if (!start) return;
          const dx = e.clientX - start.x, dy = e.clientY - start.y;
          start = null;
          if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy) && (k === 'a' ? dx < 0 : dx > 0)) leisteSchliessen();
        });
      });
      schleier.addEventListener('click', () => leisteSchliessen());
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') leisteSchliessen(); });
      app.beiGroesse(() => { if (app.istTablet()) leisteSchliessen(); });
    }
    function leisteOeffnen(k) {
      if (app.istTablet()) return;
      panel.classList.remove('jd-ws-a-offen', 'jd-ws-b-offen');
      panel.classList.add(`jd-ws-${k}-offen`);
      // Die laufende Zeile in den Blick rollen (Auftrag (3D))
      const d = kern.decks[k];
      const zeile = d.el.queue.querySelector('.q.jetzt');
      if (zeile) d.el.queue.scrollTop = zeile.offsetTop - d.el.queue.offsetTop;
      app.protokoll('app', `PlayDecker: Warteschlange ${k.toUpperCase()} geoeffnet.`);
    }
    function leisteSchliessen() {
      if (panel) panel.classList.remove('jd-ws-a-offen', 'jd-ws-b-offen');
    }

    // ---------------------------------------------------------------
    // (H) Takt der Hülle: Werbung, Zustände, Anzeigen auf dem Handy
    // ---------------------------------------------------------------
    function taktStarten() {
      setInterval(() => {
        if (!kern) return;
        ['a', 'b'].forEach((k) => {
          try { deckBeobachten(k); } catch (f) { /* nie den Takt anhalten */ }
          const d = kern.decks[k];
          const zahl = d.el.karte.querySelector('.jd-liste-knopf b');
          if (zahl) zahl.textContent = d.titel.length ? String(d.titel.length) : '';
        });
        // Hinweis unter dem Auto-Mix wie im Mockup („Überblenden 6 s vor Titelende“)
        const hinweis = panel.querySelector('.jd-mix-hinweis');
        const pd = app.einstellungen().playdecker;
        if (hinweis) hinweis.textContent = pd.blendSekunden ? `Überblenden ${pd.blendSekunden} s vor Titelende` : 'Harter Schnitt am Titelende';
        if (Date.now() > sollSpielenBis) { sollSpielen = []; sollSpielenBis = 0; }
      }, TAKT_MS);
    }

    // ---------------------------------------------------------------
    // (I) Start beim ersten Öffnen
    // ---------------------------------------------------------------
    async function starten() {
      if (gestartet) return;
      paket = app.paketQuelle();
      if (!paket) return;
      gestartet = true;
      ansicht.innerHTML = '<section id="panel-deck" class="jd-playdecker"></section>';
      panel = ansicht.firstElementChild;
      global.PlayDeckerAufbau.einsetzen(panel);
      // Design wie in den Einstellungen der App, schon vor dem Kern (er
      // liest es beim Start vom Panel).
      global.PlayListerDesigns.setzen(panel, app.einstellungen().playdecker.design);
      uebersicht = await paket.uebersicht();
      const gespeichert = await S.zustandLesen('stand_playdecker');
      kern = global.PlayDeckerKern.starten({
        wurzel: panel,
        umgebung: umgebungBauen(),
        reiterKnopf: document.querySelector('#reiter [data-ansicht="playdecker"]')
      });
      // Gemerkten Stand einspielen (Cover-Adressen neu holen)
      if (gespeichert && standTeil) {
        standWirdEingespielt = true;
        try {
          await bildadressenEinsetzen(gespeichert.a && gespeichert.a.titel);
          await bildadressenEinsetzen(gespeichert.b && gespeichert.b.titel);
          standTeil.einspielen(gespeichert);
          app.protokoll('player', `PlayDecker: gemerkter Stand eingespielt (A ${gespeichert.a ? gespeichert.a.titel.length : 0}, B ${gespeichert.b ? gespeichert.b.titel.length : 0} Titel).`);
        } catch (f) {
          app.protokoll('fehler', `PlayDecker-Stand nicht einspielbar: ${f.name}: ${f.message}`);
        } finally {
          standWirdEingespielt = false;
        }
      }
      // Die Werte der Einstellungen (Bild 10) gelten - sie haben Vorrang
      // vor dem gemerkten Stand und vor dem Paket (Antwort R3).
      alleEinstellungenAnwenden();
      // Hinweis unter dem Auto-Mix (Bild 5)
      const mitte = panel.querySelector('#deck-mitte-hinweis');
      if (mitte) mitte.insertAdjacentHTML('beforebegin', '<p class="jd-mix-hinweis"></p>');
      auswahlEinrichten();
      leistenEinrichten();
      letztePlaylistLaden();
      taktStarten();
      app.protokoll('app', 'PlayDecker gestartet.');
    }

    // ---------------------------------------------------------------
    // (J) Was der Rahmen von diesem Modul braucht
    // ---------------------------------------------------------------
    const deckSpielt = (k) => kern && (zustandVon(kern.decks[k]) === 1 || werbung[k].an);
    return {
      gestartet: () => gestartet,
      anzeigen() { starten().catch((f) => app.protokoll('fehler', `PlayDecker-Start: ${f.name}: ${f.message}`)); },
      // „Spielt“ = ein Deck läuft (auch Werbung ist Ton). Nach dem Verlassen
      // zählt bis zur Prüfung der Rückkehr auch, was spielen SOLL - das
      // System hält die Player beim App-Wechsel selbst an.
      spieltGerade: () => !!kern && (deckSpielt('a') || deckSpielt('b') || sollSpielen.length > 0),
      tonLaeuft: () => !!kern && (deckSpielt('a') || deckSpielt('b')),
      weiter() {
        if (!kern) return false;
        let noetig = false;
        sollSpielen.forEach((k) => {
          const d = kern.decks[k];
          const z = zustandVon(d);
          if (d.spieler && z !== 1 && !werbung[k].an) {
            app.protokoll('player', `PlayDecker ${k.toUpperCase()}: Weiter-Befehl nach der Rueckkehr (Zustand war ${z}).`);
            d.spieler.playVideo();
            noetig = true;
          }
        });
        sollSpielen = [];
        sollSpielenBis = 0;
        return noetig;
      },
      songtext() {
        const knopf = panel && panel.querySelector('#deck-songtext-knopf');
        if (!knopf) return 'Der PlayDecker ist noch nicht bereit.';
        knopf.click();
        return '';
      },
      /** Bild 10: Wert aus den Einstellungen der App in den Kern stellen. */
      einstellungAnwenden,
      /** Nur für die Prüfung: Stand der Werbungserkennung. */
      werbungZustand: () => ({ a: werbung.a.an, b: werbung.b.an }),
      kern: () => kern
    };
  }

  global.JukeDeckerModule = global.JukeDeckerModule || {};
  global.JukeDeckerModule.playdecker = { einrichten };
})(window);
