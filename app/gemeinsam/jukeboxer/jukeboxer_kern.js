/* =====================================================================
   JUKEBOXER-KERN (Bauauftrag 13)

   Die ganze Musikbox „Diner '58": Zustand, Bedienung, Plattenwechsel,
   Effekte-Fenster, Belegungs-Dialog. Gebaut nach dem Mockup
   Mockups/mockup_Jukeboxer_PC_Reiter.html, dessen Mockup-Kern hier als
   Ausgangspunkt diente.

   DIE WICHTIGSTE REGEL: Dieser Kern kennt weder Flask noch den
   PlayLister. Er läuft später UNVERÄNDERT in der Mobil-Version. Deshalb:
   (1) kein fetch, keine Server-Adresse - jeder Datenzugriff läuft über
       das übergebene Objekt „datenquelle" (siehe Vertrag unten);
   (2) alles, was nur der PC kann, ist in der Datenquelle WAHLFREI
       (z. B. Konto-Übernahme, Songtext) - fehlt eine Funktion, blendet
       der Kern das Zugehörige einfach aus;
   (3) alle Elemente entstehen INNERHALB des übergebenen Wurzelelements,
       alle Klassen tragen das Präfix „jbx-", alle Effekt-Merkmale stehen
       am Wurzelelement - nichts davon berührt die umgebende Seite.

   ---------------------------------------------------------------------
   VERTRAG: DIE DATENQUELLE (verbindlich für Auftrag 15, Mobil-Version)
   ---------------------------------------------------------------------
   Pflicht:
     playlistenAuflisten()      -> Promise<[{ id, name, anzahl, herkunft,
                                     geaendert, quelle_playlist_id?,
                                     quelle_stand? }]>
                                   id = Dateiname am PC ohne ".json".
     playlistLaden(id)          -> Promise<{ id, name, titel: [Titel] }>
                                   Titel = { video_id, titel, interpret,
                                   dauer_sekunden, bild?, verfuegbar,
                                   cover? }  (bild am PC, cover im Paket)
     coverAdresse(titel)        -> string | null | Promise<string|null>
                                   Bildadresse fürs Cover; null = keins
                                   (dann Ersatzetikett). Darf ein Promise
                                   liefern (mobil: Blob aus IndexedDB).
     einstellungenLaden()       -> Promise<Objekt wie jukeboxer_einstellungen.json>
     einstellungenSpeichern(o)  -> Promise (wirft Error mit deutscher
                                   Meldung, wenn abgelehnt)
   Wahlfrei:
     warnungen?()               -> [string]   Hinweise für die Leiste oben
     kontoPlaylisten?()         -> Promise<{ angemeldet: bool,
                                     playlisten: [{ kontoId, name, anzahl }] }>
     kontoUebernehmen?(q)       -> Promise<id | null>
                                   q = { kontoId } ODER { link }.
                                   Lädt, speichert LOKAL, liefert die id
                                   der lokalen Kopie; null = abgebrochen.
     kontoAktualisieren?(id)    -> Promise<{ neu, entfernt, anzahl, quelle_stand }>
     songtext?(titel)           -> Promise<{ vorhanden, text?, quelle?, grund? }>
                                   Wird im schwebenden Songtext-Fenster
                                   gezeigt (Baustein songtext_fenster.js,
                                   global SongtextFenster - muss VOR dem
                                   Kern geladen sein; fehlt er, bleibt der
                                   Knopf „♪ Songtext" aus).
     meldung?(text, istFehler)  -> Hinweis anzeigen (sonst eigener Hinweis)
     darfStarten?()             -> { ja: bool, grund?: string,
                                     grundVorgemerkt?: string }
                                   PARTY-REGEL (09.10.2026): Spielt auf dem
                                   Gerät schon eine andere Partymusik (PC:
                                   der PlayDecker), sagt die Hülle hier NEIN.
                                   Der Kern startet dann nicht, zeigt
                                   „grund" als Meldung und lässt die andere
                                   Musik ungestört. Im Modus „Warteschlange"
                                   wird ein Titel dann nur vorgemerkt (Text:
                                   „grundVorgemerkt"). Gefragt wird NUR bei
                                   einem echten Start aus der Stille (Wahl,
                                   ▶, Weiter, Zurück); Titelwechsel bei
                                   laufender Musik (Auto-Mix, Warteschlange,
                                   „Am Ende: nächstes Genre") brauchen keine
                                   Erlaubnis. Fehlt die Funktion, darf der
                                   Kern immer starten.
   Wahlfrei, NUR JUKEDECKER-APP (Auftrag 15, Nachbesserung 1), am PC nicht
   gesetzt - fehlen sie, verhält sich der Kern genau wie bisher:
     hatSongtext?(titel)        -> bool: Liegt zu diesem Titel ein Songtext
                                   vor? Dann trägt seine Titelkarte ein „♪"
                                   (Klasse jbx-songtext-marke) und die Anzeige
                                   „Jetzt läuft" die Klasse jbx-mit-songtext.
     vormerkungAbwaehlbar?()    -> bool: true = Im Modus „Warteschlange"
                                   nimmt ein erneutes Antippen eines
                                   vorgemerkten Titels ihn wieder heraus; die
                                   übrigen rücken nach. (Am PC bleibt ein
                                   zweites Antippen wie bisher ohne Wirkung.)

   START:  JukeboxerKern.starten({ wurzel, datenquelle, beimAbspielen,
                                   youtubeLaden?, zusatzKnoepfe?,
                                   songtextBehaelter?, designZiel? })
     beimAbspielen()  - meldet der Hülle: Musik startet gleich (PC: die
                        ChartLister-Vorschau beenden). Andere Partymusik
                        hält die Hülle hier NICHT an - die verhindert der
                        Kern vorher über darfStarten() (Party-Regel).
     youtubeLaden()   - Promise, wenn die IFrame-API bereitsteht. Fehlt es,
                        lädt der Kern die API selbst (genau einmal).
     zusatzKnoepfe    - [{ text, klasse, titel, beiKlick }] fürs Pult
                        (PC: „📱 Mobil-Paket")
     songtextBehaelter - Element für das schwebende Songtext-Fenster
                        (position: fixed - darf nicht unter einem transform
                        liegen). Fehlt es, hängt das Fenster in „wurzel".
     designZiel       - Element, an dem das Design-Merkmal data-design
                        steht (Auftrag 16). Muss ein ELTERNTEIL von
                        „wurzel" sein, denn die Design-Regeln lauten
                        „[data-design] .jbx …". Fehlt es, nimmt der Kern
                        das direkte Elternteil der Wurzel (PC: das Panel
                        #panel-jukebox, mobil: das äußere Element der
                        Seite). Die Liste der Designs kommt aus dem
                        Baustein designs.js (global PlayListerDesigns,
                        muss VOR dem Kern geladen sein; fehlt er, gilt
                        fest „diner-chrom" und die Auswahl bleibt aus).
   PLATTENSPIELER (Auftrag 16, Phase 2): Ist der gemeinsame Baustein
   static/gemeinsam/plattenspieler_detail.js geladen (global
   PlattenspielerDetail, VOR dem Kern), baut der Kern beim Aufbau den
   detaillierten Plattenspieler ein (START/STOP = Pause/Abspielen) und
   steuert seine Perspektive (Einstellung effekte.perspektive). Fehlt er,
   bleibt der einfache Plattenspieler.
   VON AUSSEN:
     JukeboxerKern.pausieren()          - hält an (die Party-Regel nutzt das
                                          NICHT: laufende Musik wird nie
                                          von außen unterbrochen)
     JukeboxerKern.spielt()             -> bool; true auch während eines
                                          Plattenwechsels, der gleich Ton
                                          bringt (andere Abspieler sollen
                                          dann nicht anlaufen)
     JukeboxerKern.fortsetzen()         - nur Mobil-Version: Ton nach der
                                          Rückkehr wieder anstoßen, wenn der
                                          Jukeboxer spielen SOLL (nie aus der
                                          Stille); true = war nötig
     JukeboxerKern.tonLaeuft()          -> bool; spielt UND Player meldet „läuft"
     JukeboxerKern.warteschlangeLaenge() -> Zahl der vorgemerkten Titel (nur
                                          lesen; Mobil-Version: Anzeige
                                          „3 Titel in der Warteschlange")
     JukeboxerKern.einstellungenKopie() -> Kopie der Einstellungen (nur lesen)
     JukeboxerKern.diagnose()           -> Zustand beider Player (Nachmessen)

   WIEDERGABE (Phase 3): zwei unsichtbare YouTube-Player A/B, Auto-Mix
   über die Lautstärke, Plattenwechsel und Tonarm im Gleichlauf mit dem
   echten Ton (siehe „YOUTUBE-WIEDERGABE" und „spiele()").
   Zum Nachmessen: JukeboxerKern.diagnose() liefert Zustand und
   Lautstärke beider Player.
   ===================================================================== */
