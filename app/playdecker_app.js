/* =========================================================================
   JukeDecker – Hülle des PlayDeckers in der App (Auftrag 15, Phase 4,
   Nachbesserung 1)

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
       Perspektive und Design merkt sich zusätzlich der Rahmen (Gerätewerte,
       Antwort R3: sie haben Vorrang vor dem Paket).
   (3) EINSTELLUNGEN (Nachbesserung 1, N1): Wie am PC öffnet der Knopf
       „⚙ Einstellungen“ im Pult das Einstellungsfenster DES PLAYDECKERS
       (Überblenddauer, feste Spielzeit, Plattendrehung, Perspektive,
       Design). Es ist das Fenster des Kerns; die Hülle meldet jede
       Änderung an den Rahmen, der sie sich merkt.
   (4) WARTESCHLANGEN als ausklappbare Leisten hinter „Liste A“ / „Liste B“
       (Bilder 5 und 6) - auf dem Handy UND seit Nachbesserung 1 (N5) auch
       auf dem Tablet (dort breiter, mit größerer Schrift; der gewonnene
       Platz geht an die Plattenteller). Titel antippen = jetzt spielen,
       Häkchen = markieren, ▲ ▼ und „→ Deck B“ wirken auf die markierten
       Titel. Schließen mit ✕, Wischen oder Antippen daneben.
   (5) „TEILEN“ (N2): verteilt die Playlist eines Decks abwechselnd auf
       beide Decks - wie am PC (deckAufteilen im Kern). Party-Regel: Spielt
       ein Deck, wird „Teilen“ abgewiesen („Erst anhalten“), denn es ersetzt
       beide Warteschlangen.
   (6) AUTO-MIX AUF DEM GERÄT (Auftrag (5), Nachbesserung 1 N7):
       (6A) Die Automatik ruht NUR, wenn der Ton wirklich steht - entschieden
            am Zustand und an der Position der Player (Lehre M17C), nicht
            daran, ob die Seite verborgen ist. Chrome auf dem Handy hält den
            Ton bei Sperre an: Dann ruht der Auto-Mix wie bisher. Opera auf
            dem Tablet lässt ihn weiterlaufen: Dann arbeitet der Auto-Mix
            weiter. Im Hintergrund drosselt der Browser die Zeitgeber - klappt
            eine Überblendung dann nicht sauber, kommt der nächste Titel über
            das Ende-Ereignis des Players (notfalls ohne Blende).
       (6B) Nach der Rückkehr ruht sie, bis der Ton wieder läuft (höchstens
            3,5 s, mindestens 0,5 s). Danach entscheidet wieder die Position
            der Player - kein Überblenden „im Nachhinein“.
       (6C) WERBUNG wird am Zustand des Players erkannt, wie in der
            Messseite, aber ohne festes Zeitfenster (Lehre M17C): Steht
            ein Deck in zwei aufeinanderfolgenden Takten auf
            „ungestartet“ (-1) und seine Zeit läuft dabei weiter, ist es
            Werbung. Sie endet, sobald der Player „läuft“ (1) meldet. Das
            Deck zeigt dann die Plakette „WERBUNG“; eine Überblendung
            dorthin wartet (Haken werbungLaeuft). Werbung wird weder
            übersprungen noch blockiert.
       (6D) Jede Entscheidung kommt mit Grund ins Protokoll (Haken
            automixMelden), ebenso jede Werbung und jeder Zustandswechsel.
   (7) SONGTEXT-KENNUNG (N4): Titel mit Songtext im Paket tragen in der
       Warteschlange und auf der Titelkarte des Decks ein „♪“ (Haken
       hatSongtext des Kerns).
   (8) PARTY-REGEL: Der Kern fragt selbst den Jukeboxer (JukeboxerKern).
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
  // N7: Woran die Hülle bei verborgener Seite erkennt, dass der Ton
  // WEITERLÄUFT: Der Player meldet „läuft“, und seine Position ist seit dem
  // Verbergen um mindestens 1 s vorgerückt. Gemessen (Handy, Chrome): Dort
  // meldet der Player 0,1 bis 0,5 s nach dem Verbergen „pausiert“, die
  // Position bleibt stehen - die Schwelle von 1 s trennt beides sicher.
  // Rückt die Position 2,5 s lang nicht mehr vor, gilt der Ton wieder als
  // stehend.
  const TON_LAEUFT_AB_S = 1.0;
  const TON_STEHT_NACH_MS = 2500;
  const SPEICHERN_VERZOEGERUNG_MS = 1000;
  const WERBUNG_TEXT = 'Werbung – der Auto-Mix wartet, bis der Titel beginnt.';
  const TEILEN_SPERRE_TEXT = 'Erst anhalten – „Teilen“ verteilt die Playlist neu auf beide Decks und würde die laufende Musik ersetzen.';

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
    // (A) Sichtbarkeit: Ruht die Automatik? „Soll spielen“ für die Rückkehr
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
    // N7: Beobachtung der Position je Deck, solange die Seite verborgen ist.
    const verborgenLauf = { a: null, b: null };  // { letztePos, lauf (s), letzteBewegung (Uhr) }
    let verborgenTonLaeuft = false;       // letzte Entscheidung bei verborgener Seite
    let tonLiefVerborgen = false;         // lief der Ton während der letzten verborgenen Zeit?

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        verborgen = true;
        verborgenTonLaeuft = false;
        tonLiefVerborgen = false;
        if (!kern) return;
        ['a', 'b'].forEach((k) => { verborgenLauf[k] = { letztePos: zeitVon(kern.decks[k]), lauf: 0, letzteBewegung: 0 }; });
        // Was spielte gerade? Auch ein Deck, das im letzten Takt noch lief
        // (das System kann den Player kurz VOR dieser Meldung anhalten).
        const jetzt = Date.now();
        sollSpielen = ['a', 'b'].filter((k) => zustandVon(kern.decks[k]) === 1 || werbung[k].an
          || jetzt - zuletztGespielt[k] <= TAKT_MS * 2);
        sollSpielenBis = Infinity;
        app.protokoll('automix', `Seite verborgen - Auto-Mix ruht, bis feststeht, ob der Ton weiterlaeuft. Spielend: ${sollSpielen.length ? sollSpielen.map((k) => k.toUpperCase()).join(', ') : 'keins'}.`);
        return;
      }
      verborgen = false;
      rueckkehrUm = Date.now();
      if (kern && verborgenTonLaeuft) {
        // N7: Der Ton lief die ganze Zeit weiter (z. B. Opera) - es gibt
        // nichts zu prüfen und nichts anzuhalten.
        verborgenTonLaeuft = false;
        ruheBis = 0;
        sollSpielen = [];
        sollSpielenBis = 0;
        app.protokoll('automix', 'Seite wieder sichtbar - der Ton lief weiter, der Auto-Mix arbeitet ohne Pause weiter.');
        return;
      }
      ruheBis = Date.now() + RUHE_NACH_RUECKKEHR_MS;
      if (sollSpielen.length) sollSpielenBis = Date.now() + RUHE_NACH_RUECKKEHR_MS;
      if (kern) app.protokoll('automix', `Seite wieder sichtbar - Auto-Mix ruht noch bis zur Pruefung der Rueckkehr (3 s), danach entscheidet die Position der Player.`);
    });

    /**
     * N7: Läuft der Ton bei verborgener Seite wirklich weiter? Entschieden am
     * ZUSTAND und an der POSITION der Player (Lehre M17C): Ein Deck „läuft“
     * (oder zeigt Werbung) UND seine Position ist seit dem Verbergen um
     * mindestens TON_LAEUFT_AB_S vorgerückt UND sie rückt noch vor (zuletzt
     * vor höchstens TON_STEHT_NACH_MS). Liefert { laeuft, beleg }.
     */
    function tonVerborgenPruefen() {
      const jetzt = Date.now();
      const belege = [];
      let laeuft = false;
      ['a', 'b'].forEach((k) => {
        const d = kern.decks[k];
        const s = verborgenLauf[k] || (verborgenLauf[k] = { letztePos: zeitVon(d), lauf: 0, letzteBewegung: 0 });
        const z = zustandVon(d);
        const t = zeitVon(d);
        const spielt = z === 1 || werbung[k].an;
        // Vorrücken wird an einem MERKPUNKT gemessen (s.letztePos), nicht
        // von Abfrage zu Abfrage: Während einer Überblendung fragt der Kern
        // 40-mal je Sekunde - je Abfrage rückt die Position dann nur 0,025 s
        // vor (gefunden mit app_pruefen.py, Ablauf P10b). Gezählt wird, sobald
        // der Player seit dem Merkpunkt 0,2 s weiter ist. Ein Sprung (über
        // 30 s) oder ein neuer Titel (Position kleiner) ist kein Beleg - dann
        // beginnt nur ein neuer Merkpunkt.
        // „Pausiert“ (2) - so hält Chrome den Ton bei Sperre an - oder kein
        // Player: Dieses Deck steht SOFORT. Puffern, ein frisch geladener
        // oder zu Ende gelaufener Titel (3, -1, 5, 0) dagegen gehört zu einem
        // Titelwechsel, der im Hintergrund weiterläuft (gefunden mit
        // app_pruefen.py, Ablauf P10b): Dann entscheidet die Frist von
        // TON_STEHT_NACH_MS ohne Fortschritt, nicht der Augenblick.
        if (z === 2 || z === null) {
          s.lauf = 0;
          s.letztePos = t;
        } else if (t < s.letztePos || t - s.letztePos >= 30) {
          s.letztePos = t;
        } else if (spielt && t - s.letztePos >= 0.2) {
          s.lauf += t - s.letztePos;
          s.letzteBewegung = jetzt;
          s.letztePos = t;
        }
        const deckLaeuft = s.lauf >= TON_LAEUFT_AB_S && jetzt - s.letzteBewegung <= TON_STEHT_NACH_MS;
        if (deckLaeuft) laeuft = true;
        if (d.spieler) belege.push(`Deck ${k.toUpperCase()} Zustand ${z}, Position ${t.toFixed(1)} s${deckLaeuft ? ' (rueckt vor)' : ''}`);
      });
      return { laeuft, beleg: belege.join('; ') || 'kein Player' };
    }

    let ruhteZuletzt = false;
    function automatikRuht() {
      let ruht;
      if (verborgen) {
        // N7: Bei verborgener Seite ruht der Auto-Mix nur, wenn der Ton
        // wirklich steht. Jede Änderung der Entscheidung mit Grund ins
        // Protokoll.
        const { laeuft, beleg } = kern ? tonVerborgenPruefen() : { laeuft: false, beleg: '' };
        if (laeuft !== verborgenTonLaeuft) {
          verborgenTonLaeuft = laeuft;
          if (laeuft) {
            tonLiefVerborgen = true;
            app.protokoll('automix', `Seite verborgen, aber der Ton laeuft weiter (${beleg}) - Auto-Mix arbeitet weiter. `
              + 'Der Browser drosselt im Hintergrund die Zeitgeber: Klappt eine Ueberblendung nicht sauber, kommt der naechste Titel ueber das Ende-Ereignis des Players.');
          } else {
            app.protokoll('automix', `Seite verborgen, der Ton steht (${beleg}) - Auto-Mix ruht.`);
          }
        }
        // Läuft der Ton, merkt sich die Hülle, WELCHE Decks gerade spielen -
        // so stimmt die Prüfung nach der Rückkehr auch nach einem Übergang,
        // der während der verborgenen Zeit stattfand.
        if (laeuft && kern) {
          const jetztSpielend = ['a', 'b'].filter((k) => zustandVon(kern.decks[k]) === 1 || werbung[k].an);
          if (jetztSpielend.length) sollSpielen = jetztSpielend;
        }
        ruht = !laeuft;
      } else {
        ruht = Date.now() < ruheBis;
        // Rückkehr: Spielen alle Decks, die beim Verlassen spielten, schon
        // wieder (Ton von selbst zurück oder nach dem Weiter-Befehl des
        // Rahmens), ist nichts mehr zu prüfen - die Automatik arbeitet sofort
        // weiter. Ein Deck mit Werbung (-1) zählt nicht als „spielt“.
        // Vorher ruht sie mindestens RUHE_MINDESTENS_MS (siehe oben).
        if (ruht && kern && sollSpielen.length
            && Date.now() - rueckkehrUm >= RUHE_MINDESTENS_MS
            && sollSpielen.every((k) => zustandVon(kern.decks[k]) === 1)) {
          ruheBis = 0;
          ruht = false;
        }
      }
      if (!ruht && ruhteZuletzt) app.protokoll('automix', 'Auto-Mix wieder aktiv.');
      ruhteZuletzt = ruht;
      return ruht;
    }

    /**
     * Jede Entscheidung des Auto-Mix ins Protokoll (Haken automixMelden).
     * N7 (3B2): Bei verborgener Seite mit laufendem Ton steht der Umstand
     * dabei - und wenn ein Titel ohne Überblendung endet, auch der Grund.
     */
    function automixMelden(text) {
      if (verborgen && verborgenTonLaeuft) {
        if (/zu Ende - weiter in der eigenen Warteschlange/.test(text)) {
          text += ' Grund: Die Ueberblendung kam bei verborgener Seite nicht rechtzeitig zustande (Zeitgeber gedrosselt) - '
            + 'naechster Titel ueber das Ende-Ereignis des Players, ohne Blende.';
        }
        text += ' [Seite verborgen, Ton laeuft]';
      }
      app.protokoll('automix', text);
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
      erwartungNachziehen(k, d, video);
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

    /**
     * Gefunden bei der Prüfung der Nachbesserung 1 (app_pruefen.py, P9):
     * „Teilen“ (deckAufteilen im Kern) und das Verschieben in ein leeres
     * Deck legen den ersten Titel nur BEREIT (cueVideoById), ohne sich zu
     * merken, welcher Titel jetzt erwartet wird (deck.erwarteteVideoId).
     * Endet dieser Titel, hält der Kern das „Ende“ für den Nachhall eines
     * anderen Videos und verwirft es - das Deck rückt nicht weiter, der
     * Wächter startet denselben Titel immer wieder. Am PC ist es derselbe
     * Kern (gemeldet im Statusbericht; die Behebung im Kern würde das
     * Verhalten am PC ändern und braucht deshalb Ralles Freigabe).
     * Bis dahin zieht die App den Merker nach - aber NUR, wenn der Player
     * nachweislich genau den Titel zeigt, der laut Warteschlange dran ist.
     * Das ist genau der Wert, den der Kern beim Springen selbst setzt; ein
     * echter Nachhall (Player zeigt noch das alte Video) bleibt erkennbar.
     */
    const erwartungGemeldet = { a: '', b: '' };
    function erwartungNachziehen(k, d, video) {
      if (!video || !d.spieler || !d.erwarteteVideoId || d.erwarteteVideoId === video) return;
      let imPlayer = '';
      try { imPlayer = d.spieler.getVideoData ? (d.spieler.getVideoData() || {}).video_id || '' : ''; } catch (f) { return; }
      if (imPlayer !== video) return;
      if (erwartungGemeldet[k] !== video) {
        erwartungGemeldet[k] = video;
        app.protokoll('player', `PlayDecker ${k.toUpperCase()}: erwarteter Titel nachgezogen (${video} statt ${d.erwarteteVideoId}) - `
          + 'der Kern hatte ihn ohne Merker bereitgelegt (z. B. nach "Teilen").');
      }
      d.erwarteteVideoId = video;
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
        // gar nicht erst (siehe auswahlEinrichten).
        ueberschreibenBestaetigt: () => true,
        quellenEinrichten({ auswahlFuellen }) { auswahlFuellen(); },
        standAnmelden(name, sichern, einspielen) { if (name === 'playdecker') standTeil = { sichern, einspielen }; },
        standGeplant,
        youtubeLaden: app.youtubeLaden,
        songtext: (titel) => paket.songtext(titel && titel.video_id),
        // NUR APP - die Haken (siehe Kopf des Kerns):
        automatikRuht,
        werbungLaeuft: (deck) => !!(deck && werbung[deck.kennung] && werbung[deck.kennung].an),
        automixMelden,
        // N4: „♪“ an Titeln mit Songtext im Paket
        hatSongtext: (titel) => paket.hatSongtext(titel && titel.video_id)
      };
    }

    // ---------------------------------------------------------------
    // (E) Einstellungen
    //     (E1) Beim Start: die Gerätewerte (Rahmen, Antwort R3) in den Kern
    //          stellen - über seine eigenen Regler, wie ein Mensch es täte.
    //          So bleibt der Kern unverändert und merkt sich die Werte selbst.
    //     (E2) N1: Ändert Ralle etwas im Einstellungsfenster des PlayDeckers,
    //          meldet die Hülle es an den Rahmen, der es sich merkt.
    // ---------------------------------------------------------------
    let einstellenVonHuelle = false;      // true, während die Hülle selbst Werte setzt
    function wertSetzen(id, wert, ereignis) {
      const el = panel && panel.querySelector('#' + id);
      if (!el || String(el.value) === String(wert)) return;
      el.value = String(wert);
      el.dispatchEvent(new Event(ereignis, { bubbles: true }));
    }
    function einstellungAnwenden(feld, wert) {
      if (!kern) return;
      einstellenVonHuelle = true;
      try {
        if (feld === 'blendSekunden') wertSetzen('deck-dauer', wert, 'input');
        else if (feld === 'spielzeit') wertSetzen('deck-spielzeit', Math.round(wert / 10), 'input');
        else if (feld === 'drehungSekunden') wertSetzen('deck-drehung', wert, 'input');
        else if (feld === 'design') wertSetzen('deck-design', wert, 'change');
        else if (feld === 'perspektive') {
          const knopf = panel.querySelector(`#deck-perspektive [data-p="${wert}"]`);
          if (knopf && knopf.getAttribute('aria-pressed') !== 'true') knopf.click();
        }
      } finally {
        einstellenVonHuelle = false;
      }
    }
    function alleEinstellungenAnwenden() {
      const pd = app.einstellungen().playdecker;
      ['blendSekunden', 'spielzeit', 'drehungSekunden', 'perspektive', 'design'].forEach((f) => einstellungAnwenden(f, pd[f]));
    }
    /** N1: Das Einstellungsfenster des Kerns mit dem Rahmen verbinden. */
    function einstellungsfensterEinrichten() {
      const melden = (feld, wert) => {
        if (einstellenVonHuelle) return;
        app.pdEinstellungGeaendert(feld, wert);
      };
      const el = (id) => panel.querySelector('#' + id);
      // Der Kern hört mit 'input' auf seine Regler; die Hülle hört danach
      // mit (ihr Abhörer kommt später dazu und läuft deshalb nach dem des
      // Kerns - der Wert ist dann schon angewendet).
      el('deck-dauer').addEventListener('input', () => melden('blendSekunden', Number(el('deck-dauer').value)));
      // Feste Spielzeit: Der Regler zählt Stufen (0 = aus, sonst 10 s je Stufe).
      el('deck-spielzeit').addEventListener('input', () => melden('spielzeit', Number(el('deck-spielzeit').value) * 10));
      el('deck-drehung').addEventListener('input', () => melden('drehungSekunden', Number(el('deck-drehung').value)));
      el('deck-design').addEventListener('change', () => melden('design', el('deck-design').value));
      panel.querySelectorAll('#deck-perspektive [data-p]').forEach((knopf) => {
        knopf.addEventListener('click', () => melden('perspektive', knopf.dataset.p));
      });
      // Versionszeile ganz unten im Fenster (am PC: die des PlayListers).
      const V = app.version();
      const stand = el('deck-stand');
      if (stand) stand.textContent = `${V.titel} · Stand ${V.datum}`;
      el('deck-einstellungen-knopf').addEventListener('click', () => app.protokoll('app', 'PlayDecker: Einstellungen geoeffnet.'));
    }

    // ---------------------------------------------------------------
    // (F) Playlist-Wahl lädt sofort - außer das Deck spielt
    // ---------------------------------------------------------------
    const deckSpieltOderWerbung = (k) => zustandVon(kern.decks[k]) === 1 || werbung[k].an;
    function auswahlEinrichten() {
      ['a', 'b'].forEach((k) => {
        const d = kern.decks[k];
        d.el.auswahl.addEventListener('change', () => {
          if (!d.el.auswahl.value) return;
          if (deckSpieltOderWerbung(k)) {
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

    // ---------------------------------------------------------------
    // (F2) „Teilen“ (N2): wie am PC - nur nicht bei laufender Musik
    //      Der Kern verdrahtet den Knopf über onclick. Die Hülle prüft
    //      VORHER (Abhörer in der Einfangphase am Panel, läuft also vor dem
    //      Knopf selbst): Spielt ein Deck, wird der Klick angehalten.
    // ---------------------------------------------------------------
    function teilenEinrichten() {
      panel.addEventListener('click', (e) => {
        const knopf = e.target.closest('#deck-a-teilen, #deck-b-teilen');
        if (!knopf) return;
        const k = knopf.id === 'deck-a-teilen' ? 'a' : 'b';
        const d = kern.decks[k];
        if (deckSpieltOderWerbung('a') || deckSpieltOderWerbung('b')) {
          e.stopPropagation();
          e.preventDefault();
          app.protokoll('player', `PlayDecker ${k.toUpperCase()}: "Teilen" abgewiesen - ein Deck spielt (Party-Regel).`);
          kern.deckMelden(d, TEILEN_SPERRE_TEXT);
          return;
        }
        const anzahl = d.titel.length;
        // Der Kern teilt im selben Klick auf (nach diesem Abhörer).
        setTimeout(() => app.protokoll('player', `PlayDecker: Playlist von Deck ${k.toUpperCase()} (${anzahl} Titel) auf beide Decks aufgeteilt - `
          + `A ${kern.decks.a.titel.length}, B ${kern.decks.b.titel.length} Titel.`), 0);
      }, true);
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
    // (G) Warteschlangen als ausklappbare Leiste (Bild 6) - Handy und
    //     seit Nachbesserung 1 (N5) auch Tablet
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
        // Häkchen und Werkzeuge behalten ihre eigene Wirkung. Seit N5 auch
        // auf dem Tablet (dieselbe Lösung wie auf dem Handy).
        d.el.queue.addEventListener('click', (e) => {
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
      // Wechselt das Gerät zwischen Handy- und Tablet-Aufbau (Drehen,
      // geteilter Bildschirm), schließt eine offene Leiste.
      app.beiGroesse(() => leisteSchliessen());
    }
    function leisteOeffnen(k) {
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
    // (H) Takt der Hülle: Werbung, Zustände, Anzeigen
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
      // N4: Welche Titel einen Songtext haben, muss VOR dem ersten Zeichnen
      // feststehen (der Kern fragt beim Zeichnen ohne Warten).
      await paket.bereit();
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
      // Die Gerätewerte gelten - sie haben Vorrang vor dem gemerkten Stand
      // und vor dem Paket (Antwort R3).
      alleEinstellungenAnwenden();
      einstellungsfensterEinrichten();
      // Hinweis unter dem Auto-Mix (Bild 5)
      const mitte = panel.querySelector('#deck-mitte-hinweis');
      if (mitte) mitte.insertAdjacentHTML('beforebegin', '<p class="jd-mix-hinweis"></p>');
      auswahlEinrichten();
      teilenEinrichten();
      leistenEinrichten();
      letztePlaylistLaden();
      taktStarten();
      app.protokoll('app', 'PlayDecker gestartet.');
    }

    // ---------------------------------------------------------------
    // (J) Was der Rahmen von diesem Modul braucht
    // ---------------------------------------------------------------
    const deckSpielt = (k) => kern && deckSpieltOderWerbung(k);
    /** Welches Deck ist „vorn“? Das spielende; spielen beide, das lautere
        (Crossfader wie im Kern: bis 50 Deck A). Spielt keines: null. */
    function vorderesDeck() {
      if (!kern) return null;
      const a = deckSpielt('a'), b = deckSpielt('b');
      if (a && !b) return kern.decks.a;
      if (b && !a) return kern.decks.b;
      if (!a && !b) return null;
      const regler = panel.querySelector('#deck-crossfader');
      return Number(regler ? regler.value : 50) <= 50 ? kern.decks.a : kern.decks.b;
    }
    return {
      gestartet: () => gestartet,
      anzeigen() { starten().catch((f) => app.protokoll('fehler', `PlayDecker-Start: ${f.name}: ${f.message}`)); },
      // „Spielt“ = ein Deck läuft (auch Werbung ist Ton). Nach dem Verlassen
      // zählt bis zur Prüfung der Rückkehr auch, was spielen SOLL - das
      // System hält die Player beim App-Wechsel selbst an.
      spieltGerade: () => !!kern && (deckSpielt('a') || deckSpielt('b') || sollSpielen.length > 0),
      tonLaeuft: () => !!kern && (deckSpielt('a') || deckSpielt('b')),
      // N7: Lief der Ton während der letzten verborgenen Zeit weiter?
      tonLiefVerborgen: () => tonLiefVerborgen,
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
      /** N4 (1C): Hat der laufende Titel (vorderes Deck) einen Songtext im
          Paket? null = es läuft nichts. */
      songtextDa() {
        const d = vorderesDeck();
        const t = d && d.titel[d.laufend];
        return t ? paket.hatSongtext(t.video_id) : null;
      },
      /** Wert der Gerätewerte in den Kern stellen (z. B. für Prüfungen). */
      einstellungAnwenden,
      /** Nur für die Prüfung: Stand der Werbungserkennung. */
      werbungZustand: () => ({ a: werbung.a.an, b: werbung.b.an }),
      kern: () => kern
    };
  }

  global.JukeDeckerModule = global.JukeDeckerModule || {};
  global.JukeDeckerModule.playdecker = { einrichten };
})(window);
