/* =========================================================================
   JukeDecker – Rahmen der App (Auftrag 15, Phase 2)

   WAS HIER PASSIERT:
   (A) Diagnose-Protokoll       jedes wichtige Ereignis mit Zeit, in IndexedDB
   (B) Einstellungen des Geräts  laden, Standardwerte, speichern
   (C) Module                    PlayDecker und Jukeboxer (in Phase 2 noch
                                 Platzhalter; Phase 3 und 4 melden sich hier an)
   (D) Ansichten                 Start, PlayDecker, Jukeboxer – umschalten ohne
                                 Neuladen; die zuletzt benutzte öffnet beim Start
   (E) Startseite                Bild 1 (Paket da) oder Bild 2 (noch keines)
   (F) Paket-Dialog              Bild 3 (geprüft) und Bild 4 (abgelehnt)
   (G) Einstellungen             „⚙ JukeDecker“: nur App-weite Dinge. Seit
                                 Nachbesserung 2 (M1) ein rollbares Fenster
                                 mit drei Abschnitten: Dateiarbeit (Paket
                                 laden und löschen, Protokoll speichern und
                                 leeren), Bildschirm und Party-Modus, Über
                                 JukeDecker. Seit Nachbesserung 1 (N1)
                                 stehen die Werte des PlayDeckers im
                                 PlayDecker selbst, die des Jukeboxers im
                                 Jukeboxer; Bild 10 des Mockups ist damit
                                 überholt.
   (H) Party-Modus               Wake Lock, „☀ Party“, grünes Band nach der
                                 Rückkehr; bei „Party aus“ jede Minute ein
                                 Messeintrag (N6)
   (I) Fenster                   Hochformat-Hinweis (Bild 13), Handy/Tablet,
                                 jede Größe und Ausrichtung ins Protokoll
   (J) Service Worker            Offline-Betrieb und geteilte Pakete
   (K) Start

   PARTY-REGEL (CLAUDE.md): Laufende Musik wird nie versehentlich
   unterbrochen. Deshalb lädt diese Seite sich NIE selbst neu – auch nicht,
   wenn eine neue Fassung der App bereitliegt. „Übernehmen“ und „Löschen“
   eines Pakets sind gesperrt, solange Musik läuft.
   ========================================================================= */
