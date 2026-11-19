/* =========================================================================
   JukeDecker – Hülle des Jukeboxers in der App (Auftrag 15, Phase 3)

   Der Jukeboxer selbst ist der gemeinsame Kern gemeinsam/jukeboxer/
   jukeboxer_kern.js - eine UNVERÄNDERTE Kopie aus dem PlayLister (siehe
   gemeinsam/HERKUNFT.txt). Diese Hülle verbindet ihn mit der App, so wie
   am PC jukeboxer_pc.js ihn mit dem PlayLister verbindet:
   (1) Datenquelle: Playlisten, Cover und Songtexte aus dem Paket im
       Gerätespeicher (datenquelle_geraet.js), die Einstellungen aus den
       Einstellungen des Geräts (app.js).
   (2) Start erst beim ersten Öffnen der Seite „Jukeboxer“ (vorher kein
       einziger Player, kein YouTube).
   (3) HANDY (unter 1000 px Breite, Mockup Bild 7 und 8): Die Titelkarten
       1–20 liegen hinter dem Knopf „Titelwahl 1–20“ und öffnen sich als
       Fenster. Das Fenster ist der Titelstreifen des Kerns selbst - die
       Hülle setzt nur Klassen, „Fertig“, ✕, die Seitenangabe und die Zahl
       der vorgemerkten Titel dazu.
       (3A) „sofort spielen“: Der Titel startet, das Fenster schließt.
       (3B) „in Warteschlange“ (Nachbesserung 1, N3): Das Fenster bleibt
            offen. Jedes Antippen hängt den Titel an, die Karte zeigt
            „✓ Platz 3“, erneutes Antippen nimmt ihn wieder heraus (Haken
            vormerkungAbwaehlbar des Kerns). Oben steht „3 Titel in der
            Warteschlange“. Geschlossen wird mit „Fertig“ oder ✕.
   (4) TABLET (ab 1000 px, Bild 12): Aufbau wie am PC, Titelkarten immer
       sichtbar. Das Umschalten macht allein das CSS (app.css), je nach
       Klasse „tablet“ am Rahmen. Platz-Anzeige und Herausnehmen wie (3B).
   (5) SONGTEXT-KENNUNG (N4): Titelkarten und „Jetzt läuft“ tragen „♪“, wenn
       das Paket zu dem Titel einen Songtext hat (Haken hatSongtext).
   (5) PARTY-REGEL: Spielt der PlayDecker, startet der Jukeboxer nicht
       (darfStarten). Nach der Rückkehr in die App: Ton nur anstoßen, wenn
       der Jukeboxer spielen SOLL und das System ihn angehalten hat.
   (6) DIAGNOSE: Jeder Wechsel von Titel, Player-Zustand und „spielt“ kommt
       ins Protokoll der App (Video-IDs ja, Playlist-Namen nein).

   Gerätewerte (Antwort R3): Lautstärke, zuletzt gewähltes Genre und die
   Lage des Songtext-Fensters gehören nur dem Gerät. Wiedergabe, Effekte,
   Wahlmodus und Design kamen mit dem ersten Paket und gehören danach
   ebenfalls dem Gerät. Die Genre-Belegung kommt mit jedem Paket vom PC,
   bis sie am Gerät von Hand geändert wird (dann fragt der Paket-Dialog).
   ========================================================================= */