(function (global) {
  'use strict';

  const R = global.WiedergabeRegeln;
  const SEITENGROESSE = 20;              // Wahltasten 1–20 = eine Seite
  const ANZAHL_GENRES = 10;
  const NAME_MAXLAENGE = 14;
  const SPEICHERN_VERZOEGERUNG_MS = 900; // sanft: nicht bei jedem Reglerschritt

  /* -------------------------------------------------------------------
     KLEINE HELFER
     ------------------------------------------------------------------- */
  // Text sicher in HTML einsetzen (Sonderzeichen unschädlich machen)
  const sicher = (text) => String(text ?? '').replace(/[&<>"']/g, (z) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
  // Eine Adresse sicher in eine CSS-url("...") setzen
  const cssUrl = (adresse) => `url("${String(adresse).replace(/["\\\n\r]/g, (z) => '\\' + z)}")`;
  const zeitText = R.zeitText;
  const warteMs = (ms) => new Promise((fertig) => setTimeout(fertig, ms));

  /* -------------------------------------------------------------------
     SYMBOLE für die Genre-Knöpfe (aus dem Mockup) - Reihenfolge und
     Namen wie in der Datenstruktur.
     ------------------------------------------------------------------- */
  const SYMBOLE = {
    gitarre: '<path d="M14.5 9.5 20 4"/><path d="m18.5 2.5 3 3"/><path d="M10.6 8.2c-1.6-.3-3.2.2-4.2 1.3-.6.7-.8 1.6-1.6 2.1-.9.6-2.2.5-3 1.4-1.4 1.6-.6 4.5 1.6 6.6 2.1 2.2 5 3 6.6 1.6.9-.8.8-2.1 1.4-3 .5-.8 1.4-1 2.1-1.6 1.1-1 1.6-2.6 1.3-4.2"/><circle cx="9.5" cy="14.5" r="1.6"/>',
    note: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    herz: '<path d="M12 20.5s-7.4-4.5-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.6 0 5.6 3.5 4.3 6.8-1.9 4.7-9.3 9.2-9.3 9.2z"/>',
    hut: '<path d="M2 15.5c3 2.2 17 2.2 20 0"/><path d="M5.2 15c.5-3.3 1-7.5 3.4-7.5 1.4 0 2 1 3.4 1s2-1 3.4-1c2.4 0 2.9 4.2 3.4 7.5"/>',
    saxofon: '<path d="M15 3v9a5 5 0 0 1-10 0v-1.5"/><path d="M4 10.5h3"/><path d="M13 3h5"/><circle cx="15" cy="7" r=".8"/><circle cx="15" cy="10" r=".8"/>',
    mikrofon: '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v4"/><path d="M8 21h8"/>',
    feder: '<path d="M20 4C12 4 6 10 6 18l-2 2"/><path d="M20 4c0 8-6 14-14 14"/><path d="M10 14h5"/>',
    welle: '<path d="M2 12h3l2-6 3 12 3-15 3 15 2-6h4"/>',
    kopfhoerer: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><rect x="2" y="13.5" width="5" height="7.5" rx="1.5"/><rect x="17" y="13.5" width="5" height="7.5" rx="1.5"/>',
    schluessel: '<path d="M12 22c-2 0-3-1.3-3-2.6S10.2 17 11.5 17s2 1 2 2.2V5.5c0-2 1-3.5 2-3.5s1.5 1 1.5 2.3c0 3-5 5.2-6.5 7.5-1.6 2.3-1 6 2.5 6s5-2.5 4-5c-.8-2-3.6-2.3-5-.8"/>',
    stern: '<path d="M12 2.5l2.8 6 6.6.7-5 4.5 1.4 6.5L12 17l-5.8 3.2 1.4-6.5-5-4.5 6.6-.7z"/>',
    platte: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="3"/><path d="M12 5.5a6.5 6.5 0 0 1 6.5 6.5"/>'
  };
  const symbolSvg = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SYMBOLE[name] || SYMBOLE.note}</svg>`;

  const BEDIENSYMBOLE = {
    zurueck: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 5h2.5v14H6zM20 5v14L9.5 12z"/></svg>',
    weiter:  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 5H18v14h-2.5zM4 5v14l10.5-7z"/></svg>',
    pause:   '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 5h4.5v14H6zm7.5 0H18v14h-4.5z"/></svg>',
    spielen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.5v15L19.5 12z"/></svg>'
  };

  /* -------------------------------------------------------------------
     EFFEKTE: Standard von Variante C und die Schnellwahl-Profile.
     Die Schnellwahl verändert NUR die Animationen, nie die Wiedergabe.
     ------------------------------------------------------------------- */
  const EFFEKTE_STANDARD = {
    animationen: true, plattenwechsel: 'wechsler', tellerDreht: true, tonarm: true,
    aktivKnopf: 'farbwechsel', rueckmeldung: 'aufblitzen', neon: 'pulsieren',
    coverWechsel: 'blende', tempo: 1
  };
  // Plattendrehung (Sekunden pro Umdrehung): bewusst NICHT in EFFEKTE_STANDARD,
  // denn die Schnellwahl-Profile kopieren diese Liste und würden den Wert
  // sonst zurücksetzen. Sie ist ein eigener Wert, unabhängig vom Tempo.
  const UMDREHUNG_STANDARD = 5;
  // DESIGN (Auftrag 16): ebenfalls NICHT in EFFEKTE_STANDARD - aus demselben
  // Grund wie die Plattendrehung. Die Schnellwahl betrifft nur Animationen
  // und darf das Design nie zurücksetzen. Liste und Standard liefert der
  // Baustein designs.js; fehlt er, gibt es nur das Standard-Design.
  const DESIGNS = global.PlayListerDesigns || null;
  const DESIGN_STANDARD = DESIGNS ? DESIGNS.standard : 'diner-chrom';
  const designGueltig = (kennung) => (DESIGNS ? DESIGNS.gueltig(kennung) : DESIGN_STANDARD);
  // PERSPEKTIVE des Plattenspielers (Auftrag 16, Phase 2): flach / leicht /
  // stark, Standard stark (45°). Wie das Design NICHT in EFFEKTE_STANDARD,
  // damit die Schnellwahl sie nicht zurücksetzt. Wirkt nur mit dem
  // detaillierten Plattenspieler (Baustein PlattenspielerDetail).
  const PLATTENSPIELER = global.PlattenspielerDetail || null;
  const PERSPEKTIVEN = ['flach', 'leicht', 'stark'];
  const PERSPEKTIVE_STANDARD = 'stark';
  const perspektiveGueltig = (wert) => (PERSPEKTIVEN.includes(wert) ? wert : PERSPEKTIVE_STANDARD);
  const PROFILE = {
    standard: { ...EFFEKTE_STANDARD },
    dezent: { ...EFFEKTE_STANDARD, plattenwechsel: 'blende', tonarm: false, aktivKnopf: 'leuchten',
              rueckmeldung: 'aufblitzen', neon: 'ruhig', coverWechsel: 'blende' },
    aus: { animationen: false }
  };

  /* -------------------------------------------------------------------
     DAS EINSTELLUNGSFENSTER - alle Felder an EINER Stelle.
     gruppe: in welchem Teil der Einstellungen der Wert steht.
     ------------------------------------------------------------------- */
  const SCHEMA = [
    { abschnitt: 'Wiedergabe' },
    { gruppe: 'wiedergabe', schluessel: 'ueberblenden', titel: 'Auto-Mix: weich in den nächsten Titel überblenden', art: 'schalter' },
    { gruppe: 'wiedergabe', schluessel: 'ueberblendDauer', titel: R.UEBERBLENDUNG.beschriftung, art: 'regler',
      min: R.UEBERBLENDUNG.min, max: R.UEBERBLENDUNG.max, schritt: R.UEBERBLENDUNG.schritt,
      anzeige: (w) => `${R.ueberblendWert(w)} · ${R.ueberblendZusatz(w)}` },
    // Feste Spielzeit: Regler in STUFEN wie im PlayDecker (0 = aus, dann 10 s, 20 s ...)
    { gruppe: 'wiedergabe', schluessel: 'festeSpielzeit', titel: R.SPIELZEIT.beschriftung + ' je Titel', art: 'regler',
      min: R.SPIELZEIT.stufeMin, max: R.SPIELZEIT.stufeMax, schritt: 1, stufen: true,
      anzeige: (w) => `${R.spielzeitWert(w)} · ${R.spielzeitZusatz(w)}` },
    { gruppe: 'wiedergabe', schluessel: 'reihenfolge', titel: 'Reihenfolge', art: 'wahl',
      optionen: [['reihe', 'Der Reihe nach'], ['zufall', 'Zufall']] },
    { gruppe: 'wiedergabe', schluessel: 'amEnde', titel: 'Am Ende der Playlist', art: 'wahl',
      optionen: [['wiederholen', 'Von vorn'], ['naechstesGenre', 'Nächstes Genre'], ['stoppen', 'Stopp']] },
    { gruppe: 'wiedergabe', schluessel: 'nachSchlange', titel: 'Wenn die Warteschlange leer ist', art: 'wahl',
      optionen: [['weiter', 'In der Playlist weiter'], ['zufall', 'Zufallstitel'], ['stille', 'Stille']] },
    { gruppe: 'wiedergabe', schluessel: 'songtext', titel: 'Songtext anzeigen (nur am PC)', art: 'schalter', nurMitSongtext: true },
    { gruppe: 'wiedergabe', schluessel: 'spultasten', titel: 'Spultasten ±10 s im Pult', art: 'schalter' },
    { abschnitt: 'Effekte & Animationen' },
    // Design (Auftrag 16) steht VOR der Schnellwahl, weil die Schnellwahl
    // es nicht verändert. „immerFrei": bleibt bedienbar, auch wenn
    // „Animationen gesamt" aus ist - ein Design ist keine Animation.
    // Nur sichtbar, wenn die Design-Liste (designs.js) geladen ist.
    ...(DESIGNS ? [{ gruppe: 'effekte', schluessel: 'design', titel: 'Design', art: 'wahl', immerFrei: true,
      optionen: DESIGNS.liste.map((d) => [d.kennung, d.titel]) }] : []),
    // Perspektive des Plattenspielers - ebenfalls keine Animation, darum
    // „immerFrei". Nur mit dem detaillierten Plattenspieler sichtbar.
    ...(PLATTENSPIELER ? [{ gruppe: 'effekte', schluessel: 'perspektive', titel: 'Perspektive des Plattenspielers', art: 'wahl', immerFrei: true,
      optionen: [['flach', 'Flach'], ['leicht', 'Leicht'], ['stark', 'Stark']] }] : []),
    { profilZeile: true },
    { gruppe: 'effekte', schluessel: 'animationen', titel: 'Animationen gesamt', art: 'schalter', haupt: true },
    { gruppe: 'effekte', schluessel: 'plattenwechsel', titel: 'Plattenwechsel beim Titelwechsel', art: 'wahl',
      optionen: [['schwenken', 'Seitlich tauschen'], ['wechsler', 'Wechsler (hoch/runter)'], ['blende', 'Überblenden'], ['aus', 'Aus']] },
    { gruppe: 'effekte', schluessel: 'tellerDreht', titel: 'Plattenteller dreht sich', art: 'schalter' },
    { gruppe: 'effekte', schluessel: 'umdrehungSekunden', titel: 'Plattendrehung (Sekunden pro Umdrehung)', art: 'regler',
      min: 2, max: 10, schritt: 0.5, anzeige: (w) => `${String(w).replace('.', ',')} s` },
    { gruppe: 'effekte', schluessel: 'tonarm', titel: 'Tonarm schwenkt und wandert mit', art: 'schalter' },
    { gruppe: 'effekte', schluessel: 'aktivKnopf', titel: 'Aktive Knöpfe', art: 'wahl',
      optionen: [['leuchten', 'Leuchten'], ['pulsieren', 'Pulsieren'], ['farbwechsel', 'Farbwechsel'], ['aus', 'Nur Farbe']] },
    { gruppe: 'effekte', schluessel: 'rueckmeldung', titel: 'Beim Drücken / Vormerken', art: 'wahl',
      optionen: [['aufblitzen', 'Aufblitzen'], ['blinken', 'Blinken'], ['aus', 'Aus']] },
    { gruppe: 'effekte', schluessel: 'neon', titel: 'Leuchtschild und Zierleisten', art: 'wahl',
      optionen: [['pulsieren', 'Pulsieren'], ['regenbogen', 'Regenbogen'], ['ruhig', 'Ruhig an'], ['aus', 'Aus']] },
    { gruppe: 'effekte', schluessel: 'coverWechsel', titel: 'Cover im Display', art: 'wahl',
      optionen: [['umdrehen', 'Umdrehen'], ['blende', 'Überblenden'], ['aus', 'Aus']] },
    { gruppe: 'effekte', schluessel: 'tempo', titel: 'Tempo der Animationen', art: 'regler', min: 0.5, max: 2, schritt: 0.25,
      anzeige: (w) => (w < 1 ? 'gemächlich' : w > 1 ? 'flott' : 'normal') }
  ];

  /* ===================================================================
     YOUTUBE-WIEDERGABE (Phase 3) - zwei unsichtbare Player A und B

     Warum zwei: Für den Auto-Mix startet der nächste Titel im ZWEITEN
     Player, beide werden über die Überblenddauer gegeneinander geblendet
     (Lautstärke, wie im PlayDecker). Ohne Blende (Dauer 0 oder Auto-Mix
     aus) spielt nur EIN Player mit hartem Schnitt.

     Gelernt aus dem PlayDecker (Kopfkommentar dort):
     (1) Blende und Fortschritt laufen über setInterval, NICHT über
         requestAnimationFrame - das steht in einem Hintergrund-Tab still.
     (2) Die Player entstehen erst beim ersten Abspielen, also aus einem
         Klick heraus (Autoplay-Regeln der Browser).
     (3) YouTube meldet beim Wechsel eines Videos gelegentlich noch ein
         „Ende" für das vorige. Ein „Ende" zählt deshalb nur, wenn es zum
         erwarteten Video gehört und nicht unmittelbar nach dem Wechsel kommt.

     Die IFrame-API wird nur EINMAL geladen: Die Hülle übergibt dafür
     youtubeLaden() (am PC die vorhandene Ladefunktion des PlayDeckers).
     Fehlt sie (später mobil), lädt dieser Baustein sie selbst, ohne eine
     schon vorhandene Einbindung zu überschreiben.
     =================================================================== */
  const YT_ZUSTAND = { UNGESTARTET: -1, ENDE: 0, LAEUFT: 1, PAUSE: 2, PUFFERT: 3, BEREIT: 5 };
  const ENDE_SCHONFRIST_MS = 1500;      // „Ende" so kurz nach einem Wechsel = Nachhall
  const BLEND_TAKT_MS = 50;             // Takt der Lautstärkerampe
  const START_FRIST_MS = 15000;         // so lange darf ein Titel zum Anlaufen brauchen
  // Fehlercodes der IFrame-API, bei denen ein Titel hier nicht abspielbar ist:
  // 2 ungültige Kennung, 5 HTML5-Fehler, 100 entfernt/privat,
  // 101 und 150 Einbetten verboten, 153 fehlende Herkunftsangabe.
  const YT_GESPERRT = [2, 5, 100, 101, 150, 153];

  let eigeneApiLadung = null;
  function youtubeApiSelbstLaden() {
    if (global.YT && global.YT.Player) return Promise.resolve();
    if (eigeneApiLadung) return eigeneApiLadung;
    eigeneApiLadung = new Promise((fertig, gescheitert) => {
      // Eine schon gesetzte Fertig-Meldung NICHT überschreiben, sondern mitrufen.
      const vorher = global.onYouTubeIframeAPIReady;
      global.onYouTubeIframeAPIReady = () => { if (typeof vorher === 'function') vorher(); fertig(); };
      const skript = document.createElement('script');
      skript.src = 'https://www.youtube.com/iframe_api';
      skript.onerror = () => { eigeneApiLadung = null; gescheitert(new Error('YouTube ist nicht erreichbar.')); };
      document.head.appendChild(skript);
    });
    return eigeneApiLadung;
  }

  /** Fehler beim Abspielen - mit Code der IFrame-API (oder 'zeit'). */
  class WiedergabeFehler extends Error {
    constructor(code) {
      super(code === 'zeit' ? 'Der Titel ist nicht angelaufen.' : `YouTube-Fehler ${code}`);
      this.code = code;
      this.gesperrt = YT_GESPERRT.includes(code);
    }
  }

  function baueYoutubeWiedergabe({ ablage, youtubeLaden, beiEnde, beiFehler }) {
    const slots = ['a', 'b'].map((k) => ({ k, p: null, wird: null, faktor: 1, videoId: null,
      vorbereitet: null, befohlenUm: 0, warten: null, fehler: null }));
    let aktivNr = 0;
    let basis = 70;              // Grundlautstärke 0–100 (Schieberegler)
    let blende = null;           // laufende Blende { alt, neu, uhr }
    const apiLaden = () => (typeof youtubeLaden === 'function' ? youtubeLaden() : youtubeApiSelbstLaden());
    const aktiv = () => slots[aktivNr];
    const zustandVon = (s) => { try { return s.p ? s.p.getPlayerState() : YT_ZUSTAND.UNGESTARTET; } catch (_) { return YT_ZUSTAND.UNGESTARTET; } };

    // Lautstärke je Player = Grundlautstärke x Blendfaktor (0–1).
    function lautstaerkeAnwenden() {
      slots.forEach((s) => { if (s.p && s.p.setVolume) s.p.setVolume(Math.round(basis * s.faktor)); });
    }

    // Player anlegen - beim ersten Mal, aus einem Klick heraus.
    function slotBereit(s) {
      if (s.wird) return s.wird;
      s.wird = (async () => {
        await apiLaden();
        // Eigenes Kind-Element: YT.Player ersetzt das Ziel durch das iframe.
        const ziel = document.createElement('div');
        ablage.appendChild(ziel);
        return new Promise((fertig) => {
          const p = new global.YT.Player(ziel, {
            width: '200', height: '113',
            playerVars: { autoplay: 0, playsinline: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3 },
            events: {
              onReady: () => { s.p = p; lautstaerkeAnwenden(); fertig(p); },
              onStateChange: (e) => zustandGeaendert(s, e.data),
              onError: (e) => fehlerGemeldet(s, e.data)
            }
          });
        });
      })();
      s.wird.catch(() => { s.wird = null; });
      return s.wird;
    }

    function zustandGeaendert(s, z) {
      if (z === YT_ZUSTAND.LAEUFT && s.warten) { s.warten.fertig(); s.warten = null; }
      if (z !== YT_ZUSTAND.ENDE || s !== aktiv() || !s.videoId) return;
      // Nachhall-Prüfung (siehe Kopf (3)) - im Zweifel wird gehandelt.
      let anderesVideo = false;
      try { const d = s.p.getVideoData(); anderesVideo = !!(d && d.video_id) && d.video_id !== s.videoId; } catch (_) { /* egal */ }
      if (anderesVideo || Date.now() - s.befohlenUm < ENDE_SCHONFRIST_MS) return;
      beiEnde();
    }

    function fehlerGemeldet(s, code) {
      const fehler = new WiedergabeFehler(code);
      if (s.warten) { s.warten.gescheitert(fehler); s.warten = null; return; }
      // Fehler schon beim VORLADEN (während des Plattenwechsels): merken und
      // erst beim Start melden - sonst schaltete der Kern mitten in einen
      // laufenden Wechsel hinein weiter (beim Testen so aufgefallen).
      if (s.vorbereitet) { s.fehler = fehler; return; }
      if (s === aktiv()) beiFehler(fehler);          // Fehler mitten im Titel
    }

    // Wartet, bis der Player wirklich läuft (oder scheitert).
    function aufLaufenWarten(s) {
      return new Promise((fertig, gescheitert) => {
        const uhr = setTimeout(() => { s.warten = null; gescheitert(new WiedergabeFehler('zeit')); }, START_FRIST_MS);
        s.warten = {
          fertig: () => { clearTimeout(uhr); fertig(); },
          gescheitert: (f) => { clearTimeout(uhr); gescheitert(f); }
        };
      });
    }

    // Eine laufende Blende sofort zu Ende bringen: alter Titel aus, neuer voll.
    function blendeSofortBeenden() {
      if (!blende) return;
      clearInterval(blende.uhr);
      try { blende.alt.p.stopVideo(); } catch (_) { /* egal */ }
      blende.alt.faktor = 1;
      blende.neu.faktor = 1;
      blende = null;
      lautstaerkeAnwenden();
    }

    function rampe(alt, neu, sekunden) {
      const beginn = Date.now();
      const dauerMs = Math.max(1, sekunden * 1000);
      blende = { alt, neu, uhr: setInterval(() => {
        const t = Math.min(1, (Date.now() - beginn) / dauerMs);
        neu.faktor = t;
        alt.faktor = 1 - t;
        lautstaerkeAnwenden();
        if (t >= 1) blendeSofortBeenden();
      }, BLEND_TAKT_MS) };
    }

    return {
      /** Harter Wechsel: lädt den Titel schon in den aktiven Player, OHNE
          ihn zu spielen. Der alte Ton verstummt damit sofort (Tonarm hebt ab). */
      async vorbereiten(videoId) {
        blendeSofortBeenden();
        const s = aktiv();
        await slotBereit(s);
        slots.forEach((x) => { if (x !== s && x.p) x.p.stopVideo(); });
        s.videoId = videoId; s.vorbereitet = videoId; s.befohlenUm = Date.now();
        s.fehler = null;
        s.faktor = 1;
        lautstaerkeAnwenden();
        s.p.cueVideoById(videoId);
      },

      /** Startet einen Titel. blendSekunden > 0 und es läuft gerade etwas:
          im ANDEREN Player starten und überblenden. Sonst harter Start.
          Erfüllt sich, sobald der neue Titel wirklich läuft. */
      async starten(videoId, blendSekunden) {
        blendeSofortBeenden();
        const alt = aktiv();
        const mitBlende = blendSekunden > 0 && zustandVon(alt) === YT_ZUSTAND.LAEUFT;
        const neu = mitBlende ? slots[1 - aktivNr] : alt;
        await slotBereit(neu);
        // Schon beim Vorladen gescheitert? Dann gar nicht erst starten.
        if (neu.vorbereitet === videoId && neu.fehler) {
          const fehler = neu.fehler;
          neu.fehler = null;
          neu.vorbereitet = null;
          throw fehler;
        }
        neu.fehler = null;
        neu.faktor = mitBlende ? 0 : 1;
        if (!mitBlende) slots.forEach((x) => { if (x !== neu && x.p) x.p.stopVideo(); });
        lautstaerkeAnwenden();
        const laeuft = aufLaufenWarten(neu);
        neu.befohlenUm = Date.now();
        if (neu.vorbereitet === videoId && neu.videoId === videoId) neu.p.playVideo();
        else neu.p.loadVideoById(videoId);
        neu.videoId = videoId;
        neu.vorbereitet = null;
        aktivNr = slots.indexOf(neu);
        try {
          await laeuft;
        } catch (fehler) {
          // Der neue Titel läuft nicht an: Bei einer Blende spielt der alte
          // einfach weiter laut, bis der Kern entschieden hat.
          if (mitBlende) {
            aktivNr = slots.indexOf(alt);
            neu.faktor = 1;
            try { neu.p.stopVideo(); } catch (_) { /* egal */ }
          }
          throw fehler;
        }
        if (mitBlende) rampe(alt, neu, blendSekunden);
      },

      pausieren() {
        blendeSofortBeenden();
        slots.forEach((s) => { if (s.p && zustandVon(s) !== YT_ZUSTAND.ENDE) s.p.pauseVideo(); });
      },
      abspielen() { const s = aktiv(); if (s.p) s.p.playVideo(); },
      stoppen() { blendeSofortBeenden(); slots.forEach((s) => { if (s.p) s.p.stopVideo(); }); },
      laeuft() { return zustandVon(aktiv()) === YT_ZUSTAND.LAEUFT; },
      zustand() { return zustandVon(aktiv()); },
      blendetGerade() { return !!blende; },
      position() { const s = aktiv(); try { return s.p ? (s.p.getCurrentTime() || 0) : 0; } catch (_) { return 0; } },
      /** Länge eines Titels: vom Player, wenn er genau diesen Titel geladen
          hat - sonst aus der Playlist (bis YouTube die Länge kennt). */
      dauer(titel) {
        const s = aktiv();
        let d = 0;
        try { if (s.p && titel && s.videoId === titel.video_id) d = s.p.getDuration() || 0; } catch (_) { d = 0; }
        return d || Number(titel && titel.dauer_sekunden) || 0;
      },
      springen(sekunden) { const s = aktiv(); if (s.p) s.p.seekTo(Math.max(0, sekunden), true); },
      lautstaerke(v) { basis = v; lautstaerkeAnwenden(); },
      /** Nur zum Nachmessen (Diagnose): Lautstärken und Zustände beider Player. */
      diagnose() {
        return slots.map((s, i) => ({ player: s.k, aktiv: i === aktivNr, video: s.videoId, zustand: zustandVon(s),
          lautstaerke: s.p && s.p.getVolume ? s.p.getVolume() : null, faktor: Number(s.faktor.toFixed(2)) }));
      }
    };
  }

  /* ===================================================================
     DER EINE JUKEBOXER (pro Seite gibt es genau einen)
     =================================================================== */
  let kern = null;

  function starten(optionen) {
    if (kern) return kern.oeffentlich;
    kern = baueJukeboxer(optionen);
    return kern.oeffentlich;
  }

  function baueJukeboxer({ wurzel, datenquelle, beimAbspielen, youtubeLaden, zusatzKnoepfe, songtextBehaelter, designZiel }) {
    if (!wurzel || !datenquelle) throw new Error('JukeboxerKern.starten: wurzel und datenquelle sind Pflicht.');
    const dq = datenquelle;
    // Wo das Design-Merkmal steht: ein Elternteil der Wurzel (siehe Kopf).
    const designElement = designZiel || wurzel.parentElement;
    // Das Design sofort setzen (Standard), noch bevor die Einstellungen
    // geladen sind - sonst stünde der Jukeboxer bis dahin ohne Farben da.
    // anwenden() setzt danach das gespeicherte Design.
    function designSetzen(kennung) {
      if (!designElement) return;
      if (DESIGNS) DESIGNS.setzen(designElement, kennung);
      else designElement.dataset.design = DESIGN_STANDARD;
    }
    designSetzen(DESIGN_STANDARD);
    // Ebenso die Perspektive (Standard „stark"), damit der Plattenspieler
    // nicht kurz flach erscheint, bis die Einstellungen da sind.
    if (PLATTENSPIELER) wurzel.dataset.perspektive = PERSPEKTIVE_STANDARD;
    const $ = (auswahl) => wurzel.querySelector(auswahl);
    const $$ = (auswahl) => Array.from(wurzel.querySelectorAll(auswahl));

    /* -----------------------------------------------------------------
       ZUSTAND
       ----------------------------------------------------------------- */
    let einstellungen = null;           // wie jukeboxer_einstellungen.json
    const playlisten = new Map();       // id -> Eintrag aus playlistenAuflisten()
    const geladen = new Map();          // id -> { id, name, titel } (Zwischenstand)
    const zustand = {
      angezeigtesGenre: 0,  // Index 0–9: welches Genre die Titelkarte zeigt
      seite: 0,             // welche 20er-Seite der Titelkarte
      aktuell: null,        // { playlistId, index, titel } - was gerade läuft
      spielt: false,
      warteschlange: [],    // vorgemerkte Einträge wie „aktuell"
      wechselLaeuft: false,
      naechsterWunsch: null,
      uebersprungen: 0,     // gesperrte Titel in Folge - gegen Endlosschleifen
      blendeFuer: null      // für welchen Titel der Auto-Mix schon eingeleitet ist
    };
    // Titel, die YouTube in dieser Sitzung abgelehnt hat (Fehler 100/101/150 …).
    // Sie bleiben in der Liste sichtbar, werden aber markiert und übersprungen.
    const gesperrteIds = new Set();

    // Wünscht das Gerät „reduzierte Bewegung" (Bedienungshilfe), sind die
    // Animationen beim Start aus - OHNE das in den Einstellungen zu
    // speichern. Erst wenn der Nutzer selbst etwas an den Effekten
    // ändert, gilt wieder sein gespeicherter Wert.
    const bewegungReduziert = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let bewegungsWunschAktiv = bewegungReduziert;
    const effekte = () => (bewegungsWunschAktiv ? { ...einstellungen.effekte, animationen: false } : einstellungen.effekte);
    const wiedergabe = () => einstellungen.wiedergabe;

    // Wartet die angegebene Zeit - geteilt durch das Tempo. Bei
    // abgeschalteten Animationen wird gar nicht gewartet.
    const warte = (ms) => (effekte().animationen ? warteMs(ms / effekte().tempo) : Promise.resolve());


    /* -----------------------------------------------------------------
       AUFBAU der Oberfläche (Variante C „Diner '58", Mockup-Gliederung)
       ----------------------------------------------------------------- */
    wurzel.classList.add('jbx');
    wurzel.innerHTML = `
      <div class="jbx-warnung" hidden></div>
      <div class="jbx-schmal-leiste"></div>
      <div class="jbx-diner">
        <div class="jbx-kopfzeile">
          <header class="jbx-schild">
            <span class="jbx-schild-text jbx-neon">Jukeboxer</span>
            <span class="jbx-schild-sub">by Gallus Optus</span>
          </header>
          <nav class="jbx-genre-tasten" aria-label="Genres"></nav>
        </div>
        <main class="jbx-mittelteil">
          <section class="jbx-streifen">
            <header>
              <button type="button" class="jbx-seiten-knopf jbx-seite-zurueck" title="Vorige Seite">◀</button>
              <div class="jbx-karte-titel"><h2 class="jbx-titel-kopf"></h2><small class="jbx-titel-quelle"></small></div>
              <button type="button" class="jbx-seiten-knopf jbx-seite-vor" title="Nächste Seite">▶</button>
            </header>
            <ol class="jbx-titel-liste"></ol>
          </section>
          <section class="jbx-kuppel">
            <div class="jbx-kuppel-glas">
              <div class="jbx-teller-flaeche">
                <div class="jbx-teller-box">
                  <div class="jbx-teller"></div>
                  <div class="jbx-platte-halter"><div class="jbx-platte"><div class="jbx-etikett"><span class="jbx-etikett-text">JUKEBOXER</span></div></div></div>
                  <div class="jbx-tonarm"></div>
                  <div class="jbx-tonarm-basis"></div>
                </div>
              </div>
            </div>
          </section>
          <section class="jbx-pult">
            <div class="jbx-display">
              <span class="jbx-display-kopf">Jetzt läuft</span>
              <div class="jbx-anzeige-cover jbx-cover-bild"></div>
              <b class="jbx-anzeige-titel">Bereit</b>
              <span class="jbx-anzeige-interpret">Wähle einen Titel</span>
              <div class="jbx-fortschritt"><i class="jbx-fortschritt-balken"></i></div>
              <div class="jbx-zeiten"><span class="jbx-zeit-ist">0:00</span><span class="jbx-zeit-gesamt">0:00</span></div>
              <div class="jbx-display-zeile">
                <span class="jbx-mix-anzeige"></span>
                <button type="button" class="jbx-songtext-knopf" hidden>♪ Songtext</button>
              </div>
              <span class="jbx-display-hinweis" role="status" hidden></span>
            </div>
            <div class="jbx-transport">
              <button type="button" class="jbx-wippe jbx-leuchtknopf jbx-knopf-zurueck" title="Zurück">${BEDIENSYMBOLE.zurueck}</button>
              <button type="button" class="jbx-wippe jbx-spul jbx-knopf-rueck10" title="10 Sekunden zurück" hidden>−10</button>
              <button type="button" class="jbx-wippe jbx-leuchtknopf jbx-knopf-pause" title="Abspielen">${BEDIENSYMBOLE.spielen}</button>
              <button type="button" class="jbx-wippe jbx-spul jbx-knopf-vor10" title="10 Sekunden vor" hidden>+10</button>
              <button type="button" class="jbx-wippe jbx-leuchtknopf jbx-knopf-weiter" title="Weiter">${BEDIENSYMBOLE.weiter}</button>
            </div>
            <div class="jbx-lautstaerke-zeile">
              <div class="jbx-lautstaerke-kopf"><span>Lautstärke</span><b class="jbx-lautstaerke-wert"></b></div>
              <div class="jbx-lautstaerke-schiene">
                <span aria-hidden="true">🔈</span>
                <input type="range" class="jbx-lautstaerke-regler" min="0" max="100" step="1" aria-label="Lautstärke">
                <span aria-hidden="true">🔊</span>
              </div>
            </div>
            <div class="jbx-modus"></div>
            <div class="jbx-ws"></div>
            <div class="jbx-pult-unten">
              <span class="jbx-zusatz-anker" hidden></span>
              <button type="button" class="jbx-effekte-knopf jbx-einstellungen-knopf">⚙ Einstellungen</button>
            </div>
          </section>
        </main>
        <div class="jbx-wahl-leiste">
          <span class="jbx-wahl-schild">Wählen<small class="jbx-seiten-anzeige"></small></span>
          <div class="jbx-wahltasten"></div>
        </div>
        <div class="jbx-schachbrett" aria-hidden="true"></div>
      </div>
      <div class="jbx-meldung" role="status" hidden></div>
      <div class="jbx-spieler-ablage" aria-hidden="true"></div>`;

    // DETAILLIERTER PLATTENSPIELER (Auftrag 16, Phase 2): gleich beim
    // Aufbau einsetzen, nicht nachträglich. Die Taste START/STOP am
    // Laufwerk wirkt wie die Wippe Pause/Abspielen - also auch mit der
    // Party-Regel. Vor dem Laden der Einstellungen ist sie noch ohne
    // Wirkung (dann gibt es nichts abzuspielen).
    if (PLATTENSPIELER) {
      PLATTENSPIELER.einrichten(wurzel, {
        beiStartStop: () => { if (einstellungen) pauseUmschalten(); },
        frontschrift: 'JUKEBOXER · DIREKTANTRIEB',
        rahmen: 'kuppel'
      });
    }

    // Die beiden unsichtbaren YouTube-Player (A/B) - angelegt erst beim
    // ersten Abspielen. Titelende und Fehler laufen in die Bedienlogik.
    const spieler = baueYoutubeWiedergabe({
      ablage: $('.jbx-spieler-ablage'),
      youtubeLaden,
      beiEnde: () => { if (zustand.spielt && !zustand.wechselLaeuft) naechster(); },
      beiFehler: (fehler) => titelGescheitert(zustand.aktuell, fehler)
    });

    // Zusatzknöpfe der Hülle (PC: „📱 Mobil-Paket") vor den Einstellungs-Knopf
    const anker = $('.jbx-zusatz-anker');
    (zusatzKnoepfe || []).forEach((z) => {
      const knopf = document.createElement('button');
      knopf.type = 'button';
      knopf.className = z.klasse || 'jbx-effekte-knopf';
      knopf.textContent = z.text;
      if (z.titel) knopf.title = z.titel;
      knopf.addEventListener('click', () => { rueckmeldung(knopf); z.beiKlick && z.beiKlick(); });
      anker.before(knopf);
    });

    /* -----------------------------------------------------------------
       MELDUNGEN
       ----------------------------------------------------------------- */
    let meldungsUhr = null;
    function meldung(text, istFehler = false) {
      if (dq.meldung) { dq.meldung(text, istFehler); return; }
      const m = $('.jbx-meldung');
      m.textContent = text;
      m.classList.toggle('jbx-fehler', !!istFehler);
      m.hidden = false;
      clearTimeout(meldungsUhr);
      meldungsUhr = setTimeout(() => { m.hidden = true; }, istFehler ? 8000 : 4200);
    }

    // Kurzer Hinweis im Display (z. B. „gesperrt - übersprungen")
    let displayUhr = null;
    function displayHinweis(text) {
      const h = $('.jbx-display-hinweis');
      h.textContent = text;
      h.hidden = false;
      clearTimeout(displayUhr);
      displayUhr = setTimeout(() => { h.hidden = true; }, 6000);
    }

    function warnungenZeigen() {
      const liste = (dq.warnungen && dq.warnungen()) || [];
      const leiste = $('.jbx-warnung');
      leiste.textContent = liste.join(' ');
      leiste.hidden = !liste.length;
    }

    /* -----------------------------------------------------------------
       SPEICHERN - sanft verzögert. Mehrere Änderungen kurz hintereinander
       (z. B. Regler ziehen) ergeben EINEN Speichervorgang.
       ----------------------------------------------------------------- */
    let speicherUhr = null;
    function speichernGeplant() {
      clearTimeout(speicherUhr);
      speicherUhr = setTimeout(async () => {
        try {
          await dq.einstellungenSpeichern(JSON.parse(JSON.stringify(einstellungen)));
        } catch (fehler) {
          meldung(`Einstellungen nicht gespeichert: ${fehler.message}`, true);
        }
      }, SPEICHERN_VERZOEGERUNG_MS);
    }

    /* -----------------------------------------------------------------
       PLAYLISTEN
       ----------------------------------------------------------------- */
    async function playlistenNeuLesen() {
      const liste = await dq.playlistenAuflisten();
      playlisten.clear();
      liste.forEach((p) => playlisten.set(p.id, p));
    }

    // Gibt es die Playlist eines Knopfes (noch)?
    const playlistFehlt = (genre) => !!genre.playlist && !playlisten.has(genre.playlist);

    async function playlistHolen(id) {
      if (!id || !playlisten.has(id)) return null;
      if (!geladen.has(id)) {
        try {
          const p = await dq.playlistLaden(id);
          geladen.set(id, { id, name: p.name, titel: Array.isArray(p.titel) ? p.titel : [] });
        } catch (fehler) {
          meldung(`Playlist „${id}" ließ sich nicht laden: ${fehler.message}`, true);
          return null;
        }
      }
      return geladen.get(id);
    }

    // Ist ein Titel abspielbar? Gesperrte (verfuegbar=false), in dieser
    // Sitzung von YouTube abgelehnte und Titel ohne Kennung werden
    // übersprungen - sie bleiben aber in der Liste sichtbar.
    const abspielbar = (t) => !!t && t.verfuegbar !== false && !!t.video_id && !gesperrteIds.has(t.video_id);

    const genres = () => einstellungen.genres;
    const angezeigteListe = () => {
      const g = genres()[zustand.angezeigtesGenre];
      const p = g && g.playlist ? geladen.get(g.playlist) : null;
      return p ? p.titel : [];
    };
    const angezeigteId = () => (genres()[zustand.angezeigtesGenre] || {}).playlist || null;
    const seitenAnzahl = () => Math.max(1, Math.ceil(angezeigteListe().length / SEITENGROESSE));
    const gleich = (a, b) => !!a && !!b && a.playlistId === b.playlistId && a.index === b.index;
    const istAktuell = (eintrag) => gleich(zustand.aktuell, eintrag);
    const platzInSchlange = (eintrag) => zustand.warteschlange.findIndex((w) => gleich(w, eintrag));

    /* NUR JUKEDECKER-APP (Auftrag 15, Nachbesserung 1) - wahlfreie Haken der
       Datenquelle (siehe Kopf). Fehlen sie (PC), liefern beide Helfer „nein"
       bzw. einen leeren Text, und alles bleibt Zeichen für Zeichen wie
       bisher. */
    const hatSongtext = (titel) => {
      if (typeof dq.hatSongtext !== 'function' || !titel) return false;
      try { return !!dq.hatSongtext(titel); } catch (fehler) { return false; }
    };
    const songtextMarke = (titel) => (hatSongtext(titel)
      ? '<span class="jbx-songtext-marke" title="Songtext vorhanden" aria-label="Songtext vorhanden">♪</span>' : '');
    const vormerkungAbwaehlbar = () => typeof dq.vormerkungAbwaehlbar === 'function' && !!dq.vormerkungAbwaehlbar();

    /* -----------------------------------------------------------------
       COVER - über die Datenquelle (PC: Zwischenspeicher des Servers).
       Ohne Cover oder bei Fehler bleibt das rote Ersatzetikett sichtbar:
       Es liegt als zweite Hintergrundebene UNTER dem Bild.
       ----------------------------------------------------------------- */
    async function coverHintergrund(titel) {
      try {
        const adresse = titel ? await dq.coverAdresse(titel) : null;
        return adresse ? `${cssUrl(adresse)}, var(--cover-ersatz)` : '';
      } catch (fehler) {
        return '';
      }
    }

    /* -----------------------------------------------------------------
       RÜCKMELDUNG beim Drücken (Aufblitzen/Blinken)
       ----------------------------------------------------------------- */
    function rueckmeldung(element) {
      if (!element) return;
      element.classList.remove('jbx-blitz');
      void element.offsetWidth;               // Animation neu starten
      element.classList.add('jbx-blitz');
      setTimeout(() => element.classList.remove('jbx-blitz'), 1100 / effekte().tempo);
    }

    /* ===================================================================
       ZEICHNEN
       =================================================================== */
    function zeichneGenres() {
      const leiste = $('.jbx-genre-tasten');
      leiste.innerHTML = '';
      genres().forEach((genre, nr) => {
        const knopf = document.createElement('button');
        knopf.type = 'button';
        const fehlt = playlistFehlt(genre);
        knopf.className = 'jbx-genre-knopf jbx-leuchtknopf'
          + (nr === zustand.angezeigtesGenre ? ' jbx-aktiv' : '')
          + (genre.playlist ? '' : ' jbx-unbelegt') + (fehlt ? ' jbx-fehlt' : '');
        knopf.innerHTML = `<span class="jbx-genre-symbol">${symbolSvg(genre.symbol)}</span><span class="jbx-genre-text">${sicher(genre.name)}</span>`;
        const p = playlisten.get(genre.playlist);
        knopf.title = fehlt
          ? `${genre.name}: Playlist „${genre.playlist}" fehlt (umbenannt oder gelöscht?) - lange drücken zum Neubelegen`
          : genre.playlist
            ? `${genre.name} → ${p ? p.name : genre.playlist} (lange drücken oder Rechtsklick zum Ändern)`
            : `${genre.name}: noch keine Playlist - antippen zum Belegen`;
        langerDruck(knopf, () => belegungsDialog(nr));
        knopf.addEventListener('click', () => {
          if (knopf.dataset.langGedrueckt) { delete knopf.dataset.langGedrueckt; return; }
          rueckmeldung(knopf);
          if (!genre.playlist) { belegungsDialog(nr); return; }
          genreWaehlen(nr);
        });
        leiste.appendChild(knopf);
      });
    }

    // Langes Drücken (600 ms) oder Rechtsklick öffnet den Belegungs-Dialog
    function langerDruck(element, aktion) {
      let uhr = null;
      element.addEventListener('pointerdown', () => {
        uhr = setTimeout(() => { element.dataset.langGedrueckt = '1'; aktion(); }, 600);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ereignis) =>
        element.addEventListener(ereignis, () => clearTimeout(uhr)));
      element.addEventListener('contextmenu', (e) => { e.preventDefault(); clearTimeout(uhr); aktion(); });
    }

    async function genreWaehlen(nr, ohneSpeichern = false) {
      zustand.angezeigtesGenre = nr;
      zustand.seite = 0;
      zeichneGenres();
      const neu = $$('.jbx-genre-tasten .jbx-genre-knopf')[nr];
      if (neu) {
        neu.classList.add('jbx-neu-aktiv');
        setTimeout(() => neu.classList.remove('jbx-neu-aktiv'), 800 / effekte().tempo);
      }
      zeichneTitel(true);
      zeichneWahltasten();
      if (!ohneSpeichern) { einstellungen.zuletzt_genre = nr + 1; speichernGeplant(); }
      const g = genres()[nr];
      if (g.playlist && !geladen.has(g.playlist)) {
        await playlistHolen(g.playlist);
        if (zustand.angezeigtesGenre === nr) { zeichneTitel(); zeichneWahltasten(); }
      }
    }

    function zeichneTitel(laedt = false) {
      const karte = $('.jbx-titel-liste');
      const genre = genres()[zustand.angezeigtesGenre];
      $('.jbx-titel-kopf').textContent = genre ? genre.name : '';
      const p = genre && playlisten.get(genre.playlist);
      $('.jbx-titel-quelle').textContent = !genre || !genre.playlist ? 'nicht belegt'
        : p ? `Playlist: ${p.name}` : `Playlist fehlt: ${genre.playlist}`;

      const id = angezeigteId();
      const liste = angezeigteListe();
      const start = zustand.seite * SEITENGROESSE;
      const seitenTitel = liste.slice(start, start + SEITENGROESSE);

      let leer = '';
      if (!genre || !genre.playlist) {
        leer = 'Diesem Genre-Knopf ist noch keine Playlist zugeordnet.<br>Knopf lange drücken (oder Rechtsklick) zum Belegen.';
      } else if (playlistFehlt(genre)) {
        leer = `Die Playlist „${sicher(genre.playlist)}" gibt es nicht mehr (umbenannt oder gelöscht?).<br>Knopf lange drücken (oder Rechtsklick) zum Neubelegen.`;
      } else if (laedt || !geladen.has(id)) {
        leer = 'Playlist wird geladen …';
      } else if (!liste.length) {
        leer = 'Diese Playlist enthält keine Titel.';
      }

      karte.innerHTML = seitenTitel.map((t, k) => {
        const eintrag = { playlistId: id, index: start + k };
        const spielt = istAktuell(eintrag);
        const platz = platzInSchlange(eintrag);
        const gesperrt = !abspielbar(t);
        return `<li class="jbx-titel-zeile${spielt ? ' jbx-spielt' : ''}${platz >= 0 ? ' jbx-vorgemerkt' : ''}" data-k="${k}"${gesperrt ? ' title="Bei YouTube nicht (mehr) verfügbar - wird übersprungen"' : ''}>
          <span class="jbx-titel-nr">${String(k + 1).padStart(2, '0')}</span>
          <span class="jbx-titel-text"><b>${gesperrt ? '⊘ ' : ''}${songtextMarke(t)}${sicher(t.titel)}</b><small>${sicher(t.interpret)}</small></span>
          ${spielt ? '<span class="jbx-eq"><i></i><i></i><i></i></span>' : ''}
          ${platz >= 0 ? `<span class="jbx-titel-marke" title="Platz ${platz + 1} in der Warteschlange">${platz + 1}</span>` : ''}
          <span class="jbx-titel-dauer">${t.dauer_sekunden ? zeitText(t.dauer_sekunden) : ''}</span>
        </li>`;
      }).join('') || `<li class="jbx-titel-leer">${leer || 'Keine Titel.'}</li>`;

      karte.querySelectorAll('.jbx-titel-zeile').forEach((zeile) =>
        zeile.addEventListener('click', () => waehle(+zeile.dataset.k, zeile)));

      $('.jbx-seiten-anzeige').textContent = `Seite ${zustand.seite + 1}/${seitenAnzahl()}`;
      $('.jbx-seite-zurueck').disabled = zustand.seite === 0;
      $('.jbx-seite-vor').disabled = zustand.seite >= seitenAnzahl() - 1;
    }

    function zeichneWahltasten() {
      const feld = $('.jbx-wahltasten');
      if (!feld.children.length) {
        for (let k = 0; k < SEITENGROESSE; k++) {
          const taste = document.createElement('button');
          taste.type = 'button';
          taste.className = 'jbx-wahltaste jbx-leuchtknopf';
          taste.innerHTML = `<span>${k + 1}</span>`;
          taste.addEventListener('click', () => waehle(k));
          feld.appendChild(taste);
        }
      }
      const id = angezeigteId();
      const liste = angezeigteListe();
      const start = zustand.seite * SEITENGROESSE;
      Array.from(feld.children).forEach((taste, k) => {
        const t = liste[start + k];
        const eintrag = { playlistId: id, index: start + k };
        taste.disabled = !t;
        taste.classList.toggle('jbx-aktiv', !!t && istAktuell(eintrag));
        taste.classList.toggle('jbx-vorgemerkt', !!t && platzInSchlange(eintrag) >= 0);
        taste.title = t ? `${k + 1}: ${t.titel} – ${t.interpret}` : '';
      });
    }

    function zeichneWarteschlange() {
      const kasten = $('.jbx-ws');
      if (!zustand.warteschlange.length) {
        kasten.innerHTML = '<span class="jbx-ws-leer">Warteschlange leer</span>';
        return;
      }
      const erste = zustand.warteschlange.slice(0, 3)
        .map((w, n) => `<li><b>${n + 1}.</b> ${sicher(w.titel.titel)}</li>`).join('');
      const rest = zustand.warteschlange.length - 3;
      kasten.innerHTML = `<span class="jbx-ws-kopf">Als Nächstes</span><ol>${erste}</ol>${rest > 0 ? `<span class="jbx-ws-rest">+ ${rest} weitere</span>` : ''}`;
    }

    function zeichneModus() {
      const schalter = $('.jbx-modus');
      if (!schalter.children.length) {
        schalter.innerHTML = '<button type="button" class="jbx-leuchtknopf" data-modus="sofort" title="Wahltaste spielt den Titel sofort">Sofort</button>'
          + '<button type="button" class="jbx-leuchtknopf" data-modus="warteschlange" title="Wahltaste merkt den Titel vor">Warteschlange</button>';
        schalter.querySelectorAll('button').forEach((k) => k.addEventListener('click', () => {
          einstellungen.wahlmodus = k.dataset.modus;
          rueckmeldung(k);
          zeichneModus();
          speichernGeplant();
        }));
      }
      schalter.querySelectorAll('button').forEach((k) =>
        k.classList.toggle('jbx-aktiv', k.dataset.modus === einstellungen.wahlmodus));
    }

    function zeichneAlles() { zeichneTitel(); zeichneWahltasten(); zeichneWarteschlange(); }

    /* ===================================================================
       BEDIENUNG: Titel wählen, spielen, weiter, zurück, Pause
       =================================================================== */
    function waehle(k, zusatzElement) {
      const liste = angezeigteListe();
      const index = zustand.seite * SEITENGROESSE + k;
      if (index >= liste.length) return;
      rueckmeldung($$('.jbx-wahltasten .jbx-wahltaste')[k]);
      if (zusatzElement) rueckmeldung(zusatzElement);
      const eintrag = { playlistId: angezeigteId(), index, titel: liste[index] };

      // PARTY-REGEL: Im Modus „Warteschlange" darf vorgemerkt werden, auch
      // wenn gerade eine andere Partymusik läuft - es entsteht ja kein Ton.
      // Nur das tatsächliche Abspielen wird abgewiesen.
      if (einstellungen.wahlmodus === 'warteschlange' && !zustand.aktuell) {
        const erlaubnis = startErlaubnis();
        if (!erlaubnis.ja) {
          if (platzInSchlange(eintrag) < 0) zustand.warteschlange.push(eintrag);
          else if (vormerkungAbwaehlbar()) {
            // NUR APP: Erneutes Antippen nimmt den Titel wieder heraus.
            zustand.warteschlange.splice(platzInSchlange(eintrag), 1);
            zeichneAlles();
            return;
          }
          zeichneAlles();
          meldung(erlaubnis.grundVorgemerkt
            || `„${eintrag.titel.titel}" vorgemerkt - startet, wenn Du hier ▶ drückst.`, true);
          return;
        }
      }
      if (einstellungen.wahlmodus === 'sofort' || !zustand.aktuell) {
        spiele(eintrag);
      } else if (platzInSchlange(eintrag) < 0 && !istAktuell(eintrag)) {
        zustand.warteschlange.push(eintrag);
        zeichneAlles();
      } else if (vormerkungAbwaehlbar() && platzInSchlange(eintrag) >= 0) {
        // NUR APP (Haken vormerkungAbwaehlbar): Erneutes Antippen nimmt den
        // Titel wieder heraus, die übrigen rücken nach. Am PC fehlt der
        // Haken - ein zweites Antippen bleibt dort wie bisher ohne Wirkung.
        zustand.warteschlange.splice(platzInSchlange(eintrag), 1);
        zeichneAlles();
      }
    }

    /* Einen Titel spielen - mit Plattenwechsel im Gleichlauf zum Ton.
       (1) Auto-Mix an und es läuft gerade etwas: Der neue Titel startet
           SOFORT im zweiten Player und wird über die Überblenddauer
           hereingeblendet; der Plattenwechsel beginnt MIT der Blende. Ist
           die Blende länger als die Animation, liegt die neue Platte schon
           und dreht sich, während der alte Titel ausklingt.
       (2) Sonst harter Schnitt: Der alte Ton verstummt, wenn der Tonarm
           abhebt; der neue beginnt, wenn der Tonarm wieder aufsetzt.
       Ohne Animationen geschieht beides sofort. */
    async function spiele(eintrag) {
      // Läuft gerade ein Plattenwechsel, merken wir uns den Wunsch für danach.
      if (zustand.wechselLaeuft) { zustand.naechsterWunsch = eintrag; return; }
      // PARTY-REGEL: Ein Start aus der Stille braucht die Erlaubnis der Hülle.
      // Läuft der Jukeboxer schon, ist es nur ein Titelwechsel - der darf.
      if (!zustand.spielt && !startPruefen()) return;
      if (!abspielbar(eintrag.titel)) {
        // Titel überspringen. Sind ALLE Titel einer Liste gesperrt, würde
        // das endlos weiterspringen - deshalb zählen.
        zustand.uebersprungen++;
        if (zustand.uebersprungen > listeVon(eintrag.playlistId).length) {
          zustand.uebersprungen = 0;
          anhalten();
          meldung('In dieser Playlist ist kein Titel abspielbar.', true);
          return;
        }
        displayHinweis(`„${eintrag.titel.titel}" nicht verfügbar - übersprungen`);
        zustand.aktuell = eintrag;   // damit „weiter" von hier aus weiterzählt
        naechster();
        return;
      }
      zustand.wechselLaeuft = true;
      // Zieht der Nutzer gerade am Fortschrittsbalken, verfällt das: Der
      // Sprung gälte dem alten Titel (Spulen ist im Wechsel gesperrt).
      spulVorschauBeenden();
      // Wird ein vorgemerkter Titel direkt gespielt, aus der Schlange nehmen
      zustand.warteschlange = zustand.warteschlange.filter((w) => !gleich(w, eintrag));
      // Die Hülle beendet jetzt schon die Vorschau (PC) - nicht erst, wenn
      // der Ton kommt, sonst überlappen sich beide kurz.
      if (beimAbspielen) beimAbspielen();

      const w = wiedergabe();
      const blendSekunden = w.ueberblenden ? w.ueberblendDauer : 0;
      const mitBlende = blendSekunden > 0 && zustand.spielt && spieler.laeuft();
      const hatteVorher = !!zustand.aktuell;
      zustand.aktuell = eintrag;
      zustand.blendeFuer = null;

      // Ein Start kann scheitern, BEVOR spiele() nach der Animation darauf
      // wartet. Damit der Browser das nicht als „unbehandelt" meldet, hängt
      // sofort ein leerer Fänger daran - ausgewertet wird weiter unten.
      const beobachtet = (versprechen) => { versprechen.catch(() => {}); return versprechen; };
      let start = null;
      if (mitBlende) {
        start = beobachtet(spieler.starten(eintrag.titel.video_id, blendSekunden));
      } else {
        // Den neuen Titel schon laden (der alte verstummt dabei).
        start = beobachtet(spieler.vorbereiten(eintrag.titel.video_id).then(() => null));
      }
      zeichneAlles();
      await plattenWechsel(eintrag.titel, hatteVorher, () => {
        // Tonarm setzt auf: Erst jetzt beginnt der Ton (harter Schnitt).
        if (!mitBlende) start = beobachtet(start.then(() => spieler.starten(eintrag.titel.video_id, 0)));
      });
      try {
        await start;
        zustand.uebersprungen = 0;
        setzeSpielt(true);
      } catch (fehler) {
        zustand.wechselLaeuft = false;
        // Hat der Nutzer inzwischen etwas anderes gewählt, geht das vor.
        const wunsch = zustand.naechsterWunsch;
        zustand.naechsterWunsch = null;
        titelGescheitert(eintrag, fehler, !wunsch);
        if (wunsch) spiele(wunsch);
        return;
      }
      fortschrittZeigen();
      zeichneAlles();
      zustand.wechselLaeuft = false;
      if (zustand.naechsterWunsch) {
        const wunsch = zustand.naechsterWunsch;
        zustand.naechsterWunsch = null;
        spiele(wunsch);
      }
    }

    /* Ein Titel lief nicht an oder brach ab. Gesperrte Titel (YouTube-
       Fehler 100/101/150 …) werden für diese Sitzung markiert und
       übersprungen, mit Hinweis im Display. */
    function titelGescheitert(eintrag, fehler, weiterschalten = true) {
      if (!eintrag) return;
      const t = eintrag.titel;
      if (fehler && fehler.gesperrt) {
        gesperrteIds.add(t.video_id);
        displayHinweis(`„${t.titel}" bei YouTube gesperrt (Fehler ${fehler.code}) - übersprungen`);
      } else {
        displayHinweis(`„${t.titel}" startet nicht (${fehler ? fehler.message : 'unbekannt'}) - übersprungen`);
      }
      zustand.uebersprungen++;
      if (zustand.uebersprungen > Math.max(3, listeVon(eintrag.playlistId).length)) {
        zustand.uebersprungen = 0;
        anhalten();
        meldung('Mehrere Titel hintereinander nicht abspielbar - Wiedergabe angehalten.', true);
        return;
      }
      zeichneAlles();
      if (weiterschalten) naechster();
    }

    // Liste einer Playlist (geladen) oder leer
    const listeVon = (id) => (geladen.get(id) || { titel: [] }).titel;

    async function naechster() {
      if (zustand.warteschlange.length) { spiele(zustand.warteschlange.shift()); return; }
      if (!zustand.aktuell) { waehle(0); return; }
      const { playlistId, index } = zustand.aktuell;
      const liste = listeVon(playlistId);
      const w = wiedergabe();
      // Im Warteschlangen-Modus: Was passiert, wenn die Schlange leer ist?
      if (einstellungen.wahlmodus === 'warteschlange' && w.nachSchlange === 'stille') {
        anhalten(); meldung('Warteschlange abgespielt - Stille bis zur nächsten Wahl.'); return;
      }
      if (!liste.length) { anhalten(); return; }
      const zufall = w.reihenfolge === 'zufall'
        || (einstellungen.wahlmodus === 'warteschlange' && w.nachSchlange === 'zufall');
      if (zufall) {
        let neu = Math.floor(Math.random() * liste.length);
        if (liste.length > 1 && neu === index) neu = (neu + 1) % liste.length;
        spiele({ playlistId, index: neu, titel: liste[neu] });
        return;
      }
      if (index + 1 < liste.length) { spiele({ playlistId, index: index + 1, titel: liste[index + 1] }); return; }
      // Ende der Playlist erreicht
      if (w.amEnde === 'stoppen') { anhalten(); meldung('Ende der Playlist.'); return; }
      if (w.amEnde === 'naechstesGenre') {
        // Nächster BELEGTER Knopf (mit vorhandener Playlist); die Titelkarte schaltet mit um.
        const start = genres().findIndex((g) => g.playlist === playlistId);
        const von = start >= 0 ? start : zustand.angezeigtesGenre;
        for (let schritt = 1; schritt <= ANZAHL_GENRES; schritt++) {
          const nr = (von + schritt) % ANZAHL_GENRES;
          const g = genres()[nr];
          if (!g.playlist || playlistFehlt(g)) continue;
          const p = await playlistHolen(g.playlist);
          if (!p || !p.titel.length) continue;
          genreWaehlen(nr);
          spiele({ playlistId: g.playlist, index: 0, titel: p.titel[0] });
          return;
        }
      }
      spiele({ playlistId, index: 0, titel: liste[0] });
    }

    function vorheriger() {
      if (!zustand.aktuell) return;
      // Mehr als 4 s gespielt: zurück an den Titelanfang - aber nur, wenn
      // der Sprung die Wiedergabe nicht startet (derselbe Schutz wie beim
      // Spulen; pausiert bleibt pausiert). Steht der Player dagegen auf
      // „zu Ende" (z. B. nach „Ende der Playlist" mit Stopp oder
      // Warteschlange → Stille) oder „nur geladen", startete der Sprung
      // die Wiedergabe ohne Prüfung der Party-Regel (Nacharbeit Auftrag
      // 17). Dann geht ⏮ zum vorherigen Titel, über den normalen Start
      // in spiele() - und dort mit Prüfung der Party-Regel.
      if (spieler.position() > 4 && spulenMoeglich()) { spulenAuf(0); return; }
      const { playlistId, index } = zustand.aktuell;
      const liste = listeVon(playlistId);
      if (!liste.length) return;
      const neu = (index - 1 + liste.length) % liste.length;
      spiele({ playlistId, index: neu, titel: liste[neu] });
    }

    function setzeSpielt(an) {
      zustand.spielt = an;
      wurzel.classList.toggle('jbx-spielt', an);
      wurzel.classList.toggle('jbx-pausiert', !an && !!zustand.aktuell);
      const knopf = $('.jbx-knopf-pause');
      knopf.innerHTML = BEDIENSYMBOLE[an ? 'pause' : 'spielen'];
      knopf.classList.toggle('jbx-aktiv', an);
      knopf.title = an ? 'Pause' : 'Abspielen';
    }

    function anhalten() { spieler.pausieren(); setzeSpielt(false); }

    function pauseUmschalten() {
      // Noch nichts gespielt, aber Titel vorgemerkt: der erste davon.
      if (!zustand.aktuell && zustand.warteschlange.length) { naechster(); return; }
      if (!zustand.aktuell) { waehle(0); return; }
      if (zustand.spielt) { anhalten(); return; }      // Pause geht immer
      if (!startPruefen()) return;                    // PARTY-REGEL
      if (beimAbspielen) beimAbspielen();      // PC: Vorschau beenden
      spieler.abspielen();
      setzeSpielt(true);
    }

    /* PARTY-REGEL (Entscheidung des Nutzers, 09.10.2026): Laufende
       Partymusik wird nie unterbrochen. Vor jedem Start aus der Stille
       fragt der Kern die Hülle (darfStarten, wahlfrei). Sagt sie nein,
       bleibt der Jukeboxer still und meldet den Grund. */
    function startErlaubnis() {
      if (typeof dq.darfStarten !== 'function') return { ja: true };
      const antwort = dq.darfStarten() || { ja: true };
      return antwort.ja === false ? antwort : { ja: true };
    }
    function startPruefen() {
      const erlaubnis = startErlaubnis();
      if (!erlaubnis.ja) meldung(erlaubnis.grund || 'Start im Moment nicht möglich.', true);
      return erlaubnis.ja;
    }

    /* ===================================================================
       PLATTENWECHSEL - die zentrale Animation
       Ablauf: Tonarm hebt ab → Platte stoppt → alte Platte fährt raus →
       Etikett bekommt das neue Cover → neue Platte fährt rein →
       Tonarm senkt sich → Platte dreht sich.
       =================================================================== */
    async function plattenWechsel(neu, hatteVorher, beimAufsetzen) {
      const halter = $('.jbx-platte-halter'), platte = $('.jbx-platte'), arm = $('.jbx-tonarm');
      const e = effekte();
      const stil = e.animationen ? e.plattenwechsel : 'aus';
      const armBewegt = e.tonarm && e.animationen;
      // Das Cover schon jetzt anfordern - so ist es da, wenn die neue Platte kommt.
      const coverVersprechen = coverHintergrund(neu);
      wurzel.classList.add('jbx-wechsel');

      arm.classList.remove('jbx-auf-platte');
      wurzel.style.setProperty('--fortschritt', 0);
      if (hatteVorher && armBewegt) await warte(550);
      platte.classList.remove('jbx-dreht');

      const bewegung = {
        schwenken: ['jbx-raus-rechts', 'jbx-von-links'],
        wechsler: ['jbx-raus-oben', 'jbx-raus-oben'],
        blende: ['jbx-ausgeblendet', 'jbx-ausgeblendet']
      }[stil];

      const hintergrund = await coverVersprechen;
      if (bewegung) {
        const [raus, rein] = bewegung;
        if (hatteVorher) {
          halter.classList.add(raus);
          await warte(680);
        }
        // Platte unsichtbar an die Startposition setzen, neues Cover drauf …
        halter.classList.add('jbx-sofort');
        halter.classList.remove(raus);
        halter.classList.add(rein);
        void halter.offsetWidth;
        etikettSetzen(hintergrund);
        anzeigeTitelSetzen(neu, hintergrund);
        // … und hereinfahren lassen
        halter.classList.remove('jbx-sofort', rein);
        await warte(680);
      } else {
        etikettSetzen(hintergrund);
        anzeigeTitelSetzen(neu, hintergrund);
      }

      arm.classList.add('jbx-auf-platte');
      // Der Tonarm senkt sich: Hier beginnt (beim harten Schnitt) der Ton.
      if (beimAufsetzen) beimAufsetzen();
      if (armBewegt) await warte(550);
      platte.classList.add('jbx-dreht');
      wurzel.classList.remove('jbx-wechsel');
    }

    function etikettSetzen(hintergrund) {
      const etikett = $('.jbx-etikett');
      etikett.style.backgroundImage = hintergrund || '';
      etikett.classList.toggle('jbx-mit-cover', !!hintergrund);
    }

    async function bildWechseln(element, hintergrund) {
      const e = effekte();
      const art = e.animationen ? e.coverWechsel : 'aus';
      const setzen = () => { element.style.backgroundImage = hintergrund || ''; };
      if (art === 'aus') { setzen(); return; }
      const klasse = art === 'umdrehen' ? 'jbx-kipp-raus' : 'jbx-blend-raus';
      element.classList.add(klasse);
      await warte(230);
      setzen();
      element.classList.remove(klasse);
    }

    function anzeigeTitelSetzen(titel, hintergrund) {
      $('.jbx-anzeige-titel').textContent = titel.titel || '';
      // NUR APP (Haken hatSongtext): Kennung „♪" an „Jetzt läuft" - am PC
      // fehlt der Haken, dann wird die Klasse gar nicht erst angefasst.
      if (typeof dq.hatSongtext === 'function') $('.jbx-anzeige-titel').classList.toggle('jbx-mit-songtext', hatSongtext(titel));
      $('.jbx-anzeige-interpret').textContent = titel.interpret || '';
      $('.jbx-zeit-gesamt').textContent = zeitText(spielEndeVon(titel));
      $('.jbx-zeit-ist').textContent = '0:00';
      bildWechseln($('.jbx-anzeige-cover'), hintergrund);
      // Das Songtext-Fenster bleibt offen und lädt den neuen Text selbst.
      songtextKnopfZeigen();
    }

    // Wann endet ein Titel? Volle Länge oder die feste Spielzeit (gemeinsame Regel).
    const spielEndeVon = (titel) => R.spielEnde(spieler.dauer(titel), wiedergabe().festeSpielzeit);

    // Während der Nutzer am Fortschrittsbalken zieht, hat seine Vorschau
    // Vorrang vor der automatischen Anzeige - sonst setzte der 250-ms-Takt
    // Balken, Zeit und Tonarm immer wieder auf die echte Stelle zurück.
    let spulVorschauAktiv = false;

    function fortschrittZeigen() {
      if (!zustand.aktuell || spulVorschauAktiv) return;
      fortschrittMalen(spieler.position());
    }
    /** Balken, Zeitanzeige und Tonarm auf eine Stelle (Sekunden) stellen.
        Gemeinsam für die echte Stelle (Takt) und die Vorschau beim Ziehen. */
    function fortschrittMalen(sekunden) {
      const ende = spielEndeVon(zustand.aktuell.titel) || 1;
      const anteil = Math.min(1, sekunden / ende);
      wurzel.style.setProperty('--fortschritt', anteil.toFixed(4));
      $('.jbx-fortschritt-balken').style.width = `${(anteil * 100).toFixed(2)}%`;
      $('.jbx-zeit-ist').textContent = zeitText(sekunden);
      // Für Bildschirmleser: der Balken ist ein Schieberegler (siehe Spulen)
      const leiste = $('.jbx-fortschritt');
      leiste.setAttribute('aria-valuemax', String(Math.round(ende)));
      leiste.setAttribute('aria-valuenow', String(Math.round(sekunden)));
      leiste.setAttribute('aria-valuetext', `${zeitText(sekunden)} von ${zeitText(ende)}`);
    }

    /* ===================================================================
       SPULEN (Auftrag 17): am Fortschrittsbalken unter „Jetzt läuft" und
       mit den Tasten −10 / +10. Gleiches Verhalten in allen Hüllen (PC,
       Vollbild, Handy-Querformat), mit Maus wie mit Finger.
       (1) Klick: springt sofort an diese Stelle.
       (2) Ziehen: Balken, Zeit und Tonarm laufen sichtbar mit, gesprungen
           wird erst beim Loslassen - genau EIN Sprung im Player.
       (3) Pfeil links/rechts am Balken: 5 Sekunden zurück/vor.
       (4) Höchstens bis Titelende minus 1 s (Ende nach spielEndeVon, also
           auch die feste Spielzeit) - sonst käme sofort der nächste Titel.
       (5) Spulen STARTET NIE die Wiedergabe: Pausiert bleibt pausiert.
           Spulen ist kein Abspielen, die Party-Regel bleibt deshalb
           unberührt.
       Die Rechnung (Stelle -> Anteil, Grenze am Ende) steht gemeinsam mit
       dem PlayDecker in wiedergabe_regeln.js.
       =================================================================== */
    const SPUL_ABSTAND_ENDE_S = 1;     // so nah ans Titelende höchstens
    const SPUL_TASTE_S = 5;            // Pfeiltaste am Balken
    let spulTitel = null;              // für welchen Titel die Vorschau gilt

    /** Darf jetzt gesprungen werden (Spulen, −10/+10, ⏮ an den
        Titelanfang)? Nur mit aktuellem Titel bekannter Länge, nicht
        während eines Plattenwechsels und nur, solange der Player spielt
        oder pausiert. In den übrigen Zuständen (noch nicht gestartet, nur
        geladen, zu Ende) würde ein Sprung bei YouTube die Wiedergabe
        STARTEN - ohne Prüfung der Party-Regel. Die Regel dazu steht
        gemeinsam mit dem PlayDecker in wiedergabe_regeln.js
        (sprungErlaubt); Puffern zählt nur, wenn der Jukeboxer auch
        spielen soll. */
    function spulenMoeglich() {
      if (!zustand.aktuell || zustand.wechselLaeuft) return false;
      if (!(spielEndeVon(zustand.aktuell.titel) > 0)) return false;
      return R.sprungErlaubt(spieler.zustand(), zustand.spielt);
    }
    /** Im aktuellen Titel an `sekunden` springen (begrenzt, siehe oben). */
    function spulenAuf(sekunden) {
      if (!spulenMoeglich()) return;
      const ende = spielEndeVon(zustand.aktuell.titel);
      spieler.springen(R.spulZiel(sekunden, ende, SPUL_ABSTAND_ENDE_S));
      fortschrittZeigen();
    }
    /** Ziehen beenden, ohne zu springen (z. B. weil ein Plattenwechsel
        beginnt). Die Anzeige folgt danach wieder der echten Stelle. */
    function spulVorschauBeenden() {
      spulVorschauAktiv = false;
      spulTitel = null;
      wurzel.classList.remove('jbx-spult');
    }

    function spulenEinrichten() {
      const leiste = $('.jbx-fortschritt');
      leiste.classList.add('jbx-spulbar');
      leiste.tabIndex = 0;
      leiste.setAttribute('role', 'slider');
      leiste.setAttribute('aria-label', 'Stelle im Titel (Pfeiltasten: 5 Sekunden)');
      leiste.setAttribute('aria-valuemin', '0');
      let zielSekunden = 0;

      // Zeigerstelle -> Zielzeit in Sekunden (schon begrenzt)
      const zielAusZeiger = (ereignis) => {
        const rahmen = leiste.getBoundingClientRect();
        const ende = spielEndeVon(zustand.aktuell.titel);
        const anteil = R.anteilAnStelle(ereignis.clientX, rahmen.left, rahmen.width);
        return R.spulZiel(anteil * ende, ende, SPUL_ABSTAND_ENDE_S);
      };
      // Gilt die Vorschau noch? Nicht mehr, wenn inzwischen ein anderer
      // Titel dran ist oder der Plattenwechsel läuft (z. B. Auto-Mix).
      const vorschauGilt = () => spulVorschauAktiv && zustand.aktuell === spulTitel && !zustand.wechselLaeuft;

      leiste.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;   // nur die linke Maustaste
        if (!spulenMoeglich()) return;
        // Den Fokus (danach gehen die Pfeiltasten) setzt der Browser beim
        // Klick selbst - bewusst nicht per focus(): Das zählte Chrome als
        // Tastaturfokus, und der Balken bliebe nach dem Klick dick.
        // Text markiert das Ziehen nicht (user-select im CSS).
        // Alle weiteren Bewegungen gehören jetzt dem Balken, auch wenn
        // Maus oder Finger ihn verlassen - so wirkt Ziehen wie ein Regler.
        leiste.setPointerCapture(e.pointerId);
        spulVorschauAktiv = true;
        spulTitel = zustand.aktuell;
        wurzel.classList.add('jbx-spult');
        zielSekunden = zielAusZeiger(e);
        fortschrittMalen(zielSekunden);
      });
      leiste.addEventListener('pointermove', (e) => {
        if (!spulVorschauAktiv) return;
        if (!vorschauGilt()) { spulVorschauBeenden(); return; }
        zielSekunden = zielAusZeiger(e);
        fortschrittMalen(zielSekunden);
      });
      leiste.addEventListener('pointerup', () => {
        if (!spulVorschauAktiv) return;
        const springen = vorschauGilt();
        spulVorschauBeenden();
        if (springen) spulenAuf(zielSekunden);   // genau EIN Sprung
        else fortschrittZeigen();
      });
      // Abgebrochen (z. B. das System übernimmt die Geste): nicht springen
      leiste.addEventListener('pointercancel', () => {
        if (!spulVorschauAktiv) return;
        spulVorschauBeenden();
        fortschrittZeigen();
      });
      leiste.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        if (spulVorschauAktiv) return;
        spulenAuf(spieler.position() + (e.key === 'ArrowRight' ? SPUL_TASTE_S : -SPUL_TASTE_S));
      });
    }

    /* Takt: viermal pro Sekunde (setInterval - läuft auch im Hintergrund-Tab).
       (1) Fortschritt und Tonarm nach der ECHTEN Position nachführen.
       (2) Auto-Mix: Ist die Restzeit nur noch so lang wie die
           Überblenddauer, den nächsten Titel einleiten (gemeinsame Regel
           mit dem PlayDecker) - bei fester Spielzeit entsprechend früher.
       (3) Feste Spielzeit ohne Blende: nach Ablauf hart weiter.
       Das natürliche Titelende meldet der Player selbst (beiEnde). */
    setInterval(() => {
      if (!einstellungen || !zustand.aktuell || zustand.wechselLaeuft) return;
      fortschrittZeigen();
      if (!zustand.spielt || !spieler.laeuft()) return;
      const titel = zustand.aktuell.titel;
      const ende = spielEndeVon(titel);
      const pos = spieler.position();
      const w = wiedergabe();
      const blendSekunden = w.ueberblenden ? w.ueberblendDauer : 0;
      const schluessel = `${zustand.aktuell.playlistId}|${zustand.aktuell.index}`;
      if (zustand.blendeFuer === schluessel) return;
      if (R.blendeFaellig(ende, pos, blendSekunden)) { zustand.blendeFuer = schluessel; naechster(); return; }
      if (w.festeSpielzeit > 0 && ende > 0 && pos >= ende) { zustand.blendeFuer = schluessel; naechster(); }
    }, 250);

    /* ===================================================================
       LAUTSTÄRKE-SCHIEBEREGLER (Phase 2b, statt Drehknopf)
       Ziehen, Pfeiltasten (kommen vom Browser) oder Mausrad in 5er-Schritten.
       Gespeichert wird sanft verzögert - nicht bei jedem Reglerschritt.
       =================================================================== */
    function lautstaerkeEinrichten() {
      const regler = $('.jbx-lautstaerke-regler');
      const zeigen = () => {
        const v = einstellungen.lautstaerke;
        regler.value = String(v);
        // Die gefüllte Strecke links vom Knopf zeichnet das CSS über --wert
        regler.style.setProperty('--wert', `${v}%`);
        regler.title = `Lautstärke ${v} %`;
        $('.jbx-lautstaerke-wert').textContent = v;
        spieler.lautstaerke(v);
      };
      const setzen = (wert) => {
        einstellungen.lautstaerke = Math.max(0, Math.min(100, Math.round(wert)));
        zeigen();
        speichernGeplant();
      };
      regler.addEventListener('input', () => setzen(Number(regler.value)));
      regler.addEventListener('wheel', (e) => { e.preventDefault(); setzen(einstellungen.lautstaerke + (e.deltaY < 0 ? 5 : -5)); }, { passive: false });
      zeigen();
    }

    /* ===================================================================
       WIEDERGABE-ANZEIGEN, die von den Einstellungen abhängen
       =================================================================== */
    function anwenden() {
      const e = effekte();
      wurzel.dataset.anim = e.animationen ? 'an' : 'aus';
      wurzel.dataset.aktiv = e.aktivKnopf;
      wurzel.dataset.rueck = e.rueckmeldung;
      wurzel.dataset.neon = e.neon;
      wurzel.dataset.teller = e.tellerDreht ? 'an' : 'aus';
      wurzel.dataset.tonarm = e.tonarm ? 'an' : 'aus';
      wurzel.style.setProperty('--dauer-faktor', (1 / e.tempo).toFixed(3));
      // Die Drehung hat ihren eigenen Wert und hängt nicht am Tempo.
      wurzel.style.setProperty('--umdrehung', `${e.umdrehungSekunden || UMDREHUNG_STANDARD}s`);
      // Design (Auftrag 16): wirkt sofort über das CSS - nur Farben ändern
      // sich, die Wiedergabe läuft ungestört weiter (Party-Regel).
      designSetzen(e.design);
      // Perspektive des Plattenspielers: „flach" = ohne Merkmal (Draufsicht).
      // Der Baustein bemerkt den Wechsel selbst und passt das Gerät neu ein.
      const perspektive = perspektiveGueltig(e.perspektive);
      if (perspektive === 'flach') delete wurzel.dataset.perspektive;
      else wurzel.dataset.perspektive = perspektive;

      const w = wiedergabe();
      $('.jbx-mix-anzeige').textContent = [
        w.ueberblenden && w.ueberblendDauer > 0 ? `Auto-Mix ${w.ueberblendDauer} s` : 'Auto-Mix aus',
        w.festeSpielzeit ? `je Titel ${w.festeSpielzeit} s` : '',
        w.reihenfolge === 'zufall' ? 'Zufall' : ''
      ].filter(Boolean).join(' · ');
      $$('.jbx-spul').forEach((k) => { k.hidden = !w.spultasten; });
      wurzel.classList.toggle('jbx-mit-spultasten', !!w.spultasten);
      songtextKnopfZeigen();
      if (zustand.aktuell) $('.jbx-zeit-gesamt').textContent = zeitText(spielEndeVon(zustand.aktuell.titel));
    }

    /* ===================================================================
       SONGTEXT im schwebenden Fenster (Phase 6)
       Nur, wenn die Datenquelle Texte anbietet (songtext?) UND der
       Baustein SongtextFenster geladen ist - sonst bleibt der Knopf aus.
       Das Fenster folgt zustand.aktuell: Der wechselt bei Auto-Mix schon
       mit dem Beginn der Blende, also wechselt dort auch der Text.
       =================================================================== */
    const songtextMoeglich = () => typeof dq.songtext === 'function' && !!global.SongtextFenster;
    let songtextFenster = null;
    function songtextKnopfZeigen() {
      const knopf = $('.jbx-songtext-knopf');
      knopf.hidden = !songtextMoeglich() || !wiedergabe().songtext;
      knopf.disabled = !zustand.aktuell;
      if (knopf.hidden) songtextSchliessen();
    }
    function songtextSchliessen() { if (songtextFenster) songtextFenster.schliessen(); }
    function songtextFensterHolen() {
      if (songtextFenster) return songtextFenster;
      songtextFenster = global.SongtextFenster.erstellen({
        // Die Hülle kann einen eigenen Behälter geben (PC: direkt im
        // <body>, damit das feste Fenster nicht unter einem transform
        // liegt). Ohne Angabe hängt es im Wurzelelement.
        behaelter: songtextBehaelter || wurzel,
        farbsatz: 'mint',
        // Gemerkte Lage, Größe, Tempo und Schrift (Feld songtextFenster
        // der Einstellungen; fehlt es, gelten die Standardwerte)
        werte: einstellungen.songtextFenster,
        huelle: {
          titel: () => (zustand.aktuell ? zustand.aktuell.titel : null),
          textLaden: (titel) => dq.songtext(titel),
          position: () => spieler.position(),
          // Echte Titeldauer, auch bei fester Spielzeit (Auftrag (5D))
          dauer: () => (zustand.aktuell ? spieler.dauer(zustand.aktuell.titel) : 0),
          spielt: () => zustand.spielt && spieler.laeuft(),
          // Gespeichert wird mit den übrigen Einstellungen (sanft verzögert).
          // Leere Teile (Lage noch nie verändert) bleiben weg - dort gilt
          // weiter der Standard.
          speichern: (werte) => {
            einstellungen.songtextFenster = Object.fromEntries(
              Object.entries(werte).filter(([, wert]) => wert !== null && wert !== undefined));
            speichernGeplant();
          }
        }
      });
      return songtextFenster;
    }
    function songtextUmschalten() {
      if (!songtextMoeglich() || !zustand.aktuell) return;
      songtextFensterHolen().umschalten();
    }

    /* ===================================================================
       EINSTELLUNGEN-FENSTER - Wiedergabe und Effekte
       =================================================================== */
    function baueEinstellungsFenster() {
      const huelle = document.createElement('div');
      huelle.className = 'jbx-kern-huelle';
      huelle.hidden = true;
      huelle.innerHTML = `
        <div class="jbx-kern-panel" role="dialog" aria-label="Einstellungen">
          <header><h2>Einstellungen</h2><button type="button" class="jbx-kern-zu" aria-label="Schließen">✕</button></header>
          <p class="jbx-kern-hinweis">Jede Einstellung wird sofort wirksam und gespeichert.${bewegungReduziert ? ' <b>Dein Gerät wünscht reduzierte Bewegung - deshalb sind die Animationen zu Beginn aus.</b>' : ''}</p>
          <div class="jbx-kern-felder"></div>
          <button type="button" class="jbx-kern-knopf jbx-kern-test">▶ Plattenwechsel jetzt vorführen</button>
        </div>`;
      wurzel.appendChild(huelle);

      const felder = huelle.querySelector('.jbx-kern-felder');
      SCHEMA.forEach((feld) => {
        if (feld.abschnitt) {
          const kopf = document.createElement('h3');
          kopf.className = 'jbx-kern-abschnitt';
          kopf.textContent = feld.abschnitt;
          felder.appendChild(kopf);
          return;
        }
        if (feld.profilZeile) {
          // Schnellwahl im Abschnitt „Effekte": Sie betrifft NUR die
          // Animationen (nicht Design und Plattendrehung).
          const profile = document.createElement('div');
          profile.className = 'jbx-kern-profile';
          profile.innerHTML = '<span>Schnellwahl für die Animationen</span>'
            + '<button type="button" data-profil="standard">Variante-Standard</button>'
            + '<button type="button" data-profil="dezent">Dezent</button>'
            + '<button type="button" data-profil="aus">Alles aus</button>';
          felder.appendChild(profile);
          return;
        }
        if (feld.nurMitSongtext && !songtextMoeglich()) return;
        const zeile = document.createElement('div');
        zeile.className = 'jbx-kern-feld' + (feld.art === 'schalter' ? ' jbx-zeile' : '');
        zeile.dataset.schluessel = feld.schluessel;
        let steuer = '';
        if (feld.art === 'schalter') {
          steuer = `<button type="button" class="jbx-kern-schalter" role="switch" aria-label="${sicher(feld.titel)}"></button>`;
        } else if (feld.art === 'wahl') {
          steuer = `<div class="jbx-kern-segment">${feld.optionen.map(([wert, text]) =>
            `<button type="button" data-wert="${wert}">${sicher(text)}</button>`).join('')}</div>`;
        } else {
          steuer = `<input type="range" min="${feld.min}" max="${feld.max}" step="${feld.schritt}" aria-label="${sicher(feld.titel)}">`;
        }
        zeile.innerHTML = `<span>${sicher(feld.titel)}${feld.art === 'regler' ? ' <output></output>' : ''}</span>${steuer}`;
        felder.appendChild(zeile);

        const setzen = (wert) => {
          // Nutzer entscheidet selbst über die Animationen. Das Design ist
          // keine Animation - sein Umschalten lässt den Bewegungswunsch des
          // Geräts (reduzierte Bewegung) unberührt.
          if (feld.gruppe === 'effekte' && !feld.immerFrei) bewegungsWunschAktiv = false;
          einstellungen[feld.gruppe][feld.schluessel] = wert;
          anwenden(); fensterAktualisieren(); speichernGeplant();
        };
        if (feld.art === 'schalter') {
          zeile.querySelector('.jbx-kern-schalter').addEventListener('click', () =>
            setzen(!(feld.gruppe === 'effekte' ? effekte() : wiedergabe())[feld.schluessel]));
        } else if (feld.art === 'wahl') {
          zeile.querySelectorAll('button').forEach((k) => k.addEventListener('click', () => setzen(k.dataset.wert)));
        } else {
          zeile.querySelector('input').addEventListener('input', (e) => {
            const roh = parseFloat(e.target.value);
            setzen(feld.stufen ? R.spielzeitAusStufe(roh) : roh);
          });
        }
      });

      huelle.querySelectorAll('[data-profil]').forEach((k) => k.addEventListener('click', () => {
        bewegungsWunschAktiv = false;
        Object.assign(einstellungen.effekte, PROFILE[k.dataset.profil]);
        anwenden(); fensterAktualisieren(); speichernGeplant();
      }));
      huelle.querySelector('.jbx-kern-test').addEventListener('click', () => { schliessen(); naechster(); });
      huelle.querySelector('.jbx-kern-zu').addEventListener('click', schliessen);
      huelle.addEventListener('click', (e) => { if (e.target === huelle) schliessen(); });

      function fensterAktualisieren() {
        const e = effekte();
        felder.querySelectorAll('.jbx-kern-feld').forEach((zeile) => {
          const feld = SCHEMA.find((f) => f.schluessel === zeile.dataset.schluessel);
          if (!feld) return;
          const wert = (feld.gruppe === 'effekte' ? e : wiedergabe())[feld.schluessel];
          // Ist „Animationen gesamt" aus, sind die einzelnen Animationen gesperrt
          zeile.classList.toggle('jbx-gesperrt', feld.gruppe === 'effekte' && !feld.haupt && !feld.immerFrei && !e.animationen);
          if (feld.art === 'schalter') zeile.querySelector('.jbx-kern-schalter').setAttribute('aria-checked', String(!!wert));
          if (feld.art === 'wahl') zeile.querySelectorAll('button').forEach((k) => k.setAttribute('aria-pressed', String(k.dataset.wert === wert)));
          if (feld.art === 'regler') {
            zeile.querySelector('input').value = feld.stufen ? R.stufeAusSpielzeit(wert) : wert;
            zeile.querySelector('output').textContent = feld.anzeige(wert);
          }
        });
        // Überblenddauer nur sinnvoll, wenn Auto-Mix an ist
        const dauerZeile = felder.querySelector('[data-schluessel="ueberblendDauer"]');
        if (dauerZeile) dauerZeile.classList.toggle('jbx-gesperrt', !wiedergabe().ueberblenden);
        huelle.querySelectorAll('[data-profil]').forEach((k) => {
          const p = PROFILE[k.dataset.profil];
          k.classList.toggle('jbx-gewaehlt', Object.keys(p).every((s) => e[s] === p[s]));
        });
      }

      function schliessen() { huelle.hidden = true; }
      return () => { fensterAktualisieren(); huelle.hidden = false; huelle.querySelector('.jbx-kern-zu').focus(); };
    }

    /* ===================================================================
       BELEGUNGS-DIALOG: Genre-Knopf mit einer Playlist verknüpfen
       Drei Wege (Auftrag 13, Phase 2 (2D)):
       (1) lokal gespeicherte Playlist
       (2) aus der eigenen YouTube-Music-Mediathek - wird zuerst lokal gespeichert
       (3) eingefügter Playlist-Link - ebenso
       Der Knopf zeigt IMMER auf die lokale Kopie, nie direkt auf YouTube.
       =================================================================== */
    function belegungsDialog(nr) {
      if ($('.jbx-kern-huelle.jbx-mitte')) return;
      const genre = genres()[nr];
      let symbol = genre.symbol;
      const kontoMoeglich = typeof dq.kontoUebernehmen === 'function';
      const huelle = document.createElement('div');
      huelle.className = 'jbx-kern-huelle jbx-mitte';

      const lokaleOptionen = () => {
        const liste = Array.from(playlisten.values()).sort((a, b) => a.name.localeCompare(b.name, 'de'));
        const fehlt = playlistFehlt(genre)
          ? `<option value="${sicher(genre.playlist)}" selected>⚠ Playlist fehlt: ${sicher(genre.playlist)}</option>` : '';
        return fehlt + liste.map((p) =>
          `<option value="${sicher(p.id)}"${p.id === genre.playlist ? ' selected' : ''}>${sicher(p.name)} (${p.anzahl} Titel)${p.quelle_playlist_id ? ' · YouTube-Kopie' : ''}</option>`).join('');
      };

      huelle.innerHTML = `
        <div class="jbx-kern-panel" role="dialog" aria-label="Genre-Knopf belegen">
          <header><h2>Genre-Knopf ${nr + 1} belegen</h2><button type="button" class="jbx-kern-zu" aria-label="Schließen">✕</button></header>
          <p class="jbx-kern-hinweis">Zur Auswahl stehen alle lokal gespeicherten Playlisten. Eine Playlist aus YouTube Music wird zuerst lokal gespeichert und dann zugeordnet. Wird eine Playlist später umbenannt, muss der Knopf neu belegt werden.</p>
          <div class="jbx-kern-feld"><span>Beschriftung (höchstens ${NAME_MAXLAENGE} Zeichen)</span><input type="text" class="jbx-name-eingabe" maxlength="${NAME_MAXLAENGE}" value="${sicher(genre.name)}"></div>
          <div class="jbx-kern-feld"><span>Symbol</span><div class="jbx-kern-symbole">${Object.keys(SYMBOLE).map((s) =>
            `<button type="button" class="jbx-kern-knopf" data-symbol="${s}" aria-pressed="${s === symbol}" title="${s}">${symbolSvg(s)}</button>`).join('')}</div></div>
          <div class="jbx-kern-feld"><span>Verknüpfte Playlist</span><select class="jbx-playlist-wahl">
            <option value="">— keine Playlist —</option>
            <optgroup class="jbx-lokal-gruppe" label="Lokal gespeicherte Playlisten">${lokaleOptionen()}</optgroup>
            ${kontoMoeglich && dq.kontoPlaylisten ? '<optgroup class="jbx-konto-gruppe" label="Aus dem YouTube-Music-Konto (wird zuerst lokal gespeichert)"><option disabled>… wird geladen</option></optgroup>' : ''}
          </select>
          <p class="jbx-kern-hinweis jbx-konto-hinweis" hidden></p></div>
          ${kontoMoeglich ? `
          <div class="jbx-kern-feld"><span>… oder Link einer YouTube-Playlist einfügen</span>
            <input type="text" class="jbx-link-eingabe" placeholder="https://music.youtube.com/playlist?list=…">
            <p class="jbx-kern-hinweis">Auch öffentliche Playlisten anderer - das geht meist auch ohne Anmeldung. Sie wird geladen und lokal gespeichert.</p></div>` : ''}
          <div class="jbx-kern-konto" hidden><span class="jbx-konto-stand"></span>
            <button type="button" class="jbx-kern-knopf jbx-aktualisieren">Von YouTube aktualisieren</button></div>
          <div class="jbx-kern-dialog-knoepfe"><span class="jbx-arbeitet" hidden></span><button type="button" class="jbx-kern-knopf jbx-abbrechen">Abbrechen</button><button type="button" class="jbx-kern-knopf jbx-haupt">Übernehmen</button></div>
        </div>`;
      wurzel.appendChild(huelle);

      const wahl = huelle.querySelector('.jbx-playlist-wahl');
      const arbeitet = huelle.querySelector('.jbx-arbeitet');
      const zu = () => huelle.remove();
      const beschaeftigt = (text) => {
        arbeitet.textContent = text || '';
        arbeitet.hidden = !text;
        huelle.querySelectorAll('button, input, select').forEach((e) => { e.disabled = !!text; });
      };

      // „Lokale Kopie von YouTube · Stand …" für die gewählte Playlist
      const kontoKastenZeigen = () => {
        const p = playlisten.get(wahl.value);
        const kasten = huelle.querySelector('.jbx-kern-konto');
        const zeigen = !!p && !!p.quelle_playlist_id;
        kasten.hidden = !zeigen;
        if (!zeigen) return;
        const stand = p.quelle_stand ? new Date(p.quelle_stand).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : 'unbekannt';
        huelle.querySelector('.jbx-konto-stand').textContent = `Lokale Kopie von YouTube · Stand ${stand}`;
        huelle.querySelector('.jbx-aktualisieren').hidden = typeof dq.kontoAktualisieren !== 'function';
      };
      wahl.addEventListener('change', kontoKastenZeigen);
      kontoKastenZeigen();

      // Mediathek nachladen (dauert einige Sekunden). Ohne Anmeldung nur ein
      // Hinweis - der Link-Weg bleibt trotzdem bedienbar.
      if (kontoMoeglich && dq.kontoPlaylisten) {
        const gruppe = huelle.querySelector('.jbx-konto-gruppe');
        const hinweis = huelle.querySelector('.jbx-konto-hinweis');
        dq.kontoPlaylisten().then((antwort) => {
          if (!antwort.angemeldet) {
            gruppe.innerHTML = '<option disabled>Anmeldung nötig</option>';
            hinweis.textContent = 'Die eigene Mediathek ist nur mit gültiger Anmeldung bei YouTube Music lesbar. Ein Playlist-Link funktioniert bei öffentlichen Playlisten auch ohne.';
            hinweis.classList.add('jbx-warn');
            hinweis.hidden = false;
            return;
          }
          gruppe.innerHTML = antwort.playlisten.length
            ? antwort.playlisten.map((k) => `<option value="konto:${sicher(k.kontoId)}">${sicher(k.name)}${k.anzahl != null ? ` (${k.anzahl} Titel)` : ''}</option>`).join('')
            : '<option disabled>Keine Playlisten in der Mediathek</option>';
        }).catch((fehler) => {
          gruppe.innerHTML = '<option disabled>Mediathek nicht lesbar</option>';
          hinweis.textContent = `Mediathek nicht lesbar: ${fehler.message}`;
          hinweis.classList.add('jbx-warn');
          hinweis.hidden = false;
        });
      }

      huelle.querySelectorAll('[data-symbol]').forEach((k) => k.addEventListener('click', () => {
        symbol = k.dataset.symbol;
        huelle.querySelectorAll('[data-symbol]').forEach((x) => x.setAttribute('aria-pressed', String(x === k)));
      }));
      huelle.querySelector('.jbx-kern-zu').addEventListener('click', zu);
      huelle.querySelector('.jbx-abbrechen').addEventListener('click', zu);
      huelle.addEventListener('click', (e) => { if (e.target === huelle && arbeitet.hidden) zu(); });

      // „Von YouTube aktualisieren": bewusst, mit Rückfrage (Antwort 3D)
      huelle.querySelector('.jbx-aktualisieren').addEventListener('click', async () => {
        const id = wahl.value;
        const p = playlisten.get(id);
        if (!p) return;
        const ja = global.confirm(`„${p.name}" von YouTube aktualisieren?\n\n`
          + 'Die lokale Kopie wird durch den aktuellen Stand von YouTube ersetzt. '
          + 'Lokale Änderungen an dieser Playlist gehen dabei verloren.');
        if (!ja) return;
        beschaeftigt('Wird von YouTube geladen …');
        try {
          const erg = await dq.kontoAktualisieren(id);
          geladen.delete(id);
          await playlistenNeuLesen();
          meldung(`„${p.name}" von YouTube aktualisiert: ${erg.neu} neu, ${erg.entfernt} entfernt (jetzt ${erg.anzahl} Titel).`);
          beschaeftigt('');
          // Titelzahl und Stand in der Auswahl auffrischen, Auswahl behalten
          huelle.querySelector('.jbx-lokal-gruppe').innerHTML = lokaleOptionen();
          wahl.value = id;
          kontoKastenZeigen();
          if (angezeigteId() === id) { await playlistHolen(id); zeichneAlles(); }
        } catch (fehler) {
          beschaeftigt('');
          meldung(`Aktualisieren nicht möglich: ${fehler.message}`, true);
        }
      });

      huelle.querySelector('.jbx-haupt').addEventListener('click', async () => {
        const name = huelle.querySelector('.jbx-name-eingabe').value.trim();
        if (name.length > NAME_MAXLAENGE) { meldung(`Die Beschriftung darf höchstens ${NAME_MAXLAENGE} Zeichen haben.`, true); return; }
        let ziel = wahl.value || null;
        const link = (huelle.querySelector('.jbx-link-eingabe') || {}).value?.trim();

        // Link oder Konto-Playlist: zuerst LOKAL speichern, dann zuordnen.
        let quelle = null;
        if (link) {
          if (!/[?&]list=[\w-]+/.test(link)) { meldung('Das ist kein Playlist-Link (es fehlt „list=…").', true); return; }
          quelle = { link };
        } else if (ziel && ziel.startsWith('konto:')) {
          quelle = { kontoId: ziel.slice('konto:'.length) };
        }
        if (quelle) {
          beschaeftigt('Playlist wird von YouTube geladen …');
          try {
            const id = await dq.kontoUebernehmen(quelle);
            beschaeftigt('');
            if (!id) return;                          // Nutzer hat beim Speichern abgebrochen
            await playlistenNeuLesen();
            geladen.delete(id);
            ziel = id;
            const p = playlisten.get(id);
            meldung(`„${p ? p.name : id}" lokal gespeichert${p ? ` (${p.anzahl} Titel)` : ''} und dem Knopf zugeordnet.`);
          } catch (fehler) {
            beschaeftigt('');
            meldung(`Übernehmen nicht möglich: ${fehler.message}`, true);
            return;
          }
        }

        genre.name = name || genre.name;
        genre.symbol = symbol;
        genre.playlist = ziel;
        speichernGeplant();
        zu();
        if (genre.playlist) genreWaehlen(nr); else { zeichneGenres(); zeichneAlles(); }
      });
      huelle.querySelector('.jbx-name-eingabe').focus();
    }

    /* ===================================================================
       START
       =================================================================== */
    async function hochfahren() {
      try {
        const [geladeneEinstellungen] = await Promise.all([dq.einstellungenLaden(), playlistenNeuLesen()]);
        einstellungen = geladeneEinstellungen;
        // Ältere Datenquellen kennen die Plattendrehung noch nicht: Standard.
        if (einstellungen.effekte && !(einstellungen.effekte.umdrehungSekunden >= 2)) {
          einstellungen.effekte.umdrehungSekunden = UMDREHUNG_STANDARD;
        }
        // Design (Auftrag 16): fehlt es (ältere Datenquelle) oder ist es
        // unbekannt (z. B. ein Design, das es hier nicht gibt), gilt der
        // Standard. Gespeichert wird erst, wenn der Nutzer etwas ändert.
        if (einstellungen.effekte) einstellungen.effekte.design = designGueltig(einstellungen.effekte.design);
        // Perspektive ebenso: fehlt sie oder ist sie unbekannt, gilt „stark".
        if (einstellungen.effekte) einstellungen.effekte.perspektive = perspektiveGueltig(einstellungen.effekte.perspektive);
      } catch (fehler) {
        wurzel.querySelector('.jbx-titel-liste').innerHTML =
          `<li class="jbx-titel-leer">Der Jukeboxer konnte nicht starten: ${sicher(fehler.message)}</li>`;
        meldung(`Jukeboxer: ${fehler.message}`, true);
        return;
      }
      warnungenZeigen();
      anwenden();
      setzeSpielt(false);

      $('.jbx-knopf-zurueck').addEventListener('click', (e) => { rueckmeldung(e.currentTarget); vorheriger(); });
      $('.jbx-knopf-weiter').addEventListener('click', (e) => { rueckmeldung(e.currentTarget); naechster(); });
      $('.jbx-knopf-pause').addEventListener('click', (e) => { rueckmeldung(e.currentTarget); pauseUmschalten(); });
      // −10 / +10 und der Fortschrittsbalken spulen über dieselbe Funktion
      $('.jbx-knopf-rueck10').addEventListener('click', () => spulenAuf(spieler.position() - 10));
      $('.jbx-knopf-vor10').addEventListener('click', () => spulenAuf(spieler.position() + 10));
      spulenEinrichten();
      $('.jbx-seite-zurueck').addEventListener('click', () => { if (zustand.seite > 0) { zustand.seite--; zeichneAlles(); } });
      $('.jbx-seite-vor').addEventListener('click', () => { if (zustand.seite < seitenAnzahl() - 1) { zustand.seite++; zeichneAlles(); } });
      $('.jbx-songtext-knopf').addEventListener('click', songtextUmschalten);

      const oeffneEinstellungen = baueEinstellungsFenster();
      $('.jbx-einstellungen-knopf').addEventListener('click', (e) => { rueckmeldung(e.currentTarget); oeffneEinstellungen(); });
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !wurzel.offsetParent) return;
        $$('.jbx-kern-huelle').forEach((h) => { if (h.classList.contains('jbx-mitte')) h.remove(); else h.hidden = true; });
        // Das Songtext-Fenster schließt Esc nur, wenn es den Fokus hat -
        // das erledigt es selbst (songtext_fenster.js).
      });

      const zuletzt = Number(einstellungen.zuletzt_genre) || 0;
      zustand.angezeigtesGenre = zuletzt >= 1 && zuletzt <= ANZAHL_GENRES ? zuletzt - 1 : 0;
      zeichneModus();
      lautstaerkeEinrichten();
      zeichneWarteschlange();
      await genreWaehlen(zustand.angezeigtesGenre, true);
    }
    hochfahren();

    return {
      oeffentlich: {
        /** Von außen anhalten (PC: wenn der PlayDecker zu spielen beginnt). */
        pausieren() { if (zustand.spielt) anhalten(); },
        /** Nur Mobil-Version (Auftrag 15): Nach der Rückkehr in die App den
            Ton wieder anstoßen, falls das System den Player angehalten hat,
            der Jukeboxer aber spielen SOLL. Startet nie aus der Stille - die
            Party-Regel bleibt damit unberührt. Liefert true, wenn ein
            Weiter-Befehl nötig war. Der PC ruft das nie auf. */
        fortsetzen() {
          if (!zustand.spielt || zustand.wechselLaeuft || spieler.laeuft()) return false;
          spieler.abspielen();
          return true;
        },
        /** Läuft der Ton wirklich (Player meldet „läuft")? Anders als
            spielt() unterscheidet das „soll spielen" von „spielt". */
        tonLaeuft() { return zustand.spielt && spieler.laeuft(); },
        /** Spielt der Jukeboxer gerade? */
        // Auch während eines Plattenwechsels: Der Ton kommt gleich, andere
        // Abspieler sollen in dieser Zeit nicht anlaufen (Party-Regel).
        spielt() { return zustand.spielt || zustand.wechselLaeuft; },
        /** Kopie der aktuellen Einstellungen (nur lesen) - z. B. für den
            Dialog „Mobil-Paket", der die Genre-Belegung anzeigt. */
        einstellungenKopie() { return einstellungen ? JSON.parse(JSON.stringify(einstellungen)) : null; },
        /** Zahl der vorgemerkten Titel (nur lesen). Mobil-Version: Anzeige
            „3 Titel in der Warteschlange" im Titelwahl-Fenster. */
        warteschlangeLaenge() { return zustand.warteschlange.length; },
        /** Nur zum Nachmessen: Zustand beider Player und des Kerns. */
        diagnose() {
          return { spielt: zustand.spielt, wechsel: zustand.wechselLaeuft,
            titel: zustand.aktuell && zustand.aktuell.titel.titel, position: Number(spieler.position().toFixed(1)),
            ende: zustand.aktuell ? Number(spielEndeVon(zustand.aktuell.titel).toFixed(1)) : 0,
            blendet: spieler.blendetGerade(), gesperrt: Array.from(gesperrteIds), player: spieler.diagnose() };
        }
      }
    };
  }

  global.JukeboxerKern = Object.freeze({
    starten,
    pausieren() { if (kern) kern.oeffentlich.pausieren(); },
    spielt() { return !!kern && kern.oeffentlich.spielt(); },
    fortsetzen() { return !!kern && kern.oeffentlich.fortsetzen(); },
    tonLaeuft() { return !!kern && kern.oeffentlich.tonLaeuft(); },
    diagnose() { return kern ? kern.oeffentlich.diagnose() : null; },
    warteschlangeLaenge() { return kern ? kern.oeffentlich.warteschlangeLaenge() : 0; },
    einstellungenKopie() { return kern ? kern.oeffentlich.einstellungenKopie() : null; }
  });
})(typeof window !== 'undefined' ? window : globalThis);