(function () {
  'use strict';

  const V = self.JukeDeckerVersion;
  const S = window.JukeDeckerSpeicher;
  const P = window.JukeDeckerPaket;
  const $ = (auswahl, wurzel = document) => wurzel.querySelector(auswahl);
  const $$ = (auswahl, wurzel = document) => Array.from(wurzel.querySelectorAll(auswahl));
  const wurzel = $('#jd');

  // Größen in deutscher Schreibweise: 7,47 MB
  const mb = (bytes) => (bytes / 1048576).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MB';
  // Dateigröße lesbar: unter 1 MB in KB (aufgerundet), sonst MB mit zwei Stellen.
  const groesseText = (bytes) => (bytes === undefined || bytes === null ? '–'
    : bytes < 1048576 ? `${Math.max(1, Math.ceil(bytes / 1024)).toLocaleString('de-DE')} KB` : mb(bytes));
  const zahl = (n) => Number(n || 0).toLocaleString('de-DE');
  const escapen = (text) => String(text).replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));

  // =======================================================================
  // (A) Diagnose-Protokoll (Projektregel: Diagnose statt Raten)
  //     Höchstens 1000 Einträge in IndexedDB. Video-IDs ja, KEINE
  //     Playlist-Namen, kein Dateiname, kein Rechnername.
  // =======================================================================
  const ARTEN = ['start', 'sichtbarkeit', 'wakelock', 'paket', 'player', 'werbung', 'automix', 'fehler', 'fenster', 'app'];

  function protokoll(art, text) {
    const eintrag = { zeit: new Date().toISOString(), art: ARTEN.includes(art) ? art : 'app', text: String(text) };
    // Nie die App stören: Klappt das Schreiben nicht, bleibt es still.
    S.protokollSchreiben(eintrag).catch(() => {});
  }

  window.addEventListener('error', (ereignis) => {
    protokoll('fehler', `${ereignis.message || 'Fehler'} (${String(ereignis.filename || '').split('/').pop()}:${ereignis.lineno || '?'})`);
  });
  window.addEventListener('unhandledrejection', (ereignis) => {
    const grund = ereignis.reason;
    protokoll('fehler', `Unbehandelt: ${grund && grund.name ? grund.name + ': ' : ''}${grund && grund.message ? grund.message : String(grund)}`);
  });

  /** Das Protokoll als Textdatei speichern (Einstellungen → „Protokoll als Datei speichern“). */
  async function protokollSpeichern() {
    const eintraege = await S.protokollLesen();
    const jetzt = new Date();
    const zwei = (n) => String(n).padStart(2, '0');
    const zeitText = (iso) => {
      const d = new Date(iso);
      return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()} ${zwei(d.getHours())}:${zwei(d.getMinutes())}:${zwei(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
    };
    const kopf = [
      '=== JukeDecker - Diagnose-Protokoll ===',
      `Stand App:        ${V.titel}`,
      `Gespeichert:      ${zeitText(jetzt.toISOString())}`,
      `Geraetemodell:    ${geraet.modell}`,
      `Android/Chrome:   ${geraet.android} / Chrome ${geraet.chrome}`,
      // N7 (4): Andere Chromium-Browser melden sich ebenfalls als „Chrome“ -
      // der Name des Browsers steht deshalb eigens da (ermittelt aus den
      // Marken bzw. der Kennung). Gemessen 19.11.2026: auf Handy und Tablet
      // ist es Google Chrome.
      `Browser:          ${geraet.browser}`,
      // Nachbesserung 2: die Rohangaben dazu, damit eine falsche Erkennung
      // nachprüfbar ist (Kennung ohne Gerätenamen seit Chrome 110, Marken,
      // Plattform und „mobil“ - „Linux“ mit „mobil: nein“ heißt meist:
      // Chrome auf einem Tablet zeigt die Desktop-Fassung von Webseiten).
      `Kennung:          ${String(navigator.userAgent || '?').replace(/[\x00-\x1f]/g, ' ')}`,
      `Marken:           ${geraet.marken || '?'} · Plattform ${geraet.plattform || '?'} · mobil: ${geraet.mobil || '?'}`,
      `Anzeige:          ${anzeigemodus()}, Fenster ${innerWidth} x ${innerHeight}, Pixeldichte ${devicePixelRatio}`,
      `Eintraege:        ${eintraege.length} (hoechstens ${S.PROTOKOLL_HOECHSTENS}, aelteste fallen weg)`,
      '========================================'
    ];
    // Nur Text ohne Steuerzeichen (die Upload-Seite am PC prüft das).
    const zeilen = eintraege.map((e) => `${zeitText(e.zeit)}  ${e.art.toUpperCase().padEnd(12)} ${String(e.text).replace(/[\x00-\x08\x0b-\x1f]/g, ' ')}`);
    const text = kopf.concat(zeilen).join('\n') + '\n';
    const name = `JukeDecker_Protokoll_${jetzt.getFullYear()}${zwei(jetzt.getMonth() + 1)}${zwei(jetzt.getDate())}_${zwei(jetzt.getHours())}${zwei(jetzt.getMinutes())}.txt`;
    const adresse = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const verweis = document.createElement('a');
    verweis.href = adresse;
    verweis.download = name;
    document.body.appendChild(verweis);
    verweis.click();
    verweis.remove();
    setTimeout(() => URL.revokeObjectURL(adresse), 60000);
    protokoll('app', `Protokoll als Datei gespeichert (${eintraege.length} Eintraege, ${text.length} Zeichen).`);
    bandZeigen(`✔ Protokoll gespeichert (Ordner „Downloads“). Zum PC: Seite „Für JukeDecker“ → „Messprotokoll hochladen“.`, 6000);
  }

  // Geräteangaben für den Kopf des Protokolls (wie in der Messseite).
  let geraet = { modell: '?', android: '?', chrome: '?', browser: '?' };

  /**
   * Welcher Browser läuft? (Nachbesserung 1, N7 (4))
   * Opera, Samsung Internet, Edge usw. bauen auf Chromium auf und melden sich
   * in der Versionsangabe als „Chrome“. Ihren eigenen Namen nennen sie
   * (1) in navigator.userAgentData.brands - neben „Chromium“, „Google
   *     Chrome“ und einer absichtlich unsinnigen Füllmarke („Not A Brand“,
   *     wechselnde Schreibweise), die hier wegfallen,
   * (2) sonst in der Kennung (User-Agent): „OPR/“ = Opera, „OPT/“ = Opera
   *     Touch, „OPX/“ = Opera GX, „SamsungBrowser/“, „EdgA/“ = Edge für
   *     Android. (Nachbesserung 2: „OPT/“ und „OPX/“ ergänzt.)
   * Ergebnis z. B. „Opera 85“, „Google Chrome 157“ oder „unbekannt“ - nie
   * ein Fehler.
   * GRENZE (Nachbesserung 2, aus Ralles Tablet-Protokoll vom 19.11.2026):
   * Meldet ein Browser in den Marken nur „Google Chrome“ und steht in der
   * Kennung nichts Eigenes, ist er von Chrome nicht zu unterscheiden. Damit
   * man das später nachprüfen kann, steht die Kennung selbst im Kopf des
   * Protokolls (Zeile „Kennung:“).
   */
  function browserName(marken, kennung) {
    const liste = (marken || []).filter((b) => b && b.brand && !/not.?a.?brand/i.test(b.brand));
    const eigene = liste.find((b) => !/^(Chromium|Google Chrome)$/i.test(b.brand));
    if (eigene) return `${eigene.brand} ${eigene.version}`;
    const ua = kennung === undefined ? (navigator.userAgent || '') : String(kennung);
    const treffer = [[/OPR\/([\d.]+)/, 'Opera'], [/OPT\/([\d.]+)/, 'Opera Touch'], [/OPX\/([\d.]+)/, 'Opera GX'],
      [/Opera\/([\d.]+)/, 'Opera'], [/SamsungBrowser\/([\d.]+)/, 'Samsung Internet'],
      [/EdgA?\/([\d.]+)/, 'Edge'], [/Firefox\/([\d.]+)/, 'Firefox']]
      .map(([muster, name]) => { const m = ua.match(muster); return m ? `${name} ${m[1]} (aus der Kennung)` : null; })
      .find(Boolean);
    if (treffer) return treffer;
    const chrome = liste.find((b) => /^Google Chrome$/i.test(b.brand)) || liste.find((b) => /^Chromium$/i.test(b.brand));
    return chrome ? `${chrome.brand} ${chrome.version}` : 'unbekannt';
  }

  async function geraetErmitteln() {
    try {
      if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        const w = await navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion', 'fullVersionList']);
        const marken = w.fullVersionList || [];
        const chrome = marken.find((b) => b.brand === 'Google Chrome') || marken.find((b) => /Chrom/i.test(b.brand));
        const alleMarken = marken.length ? marken : navigator.userAgentData.brands;
        geraet = {
          modell: w.model || '(leer)',
          android: (w.platform || navigator.userAgentData.platform || '') + ' ' + (w.platformVersion || '?'),
          chrome: chrome ? chrome.version : '?',
          browser: browserName(alleMarken),
          marken: (alleMarken || []).map((b) => `${b.brand} ${b.version}`).join(', '),
          plattform: w.platform || navigator.userAgentData.platform || '',
          mobil: navigator.userAgentData.mobile ? 'ja' : 'nein'
        };
        return;
      }
    } catch (fehler) { /* Rückfall unten */ }
    const ua = navigator.userAgent;
    geraet = {
      modell: (ua.match(/Android [^;]+; ([^)]+)\)/) || [])[1] || '?',
      android: (ua.match(/Android ([\d.]+)/) || [])[1] || '?',
      chrome: (ua.match(/Chrome\/([\d.]+)/) || [])[1] || '?',
      browser: browserName(navigator.userAgentData ? navigator.userAgentData.brands : []),
      marken: navigator.userAgentData ? navigator.userAgentData.brands.map((b) => `${b.brand} ${b.version}`).join(', ') : '(keine)',
      plattform: navigator.userAgentData ? navigator.userAgentData.platform : '',
      mobil: navigator.userAgentData ? (navigator.userAgentData.mobile ? 'ja' : 'nein') : '?'
    };
  }

  function anzeigemodus() {
    for (const modus of ['fullscreen', 'standalone', 'minimal-ui']) {
      if (matchMedia(`(display-mode: ${modus})`).matches) return `installiert (${modus})`;
    }
    return 'Browser-Tab';
  }

  // =======================================================================
  // (B) Einstellungen des Geräts
  //     Datenstruktur Regel 7 / Antwort R3: Gerätewerte kommen nur beim
  //     ERSTEN Paket aus dem Paket. Nur am Gerät: Lautstärken, Crossfader,
  //     Auto-Mix an/aus, Party-Modus, „Hinweis bei Rückkehr“.
  // =======================================================================
  const STANDARD_EINSTELLUNGEN = {
    party: true,                 // Ralles Entscheidung: beim Start immer an
    hinweisRueckkehr: true,
    zuletztAnsicht: null,        // 'playdecker' | 'jukeboxer'
    werteAusPaket: false,        // true, sobald ein Paket die Gerätewerte gesetzt hat
    playdecker: { ...P.PLAYDECKER_STANDARD },
    jukeboxer: null,             // { wiedergabe, effekte, wahlmodus } aus dem ersten Paket
    genres: null,                // Genre-Belegung (10 Knöpfe)
    genresVonHand: false         // am Gerät von Hand geändert (Phase 3)
  };
  let einstellungen = JSON.parse(JSON.stringify(STANDARD_EINSTELLUNGEN));
  let paket = null;              // Kopf des gültigen Pakets (oder null)

  async function einstellungenLaden() {
    const gespeichert = await S.zustandLesen('einstellungen');
    // Lesen ist tolerant: Fehlende Felder bekommen den Standard.
    einstellungen = { ...JSON.parse(JSON.stringify(STANDARD_EINSTELLUNGEN)), ...(gespeichert || {}) };
    einstellungen.playdecker = { ...P.PLAYDECKER_STANDARD, ...(einstellungen.playdecker || {}) };
  }

  function einstellungenSpeichern() {
    return S.zustandSchreiben('einstellungen', einstellungen).catch((f) => protokoll('fehler', `Einstellungen nicht gespeichert: ${f.name}`));
  }

  const designPruefen = (kennung) => (window.PlayListerDesigns ? PlayListerDesigns.gueltig(kennung) : 'diner-chrom');
  const designPlaydecker = () => designPruefen(einstellungen.playdecker.design);
  const designJukeboxer = () => designPruefen(einstellungen.jukeboxer && einstellungen.jukeboxer.effekte && einstellungen.jukeboxer.effekte.design);

  // =======================================================================
  // (C) Module: PlayDecker (playdecker_app.js) und Jukeboxer
  //     (jukeboxer_app.js). Ihre Skripte stehen VOR app.js und legen nur
  //     eine Funktion „einrichten(app)“ unter window.JukeDeckerModule ab.
  //     Eingerichtet werden sie hier, bevor die App startet - so gibt es
  //     keine Abhängigkeit von der Ladereihenfolge.
  //     Was ein Modul liefert:
  //       spieltGerade() Wiedergabe läuft (Pause zählt nicht, CLAUDE.md
  //                      Party-Regel (4))
  //       tonLaeuft()    der Player meldet wirklich „läuft“ (nach der
  //                      Rückkehr: lief die Musik von selbst weiter?)
  //       weiter()       nach der Rückkehr den Weiter-Befehl geben
  //       anzeigen()     die Seite wird gezeigt (Start beim ersten Mal)
  //       songtext()     Knopf ♪ der Kopfleiste ('' = Fenster geöffnet,
  //                      sonst ein Hinweis)
  //       songtextDa()   wahlfrei (N4): hat der laufende Titel einen Text im
  //                      Paket? true / false / null (kein Titel)
  //       tonLiefVerborgen() wahlfrei (N7): lief der Ton weiter, während die
  //                      Seite verborgen war? (z. B. Chrome auf dem Tablet)
  //       gestartet()    ob das Modul schon läuft
  // =======================================================================
  const module = {
    playdecker: { spieltGerade: () => false },
    jukeboxer: { spieltGerade: () => false }
  };
  const modulFrage = (m, frage) => { try { return typeof m[frage] === 'function' ? !!m[frage]() : false; } catch (f) { return false; } };
  function musikLaeuft() {
    return Object.values(module).some((m) => modulFrage(m, 'spieltGerade'));
  }
  /** Party-Regel zwischen den Modulen: spielt ein ANDERES als „name“? */
  function anderesModulSpielt(name) {
    return Object.entries(module).some(([n, m]) => n !== name && modulFrage(m, 'spieltGerade'));
  }
  const irgendeinModulGestartet = () => Object.values(module).some((m) => modulFrage(m, 'gestartet'));

  // Der EINE Lader der YouTube-IFrame-API für beide Module. Es darf nur
  // einen geben - sonst überschreiben sich die Fertig-Meldungen.
  let youtubeLadung = null;
  function youtubeLaden() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (youtubeLadung) return youtubeLadung;
    youtubeLadung = new Promise((fertig, gescheitert) => {
      const vorher = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof vorher === 'function') vorher();
        protokoll('player', 'YouTube-Schnittstelle geladen.');
        fertig();
      };
      const skript = document.createElement('script');
      skript.src = 'https://www.youtube.com/iframe_api';
      skript.onerror = () => {
        youtubeLadung = null;
        protokoll('fehler', `YouTube-Schnittstelle nicht ladbar (online: ${navigator.onLine ? 'ja' : 'nein'}).`);
        gescheitert(new Error('YouTube ist nicht erreichbar. Ohne Internet gibt es keine Musik.'));
      };
      document.head.appendChild(skript);
    });
    return youtubeLadung;
  }

  // Ein Paket-Zugriff je Paket (Playlisten bleiben im Arbeitsspeicher).
  let paketQuelleSpeicher = null;
  function paketQuelle() {
    if (!paket) return null;
    if (!paketQuelleSpeicher || paketQuelleSpeicher.kennung !== paket.kennung) paketQuelleSpeicher = S.paketQuelle(paket.kennung);
    return paketQuelleSpeicher;
  }

  // Behälter für die schwebenden Songtext-Fenster (fest positioniert, also
  // nicht unter einem Element mit transform). Je Modul einer.
  function songtextAblage(name) {
    const ablage = document.createElement('div');
    ablage.className = 'stf-ablage';
    ablage.dataset.fuer = name;
    wurzel.appendChild(ablage);
    return ablage;
  }

  const groessenBeobachter = [];
  const istTablet = () => wurzel.classList.contains('tablet');

  /** Die Schnittstelle, die die Module vom Rahmen bekommen. */
  const appSchnittstelle = Object.freeze({
    protokoll, bandZeigen: (t, ms) => bandZeigen(t, ms),
    einstellungen: () => einstellungen,
    einstellungenSpeichern: () => einstellungenSpeichern(),
    paketQuelle, paket: () => paket,
    anderesModulSpielt, musikLaeuft: () => musikLaeuft(),
    youtubeLaden, songtextAblage, istTablet,
    beiGroesse: (fn) => groessenBeobachter.push(fn),
    designGeaendert: () => ansichtZeigen(aktuelleAnsicht),
    aktuelleAnsicht: () => aktuelleAnsicht,
    // N1: Der PlayDecker meldet hier jede Änderung aus SEINEM
    // Einstellungsfenster (Überblenddauer, Spielzeit, Drehung, Perspektive,
    // Design). Der Rahmen merkt sie sich im Gerätespeicher (sie gelten beim
    // nächsten Start) und zieht beim Design sein eigenes Aussehen nach.
    pdEinstellungGeaendert: (feld, wert) => pdEinstellungMerken(feld, wert),
    version: () => V
  });
  const modulSkripte = window.JukeDeckerModule || {};
  ['jukeboxer', 'playdecker'].forEach((name) => {
    if (!modulSkripte[name]) return;
    try {
      module[name] = modulSkripte[name].einrichten(appSchnittstelle);
    } catch (f) {
      protokoll('fehler', `Modul ${name} nicht eingerichtet: ${f.name}: ${f.message}`);
    }
  });

  // =======================================================================
  // (D) Ansichten
  // =======================================================================
  let aktuelleAnsicht = 'start';

  function ansichtZeigen(name, anlass) {
    if (name !== 'start' && !paket) name = 'start';            // ohne Paket nur die Startseite
    aktuelleAnsicht = name;
    ['start', 'playdecker', 'jukeboxer'].forEach((n) => { $(`#ansicht-${n}`).hidden = n !== name; });
    $$('#reiter [data-ansicht]').forEach((k) => k.classList.toggle('an', k.dataset.ansicht === name));
    // Wie am PC (vollbild.js): body[data-modul] - die Regel in der kopierten
    // style.css blendet damit das Songtext-Fenster des jeweils ANDEREN
    // Moduls aus (Ablagen data-fuer="deck" bzw. "jukebox").
    document.body.dataset.modul = name === 'playdecker' ? 'deck' : name === 'jukeboxer' ? 'jukebox' : 'start';
    kopfleisteAnpassen();
    // Der Rahmen trägt das Design der gezeigten Seite; die Startseite das
    // der zuletzt benutzten (Annahme Phase 2, siehe Statusbericht).
    const fuer = name === 'start' ? (einstellungen.zuletztAnsicht || 'playdecker') : name;
    PlayListerDesigns.setzen(wurzel, fuer === 'jukeboxer' ? designJukeboxer() : designPlaydecker());
    if (name !== 'start' && einstellungen.zuletztAnsicht !== name) {
      einstellungen.zuletztAnsicht = name;
      einstellungenSpeichern();
    }
    if (anlass) protokoll('app', `Ansicht ${name} (${anlass})`);
    // Das Modul beim ersten Zeigen starten (vorher kein Player, kein YouTube).
    if (name !== 'start' && module[name] && module[name].anzeigen) {
      try { module[name].anzeigen(); } catch (f) { protokoll('fehler', `Modul ${name}: ${f.name}: ${f.message}`); }
    }
  }

  function kopfleisteAnpassen() {
    const modul = aktuelleAnsicht !== 'start';
    $('#reiter').hidden = !modul;
    $('#songtext-knopf').hidden = !modul;
    $('#songtext-knopf').disabled = !modul || !module[aktuelleAnsicht] || !module[aktuelleAnsicht].songtext;
    $('#party-knopf').hidden = !paket;          // Bild 2 zeigt nur ⚙
  }

  // Knopf ♪ (Kopfleiste): Songtext-Fenster des gezeigten Moduls.
  $('#songtext-knopf').addEventListener('click', () => {
    const m = module[aktuelleAnsicht];
    if (!m || !m.songtext) return;
    const hinweis = m.songtext();
    if (hinweis) bandZeigen(hinweis, 3500);
  });

  // N4 (1C): Der Knopf ♪ zeigt, ob der LAUFENDE Titel einen Songtext im
  // Paket hat. Hat er keinen, wird der Knopf abgeblendet (Klasse
  // „ohne-text“), bleibt aber antippbar - dann kommt wie bisher der Hinweis
  // aus dem Songtext-Fenster. Nachgesehen wird jede Sekunde (ein Blick in
  // eine Menge im Arbeitsspeicher, kostet nichts).
  function songtextKnopfNachfuehren() {
    const knopf = $('#songtext-knopf');
    const m = module[aktuelleAnsicht];
    let da = null;
    try { da = m && typeof m.songtextDa === 'function' ? m.songtextDa() : null; } catch (f) { da = null; }
    knopf.classList.toggle('ohne-text', da === false);
    knopf.title = da === false ? 'Zum laufenden Titel liegt kein Songtext im Paket.'
      : da === true ? 'Songtext des laufenden Titels (im Paket vorhanden)' : 'Songtext des laufenden Titels';
  }
  setInterval(songtextKnopfNachfuehren, 1000);

  // =======================================================================
  // (E) Startseite
  // =======================================================================
  function paketBeschreibung(kopf) {
    const i = kopf.inhalt || {};
    return `Paket vom ${P.datumText(kopf.erstellt)} · ${zahl(i.playlisten)} Playlisten · ${zahl(i.titel)} Titel · ${zahl(i.cover)} Cover`
      + (i.songtexte ? ` · ${zahl(i.songtexte)} Songtexte` : ' · ohne Songtexte');
  }

  function startseiteZeichnen() {
    $('#start-mit-paket').hidden = !paket;
    $('#start-ohne-paket').hidden = !!paket;
    // Nachbesserung 3, L4: reine Anzeige - Antippen bewirkt nichts.
    if (paket) $('#paketzeile-text').innerHTML = `<b>${escapen(paketBeschreibung(paket))}</b>`;
    // L4 (2C): Ohne Paket leuchtet das ⚙ oben rechts - der einzige Weg zur
    // Dateiarbeit („Neues Paket laden …“). Mit Paket leuchtet es nicht.
    $('#einstellungen-knopf').classList.toggle('leuchtet', !paket);
    $('#start-version').textContent = V.titel;
    $('#start-version-erst').textContent = V.titel;
    kopfleisteAnpassen();
  }

  // =======================================================================
  // (F) Paket-Dialog: Prüfen, Vergleichen, Übernehmen (Bilder 3 und 4)
  // =======================================================================
  const GETEILT_SPEICHER = 'jukedecker-geteilt';
  let dialogErgebnis = null;
  let sperrTakt = null;

  /** Die geteilte Datei aus dem Zwischenspeicher des Service Workers entfernen. */
  async function geteiltLoeschen() {
    try {
      const speicher = await caches.open(GETEILT_SPEICHER);
      await speicher.delete('geteilt/datei');
      await speicher.delete('geteilt/angaben');
    } catch (f) { /* nichts da */ }
  }

  function paketDialogOeffnen() {
    $('#paket-schleier').hidden = false;
  }

  function paketDialogSchliessen() {
    $('#paket-schleier').hidden = true;
    dialogErgebnis = null;
    if (sperrTakt) { clearInterval(sperrTakt); sperrTakt = null; }
  }

  /** Datei prüfen und das Ergebnis zeigen. weg: 'Teilen' | 'Dateiauswahl'. */
  async function paketPruefenUndZeigen(datei, weg, name) {
    $('#paket-titel').className = '';
    $('#paket-titel').textContent = 'PRÜFE …';
    $('#paket-inhalt').innerHTML = `<div class="jd-hinweis">Das Paket wird geprüft (${mb(datei.size)}).</div>`;
    $('#paket-knoepfe').innerHTML = '';
    paketDialogOeffnen();
    const tv = await P.testvektorenPruefen();
    const ergebnis = await P.dateiLesen(datei, weg, name);
    const z = ergebnis.zeiten;
    protokoll('paket', `Datei angekommen ueber ${weg}: ${datei.size} Bytes, Typ "${datei.type || '(leer)'}", Lesen ${z.lesenMs ?? '-'} ms, Zerlegen ${z.zerlegenMs ?? '-'} ms, Pruefen ${z.pruefenMs ?? '-'} ms. Testvektoren: ${tv.map((t) => `V${t.version} ${t.ok ? 'ok' : 'FALSCH'}`).join(', ')}.`);
    if (!ergebnis.ok) {
      protokoll('paket', `Abgelehnt: Art ${ergebnis.art}, ${ergebnis.fehler.length} Fehler.`);
      paketAbgelehntZeigen(ergebnis);
      return;
    }
    const a = ergebnis.angaben;
    protokoll('paket', `Geprueft: Version ${a.version}, Pruefsumme stimmt (${a.pruefzeitMs} ms), ${a.playlisten} Playlisten, ${a.titel} Titel, ${a.cover} Cover (${a.coverBilddaten} Bytes), ${a.songtexte} Songtexte, ${a.genreBelegt} Genre-Tasten belegt, ${ergebnis.hinweise.length} Hinweise.`);
    dialogErgebnis = ergebnis;
    paketGeprueftZeigen(ergebnis);
  }

  function zeile(name, wert, klasse) {
    return `<dt>${escapen(name)}</dt><dd${klasse ? ` class="${klasse}"` : ''}>${wert}</dd>`;
  }

  function einzelheiten(titel, liste) {
    if (!liste.length) return '';
    const punkte = liste.slice(0, 30).map((t, i) => `<li>(${i + 1}) ${escapen(t)}</li>`).join('');
    return `<details class="einzelheiten"><summary>${escapen(titel)} (${liste.length})</summary><ul>${punkte}</ul>`
      + (liste.length > 30 ? `<div class="jd-hinweis">… und ${liste.length - 30} weitere.</div>` : '') + '</details>';
  }

  function paketGeprueftZeigen(ergebnis) {
    const a = ergebnis.angaben;
    const vergleich = P.vergleichen(ergebnis, paket, einstellungen);
    $('#paket-titel').className = '';
    $('#paket-titel').textContent = '✔ NEUES PAKET ANGEKOMMEN';
    let geraetText;
    if (vergleich.altesPaket) {
      const alt = vergleich.altesPaket;
      geraetText = `Paket vom ${escapen(P.datumText(alt.erstellt))} (${zahl(alt.inhalt.playlisten)} Playlisten, ${zahl(alt.inhalt.titel)} Titel) – wird <b>ersetzt</b>. `
        + (vergleich.erstesPaket ? 'Designs und Einstellungen kommen aus diesem Paket.' : 'Designs und Einstellungen bleiben, wie du sie am Gerät gewählt hast.');
    } else {
      geraetText = 'Noch kein Paket auf dem Gerät. '
        + (vergleich.erstesPaket ? 'Designs und Einstellungen kommen aus diesem Paket, danach gelten die Werte am Gerät.'
          : 'Designs und Einstellungen bleiben, wie du sie am Gerät gewählt hast.');
    }
    let genre = '';
    if (vergleich.genreFrage) {
      genre = `<label class="jd-zeile haekchen"><input type="checkbox" id="genre-vom-pc"> Genre-Belegung vom PC übernehmen</label>`
        + (vergleich.genreVerlust.length
          ? `<div class="jd-hinweis">Ohne Häkchen bleiben Knopf ${vergleich.genreVerlust.join(', ')} leer, weil ihre Playlist nicht im neuen Paket ist.</div>` : '');
    }
    $('#paket-inhalt').innerHTML = `
      <div class="zwei-spalten">
        <div><div class="abschnitt">Prüfung</div><dl class="jd-tab">
          ${zeile('Weg', escapen(ergebnis.weg))}
          ${zeile('Größe', groesseText(ergebnis.datei.groesse))}
          ${zeile('Prüfsumme', '✔ stimmt', 'ok')}
          ${zeile('Erstellt', escapen(P.datumText(a.erstellt)))}
          ${zeile('Stand Paket', `Version ${a.version} <span class="ok">✔ passt</span>`)}
        </dl></div>
        <div><div class="abschnitt">Inhalt</div><dl class="jd-tab">
          ${zeile('Playlisten', zahl(a.playlisten))}
          ${zeile('Titel', zahl(a.titel))}
          ${zeile('Cover', zahl(a.cover))}
          ${zeile('Songtexte', zahl(a.songtexte))}
          ${zeile('Genre-Tasten', a.mitJukeboxer ? `${a.genreBelegt} belegt` : 'keine Angabe')}
        </dl></div>
      </div>
      <div class="abschnitt">Auf dem Gerät</div>
      <div class="jd-hinweis gross">${geraetText}</div>
      ${genre}
      ${einzelheiten('Hinweise', ergebnis.hinweise)}
      <div class="jd-hinweis warnung" id="musik-sperre" hidden>Erst Musik anhalten. „Übernehmen“ ist gesperrt, solange Musik läuft.</div>`;
    $('#paket-knoepfe').innerHTML = `<button type="button" class="jd-knopf gross" id="paket-abbrechen">ABBRECHEN</button>
      <button type="button" class="jd-knopf gross voll" id="paket-uebernehmen">ÜBERNEHMEN</button>`;
    $('#paket-abbrechen').addEventListener('click', async () => {
      await geteiltLoeschen();
      protokoll('paket', 'Abgebrochen - geteilte Datei geloescht, nichts uebernommen.');
      paketDialogSchliessen();
    });
    $('#paket-uebernehmen').addEventListener('click', () => paketUebernehmen());
    // Party-Regel: Solange Musik läuft, ist „Übernehmen“ gesperrt. Der
    // Zustand wird laufend nachgesehen – hält jemand die Musik an, wird der
    // Knopf sofort frei.
    const sperreAnpassen = () => {
      const laeuft = musikLaeuft();
      const knopf = $('#paket-uebernehmen');
      if (!knopf) return;
      if (knopf.dataset.laeuft !== 'ja') knopf.disabled = laeuft;
      $('#musik-sperre').hidden = !laeuft;
    };
    sperreAnpassen();
    sperrTakt = setInterval(sperreAnpassen, 500);
  }

  function paketAbgelehntZeigen(ergebnis, zusatz) {
    $('#paket-titel').className = 'rot';
    $('#paket-titel').textContent = '✖ DATEI NICHT ÜBERNOMMEN';
    const datei = ergebnis.datei || {};
    let wasJetzt;
    if (ergebnis.art === 'version') {
      wasJetzt = 'Die App einmal mit Internet öffnen, dann holt sie sich die neue Fassung. Danach das Paket erneut teilen.';
    } else if (ergebnis.art === 'speicher') {
      wasJetzt = 'Auf dem Gerät Platz schaffen (z. B. Fotos oder Downloads löschen) und das Paket erneut teilen.';
    } else {
      wasJetzt = 'Erzeuge im PlayLister unter „Für JukeDecker“ ein neues Paket und teile es erneut.';
    }
    const bisher = paket
      ? `Dein bisheriges Paket (${escapen(P.datumText(paket.erstellt))}, ${zahl(paket.inhalt.playlisten)} Playlisten) bleibt unverändert. `
      : 'Auf dem Gerät liegt weiter kein Paket. ';
    $('#paket-inhalt').innerHTML = `<dl class="jd-tab">
        ${zeile('Datei', escapen(datei.name || '(ohne Namen)'))}
        ${zeile('Größe', groesseText(datei.groesse))}
        ${zeile('Grund', escapen(ergebnis.grund), 'fehl')}
      </dl>
      <div class="abschnitt">Was jetzt?</div>
      <div class="jd-hinweis gross">${bisher}${escapen(wasJetzt)}${zusatz ? ' ' + escapen(zusatz) : ''}</div>
      ${einzelheiten('Einzelheiten', ergebnis.fehler || [])}`;
    $('#paket-knoepfe').innerHTML = '<button type="button" class="jd-knopf gross voll" id="paket-schliessen">SCHLIESSEN</button>';
    $('#paket-schliessen').addEventListener('click', async () => {
      await geteiltLoeschen();
      paketDialogSchliessen();
    });
  }

  async function paketUebernehmen() {
    const ergebnis = dialogErgebnis;
    if (!ergebnis) return;
    if (musikLaeuft()) return;                                  // Party-Regel (Knopf ist ohnehin gesperrt)
    const knopf = $('#paket-uebernehmen');
    knopf.dataset.laeuft = 'ja';
    knopf.disabled = true;
    $('#paket-abbrechen').disabled = true;
    knopf.textContent = 'ÜBERNEHME …';
    const genreVomPc = !!($('#genre-vom-pc') && $('#genre-vom-pc').checked);
    try {
      const r = await P.uebernehmen(ergebnis, einstellungen, genreVomPc);
      einstellungen = r.einstellungen;
      paket = await S.aktivesPaket();
      protokoll('paket', `Uebernommen in einem Zug: Schreiben ${r.zeiten.schreibenMs} ms, Umschalten ${r.zeiten.umschaltenMs} ms, `
        + `altes Paket ${r.hatteAltes ? (r.altGeloescht ? `geloescht in ${r.zeiten.loeschenMs} ms` : 'NICHT geloescht (wird beim naechsten Start weggeraeumt)') : 'gab es nicht'}. `
        + `Genre-Belegung ${genreVomPc ? 'vom PC uebernommen' : 'nach Regel'}.`);
      await geteiltLoeschen();
      paketDialogSchliessen();
      // Laufen PlayDecker oder Jukeboxer schon, kennen sie noch die
      // Playlisten des alten Pakets. Dann lädt die Seite einmal neu - das
      // ist erlaubt, weil „Übernehmen“ nur bei angehaltener Musik geht
      // (Party-Regel). Die neue Ansicht startet mit dem neuen Paket.
      if (irgendeinModulGestartet()) {
        protokoll('paket', 'Module liefen schon - Seite wird mit dem neuen Paket neu geladen.');
        bandZeigen('✔ Paket übernommen – die App startet mit dem neuen Paket neu …', 1500);
        setTimeout(() => location.reload(), 1200);
        return;
      }
      startseiteZeichnen();
      ansichtZeigen(aktuelleAnsicht);
      bandZeigen(`✔ Paket übernommen: ${zahl(paket.inhalt.playlisten)} Playlisten, ${zahl(paket.inhalt.titel)} Titel.`, 4000);
    } catch (f) {
      protokoll('paket', `Uebernehmen gescheitert: Art ${f.art || '?'} (${f.technisch || f.name || ''}) - altes Paket gilt weiter.`);
      paketAbgelehntZeigen({ ...ergebnis, art: f.art || 'schreiben', grund: f.grund || 'Das Paket konnte nicht gespeichert werden.', fehler: [] });
    }
  }

  /** Ausweichweg: „Paket laden“ öffnet die Dateiauswahl des Geräts. */
  function dateiAuswaehlen() {
    const wahl = $('#datei-wahl');
    wahl.value = '';
    wahl.click();
  }
  $('#datei-wahl').addEventListener('change', () => {
    const datei = $('#datei-wahl').files[0];
    if (datei) {
      einstellungenSchliessen();
      paketPruefenUndZeigen(datei, 'Dateiauswahl', datei.name);
    }
  });

  /** Kam ein Paket über „Teilen“? Der Service Worker hat es abgelegt. */
  async function geteiltesAbholen() {
    const adresse = new URL(location.href);
    const ueberTeilen = adresse.searchParams.has('geteilt');
    if (ueberTeilen) {
      // Adresse bereinigen, damit ein Neuladen nicht erneut einliest.
      adresse.searchParams.delete('geteilt');
      history.replaceState(null, '', adresse.pathname + adresse.search);
    }
    let speicher;
    try { speicher = await caches.open(GETEILT_SPEICHER); } catch (f) { return; }
    const angabenAntwort = await speicher.match('geteilt/angaben');
    if (!angabenAntwort) {
      if (ueberTeilen) protokoll('paket', 'Seite ueber "Teilen" geoeffnet, aber der Service Worker hat nichts abgelegt.');
      return;
    }
    const angaben = await angabenAntwort.json();
    protokoll('paket', `Teilen: ${angaben.dateien} Datei(en), ${angaben.groesse} Bytes, gemeldeter Typ "${angaben.typ}", Endung ${angaben.endung || '-'}${ueberTeilen ? '' : ' (wartete noch auf eine Entscheidung)'}.`);
    const dateiAntwort = await speicher.match('geteilt/datei');
    if (angaben.fehler || !dateiAntwort) {
      paketDialogOeffnen();
      paketAbgelehntZeigen({ datei: { name: '', groesse: undefined }, art: 'format',
        grund: angaben.fehler ? 'Die geteilte Datei kam nicht lesbar an.' : 'Es kam keine Datei an (nur Text geteilt?).', fehler: [] });
      return;
    }
    const blob = await dateiAntwort.blob();
    await paketPruefenUndZeigen(blob, 'Teilen', angaben.name || '');
  }

  // =======================================================================
  // (G) Fenster „⚙ JukeDecker“ (App-weit, Nachbesserung 1 N1; seit
  //     Nachbesserung 2 M1 rollbar mit drei Abschnitten)
  //     (1) Dateiarbeit: Paket auf dem Gerät, „Neues Paket laden …“, „Paket
  //         löschen“, „Protokoll als Datei speichern“, „Protokoll leeren“
  //     (2) Bildschirm und Party-Modus (mit dem Hinweis aus N6)
  //     (3) Über JukeDecker: Version, Speicher, Browser
  // =======================================================================
  function einstellungenZeichnen() {
    $('#e-party').checked = !!einstellungen.party;
    $('#e-rueckkehr').checked = !!einstellungen.hinweisRueckkehr;
    // (1) Paket auf dem Gerät: Datum, Größe, Playlisten, Titel, Cover, Songtexte
    const angaben = $('#e-paket-angaben');
    if (paket) {
      const i = paket.inhalt || {};
      angaben.innerHTML = zeile('Erstellt', escapen(P.datumText(paket.erstellt)))
        + zeile('Größe', groesseText(paket.bytes))
        + zeile('Playlisten', zahl(i.playlisten))
        + zeile('Titel', zahl(i.titel))
        + zeile('Cover', zahl(i.cover))
        + zeile('Songtexte', i.songtexte ? zahl(i.songtexte) : 'keine');
    } else {
      angaben.innerHTML = zeile('Paket', 'keines auf dem Gerät', 'fehl');
    }
    $('#e-paket-leer').hidden = !!paket;
    $('#e-loeschen').disabled = !paket;
    // Protokoll: wie viele Einträge liegen auf dem Gerät?
    S.protokollLesen().then((liste) => {
      $('#e-protokoll-stand').textContent = `Protokoll auf dem Gerät: ${zahl(liste.length)} Einträge (höchstens ${zahl(S.PROTOKOLL_HOECHSTENS)}, die ältesten fallen weg)`;
      $('#e-protokoll-leeren').disabled = !liste.length;
    }).catch(() => { $('#e-protokoll-stand').textContent = 'Protokoll nicht lesbar'; });
    // (3) Über JukeDecker
    $('#e-version').textContent = V.titel;
    $('#e-browser').textContent = `${geraet.browser} · ${anzeigemodus()}`;
    S.speicherSchaetzung().then((schaetzung) => {
      $('#e-speicher').textContent = schaetzung ? `${mb(schaetzung.usage || 0)} belegt` : 'Angabe nicht verfügbar';
    });
  }

  /**
   * Öffnet das Fenster „⚙ JukeDecker“, oben beginnend - der erste Abschnitt
   * ist die Dateiarbeit. Seit Nachbesserung 3 (L4) ist das ⚙ oben rechts der
   * EINZIGE Weg dorthin (Startseite: Paketzeile nur Anzeige, beim ersten
   * Start kein Knopf „Paket auswählen …“ mehr).
   */
  function einstellungenOeffnen() {
    einstellungenZeichnen();
    $('#einst-schleier').hidden = false;
    $('#einst-rolle').scrollTop = 0;
    $('#einst-zu').focus();
  }
  function einstellungenSchliessen() {
    if ($('#einst-schleier').hidden) return;
    $('#einst-schleier').hidden = true;
    $('#einstellungen-knopf').focus();
  }

  /**
   * N1: Ein Wert aus dem Einstellungsfenster DES PLAYDECKERS (Knopf
   * „⚙ Einstellungen“ im Pult). Der Kern hat ihn schon angewendet (sofort,
   * ohne Unterbrechung der Wiedergabe); hier wird er nur für den nächsten
   * Start gemerkt (Gerätewert, Antwort R3: Werte am Gerät haben Vorrang vor
   * dem Paket). Beim Design zieht der Rahmen (Kopfleiste) mit.
   * Felder: blendSekunden, spielzeit (Sekunden), drehungSekunden,
   * perspektive, design.
   */
  function pdEinstellungMerken(feld, wert) {
    if (!['blendSekunden', 'spielzeit', 'drehungSekunden', 'perspektive', 'design'].includes(feld)) return;
    if (feld === 'design') wert = designPruefen(wert);
    if (einstellungen.playdecker[feld] === wert) return;
    einstellungen.playdecker[feld] = wert;
    einstellungenSpeichern();
    if (feld === 'design') ansichtZeigen(aktuelleAnsicht);
  }
  $('#e-party').addEventListener('change', () => partySchalten($('#e-party').checked));
  $('#e-rueckkehr').addEventListener('change', () => {
    einstellungen.hinweisRueckkehr = $('#e-rueckkehr').checked;
    einstellungenSpeichern();
  });
  $('#e-protokoll').addEventListener('click', () => protokollSpeichern().catch((f) => protokoll('fehler', `Protokoll speichern: ${f.name}`)));
  // M1 (1A5): „Protokoll leeren“ mit Rückfrage - damit eine neue Messung
  // sauber anfängt. Der erste Eintrag danach sagt, dass geleert wurde (so
  // sieht man es auch der hochgeladenen Datei an).
  $('#e-protokoll-leeren').addEventListener('click', () => {
    frageStellen('PROTOKOLL LEEREN?',
      'Alle Einträge des Protokolls werden vom Gerät gelöscht. Das lässt sich nicht rückgängig machen. Wer das Protokoll noch braucht, speichert es vorher als Datei. Paket und Einstellungen bleiben.',
      'LEEREN', async () => {
        try {
          const anzahl = await S.protokollLeeren();
          protokoll('app', `Protokoll von Hand geleert (${anzahl} Eintraege geloescht). ${V.titel}, Geraet ${geraet.modell}, Browser ${geraet.browser}.`);
          bandZeigen(`✔ Protokoll geleert (${zahl(anzahl)} Einträge gelöscht).`, 4000);
        } catch (f) {
          protokoll('fehler', `Protokoll leeren: ${f.name}`);
          bandZeigen('Das Protokoll ließ sich nicht leeren.', 4000);
        }
        if (!$('#einst-schleier').hidden) einstellungenZeichnen();
      });
  });
  $('#e-loeschen').addEventListener('click', () => {
    if (!paket) return;
    if (musikLaeuft()) { bandZeigen('Erst Musik anhalten – während Musik läuft, wird kein Paket gelöscht.', 4000); return; }
    frageStellen('PAKET LÖSCHEN?',
      `Das Paket vom ${P.datumText(paket.erstellt)} wird vom Gerät entfernt: Playlisten, Cover und Songtexte. Das lässt sich nicht rückgängig machen. Deine Einstellungen bleiben. Danach lädst du unter „Neues Paket laden …“ ein neues.`,
      'LÖSCHEN', async () => {
        if (musikLaeuft()) return;
        const kennung = await S.aktivesPaketEntfernen();
        protokoll('paket', `Paket von Hand geloescht (Kennung ${kennung}).`);
        paket = null;
        einstellungenSchliessen();
        // Liefen die Module schon, halten sie noch Player und Playlisten des
        // gelöschten Pakets - neu laden (die Musik ist ja angehalten).
        if (irgendeinModulGestartet()) { setTimeout(() => location.reload(), 300); return; }
        startseiteZeichnen();
        ansichtZeigen('start');
      });
  });
  $('#einst-zu').addEventListener('click', einstellungenSchliessen);
  $('#einst-schleier').addEventListener('click', (e) => { if (e.target === $('#einst-schleier')) einstellungenSchliessen(); });

  // Rückfrage-Fenster (z. B. Paket löschen)
  function frageStellen(titel, text, jaText, beiJa) {
    $('#frage-titel').textContent = titel;
    $('#frage-text').textContent = text;
    $('#frage-ja').textContent = jaText;
    $('#frage-schleier').hidden = false;
    const schliessen = () => { $('#frage-schleier').hidden = true; $('#frage-ja').onclick = null; $('#frage-nein').onclick = null; };
    $('#frage-nein').onclick = schliessen;
    $('#frage-ja').onclick = () => { schliessen(); beiJa(); };
    $('#frage-nein').focus();
  }

  // =======================================================================
  // (H) Party-Modus: Bildschirm bleibt an (Wake Lock), Rückkehr-Band
  //     Gemessen: Android gibt den Wake Lock beim App-Wechsel frei → bei
  //     jeder Rückkehr neu anfordern. Die Helligkeit bleibt unverändert.
  // =======================================================================
  let wachSperre = null;
  let wachZustand = 'aus';           // 'aktiv' | 'wartet' | 'aus' | 'fehlt'

  async function wachHalten(anlass) {
    if (!einstellungen.party) { wachZustand = 'aus'; partyAnzeigen(); return; }
    if (!('wakeLock' in navigator)) {
      wachZustand = 'fehlt';
      protokoll('wakelock', `${anlass}: Wake Lock wird von diesem Browser nicht unterstuetzt.`);
      partyAnzeigen();
      return;
    }
    if (document.visibilityState !== 'visible') return;
    if (wachSperre && !wachSperre.released) { wachZustand = 'aktiv'; partyAnzeigen(); return; }
    try {
      wachSperre = await navigator.wakeLock.request('screen');
      wachZustand = 'aktiv';
      protokoll('wakelock', `${anlass}: angefordert - aktiv.`);
      wachSperre.addEventListener('release', () => {
        protokoll('wakelock', 'freigegeben (App-Wechsel, Sperre oder ausgeschaltet).');
        if (einstellungen.party) wachZustand = 'wartet';
        partyAnzeigen();
      });
    } catch (f) {
      wachZustand = 'wartet';
      protokoll('wakelock', `${anlass}: abgelehnt - ${f.name}: ${f.message}`);
    }
    partyAnzeigen();
  }

  function partyAnzeigen() {
    const knopf = $('#party-knopf');
    knopf.classList.toggle('aus', !einstellungen.party);
    knopf.classList.toggle('wartet', einstellungen.party && wachZustand !== 'aktiv');
    knopf.setAttribute('aria-pressed', String(!!einstellungen.party));
    knopf.title = !einstellungen.party ? 'Party-Modus aus: Der Bildschirm darf ausgehen. Antippen schaltet ein.'
      : wachZustand === 'aktiv' ? 'Party-Modus an: Der Bildschirm bleibt an. Antippen schaltet aus.'
        : wachZustand === 'fehlt' ? 'Party-Modus an, aber dieser Browser kann den Bildschirm nicht wach halten.'
          : 'Party-Modus an, der Bildschirm wird beim nächsten Antippen wieder wach gehalten.';
  }

  async function partySchalten(an) {
    einstellungen.party = !!an;
    einstellungenSpeichern();
    protokoll('wakelock', `Party-Modus ${an ? 'eingeschaltet' : 'ausgeschaltet'} (Knopf).`);
    if (an) {
      await wachHalten('Party eingeschaltet');
    } else {
      if (wachSperre && !wachSperre.released) { try { await wachSperre.release(); } catch (f) { /* egal */ } }
      wachZustand = 'aus';
      // N6: die erste Messung gleich nach dem Ausschalten, dann jede Minute.
      setTimeout(partyAusMessen, 500);
    }
    partyAnzeigen();
    if (!$('#einst-schleier').hidden) $('#e-party').checked = !!einstellungen.party;
  }
  $('#party-knopf').addEventListener('click', () => partySchalten(!einstellungen.party));

  // -----------------------------------------------------------------------
  // N6 (Nachbesserung 1): ERST MESSEN, DANN ÄNDERN. Ralles Befund: Mit
  // „Party aus“ bleibt der Bildschirm trotzdem an. Das Protokoll zeigt, dass
  // die App ihren Wake Lock freigibt. Vermutung: Android/Chrome hält den
  // Bildschirm selbst an, solange ein Video (der YouTube-Player) läuft.
  // Damit das belegbar wird, schreibt die App bei „Party aus“ JEDE MINUTE
  // einen Eintrag: Wake Lock gehalten ja/nein, spielt ein Player ja/nein,
  // Seite sichtbar ja/nein - dazu, wie lange die letzte Berührung her ist
  // (zum Abgleich mit der Bildschirmzeit in den Android-Einstellungen).
  // Geht der Bildschirm aus, steht kurz danach „verborgen“ im Protokoll.
  // -----------------------------------------------------------------------
  let letzteBeruehrung = Date.now();
  ['pointerdown', 'keydown'].forEach((art) => document.addEventListener(art, () => { letzteBeruehrung = Date.now(); }, true));
  function partyAusMessen() {
    if (einstellungen.party) return;
    const gehalten = !!(wachSperre && !wachSperre.released);
    const spielend = Object.entries(module).filter(([, m]) => modulFrage(m, 'tonLaeuft')).map(([n]) => n);
    protokoll('wakelock', `Party aus - Messung: Wake Lock gehalten: ${gehalten ? 'ja' : 'nein'}, `
      + `spielt ein Player: ${spielend.length ? `ja (${spielend.join(', ')})` : 'nein'}, `
      + `Seite sichtbar: ${document.visibilityState === 'visible' ? 'ja' : 'nein'}, `
      + `letzte Beruehrung vor ${Math.round((Date.now() - letzteBeruehrung) / 1000)} s.`);
  }
  setInterval(partyAusMessen, 60000);

  // Grünes Band (Bild 9): kurz oben eingeblendet.
  let bandZeitgeber = null;
  function bandZeigen(text, dauerMs) {
    const band = $('#band');
    band.textContent = text;
    band.hidden = false;
    clearTimeout(bandZeitgeber);
    bandZeitgeber = setTimeout(() => { band.hidden = true; }, dauerMs || 4000);
  }

  // Sichtbarkeit: Verlassen und Rückkehr. Lief beim Verlassen Musik, wird
  // nach der Rückkehr 3 s gewartet (gemessen: sie läuft in 3 von 3 Fällen
  // von selbst weiter). Läuft sie dann nicht, bekommen die Module den
  // Weiter-Befehl. Das grüne Band kommt nur, wenn vorher Musik lief und
  // „Hinweis bei Rückkehr“ an ist.
  let verlassenUm = null;
  let musikLiefBeimVerlassen = false;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      verlassenUm = Date.now();
      musikLiefBeimVerlassen = musikLaeuft();
      protokoll('sichtbarkeit', `verborgen (Musik lief: ${musikLiefBeimVerlassen ? 'ja' : 'nein'}).`);
      return;
    }
    const pauseSekunden = verlassenUm ? Math.round((Date.now() - verlassenUm) / 1000) : 0;
    protokoll('sichtbarkeit', `wieder sichtbar nach ${pauseSekunden} s.`);
    wachHalten('Rueckkehr');
    if (!musikLiefBeimVerlassen) return;
    setTimeout(() => {
      // Entschieden wird am ZUSTAND des Players (Lehre M17C): Läuft der Ton
      // wirklich? „Soll spielen“ allein genügt nicht - das System kann den
      // Player angehalten haben, während das Modul weiter „spielt“.
      const spielend = Object.entries(module).filter(([, m]) => modulFrage(m, 'spieltGerade'));
      const stumm = spielend.filter(([, m]) => typeof m.tonLaeuft === 'function' && !modulFrage(m, 'tonLaeuft'));
      if (!spielend.length) {
        protokoll('player', 'Rueckkehr: Musik ist inzwischen angehalten (von Hand) - kein Weiter-Befehl.');
        return;
      }
      // N7: Hat der Browser den Ton gar nicht angehalten (z. B. Chrome auf dem
      // Tablet), lief die Musik die ganze Zeit - das Band soll dann nicht
      // „war angehalten“ behaupten. Die Module wissen es (Position lief
      // während der verborgenen Zeit weiter).
      const liefWeiter = spielend.some(([, m]) => modulFrage(m, 'tonLiefVerborgen'));
      protokoll('player', `Rueckkehr: ${stumm.length ? `Ton steht bei ${stumm.map(([n]) => n).join(', ')} - Weiter-Befehl`
        : liefWeiter ? 'Musik lief waehrend der verborgenen Zeit weiter (der Browser hat den Ton nicht angehalten)'
          : 'Musik laeuft von selbst weiter'}.`);
      stumm.forEach(([, m]) => { try { if (m.weiter) m.weiter(); } catch (f) { /* egal */ } });
      if (einstellungen.hinweisRueckkehr) {
        bandZeigen(liefWeiter && !stumm.length ? '▶ Willkommen zurück – die Musik lief weiter.'
          : `▶ Willkommen zurück – die Musik war ${pauseSekunden} s angehalten und läuft weiter.`, 4000);
      }
    }, 3000);
  });

  // =======================================================================
  // (I) Fenster: Hochformat-Hinweis, Handy/Tablet, Protokoll jeder Größe
  //     Hochformat wird an der FENSTERGRÖSSE erkannt, nicht an
  //     screen.orientation (das Messprotokoll zeigt „portrait-primary“ bei
  //     einem Fenster von 728 × 328).
  // =======================================================================
  let fensterTakt = null;
  let letzteFenster = '';
  function fensterAnpassen(anlass) {
    const hoch = innerHeight > innerWidth;
    $('#hochformat').hidden = !hoch;
    // Umschaltschwelle 1000 px Breite: darunter Handy-, darüber Tablet-Aufbau.
    const warTablet = wurzel.classList.contains('tablet');
    wurzel.classList.toggle('tablet', innerWidth >= 1000);
    wurzel.classList.toggle('niedrig', innerHeight < 300);
    if (warTablet !== wurzel.classList.contains('tablet')) {
      groessenBeobachter.forEach((fn) => { try { fn(); } catch (f) { /* egal */ } });
    }
    clearTimeout(fensterTakt);
    fensterTakt = setTimeout(() => {
      const o = screen.orientation ? screen.orientation.type : '?';
      const text = `Fenster ${innerWidth} x ${innerHeight}, Ausrichtung ${o}, Hochformat-Hinweis ${hoch ? 'an' : 'aus'}, Aufbau ${innerWidth >= 1000 ? 'Tablet' : 'Handy'}`;
      if (text !== letzteFenster) {
        letzteFenster = text;
        protokoll('fenster', `${anlass || 'Groesse geaendert'}: ${text}.`);
      }
    }, anlass === 'Start' ? 0 : 400);
  }
  window.addEventListener('resize', () => fensterAnpassen());
  if (screen.orientation) screen.orientation.addEventListener('change', () => fensterAnpassen('Gedreht'));

  // =======================================================================
  // (J) Service Worker: Offline-Betrieb und Annahme geteilter Pakete
  //     Eine neue Fassung wird im Hintergrund geladen und gilt ab dem
  //     nächsten Öffnen – die Seite lädt sich NIE selbst neu (Party-Regel).
  // =======================================================================
  async function serviceWorkerAnmelden() {
    if (!('serviceWorker' in navigator)) {
      protokoll('app', 'Service Worker nicht verfuegbar - kein Offline-Betrieb.');
      return;
    }
    try {
      // updateViaCache 'none': Der Browser fragt bei jeder Prüfung den
      // Server, ob sw_app.js neu ist (GitHub Pages erlaubt sonst 10 Minuten
      // Zwischenspeicherung).
      const anmeldung = await navigator.serviceWorker.register('sw_app.js', { updateViaCache: 'none' });
      protokoll('app', `Service Worker angemeldet (Bereich ${new URL(anmeldung.scope).pathname}).`);
      anmeldung.addEventListener('updatefound', () => {
        protokoll('app', 'Neue Fassung der App wird geladen.');
        const neu = anmeldung.installing;
        if (neu) neu.addEventListener('statechange', () => { if (neu.state === 'activated') swVersionPruefen(); });
      });
      swVersionPruefen();
    } catch (f) {
      protokoll('fehler', `Service Worker nicht angemeldet: ${f.name}: ${f.message}`);
    }
  }

  /** Fragt den Service Worker nach seiner Version. Weicht sie ab, liegt eine neue Fassung bereit. */
  async function swVersionPruefen() {
    const sw = navigator.serviceWorker && (navigator.serviceWorker.controller || (await navigator.serviceWorker.ready).active);
    if (!sw) return;
    const kanal = new MessageChannel();
    const antwort = await new Promise((ok) => {
      kanal.port1.onmessage = (e) => ok(e.data);
      sw.postMessage({ art: 'version' }, [kanal.port2]);
      setTimeout(() => ok(null), 3000);
    });
    if (!antwort) return;
    const hinweis = $('#e-update');
    if (antwort.version !== V.version) {
      hinweis.hidden = false;
      hinweis.textContent = `Neue Fassung ${antwort.version} liegt bereit. Sie gilt ab dem nächsten Öffnen der App (App ganz schließen und neu öffnen).`;
      protokoll('app', `Service Worker hat ${antwort.version}, diese Seite ${V.version} - neue Fassung gilt ab dem naechsten Oeffnen.`);
    } else {
      hinweis.hidden = true;
    }
  }

  // =======================================================================
  // (K) Bedienung verbinden und starten
  // =======================================================================
  $('#logo').addEventListener('click', () => ansichtZeigen('start', 'Logo'));
  $$('[data-ansicht]').forEach((k) => k.addEventListener('click', () => ansichtZeigen(k.dataset.ansicht, 'angetippt')));
  $$('[data-aktion="paket-laden"]').forEach((k) => k.addEventListener('click', dateiAuswaehlen));
  // Nachbesserung 3, L4: Dateiarbeit nur über ⚙ (kein zweiter Einstieg).
  $('#einstellungen-knopf').addEventListener('click', () => einstellungenOeffnen());
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#frage-schleier').hidden) $('#frage-nein').click();
    else einstellungenSchliessen();
  });

  async function starten() {
    fensterAnpassen('Start');
    await geraetErmitteln();
    protokoll('start', `${V.titel} geoeffnet. ${anzeigemodus()}, Geraet ${geraet.modell}, ${geraet.android}, Chrome ${geraet.chrome}, `
      + `Browser ${geraet.browser}, Bildschirm ${screen.width} x ${screen.height}, Pixeldichte ${devicePixelRatio}, online: ${navigator.onLine ? 'ja' : 'nein'}.`);
    try {
      const entfernt = await S.aufraeumen();
      if (entfernt.length) protokoll('paket', `Beim Start aufgeraeumt: ${entfernt.length} unvollstaendige oder alte Paket-Reste entfernt.`);
    } catch (f) {
      protokoll('fehler', `Aufraeumen: ${f.name}`);
    }
    await einstellungenLaden();
    paket = await S.aktivesPaket();
    protokoll('start', paket ? `Paket auf dem Geraet: Version ${paket.version}, ${paket.inhalt.playlisten} Playlisten, ${paket.inhalt.titel} Titel, ${paket.inhalt.cover} Cover, ${paket.inhalt.songtexte} Songtexte.`
      : 'Noch kein Paket auf dem Geraet.');
    // Dauerhaften Speicher erbitten: Dann darf Chrome das Paket nicht bei
    // Platzmangel still wegräumen. Installierte Apps bekommen ihn meist.
    try {
      if (navigator.storage && navigator.storage.persist) {
        const dauerhaft = await navigator.storage.persist();
        protokoll('app', `Dauerhafter Speicher: ${dauerhaft ? 'gewaehrt' : 'nicht gewaehrt'}.`);
      }
    } catch (f) { /* nicht verfügbar */ }
    startseiteZeichnen();
    // Ralles Entscheidung (8): direkt die zuletzt benutzte Seite öffnen.
    ansichtZeigen(paket && einstellungen.zuletztAnsicht ? einstellungen.zuletztAnsicht : 'start', 'Start');
    partyAnzeigen();
    wachHalten('Start');
    // N6: Ist „Party“ beim Start aus, beginnt die Messung gleich (nicht erst
    // nach einer Minute) - so steht jeder Neustart mit Messwert im Protokoll.
    if (!einstellungen.party) setTimeout(partyAusMessen, 2000);
    await serviceWorkerAnmelden();
    await geteiltesAbholen();
  }

  // Für Phase 3 und 4 (Module melden sich an) und für die Prüfwerkzeuge.
  window.JukeDecker = Object.freeze({
    module, protokoll, musikLaeuft, bandZeigen,
    // Für die Prüfwerkzeuge: Erkennung des Browsers mit erfundenen Angaben.
    browserName,
    einstellungen: () => einstellungen,
    paket: () => paket,
    bereit: starten()
  });
})();