(function (global) {
  'use strict';

  const S = global.JukeDeckerSpeicher;

  /** Wird von app.js aufgerufen, bevor die App startet. „app“ ist die
      Schnittstelle des Rahmens (siehe app.js, Abschnitt (C)). */
  function einrichten(app) {
    const ansicht = document.getElementById('ansicht-jukeboxer');
    let wurzel = null;
    let kernEinstellungen = null;     // DAS Objekt, das der Kern benutzt (gleiche Referenz)
    let genresBeimStart = '';         // Belegung, wie sie dem Kern übergeben wurde (JSON)
    let gestartet = false;

    // ---------------------------------------------------------------
    // (A) Einstellungen für den Kern - aus den Einstellungen des Geräts
    // ---------------------------------------------------------------
    function kernEinstellungenBauen() {
      const e = app.einstellungen();
      const std = S.JUKEBOXER_STANDARD;
      const jb = e.jukeboxer || {};
      const geraet = e.jukeboxerGeraet || {};
      const kopie = (wert) => JSON.parse(JSON.stringify(wert));
      const o = {
        format: 'jukeboxer_einstellungen',
        version: 1,
        genres: kopie(Array.isArray(e.genres) && e.genres.length === 10 ? e.genres : std.genres),
        wiedergabe: { ...kopie(std.wiedergabe), ...kopie(jb.wiedergabe || {}) },
        effekte: { ...kopie(std.effekte), ...kopie(jb.effekte || {}) },
        wahlmodus: jb.wahlmodus || std.wahlmodus,
        lautstaerke: Number.isInteger(geraet.lautstaerke) ? geraet.lautstaerke : std.lautstaerke,
        zuletzt_genre: geraet.zuletzt_genre || null
      };
      if (geraet.songtextFenster) o.songtextFenster = kopie(geraet.songtextFenster);
      genresBeimStart = JSON.stringify(o.genres);
      return o;
    }

    /** Der Kern speichert (sanft verzögert) - zurück in die Gerätewerte. */
    async function kernEinstellungenSpeichern(o) {
      const e = app.einstellungen();
      const genresJetzt = JSON.stringify(o.genres);
      if (genresJetzt !== genresBeimStart) {
        // Belegung am Gerät von Hand geändert (Belegungs-Dialog): Ab jetzt
        // fragt der Paket-Dialog, ob die Belegung vom PC kommen soll.
        e.genres = JSON.parse(genresJetzt);
        e.genresVonHand = true;
        genresBeimStart = genresJetzt;
        app.protokoll('app', 'Jukeboxer: Genre-Belegung am Geraet von Hand geaendert.');
      }
      const designVorher = e.jukeboxer && e.jukeboxer.effekte ? e.jukeboxer.effekte.design : null;
      e.jukeboxer = { wiedergabe: o.wiedergabe, effekte: o.effekte, wahlmodus: o.wahlmodus };
      e.jukeboxerGeraet = { lautstaerke: o.lautstaerke, zuletzt_genre: o.zuletzt_genre || null };
      if (o.songtextFenster) e.jukeboxerGeraet.songtextFenster = o.songtextFenster;
      await app.einstellungenSpeichern();
      if (o.effekte.design !== designVorher) app.designGeaendert();
    }

    // ---------------------------------------------------------------
    // (B) Titelwahl als Fenster (nur Handy, Bild 8)
    // ---------------------------------------------------------------
    function titelwahlEinrichten() {
      const streifen = wurzel.querySelector('.jbx-streifen');
      const kopf = streifen.querySelector('header');
      // Leiste oben rechts im Fenster: Seitenangabe, Zahl der vorgemerkten
      // Titel, Wahlmodus, „Fertig“ und ✕
      const leiste = document.createElement('div');
      leiste.className = 'jd-tw-leiste';
      leiste.innerHTML = '<span class="jd-tw-seite"></span><span class="jd-tw-zahl" role="status"></span><span class="jd-tw-modus"></span>'
        + '<button type="button" class="jd-tw-fertig" title="Titelwahl schließen">Fertig</button>'
        + '<button type="button" class="jd-tw-zu" title="Schließen" aria-label="Titelwahl schließen">✕</button>';
      kopf.appendChild(leiste);
      // Hintergrund hinter dem Fenster: Antippen schließt
      const schleier = document.createElement('div');
      schleier.className = 'jd-tw-schleier';
      wurzel.appendChild(schleier);

      // Die Seitenangabe schreibt der Kern unten in die Wahlleiste
      // („Seite 1/3“) - im Fenster steht sie als „Seite 1 von 3“.
      const quelle = wurzel.querySelector('.jbx-seiten-anzeige');
      const seiteZeigen = () => {
        const m = /(\d+)\s*\/\s*(\d+)/.exec(quelle.textContent || '');
        leiste.querySelector('.jd-tw-seite').textContent = m ? `Seite ${m[1]} von ${m[2]}` : '';
      };
      new MutationObserver(seiteZeigen).observe(quelle, { childList: true, characterData: true, subtree: true });
      seiteZeigen();

      // Der Wahlmodus (Sofort / Warteschlange) gehört im Fenster nach oben
      // rechts (Mockup). Er bleibt dabei ein Teil der Wurzel - der Kern
      // findet ihn so weiter. Auf dem Tablet steht er wieder im Pult.
      const modus = wurzel.querySelector('.jbx-modus');
      const modusPlatzPult = document.createElement('span');
      modusPlatzPult.hidden = true;
      modus.before(modusPlatzPult);
      const modusEinordnen = () => {
        if (app.istTablet()) { if (modus.previousSibling !== modusPlatzPult) modusPlatzPult.after(modus); }
        else if (modus.parentElement !== leiste.querySelector('.jd-tw-modus')) leiste.querySelector('.jd-tw-modus').appendChild(modus);
      };
      modusEinordnen();
      app.beiGroesse(() => { modusEinordnen(); if (app.istTablet()) titelwahlSchliessen(); });

      leiste.querySelector('.jd-tw-zu').addEventListener('click', () => titelwahlSchliessen());
      leiste.querySelector('.jd-tw-fertig').addEventListener('click', () => titelwahlSchliessen());
      schleier.addEventListener('click', () => titelwahlSchliessen());

      // Zahl der vorgemerkten Titel (N3): „3 Titel in der Warteschlange“.
      // Der Kern zeichnet die Titelkarten bei JEDER Änderung der
      // Warteschlange neu - darauf hört die Anzeige (und auf den Wahlmodus).
      const zahl = leiste.querySelector('.jd-tw-zahl');
      const liste = streifen.querySelector('.jbx-titel-liste');
      const zahlZeigen = () => {
        const n = global.JukeboxerKern.warteschlangeLaenge();
        const schlange = modusIstWarteschlange();
        zahl.hidden = !schlange && !n;
        zahl.textContent = n ? `${n} Titel in der Warteschlange` : 'Warteschlange leer';
        wurzel.classList.toggle('jd-modus-schlange', schlange);
      };
      new MutationObserver(zahlZeigen).observe(liste, { childList: true });
      new MutationObserver(zahlZeigen).observe(modus, { attributes: true, subtree: true, attributeFilter: ['class'] });
      zahlZeigen();

      // Nach der Wahl eines Titels (Bild 8):
      // (1) „sofort spielen“: Das Fenster schließt - kurz warten, damit das
      //     Aufblitzen der Karte noch zu sehen ist.
      // (2) „in Warteschlange“: Das Fenster BLEIBT offen (N3), damit Ralle
      //     mehrere Titel nacheinander vormerken kann. Die Karte zeigt ihren
      //     Platz; erneutes Antippen nimmt den Titel wieder heraus (Kern).
      liste.addEventListener('click', (e) => {
        if (!e.target.closest('.jbx-titel-zeile') || app.istTablet()) return;
        if (modusIstWarteschlange()) {
          app.protokoll('app', `Jukeboxer: Titelwahl in Warteschlange - jetzt ${global.JukeboxerKern.warteschlangeLaenge()} vorgemerkt, Fenster bleibt offen.`);
          return;
        }
        setTimeout(titelwahlSchliessen, 250);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && wurzel.classList.contains('jd-titelwahl-offen')) titelwahlSchliessen();
      });
    }

    // ---------------------------------------------------------------
    // (B2) „Als Nächstes“ im Pult (Nachbesserung 2, J1 - Antwort (5) der
    //      Projektleitung). Der Kern zeigt bis zu drei vorgemerkte Titel;
    //      auf dem Tablet ließ das ab zwei Titeln das Pult rollen, und
    //      „⚙ Einstellungen“ rutschte aus dem Bild.
    //      (1) Angezeigt wird nur der ERSTE Titel. „+ n weitere“ steht
    //          rechts in derselben Zeile wie „Als Nächstes“ - so wird der
    //          Kasten nie höher als mit einem Titel.
    //      (2) Antippen klappt die VOLLE Liste als Überlagerung auf, genau
    //          über dem Kasten. Sie liegt über dem Pult (nicht darin), das
    //          Pult verschiebt sich also nicht. Schließen: ✕, daneben
    //          tippen, Esc; leert sich die Warteschlange, schließt sie selbst.
    //      (3) Die Liste kommt aus JukeboxerKern.warteschlangeTitel() (nur
    //          lesen, am PC ohne Wirkung). Sie wird bei jeder Änderung des
    //          Kastens neu gezeichnet - der Kern zeichnet ihn bei jeder
    //          Änderung der Warteschlange neu.
    //      Auf dem Handy ist der Kasten ausgeblendet (wie bisher); dort
    //      zeigt das Titelwahl-Fenster die Zahl der vorgemerkten Titel.
    // ---------------------------------------------------------------
    function alsNaechstesEinrichten() {
      const kasten = wurzel.querySelector('.jbx-ws');
      if (!kasten) return;
      const ueber = document.createElement('div');
      ueber.className = 'jd-ws-ueber';
      ueber.hidden = true;
      ueber.setAttribute('role', 'dialog');
      ueber.setAttribute('aria-label', 'Als Nächstes – alle vorgemerkten Titel');
      ueber.innerHTML = '<div class="jd-ws-ueber-kopf"><b class="jd-ws-ueber-titel"></b>'
        + '<button type="button" class="jd-ws-ueber-zu" title="Schließen" aria-label="Liste schließen">✕</button></div>'
        + '<ol class="jd-ws-ueber-liste"></ol>';
      const fang = document.createElement('div');       // daneben tippen schließt
      fang.className = 'jd-ws-fang';
      fang.hidden = true;
      ansicht.appendChild(fang);
      ansicht.appendChild(ueber);
      const sicher = (text) => String(text).replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));

      function listeZeichnen() {
        const titel = global.JukeboxerKern.warteschlangeTitel();
        ueber.querySelector('.jd-ws-ueber-titel').textContent = `Als Nächstes · ${titel.length} Titel`;
        ueber.querySelector('.jd-ws-ueber-liste').innerHTML = titel
          .map((t, n) => `<li><b>${n + 1}.</b> <span class="jd-ws-t">${sicher(t.titel)}</span>${t.interpret ? ` <span class="jd-ws-i">– ${sicher(t.interpret)}</span>` : ''}</li>`).join('');
        return titel.length;
      }
      function lageSetzen() {
        // Genau über dem Kasten, mindestens 360 px breit, nach unten offen;
        // reicht der Platz nach unten nicht, klappt sie nach oben auf.
        const rahmen = document.getElementById('jd').getBoundingClientRect();
        const k = kasten.getBoundingClientRect();
        const breite = Math.min(Math.max(k.width, 360), rahmen.width - 16);
        const links = Math.min(Math.max(k.left - rahmen.left, 8), rahmen.width - breite - 8);
        const untenFrei = rahmen.bottom - k.top - 8;
        ueber.style.width = `${breite}px`;
        ueber.style.left = `${links}px`;
        if (untenFrei >= 220) {
          ueber.style.top = `${k.top - rahmen.top}px`; ueber.style.bottom = '';
          ueber.style.maxHeight = `${untenFrei}px`;
        } else {
          ueber.style.top = ''; ueber.style.bottom = `${rahmen.bottom - k.bottom}px`;
          ueber.style.maxHeight = `${k.bottom - rahmen.top - 8}px`;
        }
      }
      function oeffnen() {
        if (!listeZeichnen()) return;
        lageSetzen();
        ueber.hidden = false;
        fang.hidden = false;
        app.protokoll('app', `Jukeboxer: "Als Naechstes" aufgeklappt (${global.JukeboxerKern.warteschlangeLaenge()} Titel).`);
      }
      function schliessen() {
        ueber.hidden = true;
        fang.hidden = true;
      }
      // Nach jedem Neuzeichnen des Kerns: „+ n weitere“ in die Kopfzeile.
      function kastenErgaenzen() {
        const n = global.JukeboxerKern.warteschlangeLaenge();
        let mehr = kasten.querySelector('.jd-ws-mehr');
        if (n >= 2) {
          if (!mehr) {
            mehr = document.createElement('button');
            mehr.type = 'button';
            mehr.className = 'jd-ws-mehr';
            mehr.title = 'Alle vorgemerkten Titel zeigen';
            mehr.addEventListener('click', (e) => { e.stopPropagation(); if (ueber.hidden) oeffnen(); else schliessen(); });
            const kopf = kasten.querySelector('.jbx-ws-kopf');
            if (kopf) kopf.after(mehr); else kasten.prepend(mehr);
          }
          const text = `+ ${n - 1} weitere ▾`;
          if (mehr.textContent !== text) mehr.textContent = text;
        } else if (mehr) {
          mehr.remove();
        }
        if (!ueber.hidden) { if (n) { listeZeichnen(); lageSetzen(); } else schliessen(); }
      }
      new MutationObserver(kastenErgaenzen).observe(kasten, { childList: true });
      kastenErgaenzen();
      ueber.querySelector('.jd-ws-ueber-zu').addEventListener('click', schliessen);
      fang.addEventListener('click', schliessen);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ueber.hidden) schliessen(); });
      app.beiGroesse(schliessen);
      window.addEventListener('resize', () => { if (!ueber.hidden) lageSetzen(); });
    }

    /** Steht der Wahlmodus auf „Warteschlange“? (der Knopf des Kerns leuchtet) */
    function modusIstWarteschlange() {
      return !!(wurzel && wurzel.querySelector('.jbx-modus [data-modus="warteschlange"].jbx-aktiv'));
    }

    function titelwahlOeffnen() {
      if (!wurzel || app.istTablet()) return;
      wurzel.classList.add('jd-titelwahl-offen');
      app.protokoll('app', 'Jukeboxer: Titelwahl geoeffnet.');
    }
    function titelwahlSchliessen() {
      if (wurzel) wurzel.classList.remove('jd-titelwahl-offen');
    }

    // ---------------------------------------------------------------
    // (C) Diagnose: Zustandswechsel ins Protokoll (Lehre M17C: Zustände,
    //     keine festen Zeitfenster - hier nur beobachtet, nie entschieden)
    // ---------------------------------------------------------------
    let letzterStand = '';
    function zustandBeobachten() {
      setInterval(() => {
        const d = global.JukeboxerKern && global.JukeboxerKern.diagnose();
        if (!d) return;
        const aktiv = (d.player || []).find((p) => p.aktiv) || {};
        const stand = `spielt=${d.spielt ? 'ja' : 'nein'} wechsel=${d.wechsel ? 'ja' : 'nein'} video=${aktiv.video || '-'} `
          + `player=${aktiv.player || '-'} zustand=${aktiv.zustand ?? '-'}${d.blendet ? ' blendet' : ''}`;
        if (stand !== letzterStand) {
          letzterStand = stand;
          app.protokoll('player', `Jukeboxer: ${stand} pos=${d.position}s ende=${d.ende}s`);
        }
      }, 1000);
    }

    // ---------------------------------------------------------------
    // (D) Start beim ersten Öffnen
    // ---------------------------------------------------------------
    let paket = null;
    async function starten() {
      if (gestartet) return;
      paket = app.paketQuelle();
      if (!paket) return;
      gestartet = true;
      // N4: Welche Titel einen Songtext haben, muss VOR dem ersten Zeichnen
      // der Titelkarten feststehen (der Kern fragt beim Zeichnen ohne Warten).
      await paket.bereit();
      ansicht.innerHTML = '<div class="jbx-wurzel"></div>';
      wurzel = ansicht.firstElementChild;
      kernEinstellungen = kernEinstellungenBauen();
      global.JukeboxerKern.starten({
        wurzel,
        datenquelle: S.jukeboxerQuelle({
          paket,
          einstellungen: () => kernEinstellungen,
          speichern: kernEinstellungenSpeichern,
          // PARTY-REGEL: Spielt der PlayDecker, startet der Jukeboxer nicht.
          darfStarten() {
            if (app.anderesModulSpielt('jukeboxer')) {
              app.protokoll('player', 'Jukeboxer: Start abgewiesen - der PlayDecker spielt (Party-Regel).');
              return {
                ja: false,
                grund: 'Der PlayDecker spielt gerade. Bitte dort erst pausieren, dann startet der Jukeboxer.',
                grundVorgemerkt: 'Vorgemerkt – startet, sobald der PlayDecker pausiert ist und Du hier ▶ drückst.'
              };
            }
            return { ja: true };
          }
        }),
        beimAbspielen() { /* keine Vorschau in der App */ },
        youtubeLaden: app.youtubeLaden,
        // Das Songtext-Fenster liegt fest positioniert direkt im Rahmen
        // (kein transform darüber).
        songtextBehaelter: app.songtextAblage('jukebox'),
        // Design am Element der Seite - einem Elternteil der Wurzel.
        designZiel: ansicht,
        zusatzKnoepfe: [{
          text: 'Titelwahl 1–20',
          klasse: 'jbx-effekte-knopf jd-titelwahl-knopf',
          titel: 'Die Titel des gewählten Genres zum Auswählen öffnen',
          beiKlick: titelwahlOeffnen
        }]
      });
      titelwahlEinrichten();
      alsNaechstesEinrichten();
      zustandBeobachten();
      app.protokoll('app', 'Jukeboxer gestartet.');
    }

    // ---------------------------------------------------------------
    // (E) Was der Rahmen von diesem Modul braucht
    // ---------------------------------------------------------------
    // ---------------------------------------------------------------
    // (D2) N7: Lief der Ton weiter, während die Seite verborgen war? (Opera
    //      auf dem Tablet hält ihn nicht an, Chrome auf dem Handy schon.)
    //      Verglichen werden Titel und Position beim Verbergen und bei der
    //      Rückkehr: Ist die Position um mindestens die Hälfte der
    //      verborgenen Zeit vorgerückt oder läuft ein anderer Titel, lief
    //      der Ton. Nur für Protokoll und Rückkehr-Band - der Jukeboxer
    //      selbst spielt ohnehin einfach weiter, solange der Player läuft.
    // ---------------------------------------------------------------
    let beimVerbergen = null;             // { video, position, uhr }
    let tonLiefVerborgen = false;
    const aktiverStand = () => {
      const d = global.JukeboxerKern && global.JukeboxerKern.diagnose();
      if (!d) return null;
      const aktiv = (d.player || []).find((p) => p.aktiv) || {};
      return { video: aktiv.video || '', position: Number(d.position) || 0, spielt: !!d.spielt };
    };
    document.addEventListener('visibilitychange', () => {
      if (!gestartet) return;
      const stand = aktiverStand();
      if (!stand) return;
      if (document.visibilityState === 'hidden') {
        beimVerbergen = { ...stand, uhr: Date.now() };
        tonLiefVerborgen = false;
        return;
      }
      if (!beimVerbergen || !beimVerbergen.spielt) { tonLiefVerborgen = false; return; }
      const sekunden = (Date.now() - beimVerbergen.uhr) / 1000;
      tonLiefVerborgen = global.JukeboxerKern.tonLaeuft() && sekunden >= 2
        && (stand.video !== beimVerbergen.video || stand.position - beimVerbergen.position >= sekunden * 0.5);
      app.protokoll('player', `Jukeboxer: Rueckkehr nach ${Math.round(sekunden)} s - Ton lief ${tonLiefVerborgen ? 'weiter' : 'nicht weiter'} `
        + `(vorher ${beimVerbergen.video || '-'} bei ${beimVerbergen.position} s, jetzt ${stand.video || '-'} bei ${stand.position} s).`);
      beimVerbergen = null;
    });

    return {
      gestartet: () => gestartet,
      anzeigen() { starten().catch((f) => app.protokoll('fehler', `Jukeboxer-Start: ${f.name}: ${f.message}`)); },
      tonLiefVerborgen: () => tonLiefVerborgen,
      /** N4 (1C): Hat der laufende Titel einen Songtext im Paket? null = es
          läuft (noch) kein Titel. */
      songtextDa() {
        const stand = gestartet && paket ? aktiverStand() : null;
        return stand && stand.video ? paket.hatSongtext(stand.video) : null;
      },
      // Party-Regel: „spielt“ = Wiedergabe läuft oder Plattenwechsel bringt
      // gleich Ton (Pause zählt nicht).
      spieltGerade: () => gestartet && global.JukeboxerKern.spielt(),
      tonLaeuft: () => gestartet && global.JukeboxerKern.tonLaeuft(),
      weiter() {
        if (!gestartet) return false;
        const noetig = global.JukeboxerKern.fortsetzen();
        if (noetig) app.protokoll('player', 'Jukeboxer: Weiter-Befehl nach der Rueckkehr gegeben.');
        return noetig;
      },
      /** Knopf ♪ in der Kopfleiste: Songtext-Fenster des Jukeboxers. */
      songtext() {
        const knopf = wurzel && wurzel.querySelector('.jbx-songtext-knopf');
        if (!knopf || knopf.hidden) return 'Der Songtext ist in den Jukeboxer-Einstellungen ausgeschaltet.';
        if (knopf.disabled) return 'Gerade läuft kein Titel.';
        knopf.click();
        return '';
      },
      /** Design aus dem Einstellungsfenster der App (Bild 10) übernehmen:
          in DASSELBE Objekt, das der Kern benutzt - so speichert der Kern
          es beim nächsten Mal mit, und sein eigenes Effekte-Fenster zeigt
          denselben Wert. Wirkt sofort (nur Farben). */
      designSetzen(kennung) {
        if (!kernEinstellungen) return;
        kernEinstellungen.effekte.design = kennung;
        global.PlayListerDesigns.setzen(ansicht, kennung);
      }
    };
  }

  global.JukeDeckerModule = global.JukeDeckerModule || {};
  global.JukeDeckerModule.jukeboxer = { einrichten };
})(window);
