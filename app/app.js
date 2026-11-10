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
   (G) Einstellungen             Bild 10
   (H) Party-Modus               Wake Lock, „☀ Party“, grünes Band nach der Rückkehr
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
  let geraet = { modell: '?', android: '?', chrome: '?' };
  async function geraetErmitteln() {
    try {
      if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        const w = await navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion', 'fullVersionList']);
        const marken = w.fullVersionList || [];
        const chrome = marken.find((b) => b.brand === 'Google Chrome') || marken.find((b) => /Chrom/i.test(b.brand));
        geraet = {
          modell: w.model || '(leer)',
          android: (w.platform || navigator.userAgentData.platform || '') + ' ' + (w.platformVersion || '?'),
          chrome: chrome ? chrome.version : '?'
        };
        return;
      }
    } catch (fehler) { /* Rückfall unten */ }
    const ua = navigator.userAgent;
    geraet = {
      modell: (ua.match(/Android [^;]+; ([^)]+)\)/) || [])[1] || '?',
      android: (ua.match(/Android ([\d.]+)/) || [])[1] || '?',
      chrome: (ua.match(/Chrome\/([\d.]+)/) || [])[1] || '?'
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
  // (C) Module: Hier melden sich PlayDecker (Phase 4) und Jukeboxer
  //     (Phase 3) an. spieltGerade(): Wiedergabe läuft (Pause zählt nicht,
  //     CLAUDE.md Party-Regel (4)). weiter(): nach der Rückkehr den
  //     Weiter-Befehl geben, falls die Musik nicht von selbst weiterlief.
  // =======================================================================
  const module = {
    playdecker: { spieltGerade: () => false },
    jukeboxer: { spieltGerade: () => false }
  };
  function musikLaeuft() {
    return Object.values(module).some((m) => { try { return !!m.spieltGerade(); } catch (f) { return false; } });
  }

  // =======================================================================
  // (D) Ansichten
  // =======================================================================
  let aktuelleAnsicht = 'start';

  function ansichtZeigen(name, anlass) {
    if (name !== 'start' && !paket) name = 'start';            // ohne Paket nur die Startseite
    aktuelleAnsicht = name;
    ['start', 'playdecker', 'jukeboxer'].forEach((n) => { $(`#ansicht-${n}`).hidden = n !== name; });
    $$('#reiter [data-ansicht]').forEach((k) => k.classList.toggle('an', k.dataset.ansicht === name));
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
  }

  function kopfleisteAnpassen() {
    const modul = aktuelleAnsicht !== 'start';
    $('#reiter').hidden = !modul;
    $('#songtext-knopf').hidden = !modul;
    $('#party-knopf').hidden = !paket;          // Bild 2 zeigt nur ⚙
  }

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
    if (paket) $('#paketzeile-text').innerHTML = `<b>${escapen(paketBeschreibung(paket))}</b>`;
    $('#start-version').textContent = V.titel;
    $('#start-version-erst').textContent = V.titel;
    const i = paket ? paket.inhalt : null;
    const text = i ? `Im Paket: ${zahl(i.playlisten)} Playlisten mit ${zahl(i.titel)} Titeln.` : '';
    $('#platzhalter-playdecker').textContent = text;
    $('#platzhalter-jukeboxer').textContent = text;
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
    $('#paket-inhalt').innerHTML = `<div class="hinweis">Das Paket wird geprüft (${mb(datei.size)}).</div>`;
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
      + (liste.length > 30 ? `<div class="hinweis">… und ${liste.length - 30} weitere.</div>` : '') + '</details>';
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
      genre = `<label class="zeile haekchen"><input type="checkbox" id="genre-vom-pc"> Genre-Belegung vom PC übernehmen</label>`
        + (vergleich.genreVerlust.length
          ? `<div class="hinweis">Ohne Häkchen bleiben Knopf ${vergleich.genreVerlust.join(', ')} leer, weil ihre Playlist nicht im neuen Paket ist.</div>` : '');
    }
    $('#paket-inhalt').innerHTML = `
      <div class="zwei-spalten">
        <div><div class="abschnitt">Prüfung</div><dl class="tab">
          ${zeile('Weg', escapen(ergebnis.weg))}
          ${zeile('Größe', groesseText(ergebnis.datei.groesse))}
          ${zeile('Prüfsumme', '✔ stimmt', 'ok')}
          ${zeile('Erstellt', escapen(P.datumText(a.erstellt)))}
          ${zeile('Stand Paket', `Version ${a.version} <span class="ok">✔ passt</span>`)}
        </dl></div>
        <div><div class="abschnitt">Inhalt</div><dl class="tab">
          ${zeile('Playlisten', zahl(a.playlisten))}
          ${zeile('Titel', zahl(a.titel))}
          ${zeile('Cover', zahl(a.cover))}
          ${zeile('Songtexte', zahl(a.songtexte))}
          ${zeile('Genre-Tasten', a.mitJukeboxer ? `${a.genreBelegt} belegt` : 'keine Angabe')}
        </dl></div>
      </div>
      <div class="abschnitt">Auf dem Gerät</div>
      <div class="hinweis gross">${geraetText}</div>
      ${genre}
      ${einzelheiten('Hinweise', ergebnis.hinweise)}
      <div class="hinweis warnung" id="musik-sperre" hidden>Erst Musik anhalten. „Übernehmen“ ist gesperrt, solange Musik läuft.</div>`;
    $('#paket-knoepfe').innerHTML = `<button type="button" class="knopf gross" id="paket-abbrechen">ABBRECHEN</button>
      <button type="button" class="knopf gross voll" id="paket-uebernehmen">ÜBERNEHMEN</button>`;
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
    $('#paket-inhalt').innerHTML = `<dl class="tab">
        ${zeile('Datei', escapen(datei.name || '(ohne Namen)'))}
        ${zeile('Größe', groesseText(datei.groesse))}
        ${zeile('Grund', escapen(ergebnis.grund), 'fehl')}
      </dl>
      <div class="abschnitt">Was jetzt?</div>
      <div class="hinweis gross">${bisher}${escapen(wasJetzt)}${zusatz ? ' ' + escapen(zusatz) : ''}</div>
      ${einzelheiten('Einzelheiten', ergebnis.fehler || [])}`;
    $('#paket-knoepfe').innerHTML = '<button type="button" class="knopf gross voll" id="paket-schliessen">SCHLIESSEN</button>';
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
  // (G) Einstellungen (Bild 10)
  // =======================================================================
  // Feste Spielzeit wie am PC: aus, sonst 10–600 s in Zehnerschritten. Die
  // Liste bietet übliche Werte; ein anderer Wert aus dem Paket wird ergänzt.
  const SPIELZEITEN = [0, 10, 20, 30, 45, 60, 90, 120, 180, 240, 300, 450, 600].filter((s) => s === 0 || s % 10 === 0);
  const spielzeitText = (s) => (s ? (s % 60 === 0 ? `${s / 60} min` : `${s} s`) : 'ganzer Titel');

  function einstellungenZeichnen() {
    const pd = einstellungen.playdecker;
    $('#e-blend').value = pd.blendSekunden;
    $('#e-blend-wert').textContent = pd.blendSekunden ? `${pd.blendSekunden} s` : 'harter Schnitt';
    const auswahl = $('#e-spielzeit');
    const werte = SPIELZEITEN.includes(pd.spielzeit) ? SPIELZEITEN : SPIELZEITEN.concat([pd.spielzeit]).sort((a, b) => a - b);
    auswahl.innerHTML = werte.map((s) => `<option value="${s}">${spielzeitText(s)}</option>`).join('');
    auswahl.value = String(pd.spielzeit);
    $('#e-drehung').value = pd.drehungSekunden;
    $('#e-drehung-wert').textContent = `${String(pd.drehungSekunden).replace('.', ',')} s`;
    // Regler wie im Mockup: links vom Knopf in Signalfarbe gefüllt (CSS-Variable --w)
    ['#e-blend', '#e-drehung'].forEach((auswahl) => {
      const r = $(auswahl);
      r.style.setProperty('--w', `${((r.value - r.min) / (r.max - r.min)) * 100}%`);
    });
    $$('#e-perspektive button').forEach((k) => {
      k.classList.toggle('an', k.dataset.p === pd.perspektive);
      k.setAttribute('aria-pressed', String(k.dataset.p === pd.perspektive));
    });
    const designOptionen = PlayListerDesigns.liste.map((d) => `<option value="${d.kennung}">${escapen(d.titel)}</option>`).join('');
    $('#e-design-pd').innerHTML = designOptionen;
    $('#e-design-pd').value = designPlaydecker();
    $('#e-design-jb').innerHTML = designOptionen;
    $('#e-design-jb').value = designJukeboxer();
    $('#e-party').checked = !!einstellungen.party;
    $('#e-rueckkehr').checked = !!einstellungen.hinweisRueckkehr;
    $('#e-paket').textContent = paket
      ? `Paket ${P.datumText(paket.erstellt).split(',')[0]} · ${groesseText(paket.bytes || 0)}`
      : 'Kein Paket auf dem Gerät';
    $('#e-loeschen').disabled = !paket;
    $('#e-version').textContent = V.titel;
    S.speicherSchaetzung().then((s) => {
      $('#e-speicher').textContent = s ? `Speicher belegt ${mb(s.usage || 0)}` : 'Speicherangabe nicht verfügbar';
    });
  }

  function einstellungenOeffnen() {
    einstellungenZeichnen();
    $('#einst-schleier').hidden = false;
    $('#einst-zu').focus();
  }
  function einstellungenSchliessen() {
    if ($('#einst-schleier').hidden) return;
    $('#einst-schleier').hidden = true;
    $('#einstellungen-knopf').focus();
  }

  // Jede Änderung wirkt sofort und wird gemerkt (wie am PC, kein Speichern-Knopf).
  function pdAendern(feld, wert) {
    einstellungen.playdecker[feld] = wert;
    einstellungenSpeichern();
    einstellungenZeichnen();
    ansichtZeigen(aktuelleAnsicht);
  }
  $('#e-blend').addEventListener('input', () => pdAendern('blendSekunden', Number($('#e-blend').value)));
  $('#e-spielzeit').addEventListener('change', () => pdAendern('spielzeit', Number($('#e-spielzeit').value)));
  $('#e-drehung').addEventListener('input', () => pdAendern('drehungSekunden', Number($('#e-drehung').value)));
  $$('#e-perspektive button').forEach((k) => k.addEventListener('click', () => pdAendern('perspektive', k.dataset.p)));
  $('#e-design-pd').addEventListener('change', () => pdAendern('design', designPruefen($('#e-design-pd').value)));
  $('#e-design-jb').addEventListener('change', () => {
    einstellungen.jukeboxer = einstellungen.jukeboxer || {};
    einstellungen.jukeboxer.effekte = { ...(einstellungen.jukeboxer.effekte || {}), design: designPruefen($('#e-design-jb').value) };
    einstellungenSpeichern();
    ansichtZeigen(aktuelleAnsicht);
  });
  $('#e-party').addEventListener('change', () => partySchalten($('#e-party').checked));
  $('#e-rueckkehr').addEventListener('change', () => {
    einstellungen.hinweisRueckkehr = $('#e-rueckkehr').checked;
    einstellungenSpeichern();
  });
  $('#e-protokoll').addEventListener('click', () => protokollSpeichern().catch((f) => protokoll('fehler', `Protokoll speichern: ${f.name}`)));
  $('#e-loeschen').addEventListener('click', () => {
    if (!paket) return;
    if (musikLaeuft()) { bandZeigen('Erst Musik anhalten – während Musik läuft, wird kein Paket gelöscht.', 4000); return; }
    frageStellen('PAKET LÖSCHEN?',
      `Das Paket vom ${P.datumText(paket.erstellt)} wird vom Gerät entfernt: Playlisten, Cover und Songtexte. Das lässt sich nicht rückgängig machen. Deine Einstellungen bleiben.`,
      'LÖSCHEN', async () => {
        if (musikLaeuft()) return;
        const kennung = await S.aktivesPaketEntfernen();
        protokoll('paket', `Paket von Hand geloescht (Kennung ${kennung}).`);
        paket = null;
        einstellungenSchliessen();
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
    }
    partyAnzeigen();
    if (!$('#einst-schleier').hidden) $('#e-party').checked = !!einstellungen.party;
  }
  $('#party-knopf').addEventListener('click', () => partySchalten(!einstellungen.party));

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
      const laeuft = musikLaeuft();
      protokoll('player', `Rueckkehr: Musik ${laeuft ? 'laeuft von selbst weiter' : 'laeuft NICHT - Weiter-Befehl an die Module'}.`);
      if (!laeuft) Object.values(module).forEach((m) => { try { if (m.weiter) m.weiter(); } catch (f) { /* egal */ } });
      if (einstellungen.hinweisRueckkehr) {
        bandZeigen(`▶ Willkommen zurück – die Musik war ${pauseSekunden} s angehalten und läuft weiter.`, 4000);
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
    wurzel.classList.toggle('tablet', innerWidth >= 1000);
    wurzel.classList.toggle('niedrig', innerHeight < 300);
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
  $('#einstellungen-knopf').addEventListener('click', einstellungenOeffnen);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#frage-schleier').hidden) $('#frage-nein').click();
    else einstellungenSchliessen();
  });

  async function starten() {
    fensterAnpassen('Start');
    await geraetErmitteln();
    protokoll('start', `${V.titel} geoeffnet. ${anzeigemodus()}, Geraet ${geraet.modell}, ${geraet.android}, Chrome ${geraet.chrome}, `
      + `Bildschirm ${screen.width} x ${screen.height}, Pixeldichte ${devicePixelRatio}, online: ${navigator.onLine ? 'ja' : 'nein'}.`);
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
    await serviceWorkerAnmelden();
    await geteiltesAbholen();
  }

  // Für Phase 3 und 4 (Module melden sich an) und für die Prüfwerkzeuge.
  window.JukeDecker = Object.freeze({
    module, protokoll, musikLaeuft, bandZeigen,
    einstellungen: () => einstellungen,
    paket: () => paket,
    bereit: starten()
  });
})();
