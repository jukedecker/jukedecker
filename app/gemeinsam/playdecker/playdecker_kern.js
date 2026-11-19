/* =====================================================================
   PLAYDECKER-KERN (Auftrag 15, Phase 1)

   Der ganze PlayDecker: zwei Decks, Warteschlangen, Crossfader, Auto-Mix,
   feste Spielzeit, Wächter, Einstellungsfenster, Plattenspieler, Songtext.
   Bis Auftrag 15 stand er in app.js (Abschnitte (10) bis (10g) und (10d)).
   Er wurde von dort WÖRTLICH hierher verschoben - so wie der Jukeboxer seit
   Auftrag 13 seinen eigenen Kern hat -, damit er unverändert auch in der
   Mobil-Version (JukeDecker) läuft.

   DIE WICHTIGSTE REGEL: Dieser Kern kennt den PlayLister nicht.
   (1) Kein fetch, keine Server-Adresse, kein Server-Pfad. Alles, was von außen
       kommt (Playlisten, Songtexte, Merken), geht über die übergebene
       „Umgebung" (Vertrag unten).
   (2) Er sucht seine Elemente nur INNERHALB seiner Wurzel (#panel-deck).
       Kopfleiste und Reiter des PC reicht die Hülle herein.
   (3) Gemeinsame Bausteine benutzt er wie bisher über ihre globalen Namen:
       WiedergabeRegeln, PlattenspielerDetail, PlayListerDesigns,
       SongtextFenster, JukeboxerKern (Party-Regel), YT (YouTube).

   WARUM DER ALTE CODE NICHT EINGERÜCKT IST: Er steht unten unverändert im
   Rumpf von starten(). Ein Einrücken hätte auch den Inhalt mehrzeiliger
   Text-Vorlagen (`…`) verändert - und damit Leerzeichen im erzeugten
   HTML. Geprüft wird das Zeichen für Zeichen mit pruefe_playdecker_gleich.py.

   WARUM OHNE 'use strict': app.js lief ohne. Der verschobene Code soll sich
   genau so verhalten wie vorher - auch in Grenzfällen.

   ---------------------------------------------------------------------
   START:  const kern = PlayDeckerKern.starten({ wurzel, umgebung,
                                                 reiterKnopf?, groessenQuellen? })
     wurzel           - das Panel #panel-deck mit dem fertigen HTML-Gerüst
                        (alle IDs deck-…). Das Gerüst muss VORHER stehen.
     reiterKnopf      - wahlfrei: Knopf, dessen Klick das Panel sichtbar
                        macht (PC: der Reiter „PlayDecker"). Danach werden
                        die Plattenspieler-Fenster nachgemessen.
     groessenQuellen  - wahlfrei: Elemente außerhalb der Wurzel, deren
                        Größenänderung ein Nachmessen auslöst (PC: .kopf,
                        .reiter).
   Läuft genau EINMAL (ein zweiter Aufruf wirft einen Fehler) und führt
   dabei aus, was früher beim Laden von app.js an dieser Stelle lief.

   VERTRAG: DIE UMGEBUNG (Pflicht, wenn nicht anders gesagt)
     auswahlFuellen(feld)       - hängt die Playlist-Einträge an ein
                                  Auswahlfeld an (die Zeile „Playlist
                                  wählen …" steht schon). value = Kennung,
                                  die der Hülle etwas sagt.
     playlistBeschreiben(kennung) -> { name, lokaleId? } | { meldung } | null
                                  name = Anzeige beim Laden; lokaleId = id
                                  der lokalen Playlist (Dateiname ohne .json,
                                  fürs Mobil-Paket); meldung = nicht laden,
                                  Meldung am Deck zeigen; null = still nichts
                                  tun.
     playlistLaden(kennung)     -> Promise<{ name, titel: [Titel] }>
                                  Titel wie im Playlist-Format 2 (video_id,
                                  titel, interpret, dauer_sekunden, bild?, …)
     ueberschreibenBestaetigt(was, bisher) -> bool oder Versprechen (bool)
                                  Rückfrage, bevor eine gefüllte
                                  Warteschlange ersetzt wird. Der Kern
                                  wartet auf die Antwort (seit Nachbesserung
                                  3 fragt der PC im Seitenstil, nicht mehr
                                  mit confirm() - das beendete das Vollbild).
     quellenEinrichten?({ decks, auswahlFuellen })
                                - die Hülle richtet ihre Playlist-Quellen ein
                                  (PC: Reiter-Klick, Fokus, erstes Füllen).
     standAnmelden(name, sichern, einspielen, alterName?)
     standGeplant()             - Merken: wie standTeilAnmelden/standGeplant
                                  in app.js (Stand-Teil „playdecker").
     youtubeLaden()             -> Promise, sobald window.YT bereitsteht
                                  (gemeinsamer Lader - es darf nur EINEN
                                  geben, sonst überschreiben sich die Rückrufe).
     vorschauBeenden?()         - Party-Regel (3): Startet ein Deck, endet eine
                                  laufende Vorschau (PC: ChartLister).
     songtext(titel)            -> Promise<{ vorhanden, text?, zeilen?, quelle?,
                                  grund? }> für das Songtext-Fenster.
     NUR JUKEDECKER-APP (Auftrag 15, Phase 4), am PC nicht gesetzt:
     automatikRuht?()           -> bool: Seite verborgen bzw. Rückkehr in
                                  Prüfung - Auto-Mix, feste Spielzeit und
                                  Wächter ruhen, eine Überblendung steht.
     werbungLaeuft?(deck)       -> bool: dieses Deck zeigt gerade Werbung -
                                  eine Überblendung dorthin wartet, der
                                  Wächter hält es nicht für Stille.
     automixMelden?(text)       - jede Entscheidung des Auto-Mix mit Grund.
     NUR JUKEDECKER-APP (Auftrag 15, Nachbesserung 1), am PC nicht gesetzt:
     hatSongtext?(titel)        -> bool: Liegt zu diesem Titel ein Songtext
                                  vor? Dann trägt er in der Warteschlange und
                                  auf der Titelkarte des Decks ein kleines „♪".
                                  Fehlt der Haken, entsteht genau dasselbe
                                  HTML wie bisher.

   VON AUSSEN (Rückgabe von starten):
     decks, DECK_LAEUFT, deckZeitText, deckMelden, deckAuswahlFuellen,
     deckTitelAnzeigen, deckQueueZeichnen, deckAnzeigeNachfuehren,
     paketWerte() (Werte fürs Mobil-Paket, Block „playdecker"),
     deckTitelImPlayer(deck) (Nachbesserung 4, E1: der Titel, den der
     Player spielt - auch der alte nach dem Laden einer neuen Liste),
     Abschluss Auftrag 15 („An Deck senden“): deckFrischeListeBereitlegen
     (deck, imPlayer) - der einzige Weg, auf dem die Hülle einen Titel im
     Player eines Decks bereitlegt; dazu nur lesend
     deckSpieltOderStartet(deck) und deckTitelVomPlayer(deck)
   Die PC-Hülle braucht sie für „An Deck senden", „Lokal" und „CSV"
   (app.js, Abschnitte (10c) und (10h)).
   Dazu wie bisher die Messhilfen window.playdeckerTaktmessung(),
   window.playdeckerTaktergebnis() und window.playdeckerProtokoll().
   ===================================================================== */
(function (global) {

  // Die übergebene Umgebung und Wurzel (siehe Kopf). Gesetzt in starten().
  let umgebung = null;
  let kernWurzel = null;
  let gestartet = false;
  // L3 (Nachbesserung 3): Wartet der PlayDecker nach einem Bereitlegen von
  // Hand auf einen Start? Erklärung bei deckRuheBisStart. Steht HIER oben,
  // weil der übrige Code erst in starten() Zeile für Zeile entsteht - eine
  // Variable weiter unten gäbe es noch nicht, falls schon beim Start
  // (Stand wiederherstellen) etwas springt.
  let deckWartetAufStart = false;

  /** Ein Element des PlayDeckers über seine ID - gesucht nur in der Wurzel. */
  function kernElement(id) {
    return kernWurzel.querySelector('#' + id);
  }

  /** Merken anstoßen (gebündelt, siehe standGeplant in app.js). */
  function standGeplant() {
    umgebung.standGeplant();
  }

  /** Die YouTube-Schnittstelle - über den GEMEINSAMEN Lader der Hülle. */
  function ytSchnittstelleLaden() {
    return umgebung.youtubeLaden();
  }

  /* --- NUR JUKEDECKER-APP (Auftrag 15, Phase 4): wahlfreie Haken der
     Umgebung. Am PC sind sie NICHT gesetzt - dann liefern die drei
     Helfer „nein" bzw. tun nichts, und der PlayDecker verhält sich genau
     wie bisher (geprüft mit pruefe_playdecker_gleich.py).
     automatikRuht()      -> bool: Die Seite ist verborgen (Sperre,
                            App-Wechsel) oder die Rückkehr wird gerade
                            geprüft. Dann ruhen Auto-Mix, feste Spielzeit
                            und Wächter, und eine laufende Überblendung
                            bleibt an ihrer Stelle stehen. Entschieden wird
                            danach wieder an der POSITION der Player, nie an
                            der vergangenen Uhrzeit - kein Überblenden „im
                            Nachhinein".
     werbungLaeuft(deck)  -> bool: Das Deck zeigt gerade Werbung (erkannt von
                            der Hülle am Zustand des Players: „ungestartet",
                            Zeit läuft). Dann wartet eine Überblendung auf
                            dieses Deck, bis der eigentliche Titel läuft, und
                            der Wächter hält Werbung nicht für Stille.
     automixMelden(text)  -  jede Entscheidung des Auto-Mix mit Grund (fürs
                            Protokoll der App, Lehre M17C). */
  function automatikRuht() { return !!(umgebung.automatikRuht && umgebung.automatikRuht()); }
  function werbungLaeuft(deck) { return !!(deck && umgebung.werbungLaeuft && umgebung.werbungLaeuft(deck)); }
  function automixMelden(text) { if (umgebung.automixMelden) umgebung.automixMelden(text); }
  /* --- NUR JUKEDECKER-APP (Auftrag 15, Nachbesserung 1, N4): Kennung
     „Songtext vorhanden". Die App sagt über den wahlfreien Haken
     hatSongtext(titel), zu welchen Titeln ihr Paket einen Text mitbringt;
     diese Titel tragen dann ein kleines „♪" vor dem Titel. Am PC fehlt der
     Haken - dann liefert diese Funktion einen LEEREN Text, und das HTML der
     Warteschlange und der Titelkarte ist Zeichen für Zeichen dasselbe wie
     bisher (geprüft mit pruefe_playdecker_gleich.py). */
  function songtextMarke(titel) {
    if (!umgebung.hatSongtext || !titel) return '';
    let vorhanden = false;
    try { vorhanden = !!umgebung.hatSongtext(titel); } catch (fehler) { vorhanden = false; }
    return vorhanden ? '<span class="songtext-marke" title="Songtext vorhanden" aria-label="Songtext vorhanden">♪</span>' : '';
  }
  const sek =(s) => (Math.round((Number(s) || 0) * 10) / 10).toFixed(1);

  /** Schützt Texte davor, als HTML gelesen zu werden. (Wörtlich wie
      discSchuetzen in app.js - der Kern braucht sie für Titel und
      Interpreten.) */
  function discSchuetzen(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Chart-Marke eines Titels: Jahr und Platzierungen (DE001_UK012), sonst
      die Länder. Wörtlich wie chartMarkeText in app.js. */
  function chartMarkeText(eintrag) {
    const teile = [];
    if (eintrag.jahr != null) teile.push(String(eintrag.jahr));

    const p = eintrag.platzierungen || {};
    const plaetze = ['DE', 'UK', 'US']
      .filter(land => land in p)
      .map(land => `${land}${String(p[land]).padStart(3, '0')}`);
    if (plaetze.length) teile.push(plaetze.join('_'));
    else if (Array.isArray(eintrag.countries) && eintrag.countries.length) {
      // Länder bekannt, aber keine Platzierung - dann wenigstens die Länder.
      teile.push(eintrag.countries.join('_'));
    }

    return teile.join(' · ');
  }

  function starten(startAngaben) {
    if (gestartet) throw new Error('Der PlayDecker-Kern läuft schon.');
    gestartet = true;
    kernWurzel = startAngaben.wurzel;
    umgebung = startAngaben.umgebung;

/* ---------------------------------------------------------------------
   AB HIER: der bisherige PlayDecker aus app.js, unverändert bis auf die
   im Kopf genannten Stellen (Umgebung, Wurzel). Nicht eingerückt - siehe
   Kopf.
   --------------------------------------------------------------------- */

/* ====================================================================
   (10) PlayDecker — Zwei-Deck-Player (Bauauftrag 08, Phase 2)

   Zwei getrennte YouTube-Player, jeder mit eigener Playlist,
   Warteschlange und Lautstärke.

   VIER ENTSCHEIDUNGEN, DIE DIREKT AUS DER M5-MESSUNG STAMMEN:

   (1) Der Fortschritt läuft über setInterval, NICHT über
       requestAnimationFrame. Gemessen: In einem Tab, der nicht im
       Vordergrund steht, hält der Browser requestAnimationFrame
       vollständig an — 0 Bilder in 2 Sekunden, während setInterval im
       selben Zeitraum 125 Takte lieferte. Eine darauf gebaute Blende
       bliebe mitten im Übergang stehen, beide Decks halblaut, bis
       jemand den Tab wieder ansieht. Das gilt für den Auto-Mix in
       Phase 3 genauso wie für die Fortschrittsanzeige hier.

   (2) Die Player werden ERST beim ersten Klick angelegt. Autoplay ohne
       Nutzergeste ist Browsersache und in der Messumgebung nicht
       verlässlich prüfbar gewesen (dort war die Sperre gelockert).
       Ein Aufbau, der eine Geste voraussetzt, ist unabhängig davon
       richtig — und er vermeidet nebenbei, dass beim bloßen Öffnen des
       Reiters eine Verbindung zu YouTube entsteht.

   (3) Der Plattenteller dreht sich nur, wenn der Player wirklich im
       Zustand „läuft" ist — nicht, wenn ein Knopf gedrückt wurde. Er
       ist damit die ehrlichste Anzeige im Reiter.

   (4) Das Titelende kommt als eigener Zustand (ENDED) und kam in der
       Messung zuverlässig genau EINMAL. Darauf schaltet die
       Warteschlange weiter.
   ==================================================================== */

// Wie oft Position und Fortschritt nachgeführt werden. 250 ms sind für
// das Auge flüssig genug und belasten nichts.
const DECK_TAKT_MS = 250;

// Zustandsnummern der YouTube-Schnittstelle, ausgeschrieben.
const DECK_LAEUFT = 1, DECK_BEENDET = 0;
// „Puffert“ heißt: Der Player wurde gestartet und lädt gerade - er soll
// gleich spielen (Nachbesserung 3: zählt bei L1 und L3 wie „läuft“).
const DECK_PUFFERT = 3;

/** Ein Deck. Beide Decks sind bis auf die Kennung gleich gebaut —
    deshalb EINE Beschreibung und zweimal dieselbe Logik, statt zwei
    Hälften, die mit der Zeit auseinanderlaufen. */
function deckAnlegen(kennung) {
  const e = id => kernElement(`deck-${kennung}-${id}`);
  return {
    kennung,
    spieler: null,
    titel: [],          // die geladene Playlist
    laufend: -1,        // welcher Titel gerade dran ist
    // E1 (Auftrag 15, Nachbesserung 4): Wurde eine neue Liste geladen,
    // während das Deck spielte, läuft der Titel von VORHER im Player zu
    // Ende. Er gehört nicht mehr zur Liste; hier steht er, solange er
    // läuft. Gilt nur, solange `laufend` -1 ist (Marke VOR Titel 1) -
    // siehe deckAlterTitelLaeuft.
    altTitel: null,
    listenName: '',
    // Aus welcher LOKALEN Playlist die Warteschlange geladen wurde (id =
    // Dateiname ohne .json), sonst null. Unsichtbar; das Mobil-Paket nimmt
    // sie als „zuletzt gewählte Playlist je Deck" mit (Auftrag 15, R6).
    quellePlaylist: null,
    laeuft: false,
    gesperrt: new Set(),  // video_id -> Einbetten nicht erlaubt
    // Auto-Mix (Phase 3): `uebergeben` merkt sich, dass an das andere
    // Deck übergeben wurde — dann rückt dieses Deck am Titelende nur
    // still weiter. `blendeFuer` verhindert, dass für denselben Titel
    // zweimal übergeblendet wird.
    uebergeben: false,
    blendeFuer: null,
    // --- Nachtrag 06.08.2026, Abend ---
    // `wiederholen`: Läuft die Warteschlange am Ende wieder von vorn an?
    //   Je Deck getrennt schaltbar (A4).
    // `fertig`: Diese Warteschlange ist durchgelaufen. Ein fertiges Deck
    //   bekommt KEINE Übergabe mehr — sonst spielte das andere Deck den
    //   letzten Titel hier ein zweites Mal an, statt allein weiterzulaufen
    //   (A2).
    wiederholen: false,
    fertig: false,
    // --- Nachtrag 12.08.2026, Änderungswunsch 4 ---
    // `blendFaktor`: Dämpfung DIESES Decks zwischen 0 und 1, mit der die
    //   vom Crossfader vorgegebene Lautstärke multipliziert wird. Nur für
    //   den Titelwechsel von Hand (Ausblenden - laden - Einblenden). Im
    //   Ruhezustand IMMER 1; alles andere wäre ein stummes Deck.
    // `titelBlende`: der gerade laufende Wechsel dieser Art, sonst null.
    //   Trägt eine Frist mit, damit der Wächter eine hängende Blende von
    //   einer laufenden unterscheiden kann.
    blendFaktor: 1,
    titelBlende: null,
    el: {
      karte: kernElement(`deck-${kennung}-karte`),
      auswahl: e('auswahl'), laden: e('laden'), teilen: e('teilen'),
      listeName: e('liste'), anzahl: e('anzahl'),
      teller: e('teller'), label: e('label'), rahmen: e('rahmen'),
      balken: e('balken'), position: e('position'), dauer: e('dauer'),
      titelZeile: e('titel'), meldung: e('meldung'),
      spielKnopf: e('spiel'), vor: e('vor'), zurueck: e('zurueck'),
      rueck: e('rueck'), spul: e('spul'),
      queue: e('queue'), queueZahl: e('queue-zahl'),
      qAlle: e('q-alle'), qKeine: e('q-keine'), qZahl: e('q-zahl'),
      qHoch: e('q-hoch'), qRunter: e('q-runter'), qWeg: e('q-weg'),
      qWiederholen: e('q-wiederholen'),
      qMischen: e('q-mischen'),
      qLokal: e('q-lokal'),
    },
    // Angekreuzte Zeilen für die Mehrfachbearbeitung. Gemerkt wird die
    // VIDEOKENNUNG, nicht die Position: Beim Verschieben ändern sich
    // die Positionen, die Kennung bleibt.
    markiert: new Set(),
    // Welche Titel schon gelaufen sind. Sie werden gedämpft angezeigt,
    // aber NICHT gelöscht - so kann man zurückspringen.
    gespielt: new Set(),
  };
}

const decks = { a: deckAnlegen('a'), b: deckAnlegen('b') };

/* --- Plattenspieler der Decks (Auftrag 16, Phase 3) ---------------------
   Jedes Deck trägt denselben detaillierten Plattenspieler wie der
   Jukeboxer (gemeinsamer Baustein static/gemeinsam/plattenspieler_detail.js).
   In index.html steht je Deck nur der Rohbau als Mini-Wurzel „.jbx"
   (#deck-a-teller, #deck-b-teller); hier kommen die Detailteile dazu:
   (1) Rahmenart „rechteck" - das Deck-Fenster hat keinen Kuppelbogen,
       das Gerät sitzt senkrecht mittig.
   (2) Frontschrift „PLAYDECKER · DECK A" bzw. „… DECK B".
   (3) START/STOP am Laufwerk drückt den ▶/⏸-Knopf des Decks - dasselbe
       Verhalten wie dort, einschließlich Party-Regel.
   Was sich dreht und wo der Tonarm steht, folgt dem echten Zustand des
   Players (deckPlattenspielerNachfuehren). */
function deckPlattenspielerEinrichten(deck) {
  if (!window.PlattenspielerDetail || !deck.el.teller) return;
  PlattenspielerDetail.einrichten(deck.el.teller, {
    beiStartStop: () => deck.el.spielKnopf.click(),
    frontschrift: `PLAYDECKER · DECK ${deck.kennung.toUpperCase()}`,
    rahmen: 'rechteck',
  });
}
deckPlattenspielerEinrichten(decks.a);
deckPlattenspielerEinrichten(decks.b);

/* --- Höhe der Plattenspieler-Fenster (Auftrag 16, Phase 3) ---------------
   Im Mockup ist das Fenster 36 % der Fensterhöhe hoch (240 bis 400 px).
   Im PlayLister stehen darüber aber Kopfleiste, Reiter und Leuchtschild -
   GEMESSEN bei 1280 x 800 und 1600 x 900 lag der Abspielknopf damit unter
   der Fensterkante (821 bzw. 864 px). Deshalb wird gemessen, wie viel
   Platz bleibt, wenn Titelkarte und Laufwerkstasten noch ohne Rollen zu
   sehen sein sollen. Das Fenster nimmt höchstens diesen Platz (CSS-
   Variable --deck-spieler-hoehe in playdecker_design.css), sonst die
   Mockup-Höhe. Gemessen wie beim Jukeboxer (jukeboxer_pc.js): nur bei
   sichtbarem Reiter, ohne requestAnimationFrame. Kein Kreislauf: Die
   Fensterhöhe ändert weder den Platz darüber noch den darunter. */
const DECK_RAND_UNTEN = 12;   // Abstand der Laufwerkstasten zur Fensterkante (px)
// Breites Dreispalten-Layout, in dem das Pult bündig mit Fenstern und
// Titelkarten steht. MUSS gleich lauten wie die Bedingung im Abschnitt
// „Lage des Pults" in playdecker_design.css.
const DECK_PULT_BUENDIG_LAYOUT = '(min-width: 1181px) and (min-height: 501px)';
function deckSpielerHoeheAnpassen() {
  const spieler = decks.a.el.teller;
  const steuer = decks.a.el.karte.querySelector('.deck-steuer');
  if (!spieler || !steuer || !spieler.offsetParent) return;   // Reiter nicht sichtbar
  const kasten = spieler.getBoundingClientRect();
  // Abstand zum Seitenanfang: Normal rollt die Seite, im Vollbild .inhalt.
  const inhalt = spieler.closest('.inhalt');
  const imVollbild = document.body.classList.contains('pl-vollbild');
  const oben = kasten.top + (imVollbild && inhalt ? inhalt.scrollTop : window.scrollY);
  // Was im Deck unter dem Fenster bis zu den Laufwerkstasten noch kommt
  const darunter = steuer.getBoundingClientRect().bottom - kasten.bottom;
  const platz = Math.round(window.innerHeight - oben - darunter - DECK_RAND_UNTEN);
  const panel = kernWurzel;
  panel.style.setProperty('--deck-spieler-hoehe', `${platz}px`);

  // LAGE DES PULTS (Wunsch von Ralle zu Auftrag 17): Oberkante bündig mit
  // der Oberkante der Plattenspieler-Fenster, Unterkante bündig mit der
  // Unterkante der Titelkarten. Neu gemessen NACH dem Setzen der
  // Fensterhöhe oben (das Lesen erzwingt die neue Anordnung). Ob die Werte
  // gelten, entscheidet das CSS: nur im breiten Dreispalten-Layout
  // (playdecker_design.css, Abschnitt „Lage des Pults").
  const anzeige = decks.a.el.karte.querySelector('.deck-anzeige');
  const pult = panel.querySelector('.mitte');
  if (anzeige && pult) {
    const fenster = spieler.getBoundingClientRect();
    const deckOben = decks.a.el.karte.getBoundingClientRect().top;
    const sollHoehe = Math.round(anzeige.getBoundingClientRect().bottom - fenster.top);
    panel.style.setProperty('--deck-pult-oben', `${Math.round(fenster.top - deckOben)}px`);
    panel.style.setProperty('--deck-pult-hoehe', `${sollHoehe}px`);
    // Passt der Inhalt nicht in diese Höhe (kleine Fenster, gemessen bei
    // 1280×800 und 1366×768), wird das Pult in zwei Stufen enger gesetzt:
    // (1) „pult-eng": kleinere Abstände und Knöpfe, (2) „pult-enger":
    // zusätzlich ohne den Hinweistext. Reicht auch das nicht, wächst das
    // Pult nach unten weiter (min-height im CSS) - abgeschnitten wird nie.
    pult.classList.remove('pult-eng', 'pult-enger');
    if (window.matchMedia(DECK_PULT_BUENDIG_LAYOUT).matches) {
      for (const stufe of ['pult-eng', 'pult-enger']) {
        if (pult.offsetHeight <= sollHoehe + 1) break;
        pult.classList.add(stufe);
      }
    }
  }
}
window.addEventListener('resize', deckSpielerHoeheAnpassen);
// Kopfleiste und Reiter ändern ihre Höhe (Umbruch, Hinweise, Vollbild),
// ebenso Titelkarte und Tastenreihe des Decks (z. B. bekommt die Karte mit
// dem ersten Titel ihre zweite Zeile für den Interpreten - gemessen: 17 px).
if (window.ResizeObserver) {
  const beobachter = new ResizeObserver(() => deckSpielerHoeheAnpassen());
  // Kopfleiste und Reiter gehoeren der Huelle (PC: .kopf, .reiter) - sie
  // reicht sie als groessenQuellen herein; die Deck-Teile sucht der Kern.
  [...(startAngaben.groessenQuellen || []),
   ...kernWurzel.querySelectorAll('#deck-a-karte .deck-anzeige, #deck-a-karte .deck-steuer')]
    .forEach(e => beobachter.observe(e));
}
// Beim Öffnen des Reiters (vorher ist das Panel verdeckt und nicht messbar)
// Der Reiter-Knopf (PC) kommt von der Huelle; ohne ihn entfaellt nur das
// Nachmessen beim Reiterwechsel.
const deckReiterEl = startAngaben.reiterKnopf || null;
if (deckReiterEl) deckReiterEl.addEventListener('click', () => setTimeout(deckSpielerHoeheAnpassen, 0));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(deckSpielerHoeheAnpassen);
deckSpielerHoeheAnpassen();

/** Plattenspieler eines Decks nach dem Zustand seines Players stellen.

    `zustand` ist der Zustand der YouTube-Schnittstelle (1 läuft, 2 Pause,
    3 puffert, 0 Ende, 5 bereit, -1 noch nicht gestartet), `anteil` der
    Fortschritt 0 bis 1.
    (1) Aufgelegt (Tonarm auf der Platte, Platte im Drehbetrieb) ist sie,
        solange ein Titel spielt, pausiert oder puffert. Bei Ende oder
        frisch geladenem Titel hebt sich der Arm - wie beim Plattenwechsel.
    (2) Drehen tut sie nur, wenn der Player WIRKLICH läuft (wie bisher der
        Teller: die ehrlichste Anzeige im Reiter). Pause hält die Platte an
        der Stelle an, statt sie auf null zurückspringen zu lassen.
    (3) Der Tonarm wandert mit dem Fortschritt nach innen. */
function deckPlattenspielerNachfuehren(deck, zustand, anteil) {
  const wurzel = deck.el.teller;
  if (!wurzel) return;
  const platte = wurzel.querySelector('.jbx-platte');
  const arm = wurzel.querySelector('.jbx-tonarm');
  const aufgelegt = zustand === 1 || zustand === 2 || zustand === 3;
  if (platte) platte.classList.toggle('jbx-dreht', aufgelegt);
  if (arm) arm.classList.toggle('jbx-auf-platte', aufgelegt);
  wurzel.classList.toggle('jbx-pausiert', aufgelegt && zustand !== 1);
  const wert = aufgelegt && Number.isFinite(anteil) ? Math.min(Math.max(anteil, 0), 1) : 0;
  wurzel.style.setProperty('--fortschritt', wert.toFixed(4));
}

function deckZeitText(sekunden) {
  if (sekunden == null || !isFinite(sekunden)) return '0:00';
  const m = Math.floor(sekunden / 60), s = Math.floor(sekunden % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function deckMelden(deck, text) {
  deck.el.meldung.hidden = !text;
  deck.el.meldung.textContent = text || '';
}


/* --- Playlist laden --------------------------------------------------- */

/** Füllt beide Auswahlfelder aus der gemeinsamen Mediathek.
    Was in den Feldern steht, bestimmt die Hülle (umgebung.auswahlFuellen). */
function deckAuswahlFuellen() {
  ['a', 'b'].forEach(k => {
    const feld = decks[k].el.auswahl;
    const vorher = feld.value;
    feld.innerHTML = '<option value="">Playlist wählen …</option>';
    // Die Einträge liefert die Hülle (Auftrag 15): am PC die YouTube-
    // Mediathek und darunter die Gruppe „Lokal gespeichert", in der App
    // die Playlisten aus dem Paket.
    umgebung.auswahlFuellen(feld);
    // Eine schon getroffene Wahl überlebt das Neuzeichnen. Bei lokalen
    // Kennungen muss der Wert maskiert werden - er enthaelt Punkte und
    // Leerzeichen aus dem Dateinamen.
    if (vorher && [...feld.options].some(o => o.value === vorher)) feld.value = vorher;
  });
}

async function deckPlaylistLaden(deck) {
  const kennung = deck.el.auswahl.value;
  if (kennung === '') return;

  // WOHER DIE PLAYLIST KOMMT, weiß nur die Hülle (Auftrag 15): am PC die
  // Weiche zwischen YouTube-Mediathek und lokaler Ablage (Bauauftrag 09),
  // in der App das Paket. Alles danach ist gemeinsam - die Ueberschreib-
  // Rueckfrage, das Uebernehmen der Titel, die Anzeige.
  // playlistBeschreiben liefert { name } oder { meldung } (dann wird nicht
  // geladen) oder null (dann still nichts tun).
  const beschreibung = umgebung.playlistBeschreiben(kennung);
  if (!beschreibung) return;
  if (beschreibung.meldung) {
    deckMelden(deck, beschreibung.meldung);
    return;
  }
  const anzeigeName = beschreibung.name;

  // Rückfrage, bevor ein vorhandener Stand verlorengeht (Auftrag vom
  // 08.08.2026). Nur wenn wirklich etwas drinsteht — siehe Begründung
  // bei standUeberschreibenBestaetigt (app.js). Die Antwort kann ein
  // Versprechen sein (Rückfrage im Seitenstil, Nachbesserung 3) - deshalb
  // await; ein schlichtes true/false (App) geht genauso.
  const bisher = deck.titel.length;
  if (!(await umgebung.ueberschreibenBestaetigt(
        `Warteschlange ${deck.kennung.toUpperCase()}`,
        bisher ? `${bisher} Titel („${deck.listenName || 'ohne Namen'}")` : ''))) {
    deckMelden(deck, 'Laden abgebrochen — die Warteschlange bleibt, wie sie war.');
    return;
  }

  deck.el.laden.disabled = true;
  deckMelden(deck, '');
  deck.el.listeName.textContent = `„${anzeigeName}" wird geladen …`;
  deck.el.queue.innerHTML = '<p class="leer">Wird geladen …</p>';
  try {
    // Das Beschaffen selbst übernimmt die Hülle; sie liefert { name, titel }.
    const geladen = await umgebung.playlistLaden(kennung);
    // Spielt das Deck JETZT (läuft oder puffert)? Und welcher Titel liegt
    // dann im Player? Beides VOR dem Ersetzen der Liste festhalten (E1,
    // siehe unten).
    const spieltNoch = deckSpieltOderStartet(deck);
    const imPlayer = spieltNoch ? deckTitelVomPlayer(deck) : null;
    // Nicht verfügbare Titel (ohne videoId) fliegen hier raus - sie
    // ließen sich ohnehin nicht abspielen. Die Zahl wird aber genannt,
    // statt sie stillschweigend zu verschlucken.
    const alle = geladen.titel || [];
    deck.titel = alle.filter(t => t.video_id);
    const weg = alle.length - deck.titel.length;
    deck.listenName = geladen.name;
    deck.quellePlaylist = beschreibung.lokaleId || null;   // R6, unsichtbar
    deck.laufend = deck.titel.length ? 0 : -1;
    deck.altTitel = null;
    // LADEN IN EIN SPIELENDES DECK (E1, Auftrag 15, Nachbesserung 4,
    // Entscheidung von Ralle am 19.11.2026): Der laufende Titel spielt
    // ungestört zu Ende (Party-Regel), DANACH kommt Titel 1 der neuen Liste -
    // ohne und mit Auto-Mix. Vorher sprang die Marke auf Titel 1, während
    // im Player der alte Titel weiterlief; an dessen Ende rückte das Deck
    // „eins weiter“ und übersprang so Titel 1 (gemessen, Rückfrage zu
    // Nachbesserung 3 (1)).
    // Jetzt steht die Marke VOR Titel 1 (-1): Der nächste Titel ist damit
    // Titel 1 - für jeden Weg, der weiterrückt (Titelende, ⏭, Übergabe,
    // stilles Bereitlegen nach einer Überblendung). Der laufende Titel
    // gehört nicht zur neuen Liste; er steht bis zu seinem Ende in
    // `altTitel`. Die Titelkarte zeigt ihn weiter an, darunter
    // „Als Nächstes: …“ (deckAlsNaechstesAnzeigen).
    if (spieltNoch) {
      deck.laufend = -1;
      deck.altTitel = imPlayer;
      // Eine Titelblende von Hand, die gerade läuft, endet: Der alte Titel
      // soll ungestört (in voller Lautstärke) zu Ende spielen, und ihr
      // Sprung zielte auf eine Stelle der ALTEN Liste.
      deckTitelBlendeAbbrechen(deck);
    }
    deck.gesperrt.clear();
    // Neue Liste, sauberer Anfang: Was von der vorigen gelaufen ist,
    // gilt nicht mehr, und „durchgelaufen" schon gar nicht - sonst
    // bliebe das Deck für die Übergabe gesperrt, obwohl frische Titel
    // darin stehen.
    deck.gespielt.clear();
    deck.markiert.clear();
    deck.fertig = false;

    deck.el.listeName.textContent = geladen.name;
    deck.el.anzahl.textContent = `${deck.titel.length} Titel`
      + (weg ? ` · ${weg} nicht verfügbar` : '');
    deckQueueZeichnen(deck);
    // DEN NEUEN ERSTEN TITEL AUCH IM PLAYER BEREITLEGEN (L1, Auftrag 15,
    // Nachbesserung 3, freigegeben am 19.11.2026). Vorher zeigte das Deck
    // nach dem Laden den neuen ersten Titel an, im Player lag aber noch der
    // alte: ▶ setzte den ALTEN Titel fort, und an dessen Ende kam der
    // ZWEITE der neuen Liste - der erste wurde übersprungen (gemessen,
    // Rückfrage zu Nachbesserung 2 (1)). Jetzt wie bei „Teilen“: Titel
    // bereitlegen und den Merker des erwarteten Titels setzen.
    //
    // NUR, WENN DAS DECK NICHT SPIELT (Party-Regel: laufende Musik wird
    // nie versehentlich unterbrochen). Ein Bereitlegen hielte den Player
    // an. Spielt das Deck, gilt E1 (oben).
    if (deck.titel.length && !spieltNoch) {
      // Frische Liste, sauberer Anfang - wie bei „Teilen“. Auch eine
      // Einstiegsstelle aus der letzten Sitzung gilt nicht für die neue
      // Liste (sonst begänne ihr erster Titel mitten drin).
      deck.uebergeben = false;
      deck.blendeFuer = null;
      deck.startSekunde = 0;
      // L3: Spielt auch sonst nichts, soll nach dem Laden nichts von selbst
      // losgehen - der Wächter wartet auf ▶ (siehe deckRuheBisStart).
      deckRuheBisStart(deckIrgendeinsSpielt());
      deckBereitlegen(deck, deck.titel[0]);
    }
    deckAnzeigeNachfuehren(deck);
    // E1: Läuft der alte Titel weiter, bleibt er auf der Titelkarte - sie
    // springt NICHT schon auf Titel 1 (das wäre falsch, Antwort (1C)).
    if (deck.titel.length && !deckAlterTitelLaeuft(deck)) deckTitelAnzeigen(deck, deck.titel[0]);
  } catch (fehler) {
    deck.el.listeName.textContent = 'keine Playlist';
    deck.el.queue.innerHTML = '<p class="leer">Laden fehlgeschlagen.</p>';
    deckMelden(deck, `Laden fehlgeschlagen: ${fehler.message}`);
  } finally {
    deck.el.laden.disabled = false;
  }
}


/* --- Anzeige ---------------------------------------------------------- */

/** Setzt Titelzeile und Tellerbeschriftung, ohne etwas abzuspielen. */
/** Die Bildquellen eines Titels, in Rangfolge — Rückfallkette statt
    einer einzigen Adresse (Änderungswunsch 16.08.2026).

    (1) Echtes Cover (`t.bild`). GEMESSEN am 06.08.2026: ytmusicapi
        liefert zu Playlist-Titeln ein QUADRATISCHES Bild (alle 150
        geprüften hatten eines), über das Größen-Anhängsel der Adresse
        auf 600 Pixel hochgebeten. Seit dem 16.08. füllt auch die
        Songsuche (ChartLister/ShufLister/DiscLister) dieses Feld.
    (2) YouTube-Videostandbild, aus der Videokennung abgeleitet — 16:9,
        wird für die runde Platte mittig beschnitten. Trägt immer dann,
        wenn (1) fehlt oder nicht lädt, UND die Videokennung noch zu
        einem echten Video gehört (siehe bildTraegtWirklich).
    Trägt keiner der beiden, zeigt deckTitelAnzeigen den Schriftzug. */
function deckBildKandidaten(t) {
  if (!t) return [];
  const kandidaten = [];
  if (t.bild) kandidaten.push(t.bild);
  if (t.video_id) kandidaten.push(`https://i.ytimg.com/vi/${t.video_id}/hqdefault.jpg`);
  return kandidaten;
}

/** Prüft, ob eine Bildadresse wirklich ein brauchbares Bild liefert —
    nicht nur, ob sie überhaupt lädt.

    ZWEI Wege, wie eine Adresse NICHT trägt:
    (a) Sie lädt gar nicht (`onerror`) — z. B. eine verbogene Cover-
        Adresse oder eine tote Domain. Im Browser nachgemessen
        (16.08.2026): löst zuverlässig `onerror` aus.
    (b) Sie lädt scheinbar erfolgreich (`onload`), liefert aber YouTubes
        grauen Platzhalter für eine nicht mehr existierende Video-
        Kennung. GEMESSEN am 16.08.2026 an drei erfundenen Kennungen:
        IMMER 120 x 90 Bildpunkte, IMMER `onload` (nie `onerror`) —
        während ein echtes Videostandbild IMMER 480 x 360 liefert. Ohne
        diese Prüfung würde die Kette hier fälschlich "gut" sagen und
        einen grauen Fleck statt des Schriftzugs zeigen. */
function bildTraegtWirklich(adresse) {
  return new Promise(fertig => {
    const pruefer = new Image();
    pruefer.onload = () => {
      const platzhalter = pruefer.naturalWidth === 120 && pruefer.naturalHeight === 90;
      fertig(!platzhalter);
    };
    pruefer.onerror = () => fertig(false);
    pruefer.src = adresse;
  });
}

function deckTitelAnzeigen(deck, t) {
  // Titelkarte (Auftrag 16): Titel oben, Interpret klein darunter - wie
  // „Jetzt läuft" im Jukeboxer.
  // songtextMarke(t): nur in der App ein „♪" (am PC leer, siehe Kopf).
  deck.el.titelZeile.innerHTML = t
    ? `${songtextMarke(t)}${discSchuetzen(t.titel || '')}<small>${discSchuetzen(t.interpret || '')}</small>`
    : '—';
  deck.el.dauer.textContent = deckZeitText(t ? t.dauer_sekunden : 0);
  deck.el.label.innerHTML = t
    ? `<b>${discSchuetzen(t.interpret || '')}</b>${discSchuetzen(t.titel.slice(0, 40))}`
    : 'PLAYDECKER';

  // Das Titelbild liegt als BILDPLATTE auf dem Plattenspieler (Auftrag 16,
  // wie im Jukeboxer: das Etikett der Platte trägt das Cover). Bis
  // feststeht, ob eines der beiden Bilder wirklich trägt, steht der
  // Schriftzug auf dem Etikett - so gibt es nie eine leere Scheibe,
  // höchstens einen kurzen Wechsel von Schrift zu Bild, nie umgekehrt einen
  // Wechsel zu einer kaputten Grafik.
  const etikett = deck.el.teller.querySelector('.jbx-etikett');
  if (etikett) {
    etikett.style.backgroundImage = '';
    etikett.classList.remove('jbx-mit-cover');
  }
  deck.el.label.hidden = false;

  // ZÄHLWERK gegen veraltete Antworten: Schaltet der Nutzer schnell
  // weiter, während die Prüfung für den vorigen Titel noch läuft, darf
  // deren Ergebnis nicht mehr auf dem inzwischen aktuellen Titel landen.
  const meineGeneration = (deck._bildGeneration = (deck._bildGeneration || 0) + 1);

  const kandidaten = deckBildKandidaten(t);
  if (!kandidaten.length) return;  // Schriftzug bleibt, nichts zu versuchen

  (async () => {
    for (const adresse of kandidaten) {
      const traegt = await bildTraegtWirklich(adresse);
      if (deck._bildGeneration !== meineGeneration) return;  // überholt
      if (traegt) {
        // Ersatzbild dahinter: Fällt das Bild später doch aus, bleibt ein
        // rotes Etikett statt einer leeren Fläche.
        if (etikett) {
          etikett.style.backgroundImage = `url('${adresse}'), var(--cover-ersatz)`;
          etikett.classList.add('jbx-mit-cover');
        }
        deck.el.label.hidden = true;
        return;
      }
    }
    // Keiner der Kandidaten trug - der Schriftzug (schon sichtbar)
    // bleibt die ehrliche Auskunft.
  })();
}

/** Chart-Marke fürs PlayDecker (Änderungswunsch 14.08.2026) - eigene
    Schutzfunktion (discSchuetzen), sonst wie manChartZeile. */
function deckChartMarke(t) {
  const text = chartMarkeText(t);
  return text ? `<small class="chart-marke">${discSchuetzen(text)}</small>` : '';
}

function deckQueueZeichnen(deck) {
  // E1 (Nachbesserung 4): Der alte Titel gilt nur, solange die Marke VOR
  // Titel 1 steht. Steht sie wieder auf einem Titel (Sprung, Titelende,
  // Teilen, Wiederherstellen, „An Deck senden“ …), ist er vorbei. Diese
  // Funktion läuft bei jeder Änderung der Warteschlange - deshalb wird hier
  // aufgeräumt und die Zeile „Als Nächstes“ der Titelkarte nachgeführt.
  if (deck.laufend >= 0) deck.altTitel = null;
  const vorErstem = deckAlterTitelLaeuft(deck);
  deckAlsNaechstesAnzeigen(deck);
  const halter = deck.el.queue;
  halter.innerHTML = '';
  if (!deck.titel.length) {
    halter.innerHTML = '<p class="leer">Noch keine Playlist geladen.</p>';
    deck.el.queueZahl.textContent = '';
    return;
  }
  deck.el.queueZahl.textContent = vorErstem
    ? `als Nächstes 1 von ${deck.titel.length}`
    : `${deck.laufend + 1} von ${deck.titel.length}`;
  let laufendeZeile = null;
  deck.titel.forEach((t, i) => {
    const zeile = document.createElement('div');
    const istJetzt = i === deck.laufend;
    // E1: Titel 1 kommt als Nächstes (der alte Titel spielt noch zu Ende).
    const istNaechster = vorErstem && i === 0;
    const istGesperrt = deck.gesperrt.has(t.video_id);
    const istGespielt = deck.gespielt.has(t.video_id) && !istJetzt;
    zeile.className = 'q' + (istJetzt ? ' jetzt' : '') + (istNaechster ? ' naechster' : '')
                    + (istGesperrt ? ' gesperrt' : '') + (istGespielt ? ' gespielt' : '');
    // MINI-COVER (Bauauftrag 10, Phase 4 - Coverpflicht: "auch jeder
    // Warteschlangen-Eintrag traegt sein kleines Cover"). Bewusst NICHT
    // die volle bildTraegtWirklich()-Pruefung wie beim grossen Teller:
    // Bei hunderten Zeilen waeren das hunderte parallele Bildladungen.
    // Hier reicht der erste Kandidat (Cover, sonst Videostandbild) als
    // background-image - laedt er nicht, bleibt schlicht die dunkle
    // Platzhalterflaeche sichtbar (siehe .q-cover in style.css), was bei
    // 34px kaum auffaellt. Kein Kandidat vorhanden -> kein style-Attribut,
    // ebenfalls nur die Platzhalterflaeche.
    const miniCoverKandidaten = deckBildKandidaten(t);
    const miniCoverStil = miniCoverKandidaten.length
      ? ` style="background-image: url('${miniCoverKandidaten[0]}')"` : '';

    zeile.innerHTML = `
      <span><input type="checkbox" class="haken"${deck.markiert.has(t.video_id) ? ' checked' : ''}></span>
      <span class="n">${istJetzt ? '▶' : i + 1}</span>
      <span class="q-cover"${miniCoverStil}></span>
      <span class="ti"><b>${songtextMarke(t)}${discSchuetzen(t.titel)}</b>
        <small>${discSchuetzen(t.interpret)}${istGesperrt ? ' · Einbetten nicht erlaubt' : ''}</small>${deckChartMarke(t)}</span>
      <span class="q-werkzeug">
        <button type="button" class="hoch" title="Nach oben"${i === 0 ? ' disabled' : ''}>▲</button>
        <button type="button" class="runter" title="Nach unten"${i === deck.titel.length - 1 ? ' disabled' : ''}>▼</button>
        <button type="button" class="weg" title="Aus der Warteschlange entfernen">✕</button>
      </span>
      <span class="d">${discSchuetzen(t.dauer || deckZeitText(t.dauer_sekunden))}</span>
    `;
    // ÄNDERUNG vom 12.08.2026: Bisher sprang schon der einfache Klick auf
    // diesen Titel - das machte ein Ankreuzen zum Nebeneffekt eines
    // Sprungs, den man vielleicht gar nicht wollte. Jetzt wie im
    // Dateiverwalter (und wie im ManLister seit Auftrag 3b): Einfacher
    // Klick wählt nur aus, Doppelklick verschiebt den Titel wirklich
    // ins Deck. Die zwei Einzelklicks eines Doppelklicks heben sich in
    // ihrer Auswahl-Wirkung gegenseitig auf - die Markierung bleibt
    // also, wie sie vorher war, und nur der Sprung zählt.
    const haken = zeile.querySelector('.haken');
    zeile.onclick = () => {
      haken.checked = !haken.checked;
      if (haken.checked) deck.markiert.add(t.video_id);
      else deck.markiert.delete(t.video_id);
      deckMarkierungAnzeigen(deck);
    };
    // Doppelklick holt den Titel ins Deck. ÜBER deckTitelVonHand, nicht
    // direkt über deckSpringen: Dort sitzt die Unterscheidung zwischen
    // wartendem und spielendem Deck (Änderungswunsch 4 vom 12.08.2026).
    zeile.ondblclick = () => deckTitelVonHand(deck, i);
    // Kästchen und Werkzeugknöpfe dürfen weder den Klick NOCH den
    // Doppelklick nach außen durchreichen - sonst spränge das Deck bei
    // jedem Ankreuzen oder bei zwei schnellen Klicks auf ✕ ungewollt auf
    // diesen Titel. Das wiegt hier schwerer als im ManLister: Ein
    // Fehlsprung unterbricht eine laufende Wiedergabe.
    zeile.querySelectorAll('.haken, .hoch, .runter, .weg').forEach(el => {
      el.ondblclick = er => er.stopPropagation();
    });
    haken.onclick = er => {
      er.stopPropagation();
      if (haken.checked) deck.markiert.add(t.video_id);
      else deck.markiert.delete(t.video_id);
      deckMarkierungAnzeigen(deck);
    };
    zeile.querySelector('.hoch').onclick = er => { er.stopPropagation(); deckVerschieben(deck, i, -1); };
    zeile.querySelector('.runter').onclick = er => { er.stopPropagation(); deckVerschieben(deck, i, +1); };
    zeile.querySelector('.weg').onclick = er => { er.stopPropagation(); deckEntfernen(deck, i); };
    if (istJetzt || istNaechster) laufendeZeile = zeile;
    halter.appendChild(zeile);
  });
  deckMarkierungAnzeigen(deck);

  // (4) Der laufende Titel steht immer OBEN in der Ansicht. Was schon
  // gelaufen ist, rollt darüber hinaus - man kommt durch Zurückrollen
  // aber jederzeit wieder hin.
  //
  // ZWEIMAL gesetzt, und das mit Absicht: Beim ersten Mal steht die
  // Liste zwar im Baum, aber der Browser hat ihre endgültigen Höhen
  // womöglich noch nicht berechnet - dann geht das Rollen ins Leere oder
  // landet zu kurz. Der zweite Anlauf nach dem nächsten Zeittakt trifft
  // sicher. Bewusst setTimeout und NICHT requestAnimationFrame: Im
  // Hintergrund-Tab steht die Bildschleife still (gemessen), das Rollen
  // bliebe dann bis zum Zurückschalten aus.
  if (laufendeZeile) {
    const rollen = () => {
      halter.scrollTop = laufendeZeile.offsetTop - halter.offsetTop;
    };
    rollen();
    setTimeout(rollen, 0);
    setTimeout(rollen, 120);
  }

  // HIER hängt das Sichern des Standes, und zwar mit Bedacht: Diese
  // Funktion läuft bei JEDER strukturellen Änderung der Warteschlange —
  // Laden, Verschieben, Entfernen, Mischen, Titelwechsel. Genau das ist
  // die Menge der Ereignisse, nach denen sich das Sichern lohnt. Der
  // Crossfader ist bewusst NICHT dabei: Er bewegt sich während einer
  // Überblendung vierzigmal je Sekunde und würde die Sammelzeit immer
  // wieder neu anstoßen, sodass am Ende gar nichts geschrieben würde.
  standGeplant();
}

/** Zeigt an, wie viele Zeilen angekreuzt sind, und sperrt die
    Mehrfach-Werkzeuge, solange keine einzige gewählt ist. */
function deckMarkierungAnzeigen(deck) {
  // Kennungen, die es gar nicht mehr gibt, still vergessen - sonst
  // zählte die Anzeige Titel mit, die längst entfernt wurden.
  const vorhanden = new Set(deck.titel.map(t => t.video_id));
  [...deck.markiert].forEach(id => { if (!vorhanden.has(id)) deck.markiert.delete(id); });

  const anzahl = deck.markiert.size;
  deck.el.qZahl.textContent = anzahl ? `${anzahl} angekreuzt` : '';
  [deck.el.qHoch, deck.el.qRunter, deck.el.qWeg].forEach(k => { k.disabled = !anzahl; });

  // Die Pfeile zwischen den Warteschlangen (Änderungswunsch 5 vom
  // 12.08.2026). Sie hängen an der Markierung DES JEWEILIGEN Decks, das
  // abgibt - deshalb hier über die feste Zuordnung und nicht über
  // `deck`: Diese Funktion wird je Deck einzeln aufgerufen, die beiden
  // Knöpfe gibt es aber nur einmal.
  const knopfNachB = kernElement('deck-nach-b');
  const knopfNachA = kernElement('deck-nach-a');
  if (knopfNachB) knopfNachB.disabled = !decks.a.markiert.size;
  if (knopfNachA) knopfNachA.disabled = !decks.b.markiert.size;
}

/** Merkt einen Titel als gespielt. */
function deckAlsGespieltMerken(deck, index) {
  const t = deck.titel[index];
  if (t && t.video_id) deck.gespielt.add(t.video_id);
}


/* --- Warteschlange umbauen (Wunsch 2) ---------------------------------- */

/** Verschiebt einen Titel um eine Stelle.

    DER HEIKLE TEIL IST DER MERKER `laufend`: Er zeigt auf eine POSITION,
    nicht auf einen Titel. Wird die Liste umgestellt, ohne ihn
    nachzuziehen, zeigt er plötzlich auf ein anderes Lied — die
    Warteschlange markierte dann etwas anderes, als der Player spielt. */
function deckVerschieben(deck, index, richtung) {
  const ziel = index + richtung;
  if (ziel < 0 || ziel >= deck.titel.length) return;
  const [t] = deck.titel.splice(index, 1);
  deck.titel.splice(ziel, 0, t);

  // Den Merker mitwandern lassen.
  if (deck.laufend === index) deck.laufend = ziel;
  else if (deck.laufend === ziel) deck.laufend = index;

  deckQueueZeichnen(deck);
}

/** Nimmt einen Titel aus der Warteschlange.

    Drei Fälle, und alle drei müssen bedacht sein:
    (1) vor dem laufenden entfernt  -> der Merker rutscht eins vor
    (2) hinter dem laufenden        -> nichts zu tun
    (3) DER LAUFENDE selbst         -> an seine Stelle rückt der nächste
        nach; der Player spielt den alten aber weiter zu Ende. Das ist
        gewollt: Mitten im Ton abzubrechen, nur weil jemand die Liste
        aufräumt, wäre unangenehm. Der nächste Titel folgt regulär. */
function deckEntfernen(deck, index) {
  const warLaufend = index === deck.laufend;
  deck.titel.splice(index, 1);

  if (!deck.titel.length) {
    deck.laufend = -1;
    deck.el.anzahl.textContent = '0 Titel';
    deckQueueZeichnen(deck);
    deckMelden(deck, 'Warteschlange ist jetzt leer.');
    return;
  }
  if (index < deck.laufend) deck.laufend--;
  else if (warLaufend) deck.laufend = Math.min(index, deck.titel.length - 1);

  deck.el.anzahl.textContent = `${deck.titel.length} Titel`;
  deckQueueZeichnen(deck);
  if (warLaufend) {
    deckMelden(deck, 'Titel aus der Warteschlange genommen — er spielt noch zu Ende.');
  }
}


/* --- Playlist auf beide Decks aufteilen (Wunsch 1) --------------------- */

/** Verteilt die Playlist EINES Decks abwechselnd auf beide.

    WARUM ABWECHSELND UND NICHT ERSTE/ZWEITE HÄLFTE: Der Auto-Mix
    übergibt immer ans andere Deck. Bekäme A die Titel 1–32 und B die
    Titel 33–64, hörte man 1, 33, 2, 34 … — die Reihenfolge wäre zerrissen.
    Abwechselnd verteilt (A: 1,3,5…  B: 2,4,6…) ergibt der Wechsel
    zwischen den Decks wieder genau die ursprüngliche Folge. */
function deckAufteilen(deck) {
  if (deck.titel.length < 2) {
    deckMelden(deck, 'Zum Aufteilen braucht es mindestens zwei Titel.');
    return;
  }
  const alle = deck.titel;
  const name = deck.listenName || 'Playlist';
  // L3: VOR dem Anhalten festhalten, ob etwas spielte. Spielte etwas, ist
  // das Teilen ein Eingriff in laufende Musik - dann bleibt der Wächter
  // wie bisher wach (am PC startet er danach die neue Verteilung).
  const spielteVorher = deckIrgendeinsSpielt();
  const fuerA = alle.filter((_, i) => i % 2 === 0);
  const fuerB = alle.filter((_, i) => i % 2 === 1);
  // Beide Hälften stammen aus derselben Playlist (R6, unsichtbar).
  const quelle = deck.quellePlaylist || null;

  [['a', fuerA], ['b', fuerB]].forEach(([k, teil]) => {
    const z = decks[k];
    if (z.spieler && z.spieler.getPlayerState() === DECK_LAEUFT) deckPausierenVonUns(z);
    z.titel = teil;
    z.laufend = 0;
    z.listenName = `${name} (${k.toUpperCase()})`;
    z.quellePlaylist = quelle;
    z.gesperrt.clear();
    z.gespielt.clear();
    z.markiert.clear();
    z.fertig = false;
    z.uebergeben = false;
    z.blendeFuer = null;
    z.el.listeName.textContent = z.listenName;
    z.el.anzahl.textContent = `${teil.length} Titel`;
    deckQueueZeichnen(z);
    deckTitelAnzeigen(z, teil[0]);
    // MERKER SETZEN WIE BEIM SPRINGEN (Kernkorrektur K1, Auftrag 15,
    // Nachbesserung 2, freigegeben 19.11.2026). Ohne ihn hielt das Deck
    // das Ende des bereitgelegten Titels für den Nachhall des ALTEN Videos
    // (deckZustandGeaendert, Prüfung (1)) und verwarf es: Nach „Teilen“
    // und ▶ lief der erste Titel zu Ende, und dann kam nicht der zweite,
    // sondern - über den Wächter - derselbe Titel noch einmal.
    deckBereitlegen(z, teil[0]);
    deckAnzeigeNachfuehren(z);
  });
  deckRuheBisStart(spielteVorher);
  deckMelden(decks.a, `Aufgeteilt: ${fuerA.length} Titel hier, ${fuerB.length} auf Deck B.`);
  deckMelden(decks.b, `Aufgeteilt: ${fuerB.length} Titel hier, ${fuerA.length} auf Deck A.`);
}

/** Führt Fortschritt, Zeiten und Teller nach. Läuft im Takt, solange
    mindestens ein Deck spielt. */
function deckAnzeigeNachfuehren(deck) {
  const p = deck.spieler;
  const zustand = p && p.getPlayerState ? p.getPlayerState() : -1;
  const laeuft = zustand === DECK_LAEUFT;
  deck.laeuft = laeuft;
  deck.el.spielKnopf.textContent = laeuft ? '⏸' : '▶';
  // Spielt das Deck, leuchtet sein großer Abspielknopf (playdecker_design.css)
  deck.el.karte.classList.toggle('spielt', laeuft);

  if (!p || !p.getCurrentTime) {
    deck.el.balken.style.width = '0%';
    deck.el.position.textContent = '0:00';
    deckPlattenspielerNachfuehren(deck, -1, 0);
    return;
  }
  const pos = p.getCurrentTime() || 0;
  // NICHT die volle Länge, sondern die Länge, die tatsächlich gespielt
  // wird. Bei fester Spielzeit endet der Titel früher; stünde hier
  // weiter die volle Dauer, liefe der Balken bis zur Hälfte und der
  // Titel wechselte scheinbar mittendrin. Die Anzeige soll zeigen, was
  // wirklich passiert.
  const dauer = deckSpielEnde(deck);
  deck.el.position.textContent = deckZeitText(pos);
  if (dauer > 0) {
    deck.el.dauer.textContent = deckZeitText(dauer);
    deck.el.balken.style.width = `${Math.min((pos / dauer) * 100, 100)}%`;
  }
  // Plattenspieler: Platte, Tonarm und Fortschritt (Auftrag 16)
  deckPlattenspielerNachfuehren(deck, zustand, dauer > 0 ? pos / dauer : 0);
}

// EIN Zeitgeber für beide Decks. Bewusst setInterval statt
// requestAnimationFrame - siehe Kopfkommentar (1).
let deckTakt = null;
function deckTaktSicherstellen() {
  if (deckTakt) return;
  // JEDER SCHRITT EINZELN ABGESICHERT. Der Auto-Mix hängt an diesem
  // Takt: Wirft ein Schritt eine Ausnahme, würde alles danach in
  // DIESEM Durchlauf übersprungen — und wenn der Fehler bei jedem
  // Durchlauf wiederkehrt, käme die Überblendung nie mehr zustande.
  // Die Musik stünde still, ohne dass irgendetwas darauf hindeutete.
  // Deshalb darf kein Schritt seinen Nachbarn mitreißen.
  const schritt = (was, tuWas) => {
    try { tuWas(); }
    catch (fehler) { console.error(`PlayDecker-Takt, Schritt „${was}":`, fehler); }
  };
  deckTakt = setInterval(() => {
    schritt('Anzeige A', () => deckAnzeigeNachfuehren(decks.a));
    schritt('Anzeige B', () => deckAnzeigeNachfuehren(decks.b));
    // Läuft ein Titel aufs Ende zu? Der Auto-Mix hängt an diesem Takt.
    schritt('Blende A', () => deckBlendePruefen(decks.a));
    schritt('Blende B', () => deckBlendePruefen(decks.b));
    // Feste Spielzeit: Ist sie abgelaufen, endet der Titel hier.
    schritt('Spielzeit A', () => deckSpielzeitPruefen(decks.a));
    schritt('Spielzeit B', () => deckSpielzeitPruefen(decks.b));
    // Der Wächter: Kommt überhaupt Ton? Siehe Abschnitt (10f).
    schritt('Mitschrift', deckMitschreiben);
    schritt('Wächter', deckWaechterPruefen);
    // Den Songtext führt seit Phase 6 das schwebende Fenster selbst nach
    // (eigener Takt, nur solange es offen ist) - siehe Abschnitt Songtext.
    // Läuft nichts mehr und ist auch nichts geladen, kann der Takt ruhen.
    if (!decks.a.spieler && !decks.b.spieler) {
      clearInterval(deckTakt); deckTakt = null;
    }
  }, DECK_TAKT_MS);
}


/* --- Wiedergabe -------------------------------------------------------- */

/** Legt den Player dieses Decks an — beim ERSTEN Mal und nur aus einem
    Klick heraus (siehe Kopfkommentar (2)). */
async function deckSpielerSicherstellen(deck, videoId) {
  if (deck.spieler) return deck.spieler;
  await ytSchnittstelleLaden();

  // Ein eigenes Kind-Element, weil YT.Player das Zielelement DURCH das
  // iframe ersetzt - der gestylte Rahmen bliebe sonst nicht erhalten.
  const innen = document.createElement('div');
  innen.id = `deck-${deck.kennung}-player`;
  deck.el.rahmen.appendChild(innen);
  deck.el.rahmen.classList.add('an');

  deck.spieler = await new Promise(fertig => {
    const p = new YT.Player(innen.id, {
      height: '92', width: '100%', videoId,
      playerVars: { autoplay: 0, playsinline: 1, controls: 0 },
      events: {
        onReady: () => fertig(p),
        onStateChange: ereignis => deckZustandGeaendert(deck, ereignis),
        onError: ereignis => deckFehler(deck, ereignis),
      },
    });
  });
  // Die Lautstärke SOFORT auf die Reglerstellung bringen. Ohne diese
  // Zeile startete ein frisch angelegtes Deck mit voller Lautstärke,
  // ganz gleich wo der Crossfader steht — und risse dem anderen Deck
  // hörbar das Wort ab.
  deckLautstaerkeAnwenden();
  deckTaktSicherstellen();
  return deck.spieler;
}

// So lange nach einem befohlenen Titelwechsel gilt ein „Ende" als
// Nachhall des VORIGEN Titels. Kurz gehalten: Ein echtes Titelende so
// bald nach einem Wechsel gibt es praktisch nicht, und je kürzer die
// Frist, desto weniger kann sie versehentlich ein echtes Ende
// verschlucken.
const DECK_ENDE_SCHONFRIST_MS = 1500;

// Wie oft ein „Ende" als Nachhall verworfen wurde. Nur zum Nachmessen -
// abrufbar über playdeckerProtokoll().
let deckEndenVerworfen = 0;

/** Reagiert auf Zustandswechsel des Players.

    HIER SASS EIN FEHLER, den der Nutzer am 12.08.2026 gemeldet hat: Ein
    Titel, der per Doppelklick in das WARTENDE Deck geladen wurde, spielte
    manchmal sofort los - und blieb stumm, weil der Crossfader beim
    aktiven Deck stand.

    Die Kette dahin: Die YouTube-Schnittstelle meldet beim Wechsel eines
    Videos gelegentlich noch ein „Ende" für das vorherige. Diese Funktion
    nahm jedes „Ende" für bare Münze und rief deckTitelBeenden() auf. Das
    endet im Normalfall bei deckWeiter(deck, +1, automatisch = true) -
    und das lädt den nächsten Titel MIT autostart. Auf diesem Weg wird
    der Crossfader nirgends angefasst, also lief das wartende Deck
    unhörbar los. Weil die Meldung nur manchmal kommt, trat es auch nur
    manchmal auf.

    ZWEI PRÜFUNGEN, und bewusst in dieser Reihenfolge:

    (1) Gehört das „Ende" überhaupt zu dem Titel, der hier erwartet wird?
        Läuft im Player nachweislich ein anderes Video, ist es ein
        Nachhall. Das ist die genaue Prüfung - sie kann kein echtes Ende
        verschlucken.
    (2) Kam es unmittelbar nach einem befohlenen Wechsel? Dann ebenfalls
        Nachhall. Das ist die grobe Prüfung für den Fall, dass
        getVideoData() nichts hergibt.

    IM ZWEIFEL WIRD GEHANDELT, nicht verworfen: Ein verschlucktes echtes
    Titelende hiesse Stille - der schlimmste Ausgang. Deshalb greift (1)
    nur bei einem NACHWEISBAREN Unterschied und (2) nur in einer sehr
    kurzen Frist. */
function deckZustandGeaendert(deck, ereignis) {
  deckAnzeigeNachfuehren(deck);
  // L3: Ein Deck puffert oder läuft - gleich auf welchem Weg es gestartet
  // wurde, ab jetzt bewacht der Wächter wieder.
  if (ereignis.data === DECK_LAEUFT || ereignis.data === DECK_PUFFERT) deckStartBefohlen();
  // PARTY-REGEL, SICHERHEITSNETZ: Jeder Start eines Decks läuft durch
  // diese Stelle. Die Startwege prüfen die Regel schon vorher (▶,
  // Springen, Wächter); läuft trotzdem ein Deck neben dem spielenden
  // Jukeboxer an, wird es SOFORT wieder angehalten - wie eine Pause von
  // Hand, damit der Wächter es nicht wieder anwirft. Der Jukeboxer spielt
  // ungestört weiter.
  if (ereignis.data === DECK_LAEUFT && deckJukeboxerSpielt()) {
    deck.vonUnsPausiert = false;
    deck.spieler.pauseVideo();
    deckParteiMeldung(deck);
    return;
  }
  // Ebenso endet eine laufende Vorschau (ChartLister & Co.) - immer nur
  // EINE Tonquelle, in allen Richtungen (CLAUDE.md, Phase 5).
  // Wie das geht, weiß die Hülle (PC: ChartLister-Vorschau, App: keine).
  if (ereignis.data === DECK_LAEUFT && umgebung.vorschauBeenden) umgebung.vorschauBeenden();
  // In der M5c-Messung kam dieses Ereignis zuverlässig und genau einmal.
  if (ereignis.data !== DECK_BEENDET) return;

  // (1) Läuft im Player nachweislich ein anderes Video als erwartet?
  let anderesVideo = false;
  try {
    const daten = deck.spieler && deck.spieler.getVideoData
      ? deck.spieler.getVideoData() : null;
    if (daten && daten.video_id && deck.erwarteteVideoId) {
      anderesVideo = daten.video_id !== deck.erwarteteVideoId;
    }
  } catch (fehler) {
    // getVideoData ist nicht in jeder Fassung der Schnittstelle
    // zugesichert. Fällt sie aus, bleibt Prüfung (2).
    anderesVideo = false;
  }

  // (2) Kam das „Ende" unmittelbar nach einem befohlenen Wechsel?
  const seitWechsel = deck.titelBefohlenUm ? Date.now() - deck.titelBefohlenUm : Infinity;
  const frischGewechselt = seitWechsel < DECK_ENDE_SCHONFRIST_MS;

  if (anderesVideo || frischGewechselt) {
    deckEndenVerworfen++;
    // Ins Ablaufgedächtnis, damit playdeckerProtokoll() es später zeigt.
    // Ein still verworfenes Ereignis, das niemand nachlesen kann, wäre
    // beim nächsten Fehlerbericht wertlos.
    deckGedaechtnis.push({
      zeit: new Date().toLocaleTimeString('de-DE'),
      hinweis: `Deck ${deck.kennung.toUpperCase()}: „Ende" verworfen`,
      grund: anderesVideo ? 'anderes Video im Player'
                          : `${Math.round(seitWechsel)} ms nach dem Wechsel`,
      erwartet: deck.erwarteteVideoId,
    });
    if (deckGedaechtnis.length > DECK_GEDAECHTNIS_MAX) deckGedaechtnis.shift();
    return;
  }

  deckTitelBeenden(deck);
}

/** Was geschieht, wenn ein Titel zu Ende ist.

    ALS EIGENE FUNKTION, seit es die feste Spielzeit gibt: Ein Titel
    kann jetzt auf ZWEI Weisen enden — von selbst am Dateiende, oder
    weil die eingestellte Spielzeit abgelaufen ist. Was danach zu
    geschehen hat, ist in beiden Fällen dasselbe. Stünde es weiterhin
    nur in der Ereignisbehandlung, müsste der zweite Weg es
    nachbilden — und zwei Nachbildungen desselben Ablaufs laufen mit
    der Zeit auseinander. */
function deckTitelBeenden(deck) {
  // E1: Endet der Titel von VOR dem Laden, gehört er nicht zur Liste. Die
  // Marke steht schon vor Titel 1 - weitergerückt wird also auf Titel 1.
  const alterTitel = deckAlterTitelLaeuft(deck);
  automixMelden(`Deck ${deck.kennung.toUpperCase()}: `
    + (alterTitel ? 'bisheriger Titel (vor dem Laden der neuen Liste)' : `Titel ${deck.laufend + 1}`) + ' zu Ende - '
    + (deck.uebergeben ? 'schon uebergeben, naechster Titel nur bereitgelegt.'
      : deckAutoMixAn && deckBlendSekunden === 0 ? 'harter Schnitt zum anderen Deck, falls dort Titel liegen.'
        : 'weiter in der eigenen Warteschlange.'));
  if (alterTitel) deck.altTitel = null;
  // Durchgelaufen heißt gespielt - die Zeile wird gedämpft.
  deckAlsGespieltMerken(deck, deck.laufend);

  // (1) Es wurde bereits an das andere Deck übergeben. Dann rückt dieses
  //     Deck nur STILL einen Titel weiter und wartet dort auf die
  //     nächste Übergabe.
  if (deck.uebergeben) {
    deck.uebergeben = false;
    deckStillWeiter(deck);
    return;
  }
  // (2) Auto-Mix mit Überblenddauer 0: harter Schnitt zum anderen Deck,
  //     ohne Blende. Ausdrücklich erlaubt und kein Fehlerfall.
  if (deckAutoMixAn && deckBlendSekunden === 0 && deckHarterSchnitt(deck)) {
    deckStillWeiter(deck);
    return;
  }
  // (3) Der Normalfall: eins weiter in der eigenen Warteschlange.
  deckWeiter(deck, +1, true);
}

function deckFehler(deck, ereignis) {
  // 101 und 150 heißen beide: Der Rechteinhaber erlaubt das Einbetten
  // nicht. Solche Titel werden gekennzeichnet und übersprungen, statt
  // das Deck stehen zu lassen.
  // E1: Im Zustand „alter Titel läuft zu Ende“ betrifft der Fehler ihn -
  // dann geht es gleich mit Titel 1 der neuen Liste weiter.
  const t = deckTitelImPlayer(deck);
  const gesperrt = ereignis.data === 101 || ereignis.data === 150;
  if (gesperrt && t) {
    if (deckAlterTitelLaeuft(deck)) deck.altTitel = null;
    deck.gesperrt.add(t.video_id);
    deckQueueZeichnen(deck);
    // Die Begründung wird MITGEGEBEN und nicht vorher gesetzt: Der
    // Sprung räumt die Meldezeile auf, sonst verschwände der Grund
    // sofort wieder und der Titel wäre scheinbar grundlos übersprungen.
    deckWeiter(deck, +1, true,
      `„${t.titel}" darf nicht eingebettet werden — übersprungen.`);
    return;
  }
  deckMelden(deck, `Wiedergabe nicht möglich (Code ${ereignis.data}).`);
}

/** Merkt sich, welcher Titel auf diesem Deck jetzt erwartet wird, und
    wann er befohlen wurde - genau so, wie es deckSpringen tut.

    Kernkorrektur K1 (Auftrag 15, Nachbesserung 2, freigegeben am
    19.11.2026): „Teilen“ (deckAufteilen) und das Verschieben in bzw. aus
    einer Warteschlange (deckZwischenWarteschlangen, zwei Stellen) legen
    einen Titel nur BEREIT, ohne zu springen. Vorher setzten sie die
    beiden Merker nicht. Stand im Merker noch das Video von früher, hielt
    deckZustandGeaendert das Ende des neuen Titels für den Nachhall des
    alten und verwarf es - das Deck rückte nicht weiter. */
function deckErwartungSetzen(deck, t) {
  if (!t) return;
  deck.erwarteteVideoId = t.video_id;
  deck.titelBefohlenUm = Date.now();
}

/** Legt einen Titel im Player BEREIT, ohne ihn zu starten, und setzt den
    Merker des erwarteten Titels (deckErwartungSetzen). Ohne Player (das
    Deck hat noch nie gespielt) wird nur der Merker gesetzt; der Player
    entsteht beim ersten ▶ mit genau diesem Titel.

    Eine Stelle für alle, die nur bereitlegen: „Laden“ (L1, Nachbesserung 3),
    „Teilen“ und das Verschieben zwischen den Warteschlangen (K1,
    Nachbesserung 2). Vorher stand dieselbe Zeile an drei Stellen. */
function deckBereitlegen(deck, t) {
  if (!t) return;
  deckErwartungSetzen(deck, t);
  if (deck.spieler && deck.spieler.cueVideoById) deck.spieler.cueVideoById(t.video_id);
}

/** Nimmt den Anfang einer FRISCHEN Liste von außen an: „An Deck senden“
    der PC-Hülle (app.js, deckUebernehmen: „Ersetzen“ bei stehendem Deck und
    Senden in ein leeres Deck). Vorher steht die neue Liste schon in
    `deck.titel`, die Marke auf 0. Gibt zurück, ob Titel 1 im Player
    bereitliegt (true) oder erst nach dem laufenden Titel kommt (false).

    (A) DAS DECK STEHT: dieselben Schritte wie „Laden“ (L1, L3):
        (1) Eine Einstiegsstelle aus der letzten Sitzung gilt für die neue
            Liste nicht (sonst begänne ihr erster Titel mitten drin).
        (2) L3: Spielt nichts, startet danach nichts von selbst - der
            Wächter wartet auf ▶ (deckRuheBisStart).
        (3) Titel bereitlegen und den Merker des erwarteten Titels setzen
            (deckBereitlegen), sonst verwürfe das Deck später dessen Ende.
    (B) DAS DECK SPIELT ODER STARTET GERADE (nur möglich, wenn seine Liste
        leer war: Der laufende Titel wurde aus der Warteschlange genommen
        und „spielt noch zu Ende“): Nichts geht an den Player (Party-Regel).
        Es gilt dasselbe wie bei E1: Der laufende Titel (`imPlayer`, vom
        Aufrufer VOR dem Austausch der Liste ermittelt) spielt zu Ende,
        danach kommt Titel 1. Eine Titelblende von Hand endet, ihr Sprung
        zielte auf die alte Liste.

    Kernkorrektur im Abschluss von Auftrag 15 (freigegeben 19.11.2026,
    Antwort zu Nachbesserung 4 (1)). Vorher schickte app.js den Titel
    direkt an den Player (gemessen): Am Ende des ersten Titels blieb das
    Deck stehen, mit Auto-Mix lief er zweimal, ohne ▶ startete der Wächter
    das Deck nach 6 s von selbst - und in Fall (B) brach die laufende Musik
    ab. Seitdem ist dies der einzige Weg, auf dem die Hülle einen Titel im
    Player eines Decks bereitlegt. */
function deckFrischeListeBereitlegen(deck, imPlayer) {
  const t = deck.titel[0];
  if (!t) return false;
  if (deckSpieltOderStartet(deck)) {
    deck.laufend = -1;
    deck.altTitel = imPlayer || null;
    deckTitelBlendeAbbrechen(deck);
    return false;
  }
  deck.altTitel = null;
  deck.startSekunde = 0;
  deckRuheBisStart(deckIrgendeinsSpielt());
  deckBereitlegen(deck, t);
  return true;
}

/** Spielt dieses Deck gerade oder ist es dabei zu starten (puffert)? */
function deckSpieltOderStartet(deck) {
  if (!deck.spieler || !deck.spieler.getPlayerState) return false;
  const zustand = deck.spieler.getPlayerState();
  return zustand === DECK_LAEUFT || zustand === DECK_PUFFERT;
}

/** Spielt irgendein Deck oder startet gerade? */
function deckIrgendeinsSpielt() {
  return deckSpieltOderStartet(decks.a) || deckSpieltOderStartet(decks.b);
}

/* --- E1: Laden in ein spielendes Deck (Auftrag 15, Nachbesserung 4) -----
   Wird eine neue Liste geladen, während das Deck spielt, spielt der
   laufende Titel zu Ende, danach kommt Titel 1 der neuen Liste (Erklärung
   in deckPlaylistLaden). Solange gilt:
   (1) `laufend` ist -1: Die Marke steht VOR Titel 1. deckNaechsterIndex
       liefert damit 0 - jeder Weg, der weiterrückt, landet auf Titel 1.
   (2) `altTitel` ist der Titel, der im Player zu Ende läuft. Er gehört
       nicht zur Liste. Wo bisher „der Titel an der Marke“ gefragt war,
       weil der Player ihn spielt (Überblendung, Songtext, Fehler), gilt er.
   (3) Die Titelkarte zeigt ihn weiter, darunter „Als Nächstes: <Titel 1>“;
       in der Warteschlange trägt Titel 1 die Marke „»“.
   Sobald die Marke wieder auf einem Titel steht (Titelende, Sprung,
   Doppelklick, Teilen, Wiederherstellen), ist der Zustand vorbei:
   deckQueueZeichnen räumt `altTitel` dann auf. */

/** Läuft im Player noch der Titel von VOR dem Laden der neuen Liste? */
function deckAlterTitelLaeuft(deck) {
  return deck.laufend < 0 && !!deck.altTitel;
}

/** Der Titel, den der Player dieses Decks gerade spielt bzw. bereithält:
    sonst der Titel an der Marke, im Zustand E1 der alte Titel. */
function deckTitelImPlayer(deck) {
  return deckAlterTitelLaeuft(deck) ? deck.altTitel : deck.titel[deck.laufend];
}

/** Welcher Titel liegt WIRKLICH im Player? Für E1 beim Laden: Meist ist es
    der Titel an der Marke. Hat jemand den laufenden Titel aus der
    Warteschlange genommen („er spielt noch zu Ende“), steht die Marke schon
    auf dem nächsten - dann zählt der Merker des erwarteten Videos, notfalls
    das, was der Player selbst über sein Video sagt. */
function deckTitelVomPlayer(deck) {
  const anMarke = deckTitelImPlayer(deck) || null;
  const erwartet = deck.erwarteteVideoId;
  if (!erwartet || (anMarke && anMarke.video_id === erwartet)) return anMarke;
  const inListe = deck.titel.find(t => t.video_id === erwartet);
  if (inListe) return inListe;
  let daten = null;
  try { daten = deck.spieler && deck.spieler.getVideoData ? deck.spieler.getVideoData() : null; }
  catch (fehler) { daten = null; }
  return { video_id: erwartet, titel: (daten && daten.title) || '', interpret: (daten && daten.author) || '' };
}

/** Zeigt auf der Titelkarte „Als Nächstes: <Titel 1>“ - nur im Zustand E1,
    sonst gibt es das Feld gar nicht (die Karte bleibt Zeichen für Zeichen
    wie vorher). Es steht in der freien Mitte zwischen Position und Dauer,
    damit die Karte nicht höher wird (Gestaltung: playdecker_design.css). */
function deckAlsNaechstesAnzeigen(deck) {
  const karte = deck.el.titelZeile ? deck.el.titelZeile.closest('.deck-anzeige') : null;
  if (!karte) return;
  let feld = karte.querySelector('.deck-als-naechstes');
  const naechster = deckAlterTitelLaeuft(deck) ? deck.titel[0] : null;
  if (!naechster) {
    if (feld) feld.remove();
    return;
  }
  if (!feld) {
    feld = document.createElement('span');
    feld.className = 'deck-als-naechstes';
    karte.appendChild(feld);
  }
  feld.innerHTML = `<b>Als Nächstes:</b> ${discSchuetzen(naechster.titel || '')}`;
  feld.title = `Als Nächstes: ${naechster.titel || ''}${naechster.interpret ? ` – ${naechster.interpret}` : ''}`
    + ' (der laufende Titel spielt zu Ende)';
}

/* --- L3: Nach dem Bereitlegen von Hand wartet der Wächter auf einen Start
   (Auftrag 15, Nachbesserung 3, Befund Ralle im Prüfplan zu Nachbesserung
   2, Schritt 2.5 (3): „Nach dem Laden der Playlist wird das Deck
   automatisch angestoßen. Begründung … kein Ton, also anstupsen.“)

   GEMESSEN (pruefe_playdecker_gleich.py, Abläufe l3_…): Der Wächter hielt
   sich bisher nur bei einer PAUSE VON HAND heraus (deckVonHandPausiert).
   Wer ein angehaltenes Deck neu belegte, ließ den Player aber einen Titel
   BEREITLEGEN - danach steht er auf „vorgemerkt“, nicht mehr auf
   „pausiert“. Die Pause von Hand war damit vergessen, und 6 s später
   startete der Wächter das Deck von selbst. Bei „Teilen“ geschah das schon
   immer; mit L1 (Laden legt bereit) wäre es nach JEDEM Laden geschehen.

   DIE REGEL: Legt der Nutzer einen Titel nur bereit (Laden, Teilen,
   Verschieben zwischen den Warteschlangen, Doppelklick bei stehendem
   Deck), während im PlayDecker NICHTS spielt, dann soll auch weiter nichts
   spielen. Der Wächter greift erst wieder ein, wenn irgendein Deck
   gestartet wurde (▶, Doppelklick bei laufendem Deck, Übergabe, oder der
   Player meldet „puffert“/„läuft“). Spielt dagegen ein Deck, ändert das
   Bereitlegen nichts: Der Wächter bewacht die laufende Musik wie bisher und
   greift bei echtem Stillstand nach der üblichen Frist ein.
   (Der Merker deckWartetAufStart steht ganz oben im Modul.) */

/** Merkt sich, dass der PlayDecker auf einen Start wartet - aber nur, wenn
    vor dem Bereitlegen nichts gespielt hat (`spielteVorher`). */
function deckRuheBisStart(spielteVorher) {
  if (spielteVorher) return;
  if (!deckWartetAufStart) {
    automixMelden('Waechter ruht: Titel von Hand bereitgelegt, nichts spielt - bis zum naechsten Start.');
  }
  deckWartetAufStart = true;
}

/** Ein Start wurde befohlen oder gemeldet - der Wächter bewacht wieder. */
function deckStartBefohlen() {
  deckWartetAufStart = false;
}

/** Spielt den Titel an der angegebenen Stelle.

    `meldung` ist für den Fall gedacht, dass der Sprung eine Ursache hat,
    die der Nutzer erfahren soll (etwa ein übersprungener Titel). Ohne
    diesen Umweg würde die Meldezeile beim Sprung geleert und der Grund
    verschwände, kaum dass er dastand. */
async function deckSpringen(deck, index, autostart = true, meldung = '',
                            ausTitelblende = false) {
  if (!deck.titel.length) return;
  if (index < 0 || index >= deck.titel.length) return;
  // PARTY-REGEL: Spielt der Jukeboxer, wird der Titel nur bereitgelegt,
  // nicht gespielt - die Auswahl bleibt also nicht wirkungslos.
  const parteiAbgewiesen = autostart && deckJukeboxerSpielt();
  if (parteiAbgewiesen) autostart = false;
  // L3: Wer startet, will Musik - der Wächter bewacht sie wieder.
  if (autostart) deckStartBefohlen();

  // EINE LAUFENDE TITELBLENDE DIESES DECKS BEENDEN (12.08.2026). Der
  // Kommentar weiter unten hat das schon immer versprochen; der Code
  // dazu war mit dem Rückbau von Wunsch A3 verschwunden und das
  // Versprechen damit hohl. Mit Änderungswunsch 4 gibt es wieder eine
  // eigene Blende - also braucht es die Zeile auch wieder.
  //
  // AUSGENOMMEN ist der Aufruf AUS der Blende heraus: Der würde sonst
  // genau den Vorgang abbrechen, zu dem er selbst gehört.
  if (!ausTitelblende) deckTitelBlendeAbbrechen(deck);

  // WER EINEN TITEL VERLÄSST, HAT IHN HINTER SICH — gleich auf welchem
  // Weg. Vorher stand das Merken nur in `deckWeiter`, also allein am
  // ⏭-Knopf und am Titelende. Wer stattdessen eine Zeile in der
  // Warteschlange anklickte, ließ den verlassenen Titel ungefärbt
  // zurück; beim Testen ist genau das aufgefallen. Ausgenommen ist nur
  // der Sprung auf sich selbst (denselben Titel noch einmal von vorn).
  if (deck.laufend >= 0 && deck.laufend !== index) {
    deckAlsGespieltMerken(deck, deck.laufend);
  }
  // (Das Beenden einer eigenen Blende steht jetzt ganz oben in dieser
  //  Funktion — dort, wo es hingehört: vor allem anderen.)
  // Wer wieder irgendwo in der Liste steht, ist nicht mehr „durch".
  deck.fertig = false;
  // `uebergeben` ebenfalls löschen. Der Merker bedeutet „ich habe schon
  // abgegeben und rücke am Titelende nur noch still vor". Blieb er nach
  // einem Eingriff von Hand stehen, legte dieses Deck beim nächsten
  // Titelende bloß den Folgetitel bereit, ohne ihn zu spielen — und wenn
  // das andere Deck da schon fertig war, war es still.
  deck.uebergeben = false;
  // Wer springt, will spielen — eine vom Programm gesetzte Pause ist
  // damit hinfällig.
  deck.vonUnsPausiert = false;
  deck.laufend = index;
  const t = deck.titel[index];
  // Neuer Titel, neue Chance auf eine Überblendung — sonst bliebe ein
  // Titel, den man später noch einmal anspielt, für die Automatik
  // dauerhaft gesperrt.
  deck.blendeFuer = null;
  deckTitelAnzeigen(deck, t);
  deckQueueZeichnen(deck);
  deckMelden(deck, meldung);
  if (parteiAbgewiesen) deckParteiMeldung(deck);

  // EINSTIEGSSTELLE AUS DER LETZTEN SITZUNG. Wurde ein Stand geladen,
  // steht hier die Sekunde, an der zuletzt aufgehört wurde. Sie gilt
  // GENAU EINMAL — danach beginnt jeder Titel wieder von vorn, sonst
  // spränge die Wiedergabe bei jedem Durchlauf an dieselbe Stelle.
  const startSekunde = deck.startSekunde || 0;
  deck.startSekunde = 0;

  // WELCHER TITEL AUF DIESEM DECK ERWARTET WIRD und wann er befohlen
  // wurde (12.08.2026). Beides braucht deckZustandGeaendert, um ein
  // verspätetes „Ende" des VORHERIGEN Titels von einem echten Titelende
  // unterscheiden zu können - siehe die Begründung dort.
  deck.erwarteteVideoId = t.video_id;
  deck.titelBefohlenUm = Date.now();

  if (!deck.spieler) {
    await deckSpielerSicherstellen(deck, t.video_id);
    // Der frisch angelegte Player steht auf diesem Titel; er muss nur
    // noch losgeschickt werden.
    // Mit Startsekunde, aber OHNE Start (Stand wiederherstellen, oder die
    // Party-Regel hat abgewiesen): nicht springen, sondern den Titel samt
    // Einstiegsstelle nur bereitlegen. Ein Sprung im Zustand „nur
    // geladen" startete die Wiedergabe (Nacharbeit Auftrag 17).
    if (startSekunde > 0 && !autostart) {
      deck.spieler.cueVideoById({ videoId: t.video_id, startSeconds: startSekunde });
    } else if (startSekunde > 0) {
      deck.spieler.seekTo(startSekunde, true);
    }
    if (autostart) deck.spieler.playVideo();
  } else if (startSekunde > 0) {
    // Mit Startsekunde geht es nur über die Objektform des Aufrufs —
    // die einfache Form kennt keinen Einstiegspunkt.
    if (autostart) deck.spieler.loadVideoById({ videoId: t.video_id, startSeconds: startSekunde });
    else deck.spieler.cueVideoById({ videoId: t.video_id, startSeconds: startSekunde });
  } else {
    if (autostart) deck.spieler.loadVideoById(t.video_id);
    else deck.spieler.cueVideoById(t.video_id);
  }
  deckAnzeigeNachfuehren(deck);
  standGeplant();
}

/** Einen Titel vor oder zurück. `automatisch` unterscheidet den
    Titelende-Fall vom Knopfdruck: Am Ende der Liste soll nicht
    stillschweigend wieder vorn begonnen werden. */
function deckWeiter(deck, richtung, automatisch = false, meldung = '') {
  // Das Merken übernimmt sonst `deckSpringen` — aber NUR, wenn dort
  // überhaupt gesprungen wird. Am Listenende (`ziel` liegt hinter dem
  // letzten Titel) kommt es nicht mehr dazu, und der letzte Titel bliebe
  // ungefärbt zurück. Deshalb steht es hier zusätzlich, VOR der
  // Bereichsprüfung. Doppeltes Merken schadet nicht: Es ist eine Menge.
  if (richtung > 0) deckAlsGespieltMerken(deck, deck.laufend);
  // Vorwärts entscheidet `deckNaechsterIndex` — es kennt als Einziges
  // die Wiederholung (A4) und springt am Listenende gegebenenfalls
  // zurück auf Anfang. Rückwärts ist es schlicht eins weniger.
  const ziel = richtung > 0 ? deckNaechsterIndex(deck) : deck.laufend - 1;
  if (ziel < 0) {
    if (richtung > 0) {
      // Die Warteschlange ist durch. Das wird VERMERKT, nicht nur
      // gemeldet: Das andere Deck darf nun nicht mehr hierher übergeben,
      // sonst spielte es diesen letzten Titel ein zweites Mal an,
      // statt allein weiterzulaufen (A2).
      deck.fertig = true;
      // UND DEN PLAYER STILLLEGEN (Fehlerbericht 18.08.2026). Ohne diese
      // Zeile blieb der Player im Zustand "beendet" stehen. Das ist nicht
      // dasselbe wie "pausiert": Ein beendeter Player wird vom Wächter
      // weiter angefasst, und deckZielStarten() lädt in diesem Zustand
      // den letzten Titel NEU. Ergebnis war ein Deck, das am Listenende
      // hängenblieb und alle paar Sekunden kurz wieder angestoßen wurde.
      // Pausiert wird "von uns" - der Wächter unterscheidet das von
      // einer Pause des Nutzers und schaltet sich deshalb nicht
      // insgesamt ab (siehe deckVonHandPausiert).
      deckPausierenVonUns(deck);
      deckQueueZeichnen(deck);
      if (automatisch) {
        // Am Listenende zählt der Grund mehr als die Zielmeldung: Wenn der
        // letzte Titel gesperrt war, soll das dastehen und nicht bloß
        // "Ende erreicht".
        deckMelden(deck, meldung || 'Ende der Warteschlange erreicht.');
        deckAnzeigeNachfuehren(deck);
      }
    }
    return;
  }
  // VON HAND ODER VOM TITELENDE — hier trennt sich beides
  // (Änderungswunsch 4 vom 12.08.2026):
  //
  // `automatisch === false` heißt: Der Nutzer hat ⏭ oder ⏮ gedrückt.
  // Dann kommt der weiche Übergang aus deckTitelVonHand.
  //
  // `automatisch === true` heißt: Der Titel ist zu Ende gelaufen, oder er
  // war gesperrt. Dann bleibt es beim harten Wechsel — an einem Titel,
  // der ohnehin verklungen ist, gibt es nichts auszublenden. Das ist
  // zugleich die Stelle, an der der abbestellte Wunsch A3 abbestellt
  // bleibt.
  if (automatisch) deckSpringen(deck, ziel, true, meldung);
  else deckTitelVonHand(deck, ziel, meldung);
}

// Wie weit ein Druck auf die Spulknöpfe springt.
const DECK_SPULWEITE_S = 10;
// Zwei Sekunden Sicherheitsabstand zum Ende: Direkt ans Ende zu springen
// löste sonst sofort das Titelende-Ereignis aus - der Titel wäre also
// übersprungen statt vorgespult. (Der Jukeboxer nimmt 1 s, Auftrag 17.)
const DECK_SPUL_ABSTAND_ENDE_S = 2;

/** Darf auf diesem Deck gesprungen werden, ohne dass der Sprung die
    Wiedergabe startet? (Nacharbeit Auftrag 17, Party-Regel.) Ein Sprung
    im Zustand „nur geladen" (z. B. gleich nach „Laden") oder „zu Ende"
    startet bei YouTube die Wiedergabe - an deckSpielenUmschalten und
    damit an der Prüfung der Party-Regel vorbei. Die Regel ist dieselbe
    wie im Jukeboxer (wiedergabe_regeln.js, sprungErlaubt). */
function deckSprungErlaubt(p) {
  if (!p || !p.getPlayerState || !p.getCurrentTime) return false;
  return window.WiedergabeRegeln.sprungErlaubt(p.getPlayerState());
}

/** Spult innerhalb des LAUFENDEN Titels vor oder zurück.

    Bewusst begrenzt: Über den Titelanfang hinaus wird nicht zum
    vorherigen Titel gesprungen, und über das Ende hinaus nicht zum
    nächsten. Dafür gibt es ⏮ und ⏭ — ein Spulknopf, der unversehens
    den Titel wechselt, wäre eine unangenehme Überraschung. */
function deckSpulen(deck, sekunden) {
  const p = deck.spieler;
  if (!deckSprungErlaubt(p)) {
    deckMelden(deck, 'Erst abspielen, dann lässt sich spulen.');
    return;
  }
  const dauer = p.getDuration() || 0;
  // Begrenzt auf Anfang und Ende minus Sicherheitsabstand (gemeinsame
  // Spulregel mit dem Jukeboxer, wiedergabe_regeln.js).
  p.seekTo(window.WiedergabeRegeln.spulZiel((p.getCurrentTime() || 0) + sekunden, dauer, DECK_SPUL_ABSTAND_ENDE_S), true);
  deckAnzeigeNachfuehren(deck);
}

/** Springt an die angeklickte Stelle der Fortschrittsleiste. */
function deckSpringeAnStelle(deck, ereignis) {
  const p = deck.spieler;
  if (!deckSprungErlaubt(p)) {
    deckMelden(deck, 'Erst abspielen, dann lässt sich spulen.');
    return;
  }
  const dauer = p.getDuration() || 0;
  if (dauer <= 0) return;
  const leiste = ereignis.currentTarget.getBoundingClientRect();
  const regeln = window.WiedergabeRegeln;
  const anteil = regeln.anteilAnStelle(ereignis.clientX, leiste.left, leiste.width);
  p.seekTo(regeln.spulZiel(anteil * dauer, dauer, DECK_SPUL_ABSTAND_ENDE_S), true);
  deckAnzeigeNachfuehren(deck);
}

function deckSpielenUmschalten(deck) {
  if (!deck.titel.length) {
    deckMelden(deck, 'Erst eine Playlist laden.');
    return;
  }
  const laeuftSchon = deck.spieler && deck.spieler.getPlayerState() === DECK_LAEUFT;
  // PARTY-REGEL: Ein START wird abgewiesen, solange der Jukeboxer spielt.
  // Eine Pause dagegen ist immer erlaubt.
  if (!laeuftSchon && deckStartAbgewiesen(deck)) return;

  // MANUELLE ÜBERGABE (Wunsch 3): Läuft das ANDERE Deck und der Nutzer
  // startet dieses hier von Hand, ist das die Ansage „jetzt wechseln".
  // Dann wird übergeblendet wie am Titelende — und danach beendet das
  // abgebende Deck seinen Titel und legt den nächsten bereit.
  //
  // Gekoppelt an den Auto-Mix-Schalter, und zwar mit Absicht: Ist er
  // aus, will der Nutzer von Hand mischen. Dann müssen beide Decks
  // gleichzeitig laufen dürfen, und allein der Crossfader entscheidet.
  // Würde hier immer übergeblendet, wäre reines Handmischen unmöglich.
  const anderes = deckAnderes(deck);
  const anderesLaeuft = anderes.spieler
    && anderes.spieler.getPlayerState() === DECK_LAEUFT;
  if (!laeuftSchon && anderesLaeuft && deckAutoMixAn && !deckBlende) {
    deckUebergabeVonHand(anderes);
    return;
  }

  if (!deck.spieler) {
    // Erster Start - genau hier ist die Nutzergeste, auf die es ankommt.
    // (A5) Und genau hier gehört der Regler ganz auf dieses Deck: Wer
    // B zuerst startet, will B hören und nicht die halbe Lautstärke,
    // die der Regler in seiner Mittelstellung übrig lässt.
    deckErstStartRegler(deck);
    deckSpringen(deck, Math.max(deck.laufend, 0));
    return;
  }

  // AM LISTENENDE HEISST ▶ „NOCH EINMAL" (18.08.2026). Seit das Deck am
  // Ende der Warteschlange pausiert wird — statt im Zustand „beendet" zu
  // verharren und dort vom Wächter angestoßen zu werden —, steht der
  // Player auf der letzten Sekunde des letzten Titels. Ein bloßes
  // playVideo() spielte diesen Rest zu Ende und wäre sofort wieder am
  // Ende: Der Knopf sähe wirkungslos aus. deckSpringen setzt `fertig`
  // zurück und beginnt den Titel von vorn, was hier die naheliegende
  // Bedeutung von ▶ ist.
  //
  // `deckErschoepft` und nicht `fertig`: Bei eingeschalteter Wiederholung
  // ist ein Deck nie erschöpft, dort gilt weiterhin der normale Weg.
  if (!laeuftSchon && deckErschoepft(deck) && deck.laufend >= 0) {
    deckSpringen(deck, deck.laufend, true);
    return;
  }

  // WER SELBST ANFASST, BEENDET DIE TITELBLENDE (12.08.2026). Sonst
  // liefe sie über den Handgriff hinweg weiter und zöge die Lautstärke
  // wenige Zehntel später wieder dorthin, wo der Nutzer sie gerade nicht
  // haben wollte. Dieselbe Regel wie beim Crossfader (Entscheidung 2A):
  // Ein Eingriff von Hand führt.
  deckTitelBlendeAbbrechen(deck);

  if (laeuftSchon) {
    // DIE PAUSE VON HAND. Der Merker wird ausdrücklich gelöscht: Diese
    // Pause kommt vom Nutzer, und der Wächter soll sie in Ruhe lassen.
    deck.vonUnsPausiert = false;
    // UND DER MERKER „schon übergeben“ GEHT MIT (Kernkorrektur K2,
    // Auftrag 15, Nachbesserung 2, freigegeben 19.11.2026). Nach einer
    // Überblendung spielt das abgebende Deck seinen Titel unhörbar zu Ende
    // und trägt dabei den Merker. Hielt man es jetzt an, blieb er stehen:
    // Kam die Automatik später hierher zurück, setzte das Deck den alten
    // Titel fort und legte an dessen Ende den nächsten nur bereit - eine
    // Lücke, bis der Wächter nach 6 s eingriff.
    deck.uebergeben = false;
    deck.spieler.pauseVideo();
  } else {
    deck.vonUnsPausiert = false;
    deckErstStartRegler(deck);
    deckStartBefohlen();          // L3
    deck.spieler.playVideo();
  }
  deckAnzeigeNachfuehren(deck);
}

/** Übergabe auf Zuruf: blendet von `von` zum anderen Deck und beendet
    danach den laufenden Titel von `von`. */
function deckUebergabeVonHand(von) {
  if (deckBlendSekunden <= 0) {
    // Harter Schnitt - kein Ausblenden, sofort umschalten.
    if (deckHarterSchnitt(von)) {
      if (von.spieler) deckPausierenVonUns(von);
      deckStillWeiter(von);
      deckMelden(von, 'Übergeben — nächster Titel liegt bereit.');
    }
    return;
  }
  deckBlendeStarten(von, true);
}


/* --- Verdrahtung ------------------------------------------------------- */

['a', 'b'].forEach(k => {
  const deck = decks[k];
  deck.el.laden.onclick = () => deckPlaylistLaden(deck);
  deck.el.teilen.onclick = () => deckAufteilen(deck);
  deck.el.spielKnopf.onclick = () => deckSpielenUmschalten(deck);
  deck.el.vor.onclick = () => deckWeiter(deck, +1);
  deck.el.zurueck.onclick = () => deckWeiter(deck, -1);
  deck.el.rueck.onclick = () => deckSpulen(deck, -DECK_SPULWEITE_S);
  deck.el.spul.onclick = () => deckSpulen(deck, +DECK_SPULWEITE_S);
  // Ein Klick in die Fortschrittsleiste springt an diese Stelle. Das ist
  // die schnelle Bewegung; die Spulknöpfe sind die feine.
  deck.el.balken.parentElement.onclick = ereignis => {
    deckSpringeAnStelle(deck, ereignis);
  };
});

// Die Playlist-Quellen richtet die HÜLLE ein (Auftrag 15) - genau an dieser
// Stelle, damit die Reihenfolge beim Start dieselbe bleibt wie vorher. Am PC:
// lokale Listen beim Start und beim Reiter-Klick holen, die YouTube-
// Mediathek erst beim ersten Fokus auf ein Auswahlfeld (app.js,
// Abschnitt (10)). In der App: die Playlisten aus dem Paket.
if (umgebung.quellenEinrichten) umgebung.quellenEinrichten({ decks, auswahlFuellen: deckAuswahlFuellen });


/* ====================================================================
   (10b) PlayDecker — Crossfader und Auto-Mix (Bauauftrag 08, Phase 3)

   Der Crossfader setzt die Lautstärken beider Decks gegenläufig. Der
   Auto-Mix übergibt am Titelende an das andere Deck, indem er genau
   diesen Regler von selbst hinüberfährt.

   WARUM DER REGLER UND NICHT ZWEI GETRENNTE LAUTSTÄRKEN: Es gibt genau
   EINE Wahrheit über die Balance, und die steht sichtbar im Fenster.
   Führte die Automatik eine eigene, unsichtbare Lautstärke mit, stünde
   der Regler nach einem Übergang falsch — und der nächste Handgriff des
   Nutzers risse den Ton hörbar zurück.

   ÜBERBLENDUNG PER LAUTSTÄRKE, NICHT TAKTSYNCHRON: Der eingebettete
   Player gibt das rohe Tonsignal nicht heraus. Übergänge sind darum
   hörbar weich, aber nicht auf den Schlag genau. Die Fußzeile des
   Reiters sagt das auch so.
   ==================================================================== */

// Takt der Blende. 25 ms sind gemessen ausreichend fein: Die Lautstärke
// kennt 101 ganzzahlige Stufen, und schon eine Vier-Sekunden-Blende
// bekommt damit 160 Takte — jede Stufe wird genutzt.
const DECK_BLEND_TAKT_MS = 25;

// Regler ganz links = nur A, ganz rechts = nur B.
const DECK_NUR_A = 0, DECK_NUR_B = 100;

let deckCross = 50;             // Stellung des Crossfaders
let deckGesamtLautstaerke = 100; // Gesamtlautstärke beider Decks (Bauauftrag 13)
// (A6) Die Automatik steht ab Werk auf AN. Wer ein DJ-Pult aufmacht,
// will in aller Regel, dass es durchläuft; das Ausschalten ist ein Klick.
let deckAutoMixAn = true;
let deckBlendSekunden = 4;      // 0 bis 20; 0 heißt harter Schnitt
let deckBlende = null;          // der gerade laufende Übergang

const deckCrossEl = kernElement('deck-crossfader');
const deckCrossWerteEl = kernElement('deck-cross-werte');
const deckAutoMixKipp = kernElement('deck-automix-kipp');
const deckAutoMixZeile = kernWurzel.querySelector('.automix');
const deckDauerEl = kernElement('deck-dauer');
const deckDauerWertEl = kernElement('deck-dauer-wert');
const deckDauerZusatzEl = kernElement('deck-dauer-zusatz');
// Die Zeile der Überblenddauer - über ihren Regler gesucht. Hier stand
// document.querySelector('#panel-deck .dauer-wahl'): Das traf seit der
// Gesamtlautstärke (Bauauftrag 13) die LAUTSTÄRKE-Zeile, die vorne steht.
// Die Markierung „harter Schnitt" landete dadurch an der falschen Zeile
// (nachgemessen bei Auftrag 16, Phase 3).
const deckDauerWahlEl = deckDauerEl.closest('.dauer-wahl');

/** Füllung eines Pult-Reglers (Auftrag 16): Die Strecke links vom Knopf
    erscheint in der Signalfarbe des Designs. Das CSS braucht dafür den
    Anteil als --wert. Aufgerufen an den Stellen, an denen sich ein Wert
    ändert - auch wenn das Skript ihn setzt (dann kommt kein „input"). */
function deckReglerFuellen(regler) {
  if (!regler) return;
  const min = Number(regler.min) || 0;
  const max = Number(regler.max);
  const spanne = (Number.isFinite(max) ? max : 100) - min;
  const anteil = spanne > 0 ? (Number(regler.value) - min) / spanne : 0;
  regler.style.setProperty('--wert', `${(Math.min(Math.max(anteil, 0), 1) * 100).toFixed(1)}%`);
}

function deckAnderes(deck) { return deck === decks.a ? decks.b : decks.a; }


/* --- Crossfader -------------------------------------------------------- */

/** Rechnet die Reglerstellung in zwei Lautstärken um.

    Bewusst LINEAR und nicht nach einer Leistungskurve: Bei 101 ganzen
    Stufen und ohne Zugriff auf das Tonsignal wäre jede feinere Kurve
    eine Genauigkeit, die wir gar nicht prüfen könnten. Linear ist
    vorhersehbar, und die beiden Zahlen unter dem Regler zeigen es. */
function deckLautstaerkeAnwenden() {
  // ERGÄNZT am 12.08.2026 (Änderungswunsch 4): Der Crossfader bleibt die
  // eine sichtbare Wahrheit über die BALANCE zwischen den Decks. Der
  // `blendFaktor` ist etwas anderes und liegt bewusst DAHINTER: eine
  // kurze Dämpfung eines einzelnen Decks während eines Titelwechsels von
  // Hand. Er wird MULTIPLIZIERT, nicht addiert, und kehrt danach auf 1
  // zurück - der Regler steht hinterher also genau dort, wo ihn der
  // Nutzer gelassen hat. Damit gilt der Grundsatz von oben weiter: Die
  // Automatik führt keine zweite, unsichtbare Balance mit.
  // GESAMTLAUTSTÄRKE (Bauauftrag 13): wird mit Crossfader und Blende
  // MULTIPLIZIERT - bei 50 klingt alles halb so laut, die Balance bleibt.
  const gesamt = deckGesamtLautstaerke / 100;
  const lautA = Math.round((DECK_NUR_B - deckCross) * decks.a.blendFaktor * gesamt);
  const lautB = Math.round(deckCross * decks.b.blendFaktor * gesamt);
  if (decks.a.spieler && decks.a.spieler.setVolume) decks.a.spieler.setVolume(lautA);
  if (decks.b.spieler && decks.b.spieler.setVolume) decks.b.spieler.setVolume(lautB);
  // Angezeigt wird, was WIRKLICH herauskommt - nicht, was der Regler
  // allein sagen würde. Während einer Titelblende laufen die Zahlen
  // deshalb kurz herunter und wieder herauf. Das ist gewollt: Eine
  // Anzeige, die "A 50" behauptet, während A stumm ist, wäre falsch.
  deckCrossWerteEl.textContent = `A ${lautA} · B ${lautB}`;
  return { a: lautA, b: lautB };
}

/** Setzt den Crossfader. `vomNutzer` unterscheidet den Handgriff von der
    Bewegung, die die Automatik selbst auslöst. */
function deckCrossSetzen(wert, vomNutzer = false) {
  deckCross = Math.min(Math.max(Math.round(wert), DECK_NUR_A), DECK_NUR_B);
  deckCrossEl.value = String(deckCross);
  deckLautstaerkeAnwenden();
  if (vomNutzer) {
    // Entscheidung des Nutzers (2A): Wer den Regler anfasst, übernimmt.
    if (deckBlende) deckBlendeAbbrechen('Überblendung abgebrochen — der Regler führt.');
    // Dasselbe gilt für eine Titelblende (12.08.2026). Sie dämpft ein
    // Deck hinter dem Regler; liefe sie weiter, zöge sie die eben von
    // Hand eingestellte Lautstärke gleich wieder herunter — und der
    // Regler stünde da und behauptete etwas anderes.
    deckTitelBlendeAbbrechen(decks.a);
    deckTitelBlendeAbbrechen(decks.b);
  }
}

// Der `input`-Fall greift NUR beim echten Ziehen: Das Setzen von .value
// aus dem Skript löst ihn nicht aus. Genau deshalb lässt sich hier der
// Handgriff sauber vom Selbstlauf der Automatik trennen.
deckCrossEl.oninput = () => deckCrossSetzen(Number(deckCrossEl.value), true);


/* --- Titelwechsel von Hand mit weichem Übergang -----------------------
       (Änderungswunsch 4 vom 12.08.2026)

   WAS DER NUTZER WILL: Wird ein Titel von Hand ins Deck geholt — per
   Doppelklick in der Warteschlange oder mit ⏭ —, soll das nicht mehr als
   harter Schnitt kommen.

   ZWEI FÄLLE, und sie sind ausdrücklich verschieden:

   (4-1) Das Deck WARTET gerade (spielt nicht). Dann wird der Titel nur
         geladen und bleibt still. Kein Ton, keine Blende — das Deck
         wartet danach eben auf einen anderen Titel als vorher.
   (4-2) Das Deck SPIELT gerade. Dann wird der laufende Titel
         ausgeblendet, der neue geladen und wieder eingeblendet. Je
         Hälfte die halbe Überblenddauer: Bei 4 s also 2 s hinunter und
         2 s herauf, zusammen wieder 4 s (so vom Nutzer bestätigt).

   EHRLICH DAZU, UND DER NUTZER WEISS ES: Eine echte Überblendung ist das
   nicht. Ein Player spielt immer nur einen Titel; zwischen zwei Titeln
   DESSELBEN Decks kann es keine Überlappung geben. Es bleibt ein
   Ausblenden, ein Laden und ein Einblenden — mit einer kurzen Lücke
   dazwischen, deren Länge YouTube bestimmt, nicht wir.

   GENAU DAS WAR SCHON EINMAL GEBAUT (Wunsch A3 vom 06.08.) und wurde
   nach dem Testen abbestellt — damals für den AUTOMATISCHEN Titelwechsel
   am Titelende. Dort bleibt es abbestellt: `deckWeiter` blendet nur,
   wenn der Wechsel von Hand kommt (`automatisch === false`). Am
   Titelende ist ohnehin nichts mehr auszublenden.

   WARUM EIN EIGENER FAKTOR UND NICHT DER CROSSFADER: Der Crossfader
   regelt die Balance ZWISCHEN den Decks. Zöge man ihn zum Ausblenden
   von Deck A nach rechts, würde Deck B lauter — und das wartet dort
   womöglich still. Der `blendFaktor` sitzt deshalb dahinter und dämpft
   nur dieses eine Deck; der Regler steht hinterher unverändert da.
   -------------------------------------------------------------------- */

// Zuschlag auf die Frist einer Titelblende. Er deckt das Laden des
// Videos ab, dessen Dauer YouTube bestimmt. Erst NACH Ablauf der Frist
// gilt eine Blende als hängengeblieben - siehe deckWaechterPruefen.
const DECK_TITELBLENDE_ZUSCHLAG_MS = 4000;

/** Beendet eine laufende Titelblende dieses Decks und stellt seine volle
    Lautstärke wieder her.

    MUSS BEI JEDEM EINGRIFF AUFGERUFEN WERDEN, der die Wiedergabe
    umlenkt. Bliebe der Faktor auf halbem Weg stehen, stünde der Regler
    richtig und es käme trotzdem kaum etwas — der unangenehmste aller
    Zustände, weil man ihm nicht ansieht, woher er kommt. */
function deckTitelBlendeAbbrechen(deck) {
  const blende = deck.titelBlende;
  deck.titelBlende = null;
  if (blende) {
    if (blende.timer) clearInterval(blende.timer);
    // Eine wartende Rampe freigeben, sonst bliebe der Ablauf, der auf
    // sie wartet, für immer stehen.
    if (blende.aufloesen) blende.aufloesen();
  }
  if (deck.blendFaktor !== 1) {
    deck.blendFaktor = 1;
    deckLautstaerkeAnwenden();
  }
}

/** Fährt den Blendfaktor eines Decks weich auf `ziel`.

    Zeitgeber, NICHT requestAnimationFrame — dieselbe gemessene
    Begründung wie bei der Überblendung zwischen den Decks: Außerhalb des
    Vordergrunds hält der Browser die Bildschleife an, und die Blende
    bliebe auf halbem Weg stehen. */
function deckFaktorRampe(deck, ziel, dauerMs) {
  return new Promise(erfuellt => {
    const eigene = deck.titelBlende;
    const start = deck.blendFaktor;
    if (!eigene || dauerMs <= 0) {
      deck.blendFaktor = ziel;
      deckLautstaerkeAnwenden();
      erfuellt();
      return;
    }
    eigene.aufloesen = erfuellt;
    const beginn = performance.now();
    eigene.timer = setInterval(() => {
      // Wurde diese Blende inzwischen abgebrochen oder durch eine neue
      // ersetzt, steigt der Zeitgeber still aus. Das Zurücksetzen des
      // Faktors hat dann bereits deckTitelBlendeAbbrechen erledigt.
      if (deck.titelBlende !== eigene) { clearInterval(eigene.timer); erfuellt(); return; }
      const anteil = Math.min((performance.now() - beginn) / dauerMs, 1);
      deck.blendFaktor = start + (ziel - start) * anteil;
      deckLautstaerkeAnwenden();
      if (anteil >= 1) { clearInterval(eigene.timer); eigene.aufloesen = null; erfuellt(); }
    }, DECK_BLEND_TAKT_MS);
  });
}

/** Holt einen Titel von Hand ins Deck — Fall 4-1 oder 4-2, siehe oben. */
async function deckTitelVonHand(deck, index, meldung = '') {
  if (index < 0 || index >= deck.titel.length) return;

  const spieltGerade = deck.spieler && deck.spieler.getPlayerState
    && deck.spieler.getPlayerState() === DECK_LAEUFT;

  // (4-1) Das Deck wartet: Titel nur vormerken, still bleiben.
  if (!spieltGerade) {
    deckTitelBlendeAbbrechen(deck);
    // L3: Spielt auch sonst nichts, bleibt es still, bis jemand startet.
    deckRuheBisStart(deckIrgendeinsSpielt());
    await deckSpringen(deck, index, false, meldung);
    return;
  }

  // Überblenddauer 0 heißt im ganzen PlayDecker "harter Schnitt" - hier
  // genauso, sonst hieße dieselbe Einstellung an zwei Stellen
  // Verschiedenes.
  if (deckBlendSekunden <= 0) {
    deckTitelBlendeAbbrechen(deck);
    await deckSpringen(deck, index, true, meldung);
    return;
  }

  // (4-2) Das Deck spielt: ausblenden, wechseln, einblenden.
  deckTitelBlendeAbbrechen(deck);
  const halbeMs = Math.round(deckBlendSekunden * 1000 / 2);
  const marke = {};
  deck.titelBlende = {
    marke,
    timer: null,
    aufloesen: null,
    // Die Frist sagt dem Wächter, wie lange diese Stille planmäßig ist.
    fristMs: Date.now() + halbeMs * 2 + DECK_TITELBLENDE_ZUSCHLAG_MS,
  };
  const istNochUnsere = () => deck.titelBlende && deck.titelBlende.marke === marke;

  deckMelden(deck, `Wechsel zu „${deck.titel[index].titel}" `
                 + `(${(deckBlendSekunden / 2).toFixed(1).replace('.', ',')} s Blende) …`);

  await deckFaktorRampe(deck, 0, halbeMs);
  if (!istNochUnsere()) return;

  // Der Sprung darf die eigene Blende NICHT abbrechen - deshalb das
  // letzte Argument. Ohne es beendete dieser Aufruf genau die Blende,
  // in der er selbst steckt.
  await deckSpringen(deck, index, true, meldung, true);
  if (!istNochUnsere()) return;

  await deckFaktorRampe(deck, 1, halbeMs);
  if (!istNochUnsere()) return;

  deck.titelBlende = null;
  deck.blendFaktor = 1;
  deckLautstaerkeAnwenden();
}

/** Läuft gerade irgendwo eine Titelblende, die noch in ihrer Frist ist?

    DER WÄCHTER BRAUCHT DAS, und der Zuschnitt ist der eigentliche Punkt:
    Während einer Blende ist das Deck absichtlich stumm — bei 20 s
    Überblenddauer sind das zweimal 10 s, also weit mehr als die sechs
    Sekunden, nach denen der Wächter sonst eingreift. Er würde also mitten
    in einen völlig gesunden Übergang hineinfahren.

    Die Frist ist die Grenze dieses Vertrauens: Sie deckt die geplante
    Dauer plus einen Zuschlag fürs Laden. Danach gilt die Blende als
    hängengeblieben, und der Wächter macht wieder seine Arbeit. Ein
    Vertrauen ohne Frist wäre genau die lautlose Abschaltung, die ich
    bei der festen Spielzeit schon einmal gebaut hatte. */
function deckTitelBlendePlanmaessig() {
  const jetzt = Date.now();
  return ['a', 'b'].some(k => {
    const blende = decks[k].titelBlende;
    return Boolean(blende) && jetzt <= blende.fristMs;
  });
}


/* --- Auto-Mix: Schalter und Dauer -------------------------------------- */

/** Setzt Zustand UND Anzeige des Auto-Mix an einer Stelle. Damit kann
    die Anzeige nicht mehr etwas anderes behaupten als der Zustand. */
function deckAutoMixSetzen(an) {
  deckAutoMixAn = an;
  deckAutoMixKipp.classList.toggle('an', an);
  deckAutoMixZeile.classList.toggle('an', an);
}

deckAutoMixKipp.onclick = () => {
  const neu = !deckAutoMixAn;
  deckAutoMixSetzen(neu);
  // NACHGEMESSEN 08.10.2026 (Bauauftrag 13, Phase 3): Der umgeschaltete
  // Auto-Mix stand 3 s später noch nicht im gemerkten Stand - dasselbe
  // Muster wie bei der Überblenddauer. Jetzt wie dort sofort einplanen.
  standGeplant();
  // Ausschalten heißt: auch ein gerade laufender Übergang endet.
  if (!neu && deckBlende) {
    deckBlendeAbbrechen('Auto-Mix ausgeschaltet — Überblendung beendet.');
  }
};

/* --- Feste Spielzeit je Titel (Auftrag vom 11.08.2026) ---------------

   Wunsch: „Wenn der Slider auf eine andere Abspielzeit eingestellt
   wird, dann werden alle Titel nach dieser Zeit automatisch beendet und
   ordnungsgemäß auf den nächsten Titel überblendet."

   DER REGLER STEUERT NICHT SEKUNDEN, SONDERN STUFEN. Grund: Er soll
   ganz links „aus" sein und von dort auf 10 s springen — dazwischen
   soll es nichts geben. Ein Regler, der Sekunden führte, müsste dafür
   von 0 auf 10 springen, und das kann ein Schieberegler nicht. Mit
   Stufen ist es einfach: Stufe 0 heißt aus, Stufe n heißt n·10
   Sekunden. 60 Stufen ergeben 10 bis 600 Sekunden.

   WANN GEBLENDET WIRD: Die Blende beginnt so früh, dass sie GENAU zur
   eingestellten Zeit fertig ist — bei 210 s Spielzeit und 4 s Blende
   also bei 206 s. Damit steht der nächste Titel bei 210 s, so wie am
   natürlichen Titelende auch. */

const deckSpielzeitEl = kernElement('deck-spielzeit');
const deckSpielzeitWertEl = kernElement('deck-spielzeit-wert');
const deckSpielzeitZusatzEl = kernElement('deck-spielzeit-zusatz');
const deckSpielzeitWahlEl = kernWurzel.querySelector('.spielzeit-wahl');

// 0 heißt: keine Begrenzung, die Titel laufen in voller Länge.
let deckSpielzeitSekunden = 0;

/* Die Stufenlogik selbst steht seit Bauauftrag 13 an EINER Stelle für
   PlayDecker und Jukeboxer: static/jukeboxer/wiedergabe_regeln.js
   (Stufe 0 = aus, Stufe n = n x 10 s). Hier nur noch weitergereicht. */
function deckSpielzeitAusStufe(stufe) {
  return WiedergabeRegeln.spielzeitAusStufe(stufe);
}

/** Wann endet der laufende Titel dieses Decks WIRKLICH?

    Die eine Stelle, die beides zusammenbringt: die tatsächliche Länge
    der Aufnahme und die eingestellte feste Spielzeit. Ist der Titel
    kürzer als die eingestellte Zeit, gewinnt der Titel — dann gibt es
    nichts abzuschneiden. */
function deckSpielEnde(deck) {
  const p = deck.spieler;
  const dauer = (p && p.getDuration) ? (p.getDuration() || 0) : 0;
  if (!deckSpielzeitSekunden) return dauer;
  if (!dauer) return deckSpielzeitSekunden;
  return Math.min(dauer, deckSpielzeitSekunden);
}

function deckSpielzeitAnzeigen() {
  const an = deckSpielzeitSekunden > 0;
  deckSpielzeitWertEl.textContent = an ? `${deckSpielzeitSekunden} s` : 'aus';
  deckSpielzeitZusatzEl.textContent = an
    ? `jeder Titel endet nach ${deckZeitText(deckSpielzeitSekunden)}`
    : 'Titel laufen in voller Länge';
  if (deckSpielzeitWahlEl) deckSpielzeitWahlEl.classList.toggle('an', an);
  deckReglerFuellen(deckSpielzeitEl);
}

deckSpielzeitEl.oninput = () => {
  deckSpielzeitSekunden = deckSpielzeitAusStufe(deckSpielzeitEl.value);
  deckSpielzeitAnzeigen();
  // Eine geänderte Spielzeit macht eine bereits vergebene Blende
  // hinfällig: Sonst bliebe ein Titel, für den schon geblendet wurde,
  // bei einer neu eingestellten kürzeren Zeit trotzdem bis zum Schluss
  // stehen.
  decks.a.blendeFuer = null;
  decks.b.blendeFuer = null;
  standGeplant();
};
deckSpielzeitAnzeigen();

/** Beendet den Titel, wenn die eingestellte Spielzeit abgelaufen ist.

    Läuft im gemeinsamen Takt. Ohne diese Prüfung bliebe das Deck nach
    einer Übergabe stumm bis zum echten Dateiende stehen — es hätte
    seinen Titel dann zwar längst abgegeben, gälte aber noch minutenlang
    als beschäftigt und stünde für die nächste Übergabe nicht bereit. */
function deckSpielzeitPruefen(deck) {
  if (!deckSpielzeitSekunden) return;
  // App: Während die Seite verborgen ist, ruht auch die feste Spielzeit.
  if (automatikRuht()) return;
  const p = deck.spieler;
  if (!p || !p.getCurrentTime) return;
  if (p.getPlayerState() !== DECK_LAEUFT) return;
  const pos = p.getCurrentTime() || 0;
  if (pos < deckSpielzeitSekunden) return;
  const dauer = p.getDuration() || 0;
  // Ist die Aufnahme ohnehin kürzer, macht das Dateiende die Arbeit —
  // dann hier nichts tun, sonst käme das Titelende zweimal.
  if (dauer && dauer <= deckSpielzeitSekunden) return;
  automixMelden(`Deck ${deck.kennung.toUpperCase()}: feste Spielzeit ${deckSpielzeitSekunden} s erreicht `
    + `(Position ${sek(pos)} s im Titel) - Titel endet.`);
  // Anhalten, sonst liefe die Aufnahme unter dem nächsten Titel weiter.
  deckPausierenVonUns(deck);
  deckTitelBeenden(deck);
}

function deckDauerAnzeigen() {
  deckDauerWertEl.textContent = `${deckBlendSekunden} s`;
  const hart = deckBlendSekunden === 0;
  deckDauerZusatzEl.textContent = hart ? 'harter Schnitt' : 'weiche Überblendung';
  deckDauerWahlEl.classList.toggle('hart', hart);
  deckReglerFuellen(deckDauerEl);
}

/* --- Gesamtlautstärke (Bauauftrag 13) ------------------------------------
   Ein Regler für beide Decks, verrechnet mit Crossfader und Blende (siehe
   deckLautstaerkeAnwenden). Mausrad in 5er-Schritten, Pfeiltasten kommen
   vom Browser. Gemerkt wie die übrigen PlayDecker-Einstellungen - und zwar
   SOFORT eingeplant, nicht erst „wenn zufällig etwas anderes speichert"
   (der Fehler, der bei Überblenddauer und Auto-Mix gefunden wurde). */
const deckLautstaerkeEl = kernElement('deck-lautstaerke');
const deckLautstaerkeWertEl = kernElement('deck-lautstaerke-wert');

function deckGesamtLautstaerkeSetzen(wert) {
  deckGesamtLautstaerke = Math.min(100, Math.max(0, Math.round(Number(wert) || 0)));
  deckLautstaerkeEl.value = String(deckGesamtLautstaerke);
  deckLautstaerkeWertEl.textContent = String(deckGesamtLautstaerke);
  deckReglerFuellen(deckLautstaerkeEl);
  deckLautstaerkeAnwenden();
}

deckLautstaerkeEl.oninput = () => {
  deckGesamtLautstaerkeSetzen(deckLautstaerkeEl.value);
  standGeplant();
};
deckLautstaerkeEl.addEventListener('wheel', ereignis => {
  ereignis.preventDefault();
  deckGesamtLautstaerkeSetzen(deckGesamtLautstaerke + (ereignis.deltaY < 0 ? 5 : -5));
  standGeplant();
}, { passive: false });
// Füllung schon beim Start (ohne gemerkten Stand ruft niemand den Setter)
deckReglerFuellen(deckLautstaerkeEl);

deckDauerEl.oninput = () => {
  deckBlendSekunden = Number(deckDauerEl.value);
  deckDauerAnzeigen();
  // NACHGEMESSEN 08.10.2026 (Bauauftrag 13): Ohne diese Zeile stand eine
  // geänderte Überblenddauer 3 s später noch nicht im gemerkten Stand -
  // sie wurde erst gesichert, wenn zufällig etwas anderes speicherte oder
  // die Seite geschlossen wurde. Der Regler für die feste Spielzeit
  // macht es schon immer so.
  standGeplant();
};
deckDauerAnzeigen();

/* --- Plattendrehung (Nacharbeit zu Bauauftrag 13, 17.10.2026) ------------
   Sekunden pro Umdrehung beider Plattenteller: 2 bis 10 in Halbsekunden-
   Schritten, ab Werk 5. Der Wert geht als CSS-Variable --deck-umdrehung an
   die Animation (style.css, .teller.dreht). Gemerkt wie die übrigen
   PlayDecker-Einstellungen, sofort eingeplant (standGeplant). */
const deckDrehungEl = kernElement('deck-drehung');
const deckDrehungWertEl = kernElement('deck-drehung-wert');
let deckDrehungSekunden = 5;

function deckDrehungSetzen(wert) {
  const zahl = Number(wert);
  // Ungültiges (fehlend, außerhalb, kein Halbsekundenschritt) -> Standard 5 s.
  const gueltig = Number.isFinite(zahl) && zahl >= 2 && zahl <= 10 && (zahl * 2) % 1 === 0;
  deckDrehungSekunden = gueltig ? zahl : 5;
  deckDrehungEl.value = String(deckDrehungSekunden);
  deckDrehungWertEl.textContent = `${String(deckDrehungSekunden).replace('.', ',')} s`;
  document.documentElement.style.setProperty('--deck-umdrehung', `${deckDrehungSekunden}s`);
  deckReglerFuellen(deckDrehungEl);
}

deckDrehungEl.oninput = () => {
  deckDrehungSetzen(deckDrehungEl.value);
  standGeplant();
};
deckDrehungSetzen(5);

/* --- Design des PlayDeckers (Auftrag 16, Phase 3) -------------------------
   Eigenes Design, UNABHÄNGIG vom Jukeboxer (Festlegung 18.10.2026): Es
   steht als data-design am Panel #panel-deck - der Jukeboxer trägt seines
   an #panel-jukebox. Die Auswahlliste kommt aus static/designs/designs.js
   (ein neues Design erscheint dort von selbst). Gemerkt wie die übrigen
   PlayDecker-Einstellungen, sofort eingeplant (standGeplant). Umschalten
   ändert nur Farben - die Wiedergabe läuft ungestört weiter. */
const deckPanelEl = kernWurzel;
const deckDesignEl = kernElement('deck-design');
let deckDesign = 'diner-chrom';

function deckDesignSetzen(kennung) {
  const designs = window.PlayListerDesigns;
  // Unbekannt (z. B. ein Design, das es hier nicht gibt) -> Standard
  deckDesign = designs ? designs.gueltig(kennung) : 'diner-chrom';
  if (designs) designs.setzen(deckPanelEl, deckDesign);
  else deckPanelEl.dataset.design = deckDesign;
  if (deckDesignEl) deckDesignEl.value = deckDesign;
}

if (deckDesignEl) {
  const liste = window.PlayListerDesigns ? window.PlayListerDesigns.liste
    : [{ kennung: 'diner-chrom', titel: 'Diner – Chrom' }];
  liste.forEach(d => {
    const eintrag = document.createElement('option');
    eintrag.value = d.kennung;
    eintrag.textContent = d.titel;
    deckDesignEl.appendChild(eintrag);
  });
  deckDesignEl.onchange = () => {
    deckDesignSetzen(deckDesignEl.value);
    standGeplant();
  };
}
deckDesignSetzen(deckPanelEl.dataset.design || 'diner-chrom');

/* --- Perspektive der Plattenspieler (Auftrag 17) --------------------------
   Gilt für BEIDE Decks gemeinsam: flach (Draufsicht), leicht (22°) oder
   stark (45°, Standard). Gesetzt wird das Merkmal data-perspektive an den
   beiden Mini-Wurzeln; bei „flach" entfällt es - genau wie im Jukeboxer.
   Der Plattenspieler-Baustein bemerkt den Wechsel selbst und passt das
   Gerät neu ein, sodass nichts den Rahmen durchdringt. Gemerkt wie die
   übrigen PlayDecker-Werte; ein unbekannter oder fehlender Wert wird zum
   Standard („Lesen tolerant"). Nur Darstellung - die Wiedergabe läuft
   ungestört weiter. */
const DECK_PERSPEKTIVEN = ['flach', 'leicht', 'stark'];
const deckPerspektiveEl = kernElement('deck-perspektive');
let deckPerspektive = 'stark';

function deckPerspektiveSetzen(wert) {
  deckPerspektive = DECK_PERSPEKTIVEN.includes(wert) ? wert : 'stark';
  [decks.a, decks.b].forEach(deck => {
    if (!deck.el.teller) return;
    if (deckPerspektive === 'flach') delete deck.el.teller.dataset.perspektive;
    else deck.el.teller.dataset.perspektive = deckPerspektive;
  });
  // Die drei Knöpfe im Einstellungsfenster: der gewählte leuchtet
  if (deckPerspektiveEl) {
    deckPerspektiveEl.querySelectorAll('button[data-p]').forEach(knopf => {
      const gewaehlt = knopf.dataset.p === deckPerspektive;
      knopf.classList.toggle('an', gewaehlt);
      knopf.setAttribute('aria-pressed', String(gewaehlt));
    });
  }
}

if (deckPerspektiveEl) {
  deckPerspektiveEl.querySelectorAll('button[data-p]').forEach(knopf => {
    knopf.addEventListener('click', () => {
      deckPerspektiveSetzen(knopf.dataset.p);
      standGeplant();
    });
  });
}
deckPerspektiveSetzen('stark');

/* --- Einstellungsfenster (Auftrag 17) --------------------------------------
   Knopf „⚙ Einstellungen" unter dem Songtext-Knopf öffnet das Fenster
   #deck-einstellungen. Darin stehen Überblenddauer, Feste Spielzeit,
   Plattendrehung, Perspektive und Design - die Regler sind dieselben
   Elemente wie früher im Pult, ihre Logik steht weiter oben unverändert.
   Schließen auf vier Wegen: „Fertig", ✕, Esc und Klick neben das Fenster.
   Danach liegt der Fokus wieder auf dem Einstellungsknopf, damit man mit
   der Tastatur dort weitermacht, wo man war. */
const deckEinstKnopf = kernElement('deck-einstellungen-knopf');
const deckEinstFenster = kernElement('deck-einstellungen');

function deckEinstellungenOeffnen() {
  if (!deckEinstFenster) return;
  deckEinstFenster.hidden = false;
  const zu = deckEinstFenster.querySelector('.deck-einst-zu');
  if (zu) zu.focus();
}
function deckEinstellungenSchliessen() {
  if (!deckEinstFenster || deckEinstFenster.hidden) return;
  deckEinstFenster.hidden = true;
  if (deckEinstKnopf) deckEinstKnopf.focus();
}

if (deckEinstKnopf && deckEinstFenster) {
  deckEinstKnopf.addEventListener('click', deckEinstellungenOeffnen);
  deckEinstFenster.querySelector('.deck-einst-zu').addEventListener('click', deckEinstellungenSchliessen);
  deckEinstFenster.querySelector('.deck-einst-fertig').addEventListener('click', deckEinstellungenSchliessen);
  // Klick NEBEN das Fenster (auf den abgedunkelten Hintergrund) schließt;
  // ein Klick in das Fenster selbst nicht.
  deckEinstFenster.addEventListener('click', ereignis => {
    if (ereignis.target === deckEinstFenster) deckEinstellungenSchliessen();
  });
  // Esc schließt das Fenster - und NUR das Fenster: Der Vollbild-Baustein
  // (vollbild.js, später angemeldet) beendet mit Esc sonst auch das
  // Leisten-Vollbild. Er prüft zwar selbst, ob ein Dialog offen ist, aber
  // dieser Abhörer läuft vorher und hätte das Fenster dann schon zu. Also
  // hier anhalten: erstes Esc = Fenster zu, zweites Esc = Vollbild aus.
  document.addEventListener('keydown', ereignis => {
    if (ereignis.key === 'Escape' && !deckEinstFenster.hidden) {
      ereignis.preventDefault();
      ereignis.stopImmediatePropagation();
      deckEinstellungenSchliessen();
    }
  });
}


/* --- Der Übergang ------------------------------------------------------ */

/** Prüft für ein Deck, ob sein Titel aufs Ende zuläuft. Wird im
    gemeinsamen Takt aufgerufen. */
function deckBlendePruefen(deck) {
  if (!deckAutoMixAn || deckBlende || deckBlendSekunden <= 0) return;
  // App: Während die Seite verborgen ist, ruht der Auto-Mix (siehe oben).
  if (automatikRuht()) return;
  if (!deck.laeuft || !deck.spieler) return;
  // Der Titel im Player - im Zustand E1 der alte, der zu Ende läuft.
  const t = deckTitelImPlayer(deck);
  if (!t || deck.blendeFuer === t.video_id) return;   // für diesen Titel erledigt

  // Gerechnet wird gegen das TATSÄCHLICHE Ende — bei fester Spielzeit
  // ist das früher als das Dateiende. Damit beginnt die Blende so, dass
  // sie genau zur eingestellten Zeit fertig ist.
  const ende = deckSpielEnde(deck);
  const position = deck.spieler.getCurrentTime() || 0;
  if (ende <= 0) return;
  const rest = ende - position;
  if (rest > 0 && rest <= deckBlendSekunden) {
    automixMelden(`Deck ${deck.kennung.toUpperCase()} (${t.video_id}): Ueberblenden faellig - Position ${sek(position)} s, `
      + `Ende ${sek(ende)} s${deckSpielzeitSekunden ? ` (feste Spielzeit ${deckSpielzeitSekunden} s)` : ''}, `
      + `Rest ${sek(rest)} s <= Ueberblenddauer ${deckBlendSekunden} s.`);
    deckBlendeStarten(deck);
  }
}

/** Übergibt an das andere Deck: dort starten, hier ausblenden.

    `vonHand` unterscheidet die beiden Anlässe: Am Titelende läuft das
    abgebende Deck noch bis zu seinem natürlichen Schluss weiter (und
    rückt dann still vor). Auf Zuruf des Nutzers dagegen soll es nach der
    Blende AUFHÖREN — sonst liefe es unhörbar weiter und verbrauchte
    seinen Titel. */
function deckBlendeStarten(von, vonHand = false) {
  const nach = deckAnderes(von);
  const t = deckTitelImPlayer(von);    // E1: im Zustand „alter Titel“ dieser
  if (t) von.blendeFuer = t.video_id;   // nicht zweimal für denselben Titel

  // Ist am Zieldeck nichts (mehr) zu holen, gibt es keine Übergabe —
  // aber sehr wohl eine Blende: Das Deck läuft dann ALLEIN weiter und
  // blendet innerhalb der eigenen Warteschlange über (A2 und A3).
  // Früher stand hier nur eine Meldung und der Titelwechsel kam als
  // harter Schnitt.
  //
  // AUSNAHME: Bei der Übergabe auf Zuruf (`vonHand`) hat der Nutzer das
  // Zieldeck gerade selbst gestartet. Dann zählt seine Ansage mehr als
  // der Merker — ein durchgelaufenes Deck fängt eben wieder an. Nur wenn
  // dort überhaupt keine Titel liegen, geht es nicht.
  // Ist am Zieldeck nichts (mehr) zu holen, gibt es keinen Übergang.
  // Das Deck wechselt dann regulär in seiner EIGENEN Warteschlange
  // weiter — und der Nutzer erfährt, warum nicht übergeblendet wurde.
  //
  // KEINE BLENDE INNERHALB EINES DECKS. Hier stand einen Tag lang eine
  // solche „Eigenblende" (Wunsch A3). Der Nutzer hat sie nach dem
  // Testen wieder abbestellt, und zwar mit dem besseren Argument:
  // Zwischen zwei Titeln DESSELBEN Decks kann es keine Überlappung
  // geben — ein Player spielt nur einen Titel. Was blieb, war ein
  // Ausblenden und ein Einblenden mit einer Lücke dazwischen. Die
  // Überblendung ist für den WECHSEL zwischen zwei Warteschlangen
  // gedacht; bei nur einer ist sie sinnfrei.
  const zielTaugt = nach.titel.length && (vonHand || !deckErschoepft(nach));
  if (!zielTaugt) {
    automixMelden(`Kein Uebergang von Deck ${von.kennung.toUpperCase()}: Deck ${nach.kennung.toUpperCase()} ist `
      + `${nach.titel.length ? 'durchgelaufen' : 'leer'} - Deck ${von.kennung.toUpperCase()} spielt allein weiter.`);
    deckMelden(von, nach.titel.length
      ? `Kein Übergang: Deck ${nach.kennung.toUpperCase()} ist durchgelaufen.`
      : `Kein Übergang: Deck ${nach.kennung.toUpperCase()} ist leer.`);
    return;
  }
  // Das Zieldeck spielt gleich wieder — also ist es nicht mehr „durch".
  nach.fertig = false;
  // Und es hat nichts mehr „schon übergeben“ (Kernkorrektur K2,
  // Nachbesserung 2): Es führt jetzt. Bliebe ein alter Merker stehen (es
  // spielte z. B. noch unhörbar den Rest seines letzten Titels), legte es
  // an dessen Ende den nächsten Titel nur bereit statt ihn zu spielen.
  nach.uebergeben = false;

  // Ab hier führt die Überblendung zwischen den Decks die Lautstärken.
  // Eine noch laufende Titelblende würde dagegenhalten und eines der
  // beiden Decks gedämpft lassen (12.08.2026).
  deckTitelBlendeAbbrechen(von);
  deckTitelBlendeAbbrechen(nach);

  deckZielStarten(nach);

  const ziel = (nach === decks.a) ? DECK_NUR_A : DECK_NUR_B;
  const start = deckCross;
  const dauerMs = deckBlendSekunden * 1000;
  // `let`, nicht `const`: In der App (Haken der Umgebung, siehe oben) wird
  // der Beginn um die Zeit verschoben, in der die Überblendung ruht oder auf
  // das Ende einer Werbung wartet. Am PC bleibt er, wie er ist.
  let beginn = performance.now();
  let letzterTakt = beginn;
  von.uebergeben = true;
  automixMelden(`Ueberblendung ${vonHand ? 'auf Zuruf ' : ''}von Deck ${von.kennung.toUpperCase()} nach `
    + `Deck ${nach.kennung.toUpperCase()} beginnt (${deckBlendSekunden} s, Regler ${Math.round(start)} -> ${ziel}).`);

  deckCrossEl.parentElement.classList.add('blendet');
  deckCrossWerteEl.classList.add('blendet');
  deckMelden(von, `Überblendung nach Deck ${nach.kennung.toUpperCase()} `
                + `(${deckBlendSekunden} s) …`);

  // Zeitgeber, NICHT requestAnimationFrame: In einem Tab außerhalb des
  // Vordergrunds hält der Browser die Bildschleife komplett an
  // (gemessen 0 Bilder in 2 Sekunden). Die Blende bliebe dann mitten im
  // Übergang stehen — beide Decks halblaut.
  let gehalten = '';             // nur App: warum die Blende gerade steht
  const timer = setInterval(() => {
    const jetzt = performance.now();
    // NUR APP (Haken der Umgebung; am PC beide immer „nein"):
    // (1) Seite verborgen oder Rückkehr in Prüfung: Die Blende steht an
    //     ihrer Stelle und läuft danach von dort weiter - die Pause wird
    //     herausgerechnet, nicht nachgeholt.
    // (2) Werbung auf dem Zieldeck: Die Blende wartet, bis der eigentliche
    //     Titel läuft (Ralles Entscheidung (11)). Ist das abgebende Deck
    //     inzwischen still (Titel zu Ende), geht der Regler sofort ganz auf
    //     das Zieldeck - Werbung wird nicht stummgeschaltet (nicht blockiert).
    const grund = automatikRuht() ? 'ruht' : (werbungLaeuft(nach) ? 'werbung' : '');
    if (grund) {
      beginn += jetzt - letzterTakt;
      letzterTakt = jetzt;
      if (grund !== gehalten) {
        gehalten = grund;
        automixMelden(grund === 'ruht'
          ? `Ueberblendung nach Deck ${nach.kennung.toUpperCase()} angehalten: Seite verborgen bzw. Rueckkehr in Pruefung (Regler ${Math.round(deckCross)}).`
          : `Ueberblendung nach Deck ${nach.kennung.toUpperCase()} wartet: dort laeuft Werbung (Regler ${Math.round(deckCross)}).`);
      }
      const vonStill = !(von.spieler && von.spieler.getPlayerState && von.spieler.getPlayerState() === DECK_LAEUFT);
      if (grund === 'werbung' && vonStill) {
        automixMelden(`Deck ${von.kennung.toUpperCase()} ist still, Deck ${nach.kennung.toUpperCase()} zeigt noch Werbung - Regler ganz auf ${nach.kennung.toUpperCase()}.`);
        deckCrossSetzen(ziel, false);
        deckBlendeBeenden();
      }
      return;
    }
    if (gehalten) {
      automixMelden(`Ueberblendung nach Deck ${nach.kennung.toUpperCase()} laeuft weiter (vorher: ${gehalten === 'ruht' ? 'angehalten' : 'Werbung'}).`);
      gehalten = '';
    }
    letzterTakt = jetzt;
    const anteil = Math.min((jetzt - beginn) / dauerMs, 1);
    deckCrossSetzen(start + (ziel - start) * anteil, false);
    if (anteil >= 1) deckBlendeBeenden();
  }, DECK_BLEND_TAKT_MS);
  deckBlende = { von, nach, timer, vonHand };
}

/** Räumt einen Übergang auf. Der einzige Weg, den Zeitgeber zu stoppen -
    so kann kein Rest weiterlaufen und später wieder eingreifen. */
function deckBlendeAufraeumen() {
  if (deckBlende) clearInterval(deckBlende.timer);
  deckBlende = null;
  deckCrossEl.parentElement.classList.remove('blendet');
  deckCrossWerteEl.classList.remove('blendet');
}

function deckBlendeBeenden() {
  if (!deckBlende) return;
  const { von, vonHand } = deckBlende;
  automixMelden(`Ueberblendung fertig, Regler ${Math.round(deckCross)}${vonHand ? ' - abgebendes Deck haelt an' : ''}.`);
  deckBlendeAufraeumen();
  if (vonHand) {
    // Auf Zuruf übergeben: Das abgebende Deck hört jetzt auf und legt
    // den nächsten Titel bereit. Es soll nicht unhörbar weiterlaufen.
    von.uebergeben = false;
    if (von.spieler) deckPausierenVonUns(von);
    deckStillWeiter(von);
    deckMelden(von, 'Übergeben — nächster Titel liegt bereit.');
    return;
  }
  deckMelden(von, '');
}

/** Abbruch von Hand (Entscheidung 2A). Der Merker `uebergeben` wird
    mit gelöscht: Die Automatik ist beendet, also soll das laufende Deck
    am Titelende wieder ganz normal in seiner eigenen Warteschlange
    weitergehen. */
function deckBlendeAbbrechen(grund) {
  if (!deckBlende) return;
  const { von } = deckBlende;
  von.uebergeben = false;
  deckBlendeAufraeumen();

  // UND DER SCHALTER GEHT MIT AUS. Der Nutzer hat beim Testen zu Recht
  // darauf bestanden: Wer in eine laufende Überblendung eingreift, hat
  // die Steuerung übernommen. Bliebe der Schalter an, behauptete die
  // Anzeige weiter "Automatik" — und am nächsten Titelende käme ein
  // Übergang, mit dem niemand mehr rechnet. Wieder einschalten ist ein
  // Klick; eine unerwartete Blende mitten im Betrieb ist teurer.
  const warAn = deckAutoMixAn;
  automixMelden(`Ueberblendung abgebrochen (Eingriff von Hand)${warAn ? ' - Auto-Mix ausgeschaltet' : ''}.`);
  deckAutoMixSetzen(false);
  const zusatz = warAn ? ' Auto-Mix ist aus.' : '';
  deckMelden(von, grund ? grund + zusatz : '');
}

/** Harter Schnitt bei Überblenddauer 0: kein Ausblenden, sondern
    unmittelbar umschalten. Ausdrücklich KEIN Fehlerfall. */
function deckHarterSchnitt(von) {
  const nach = deckAnderes(von);
  // Auch der harte Schnitt geht nur an ein Deck, das noch etwas zu
  // bieten hat. Sonst spielte es seinen letzten Titel erneut an (A2).
  if (!nach.titel.length || deckErschoepft(nach)) return false;
  automixMelden(`Harter Schnitt (Ueberblenddauer 0) von Deck ${von.kennung.toUpperCase()} nach Deck ${nach.kennung.toUpperCase()}.`);
  // Wie bei der Überblendung (Kernkorrektur K2): Das Zieldeck führt jetzt.
  nach.uebergeben = false;
  deckZielStarten(nach);
  deckCrossSetzen((nach === decks.a) ? DECK_NUR_A : DECK_NUR_B, false);
  return true;
}

/** Bringt das Zieldeck einer Übergabe zum Klingen — aus JEDEM Zustand.

    HIER LAG EIN LOCH, das die Musik verstummen ließ: Gestartet wurde nur
    aus »pausiert«, »vorgemerkt« und »noch nie gestartet«. Ein Player, der
    auf »beendet« stand, fiel durch — er bekam keinen einzigen Befehl.
    Der Crossfader fuhr trotzdem sauber auf dieses Deck hinüber, das
    abgebende blendete sich aus, und danach war Ruhe. Von außen sah es
    aus, als bliebe der Player einfach stehen.

    »Beendet« ist kein seltener Ausnahmezustand: Jedes Deck landet dort,
    sobald seine Warteschlange einmal durchgelaufen ist. Kommen später
    neue Titel dazu, steht der Player weiterhin auf »beendet«, und ein
    bloßes playVideo() würde nur den alten, schon abgespielten Titel
    wiederholen. Deshalb wird in diesem Fall der aktuelle Titel neu
    geladen statt bloß fortgesetzt. */
function deckZielStarten(nach) {
  // PARTY-REGEL: Keine Automatik startet ein Deck neben dem Jukeboxer.
  if (deckJukeboxerSpielt()) return false;
  if (!nach.titel.length) return false;
  const t = nach.titel[Math.max(nach.laufend, 0)];
  if (!t) return false;
  deckStartBefohlen();            // L3: die Automatik startet - bewachen

  if (!nach.spieler) {
    // Noch kein Player: Der entsteht beim Springen und startet dabei.
    deckSpringen(nach, Math.max(nach.laufend, 0), true);
    return true;
  }
  const zustand = nach.spieler.getPlayerState();
  if (zustand === DECK_LAEUFT) return true;          // spielt schon
  if (zustand === DECK_BEENDET) {
    // E1: Der alte Titel (von vor dem Laden) ist zu Ende - weiter mit
    // Titel 1, und zwar über den Sprung, damit Marke und Anzeige stimmen.
    if (deckAlterTitelLaeuft(nach)) {
      deckSpringen(nach, 0, true);
      return true;
    }
    // Am Ende angekommen - fortsetzen ginge ins Leere. Neu laden.
    // MIT dem Merker des erwarteten Titels (Abschluss von Auftrag 15,
    // letzte Suche nach Wegen am Merker vorbei): Hat sich die Marke
    // inzwischen ohne Player bewegt (etwa weil der beendete Titel aus der
    // Warteschlange genommen wurde), stünde im Merker noch das alte Video,
    // und das Deck verwürfe das Ende dieses Titels (wie bei K1).
    deckErwartungSetzen(nach, t);
    nach.spieler.loadVideoById(t.video_id);
    return true;
  }
  // Pausiert, vorgemerkt, puffernd oder ungestartet: anstoßen genügt.
  nach.spieler.playVideo();
  return true;
}

/** Rückt ein Deck still einen Titel weiter: Der Titel wird nur
    vorgemerkt, nicht gespielt. So wartet das Deck stumm auf die nächste
    Übergabe, statt unhörbar eine ganze Aufnahme zu verbrauchen. */
function deckStillWeiter(deck) {
  const ziel = deckNaechsterIndex(deck);
  if (ziel < 0) {
    // Durchgelaufen. Der Vermerk ist wichtiger als die Meldung: Er hält
    // das andere Deck davon ab, hierher zu übergeben (A2).
    deck.fertig = true;
    // Wie in deckWeiter: stilllegen statt im Zustand "beendet" stehen
    // lassen, sonst stößt der Wächter das Deck immer wieder an
    // (Fehlerbericht 18.08.2026).
    deckPausierenVonUns(deck);
    deckQueueZeichnen(deck);
    deckMelden(deck, 'Ende der Warteschlange erreicht.');
    return;
  }
  deckSpringen(deck, ziel, false);
}


/* ====================================================================
   (10e) PlayDecker — Wiederholen und Alleinlauf
         (Nachtrag 06.08.2026, Wünsche A2 und A4)

   Zwei Merker regeln, was am Ende einer Warteschlange geschieht:

   `fertig`  — diese Warteschlange ist durchgelaufen. Ein fertiges Deck
               bekommt KEINE Übergabe mehr, sonst spielte das andere
               Deck dessen letzten Titel ein zweites Mal an, statt
               allein weiterzulaufen (A2).
   `wiederholen` — je Deck getrennt schaltbar. Eine Warteschlange mit
               Wiederholung ist nie „fertig"; sie fängt wieder vorn an
               und vergisst dabei, was schon gelaufen ist (A4).

   HIER STAND EINEN TAG LANG MEHR: eine Blende innerhalb EINES Decks
   (Wunsch A3 vom 06.08.). Der Nutzer hat sie nach dem Testen wieder
   abbestellt — mit dem besseren Argument. Ein Player spielt immer nur
   einen Titel; zwischen zwei Titeln desselben Decks kann es keine
   Überlappung geben. Übrig blieb ein Ausblenden und ein Einblenden mit
   einer Ladelücke dazwischen. Die Überblendung ist für den WECHSEL
   zwischen zwei Warteschlangen gedacht und dort auch gut; bei nur einer
   ist sie sinnfrei. Entfernt am 07.08.2026.
   ==================================================================== */

/** Ist diese Warteschlange erschöpft — gibt es also nichts mehr, wohin
    das andere Deck übergeben könnte?

    Eine Warteschlange mit eingeschalteter Wiederholung ist NIE
    erschöpft: Sie fängt am Ende wieder von vorn an. */
function deckErschoepft(deck) {
  if (!deck.titel.length) return true;
  if (deck.wiederholen) return false;
  return deck.fertig;
}

/** Der nächste Titel dieser Warteschlange, oder -1 wenn keiner mehr kommt.

    DIE EINE STELLE, die die Wiederholung kennt. Alles Weiterrücken —
    am Titelende, per Knopf, beim stillen Nachrücken — geht hier
    hindurch; sonst müsste die Wiederholung an drei Stellen bedacht
    werden und wäre an der vierten vergessen. */
function deckNaechsterIndex(deck) {
  const ziel = deck.laufend + 1;
  if (ziel < deck.titel.length) return ziel;
  if (deck.wiederholen && deck.titel.length) {
    // Neue Runde, neue Farben: Was gelaufen ist, wird vergessen, sonst
    // wäre die ganze Liste ab dem zweiten Durchgang dauerhaft grau.
    deck.gespielt.clear();
    return 0;
  }
  return -1;
}

/* ====================================================================
   (10f) Der Wächter — die Musik darf nicht stehenbleiben

   Der Nutzer hat es klar gesagt: „Bei einer Fete ist das richtig Mist.
   Es muss gewährleistet sein, dass der Player immer läuft."

   Die drei Löcher, durch die der Ton bisher verschwinden konnte, sind
   an ihrer jeweiligen Stelle geschlossen (Zieldeck aus jedem Zustand
   starten, `fertig` beim Einreihen aufheben, `uebergeben` beim Sprung
   löschen). Aber genau darauf ist kein Verlass: Es waren drei Löcher,
   die niemand vorhergesehen hat, und es kann ein viertes geben — ein
   Netzhänger, ein Titel, der nicht lädt, eine Eigenheit des
   YouTube-Players.

   Deshalb hier zusätzlich eine ANDERE Art von Sicherung. Sie kennt die
   Ursachen nicht und will sie auch nicht kennen. Sie prüft nur eines:
   Kommt Ton? Kommt über mehrere Sekunden keiner, obwohl noch Titel da
   sind, wird die Wiedergabe angestoßen. Eine Sicherung, die nur die
   bekannten Fälle abdeckt, hilft gegen den unbekannten nicht.

   WAS DER WÄCHTER NICHT TUT: Er greift nicht ein, wenn der Nutzer
   selbst pausiert hat — eine Pause, die sich von allein aufhebt, wäre
   eine Zumutung. Er greift auch nicht ein, wenn die Automatik aus ist:
   Dann mischt der Nutzer von Hand, und Stille kann Absicht sein.
   ==================================================================== */

// So lange darf es still sein, bevor eingegriffen wird. Kurz genug, dass
// es auf einer Fete nicht auffällt; lang genug, dass normales Laden
// eines Titels (gemessen: Bruchteile einer Sekunde bis etwa eine) nicht
// fälschlich als Stillstand gilt.
const DECK_WAECHTER_STILLE_MS = 6000;
// Nach einem Eingriff wird gewartet, bevor erneut eingegriffen wird -
// sonst hämmerte der Wächter im Takt gegen einen Titel, der partout
// nicht spielen will.
const DECK_WAECHTER_PAUSE_MS = 8000;

let deckStilleSeit = null;
let deckLetzterEingriff = 0;
let deckEingriffe = 0;

/* --- Das Ablaufgedächtnis --------------------------------------------

   WARUM ES DAS GIBT: Der Nutzer berichtete einen Stillstand nach rund
   zwanzig Titeln je Deck — bei ZWEI VOLLEN Warteschlangen mit je etwa
   sechzig Titeln. Damit scheiden die Ursachen aus, die ich gefunden
   und behoben habe: Es lag weder an einer leergelaufenen Warteschlange
   noch an nachgefüllten Titeln. Nachstellen ließ sich der Fall nicht.

   Ein Fehler, der sich erst nach einer Stunde zeigt und den man nicht
   nachstellen kann, ist mit Nachdenken nicht zu fassen. Also wird
   mitgeschrieben: die letzten Zustandswechsel beider Decks, klein
   gehalten und nur im Arbeitsspeicher. Tritt der Stillstand wieder
   auf, steht in der Entwicklerkonsole, was unmittelbar davor geschah —
   dann ist es eine Messung statt einer Vermutung.

   Aufrufbar ist es außerdem jederzeit über playdeckerProtokoll(). */

const DECK_GEDAECHTNIS_MAX = 240;
const deckGedaechtnis = [];
let deckLetzterAbdruck = '';

function deckMitschreiben() {
  const z = d => (d.spieler && d.spieler.getPlayerState
    ? d.spieler.getPlayerState() : null);
  const a = decks.a, b = decks.b;
  const abdruck = [z(a), z(b), a.laufend, b.laufend, deckCross,
                   a.uebergeben, b.uebergeben, a.fertig, b.fertig,
                   Boolean(deckBlende), deckAutoMixAn].join('|');
  if (abdruck === deckLetzterAbdruck) return;
  deckLetzterAbdruck = abdruck;
  deckGedaechtnis.push({
    zeit: new Date().toLocaleTimeString('de-DE'),
    zustandA: z(a), zustandB: z(b),
    titelA: a.laufend, titelB: b.laufend,
    cross: deckCross,
    uebergebenA: a.uebergeben, uebergebenB: b.uebergeben,
    fertigA: a.fertig, fertigB: b.fertig,
    blende: Boolean(deckBlende), autoMix: deckAutoMixAn,
  });
  // Ringspeicher: Nur die jüngste Vergangenheit ist interessant, und
  // ein unbegrenzt wachsendes Feld wäre über Stunden ein Leck.
  if (deckGedaechtnis.length > DECK_GEDAECHTNIS_MAX) deckGedaechtnis.shift();
}

/* --- Taktmessung für den Hintergrundbetrieb ---------------------------

   ANLASS: Der Nutzer berichtet, der Player scheine zu haken, wenn der
   Browser nicht im Vordergrund ist. In der Entwicklungsumgebung war das
   NICHT nachzustellen — 67 Sekunden bei verborgener Seite ergaben
   Taktabstände von 250 ms (Soll 250) und 25 ms (Soll 25), also gar
   keine Drosselung.

   Das beweist aber nur etwas über EINEN Browser. Chrome und Edge
   bremsen Zeitgeber in Hintergrund-Fenstern durchaus aus, üblicherweise
   auf einen Takt je Sekunde. Für die Überblendung wäre das hörbar: Statt
   160 feiner Lautstärkeschritte kämen vier grobe — genau das, was man
   als „Haken" beschreibt.

   Ob es beim Nutzer so ist, kann nur beim Nutzer gemessen werden.
   Deshalb dieses Werkzeug: aufrufen, Fenster in den Hintergrund legen,
   warten, zurückkommen — das Ergebnis steht dann in der Konsole. Es
   greift in nichts ein und läuft von allein wieder aus. */
window.playdeckerTaktmessung = function (sekunden = 600) {
  const start = performance.now();

  /* ZWEI EINSICHTEN STECKEN IN DIESER FASSUNG, beide aus Fehlern der
     vorigen:

     (1) GETRENNT NACH SICHTBARKEIT. Die erste Fassung gab EINEN Median
         ueber den ganzen Zeitraum aus. War das Fenster bloss zehn von
         sechzig Sekunden im Hintergrund, blieb dieser Median bei 25 ms -
         die gedrosselte Minderheit verschwand spurlos darin. Ein
         Mittelwert ueber zwei Betriebszustaende beantwortet die Frage
         nicht, er verwischt sie.

     (2) GETRENNT AN DER FUENF-MINUTEN-SCHWELLE, und das ist der Punkt,
         auf den der Nutzer gestossen ist. Browser bremsen Zeitgeber im
         Hintergrund in ZWEI Stufen: zunaechst milde, und erst wenn eine
         Seite RUND FUENF MINUTEN verborgen war, scharf (ein Takt je
         Minute). Eine Messung ueber eine Minute kann das gar nicht
         finden - sie endet, bevor die harte Drosselung ueberhaupt
         einsetzt. Deshalb zehn Minuten Vorgabe und ein getrennter
         Ausweis dessen, was NACH der fuenften Minute geschah. */

  const SCHWELLE_MS = 5 * 60 * 1000;
  const takt = { vorn: [], hFrueh: [], hSpaet: [] };
  const blend = { vorn: [], hFrueh: [], hSpaet: [] };
  const sicht = [];
  let versteckSeit = document.visibilityState === 'hidden' ? start : null;
  let tLetzt = start, bLetzt = start;

  const eintragen = (sammlung, abstand) => {
    if (document.visibilityState !== 'hidden') { sammlung.vorn.push(abstand); return; }
    const wieLange = versteckSeit === null ? 0 : performance.now() - versteckSeit;
    (wieLange >= SCHWELLE_MS ? sammlung.hSpaet : sammlung.hFrueh).push(abstand);
  };

  const iTakt = setInterval(() => {
    const jetzt = performance.now();
    eintragen(takt, Math.round(jetzt - tLetzt));
    tLetzt = jetzt;
  }, DECK_TAKT_MS);
  const iBlend = setInterval(() => {
    const jetzt = performance.now();
    eintragen(blend, Math.round(jetzt - bLetzt));
    bLetzt = jetzt;
  }, DECK_BLEND_TAKT_MS);

  const beiWechsel = () => {
    const s = Math.round((performance.now() - start) / 1000);
    sicht.push(`${s} s -> ${document.visibilityState}`);
    versteckSeit = document.visibilityState === 'hidden' ? performance.now() : null;
  };
  document.addEventListener('visibilitychange', beiWechsel);

  // Ein Lebenszeichen je Minute. Zehn Minuten schweigend zu warten
  // laesst zweifeln, ob ueberhaupt etwas laeuft.
  const iPuls = setInterval(() => {
    const s = Math.round((performance.now() - start) / 1000);
    console.log(`  … Taktmessung laeuft: ${s} von ${sekunden} s, `
              + `Fenster gerade ${document.visibilityState}`);
  }, 60000);

  setTimeout(() => {
    clearInterval(iTakt); clearInterval(iBlend); clearInterval(iPuls);
    document.removeEventListener('visibilitychange', beiWechsel);

    const zeile = (name, feld, soll) => {
      if (!feld.length) return `  ${name.padEnd(14)} nicht gemessen`;
      const a = feld.slice().sort((x, y) => x - y);
      return `  ${name.padEnd(14)}${String(a.length).padStart(6)} Takte   `
           + `Median ${String(a[Math.floor(a.length / 2)]).padStart(6)} ms   `
           + `groesster ${String(a[a.length - 1]).padStart(7)} ms   (Soll ${soll} ms)`;
    };
    const schritte = feld => {
      if (!feld.length) return null;
      const a = feld.slice().sort((x, y) => x - y);
      return Math.round(deckBlendSekunden * 1000 / (a[Math.floor(a.length / 2)] || 1));
    };
    const dauer = feld => Math.round(feld.length * DECK_BLEND_TAKT_MS / 1000);
    const sV = schritte(blend.vorn);
    const sF = schritte(blend.hFrueh);
    const sS = schritte(blend.hSpaet);

    const block = (ueberschrift, tFeld, bFeld, s, sek) =>
      `\n  ${ueberschrift}  (rund ${sek} s)\n`
      + zeile('Haupttakt', tFeld, DECK_TAKT_MS) + '\n'
      + zeile('Blendtakt', bFeld, DECK_BLEND_TAKT_MS) + '\n'
      + `  Schritte je Ueberblendung: ${s === null ? '-' : s}\n`;

    let befund;
    if (sF === null && sS === null) {
      befund = 'Das Fenster war nie im Hintergrund.\n'
             + '          Bitte wiederholen und dabei wegschalten.';
    } else if (sS === null) {
      befund = `Im Hintergrund unauffaellig (${sF} Schritte), ABER die\n`
             + '          Fuenf-Minuten-Schwelle wurde nicht erreicht. Genau\n'
             + '          dahinter setzt die harte Drosselung ein. Bitte laenger\n'
             + '          am Stueck weggeschaltet lassen.';
    } else if (sS >= 40) {
      befund = `unauffaellig, auch nach fuenf Minuten im Hintergrund\n`
             + `          (${sS} Schritte je Ueberblendung). Der Verdacht\n`
             + '          bestaetigt sich nicht.';
    } else {
      befund = `GEDROSSELT nach fuenf Minuten im Hintergrund: nur ${sS}\n`
             + '          Schritte je Ueberblendung. Das ist hoerbar und\n'
             + '          erklaert das Haken. Bitte diese Ausgabe melden.';
    }

    const bericht =
      '\n=== PlayDecker-Taktmessung =====================================\n'
      + `  Zeitpunkt: ${new Date().toLocaleString('de-DE')}\n`
      + `  Zeitraum: ${sekunden} s\n`
      + `  Sichtbarkeitswechsel: ${sicht.length ? sicht.join('  |  ') : 'KEINE'}\n`
      + block('IM VORDERGRUND', takt.vorn, blend.vorn, sV, dauer(blend.vorn))
      + block('IM HINTERGRUND, erste fuenf Minuten', takt.hFrueh, blend.hFrueh, sF, dauer(blend.hFrueh))
      + block('IM HINTERGRUND, ab der fuenften Minute', takt.hSpaet, blend.hSpaet, sS, dauer(blend.hSpaet))
      + '\n  BEFUND: ' + befund
      + '\n==============================================================\n';

    console.log(bericht);

    // UND ZUSAETZLICH WEGGESCHRIEBEN. Der Grund ist heikel und leicht zu
    // uebersehen: Chrome schaltet die Drosselung, um die es hier geht,
    // teilweise AB, solange die Entwicklerwerkzeuge offen sind. Wer die
    // Messung also mit offener Konsole laufen laesst, misst genau den
    // Fall nicht, den er sucht - und bekommt einen Freispruch, der
    // keiner ist.
    //
    // Deshalb landet der Bericht auch im Speicher des Browsers. So kann
    // man die Konsole waehrend der Messung SCHLIESSEN und das Ergebnis
    // hinterher mit playdeckerTaktergebnis() abholen.
    try { localStorage.setItem('playlister.taktmessung', bericht); }
    catch (fehler) { console.warn('Bericht nicht speicherbar:', fehler); }
  }, sekunden * 1000);

  return `Messung laeuft ${sekunden} Sekunden (${Math.round(sekunden / 60)} Minuten).\n`
       + `WICHTIG: Jetzt die Entwicklerwerkzeuge SCHLIESSEN (F12) und das\n`
       + `Fenster am Stueck weggeschaltet lassen - bei offener Konsole\n`
       + `bremst der Browser gar nicht erst, und die Messung waere wertlos.\n`
       + `Danach zurueckkommen, F12 druecken und playdeckerTaktergebnis()\n`
       + `eingeben.`;
};

/** Holt den zuletzt gespeicherten Messbericht wieder hervor. */
window.playdeckerTaktergebnis = function () {
  const bericht = localStorage.getItem('playlister.taktmessung');
  if (!bericht) {
    console.log('Noch kein Messergebnis vorhanden. Erst playdeckerTaktmessung() '
              + 'starten und die volle Zeit abwarten.');
    return;
  }
  console.log(bericht);
};

/** Gibt den Mitschnitt aus — für den Nutzer über die Entwicklerkonsole. */
window.playdeckerProtokoll = function () {
  console.table(deckGedaechtnis);
  return `${deckGedaechtnis.length} Zustandswechsel aufgezeichnet, `
       + `${deckEingriffe} Eingriff(e) des Wächters, `
       + `${deckEndenVerworfen} verworfene(s) „Ende".`;
};

/** Spielt gerade IRGENDEIN Deck hörbar? */
function deckIrgendwoTon() {
  return ['a', 'b'].some(k => {
    const d = decks[k];
    if (!d.spieler || !d.spieler.getPlayerState) return false;
    if (d.spieler.getPlayerState() !== DECK_LAEUFT) return false;
    // Ein Deck, das zwar läuft, aber auf null heruntergeblendet ist,
    // macht keinen Ton. Für den Wächter zählt das als Stille - sonst
    // übersähe er genau den Fall, dass eine Blende hängen bleibt.
    //
    // DER `blendFaktor` GEHÖRT HIER ZWINGEND MIT HINEIN (12.08.2026):
    // Er dämpft ein Deck an derselben Stelle wie der Crossfader, nur
    // unsichtbar. Bliebe er hier außen vor, hielte der Wächter ein Deck
    // für hörbar, das auf null steht - und eine hängengebliebene
    // Titelblende wäre genau der stumme Zustand, den er nie bemerkt.
    // Das ist derselbe blinde Fleck, den die Zeile darüber schon für den
    // Crossfader schließt.
    const vomRegler = d === decks.a ? DECK_NUR_B - deckCross : deckCross;
    const laut = vomRegler * d.blendFaktor;
    return laut > 1;
  });
}

/** Hat der NUTZER selbst pausiert? Dann wird nicht eingegriffen.

    DER UNTERSCHIED IST WICHTIG, und er ist mir beim Bauen der festen
    Spielzeit beinahe entgangen: Die App pausiert Decks auch selbst — am
    Ende einer festen Spielzeit, beim Aufteilen, nach einer Übergabe auf
    Zuruf. Ein solcher Player steht auf „pausiert" wie jeder andere.
    Würde das als Handgriff des Nutzers gelesen, hielte sich der Wächter
    genau dann heraus, wenn die App selbst das Deck stillgelegt hat —
    die Sicherung wäre lautlos abgeschaltet.

    Deshalb merkt sich jedes Deck, ob die Pause von IHM kam. */
function deckVonHandPausiert() {
  return ['a', 'b'].some(k => {
    const d = decks[k];
    if (d.vonUnsPausiert) return false;
    return d.spieler && d.spieler.getPlayerState
      && d.spieler.getPlayerState() === 2;      // 2 = pausiert
  });
}

/* --- PARTY-REGEL (Entscheidung des Nutzers, 09.10.2026, CLAUDE.md) ------
   PlayDecker und Jukeboxer spielen auf Partys Musik. Laufende Musik darf
   NIE versehentlich unterbrochen werden: Wer spielt, hat Vorrang. Spielt
   der Jukeboxer, wird ein Start im PlayDecker ABGEWIESEN - mit Meldung am
   Deck, das angeklickt wurde. Keine Automatik (Auto-Mix, Titelende,
   Wächter) startet der PlayDecker neben dem Jukeboxer. „Spielt" heißt:
   Wiedergabe läuft - ein pausierter Jukeboxer blockiert nichts. */
const DECK_PARTY_TEXT = 'Der Jukeboxer spielt gerade. Bitte dort erst pausieren, '
  + 'dann startet der PlayDecker.';
const DECK_PARTY_MELDUNG_MS = 7000;

function deckJukeboxerSpielt() {
  return !!(window.JukeboxerKern && JukeboxerKern.spielt());
}

/** Zeigt die Party-Meldung am Deck - gut sichtbar, nach einigen Sekunden
    wieder weg (nur, wenn inzwischen keine andere Meldung dasteht). */
function deckParteiMeldung(deck) {
  deckMelden(deck, DECK_PARTY_TEXT);
  clearTimeout(deck.parteiUhr);
  deck.parteiUhr = setTimeout(() => {
    if (deck.el.meldung.textContent === DECK_PARTY_TEXT) deckMelden(deck, '');
  }, DECK_PARTY_MELDUNG_MS);
}

/** Wird ein Start dieses Decks wegen der Party-Regel abgewiesen? */
function deckStartAbgewiesen(deck) {
  if (!deckJukeboxerSpielt()) return false;
  deckParteiMeldung(deck);
  return true;
}

/** Pausiert ein Deck von Programms wegen — erkennbar für den Wächter. */
function deckPausierenVonUns(deck) {
  if (!deck.spieler || !deck.spieler.pauseVideo) return;
  deck.vonUnsPausiert = true;
  deck.spieler.pauseVideo();
}

/** Welches Deck soll die Stille beenden? Das mit dem nächsten Titel;
    bei Gleichstand das, auf dem der Regler steht.

    EIN DURCHGELAUFENES DECK KOMMT NICHT IN FRAGE (Fehlerbericht vom
    18.08.2026, und das war der eigentliche Fehler). Vorher wurde hier
    nur geprüft, OB ein Deck Titel hat und ob `laufend` in den Grenzen
    liegt. Beides trifft am Listenende weiterhin zu — der Zeiger steht
    ja auf dem letzten Titel. Der Wächter hielt das fertige Deck also
    für einen gültigen Kandidaten, deckZielStarten() fand den Player im
    Zustand „beendet" und lud daraufhin den letzten Titel NEU. Das ging
    alle acht Sekunden von vorn los, solange der Auto-Mix an war: genau
    das „Hängenbleiben mit kurzem Anstoßen", das der Nutzer berichtet
    hat.

    `deckErschoepft` ist hier die richtige Frage und nicht `fertig`
    allein: Ein Deck mit eingeschalteter Wiederholung ist NIE erschöpft
    (es fängt wieder vorn an) — dort SOLL der Wächter eingreifen
    dürfen. */
function deckWaechterKandidat() {
  const reihenfolge = deckCross <= 50 ? ['a', 'b'] : ['b', 'a'];
  for (const k of reihenfolge) {
    const d = decks[k];
    if (!d.titel.length) continue;
    if (deckErschoepft(d)) continue;
    if (d.laufend >= 0 && d.laufend < d.titel.length) return d;
    // E1: Der alte Titel läuft noch, danach kommt Titel 1 - auch dieses
    // Deck kann die Stille beenden.
    if (deckAlterTitelLaeuft(d)) return d;
  }
  return null;
}

function deckWaechterPruefen() {
  if (!deckAutoMixAn) { deckStilleSeit = null; return; }
  // App: Seite verborgen / Rückkehr in Prüfung - der Wächter ruht (sonst
  // griffe er nach der Rückkehr „im Nachhinein" ein). Und Werbung ist kein
  // Stillstand: Sie wird weder übersprungen noch neu angestoßen.
  if (automatikRuht() || werbungLaeuft(decks.a) || werbungLaeuft(decks.b)) { deckStilleSeit = null; return; }
  // PARTY-REGEL: Spielt der Jukeboxer, ist die Stille im PlayDecker gewollt -
  // der Wächter greift nicht ein.
  if (deckJukeboxerSpielt()) { deckStilleSeit = null; return; }
  if (deckIrgendwoTon()) { deckStilleSeit = null; return; }
  if (deckVonHandPausiert()) { deckStilleSeit = null; return; }
  // L3 (Nachbesserung 3): Von Hand bereitgelegt, während nichts spielte -
  // dann soll nichts spielen, bis jemand startet.
  if (deckWartetAufStart) { deckStilleSeit = null; return; }
  // Eine planmäßig laufende Titelblende ist gewollte Stille (12.08.2026).
  // NUR solange sie in ihrer Frist liegt - danach zählt sie wieder als
  // Stillstand wie jede andere. Siehe deckTitelBlendePlanmaessig().
  if (deckTitelBlendePlanmaessig()) { deckStilleSeit = null; return; }

  const jetzt = Date.now();
  if (deckStilleSeit === null) { deckStilleSeit = jetzt; return; }
  if (jetzt - deckStilleSeit < DECK_WAECHTER_STILLE_MS) return;
  if (jetzt - deckLetzterEingriff < DECK_WAECHTER_PAUSE_MS) return;

  const deck = deckWaechterKandidat();
  if (!deck) { deckStilleSeit = null; return; }   // wirklich nichts mehr da

  deckLetzterEingriff = jetzt;
  deckEingriffe++;
  deckStilleSeit = null;
  automixMelden(`Waechter: seit ${DECK_WAECHTER_STILLE_MS / 1000} s kein Ton - Deck ${deck.kennung.toUpperCase()} wird neu angestossen (Eingriff ${deckEingriffe}).`);

  // Eine hängengebliebene Blende zuerst aufräumen: Sie sperrt sonst
  // jeden weiteren Übergang, weil deckBlendePruefen bei laufender Blende
  // sofort zurückkehrt.
  if (deckBlende) deckBlendeAufraeumen();

  // UND EINE HÄNGENGEBLIEBENE TITELBLENDE (12.08.2026). Das ist hier
  // kein Beiwerk, sondern notwendig: deckZielStarten() stößt den Player
  // an, rührt die Lautstärke aber nicht an. Stünde der blendFaktor noch
  // auf 0, spielte das Deck nach dem Eingriff stumm weiter — der Wächter
  // hätte "eingegriffen", es käme wieder kein Ton, und acht Sekunden
  // später ginge dasselbe von vorn los. Eine Sicherung, die sich selbst
  // im Kreis dreht, ist schlimmer als keine.
  deckTitelBlendeAbbrechen(decks.a);
  deckTitelBlendeAbbrechen(decks.b);

  // Und den Regler auf das Deck ziehen, das gleich spielt. Ohne das
  // stünde er womöglich auf der stummen Seite, und der Eingriff bliebe
  // unhörbar.
  deckCrossSetzen(deck === decks.a ? DECK_NUR_A : DECK_NUR_B, false);
  deckZielStarten(deck);
  deckMelden(deck, `Es kam kein Ton — Deck ${deck.kennung.toUpperCase()} `
                 + `wurde neu angestoßen.`);

  // UND DAS GEDÄCHTNIS AUSGEBEN. Ein Eingriff des Wächters heißt: Etwas
  // ist schiefgelaufen, das ich nicht vorhergesehen habe. Genau dann
  // gehört die Vorgeschichte in die Konsole — sonst ist sie beim
  // nächsten Nachfragen längst überschrieben.
  console.error(
    `PlayDecker-Wächter, Eingriff Nr. ${deckEingriffe}: Es kam kein Ton. `
    + `Die letzten Zustandswechsel davor:`, deckGedaechtnis.slice(-25));
}


/* --- (A5) Wer zuerst spielt, bekommt den Regler ----------------------- */

/** Zieht den Crossfader ganz auf dieses Deck, wenn es als EINZIGES
    spielt.

    Gedacht für den Start: Wer Deck B zuerst startet, will B hören und
    nicht die Hälfte davon. Läuft das andere Deck bereits, wird der
    Regler NICHT angefasst — dann ist die Balance eine Entscheidung des
    Nutzers oder der Automatik, und die darf hier niemand überfahren. */
function deckErstStartRegler(deck) {
  if (deckBlende) return;                       // die Automatik führt gerade
  const anderes = deckAnderes(deck);
  const zustand = anderes.spieler && anderes.spieler.getPlayerState
    ? anderes.spieler.getPlayerState() : null;
  // 1 = spielt, 3 = puffert. Beides heißt: Da ist schon Ton unterwegs.
  if (zustand === DECK_LAEUFT || zustand === 3) return;
  deckCrossSetzen(deck === decks.a ? DECK_NUR_A : DECK_NUR_B, false);
}

/* --- (A4) Wiederholen je Warteschlange -------------------------------- */

function deckWiederholenAnzeigen(deck) {
  const k = deck.el.qWiederholen;
  if (!k) return;
  k.classList.toggle('an', deck.wiederholen);
  k.title = deck.wiederholen
    ? `Warteschlange ${deck.kennung.toUpperCase()} läuft am Ende wieder von vorn`
    : `Warteschlange ${deck.kennung.toUpperCase()} am Ende wieder von vorn`;
}

['a', 'b'].forEach(k => {
  const deck = decks[k];
  if (!deck.el.qWiederholen) return;
  deck.el.qWiederholen.onclick = () => {
    deck.wiederholen = !deck.wiederholen;
    // Wer die Wiederholung einschaltet, hebt damit auch das „durch"
    // wieder auf - sonst bliebe ein bereits abgelaufenes Deck für die
    // Übergabe gesperrt, obwohl es jetzt wieder Titel liefern kann.
    if (deck.wiederholen) deck.fertig = false;
    deckWiederholenAnzeigen(deck);
    deckMelden(deck, deck.wiederholen
      ? 'Wiederholung an — die Warteschlange läuft am Ende wieder von vorn.'
      : 'Wiederholung aus.');
    standGeplant();
  };
  deckWiederholenAnzeigen(deck);
});

// (A6) Die Automatik steht ab Werk auf AN. Der Zustand wird hier EINMAL
// durch dieselbe Funktion gesetzt, die auch der Schalter benutzt - so
// kann die Anzeige gar nicht erst etwas anderes behaupten als der Wert.
deckAutoMixSetzen(deckAutoMixAn);


/* ====================================================================
   (10g) PlayDecker — Mischen und das Weiterhören nach dem Schließen
         (Auftrag vom 08.08.2026)
   ==================================================================== */

/** Schüttelt die Warteschlange durch — aber nur, was noch kommt.

    WARUM NICHT DIE GANZE LISTE: Was schon gelaufen ist, soll seinen
    Platz behalten; sonst stünde die eigene Hörgeschichte hinterher in
    beliebiger Reihenfolge da. Und der laufende Titel darf sich beim
    Mischen erst recht nicht bewegen — er klingt ja gerade. Gemischt
    wird also der Rest dahinter. Genau so machen es die gängigen Player.

    Verfahren: Fisher-Yates, von hinten nach vorn. Es ist das einzige
    Mischen, bei dem jede Reihenfolge gleich wahrscheinlich ist; das
    naheliegende „jedes Element mit einem zufälligen tauschen" ist
    nachweislich schief. */
function deckMischen(deck) {
  const ab = Math.max(deck.laufend, -1) + 1;   // erste Stelle, die gemischt wird
  const rest = deck.titel.length - ab;
  if (rest < 2) {
    deckMelden(deck, 'Zum Mischen braucht es mindestens zwei kommende Titel.');
    return;
  }
  for (let i = deck.titel.length - 1; i > ab; i--) {
    const j = ab + Math.floor(Math.random() * (i - ab + 1));
    [deck.titel[i], deck.titel[j]] = [deck.titel[j], deck.titel[i]];
  }
  // Die Kreuzchen zeigen auf Videokennungen, nicht auf Positionen —
  // sie überleben das Mischen also unbeschadet. Der laufende Titel
  // steht noch an seiner Stelle, `laufend` bleibt damit gültig.
  deckQueueZeichnen(deck);
  deckMelden(deck, `${rest} kommende Titel gemischt.`);
  standGeplant();
}

['a', 'b'].forEach(k => {
  const deck = decks[k];
  if (deck.el.qMischen) deck.el.qMischen.onclick = () => deckMischen(deck);
});


/* --- Der Stand eines Decks über das Schließen hinaus ------------------ */

/** Sammelt ein, was ein Deck ausmacht. */
function deckStandSichern(deck) {
  if (!deck.titel.length) return null;
  const p = deck.spieler;
  // Die Sekunde im laufenden Titel. Sie ist der eigentliche Wunsch:
  // nicht wieder von vorn hören. Ein kleiner Sicherheitsabstand nach
  // hinten, damit man nicht mitten im letzten Ton wieder einsteigt.
  // E1: Läuft noch der Titel von VOR dem Laden, gehört er nicht zur Liste.
  // Gemerkt wird dann Titel 1 von vorn - genau das, was als Nächstes käme.
  const alterTitel = deckAlterTitelLaeuft(deck);
  let sekunde = 0;
  if (p && p.getCurrentTime && !alterTitel) sekunde = Math.max(Math.floor(p.getCurrentTime() || 0) - 2, 0);
  return {
    titel: deck.titel,
    laufend: alterTitel ? 0 : deck.laufend,
    listenName: deck.listenName,
    quellePlaylist: deck.quellePlaylist || null,
    anzahlText: deck.el.anzahl.textContent,
    gespielt: [...deck.gespielt],
    gesperrt: [...deck.gesperrt],
    wiederholen: deck.wiederholen,
    fertig: deck.fertig,
    sekunde,
  };
}

/** Spielt einen gesicherten Deck-Stand zurück.

    ES WIRD NICHT LOSGESPIELT, und das ist keine Nachlässigkeit: Ohne
    einen echten Klick des Nutzers verweigern die Browser das Abspielen
    mit Ton. Der Titel wird deshalb VORGEMERKT — an der gesicherten
    Sekunde. Ein Druck auf ▶ setzt genau dort fort. */
function deckStandEinspielen(deck, d) {
  if (!d || !Array.isArray(d.titel) || !d.titel.length) return;
  deck.titel = d.titel;
  deck.laufend = Math.min(Math.max(d.laufend, 0), d.titel.length - 1);
  deck.listenName = d.listenName || '';
  // Ältere Stände kennen das Feld nicht (vor Auftrag 15): dann null.
  deck.quellePlaylist = typeof d.quellePlaylist === 'string' ? d.quellePlaylist : null;
  deck.gespielt = new Set(d.gespielt || []);
  deck.gesperrt = new Set(d.gesperrt || []);
  deck.wiederholen = Boolean(d.wiederholen);
  deck.fertig = Boolean(d.fertig);
  deck.startSekunde = Number(d.sekunde) || 0;

  deck.el.listeName.textContent = deck.listenName || 'Fortgesetzt';
  deck.el.anzahl.textContent = d.anzahlText || `${deck.titel.length} Titel`;
  deckQueueZeichnen(deck);
  deckWiederholenAnzeigen(deck);
  deckTitelAnzeigen(deck, deck.titel[deck.laufend]);

  const t = deck.titel[deck.laufend];
  const zeit = deck.startSekunde ? ` bei ${deckZeitText(deck.startSekunde)}` : '';
  deckMelden(deck, `Fortgesetzt: „${t.titel}"${zeit} — ▶ drücken.`);
}

umgebung.standAnmelden('playdecker',
  () => ({
    a: deckStandSichern(decks.a),
    b: deckStandSichern(decks.b),
    cross: deckCross,
    autoMix: deckAutoMixAn,
    blendSekunden: deckBlendSekunden,
    spielzeit: deckSpielzeitSekunden,
    lautstaerke: deckGesamtLautstaerke,
    drehungSekunden: deckDrehungSekunden,
    // Design des PlayDeckers (Auftrag 16) - unabhängig vom Jukeboxer
    design: deckDesign,
    // Perspektive beider Plattenspieler (Auftrag 17)
    perspektive: deckPerspektive,
    // Schwebendes Songtext-Fenster (Phase 6). Ältere Stände kennen das Feld
    // nicht - dann gelten im Fenster die Standardwerte.
    songtextFenster: songtextFenster ? songtextFenster.werte() : songtextFensterWerte,
  }),
  daten => {
    if (daten.a) deckStandEinspielen(decks.a, daten.a);
    if (daten.b) deckStandEinspielen(decks.b, daten.b);
    if (typeof daten.blendSekunden === 'number') {
      deckBlendSekunden = daten.blendSekunden;
      deckDauerEl.value = String(deckBlendSekunden);
      deckDauerAnzeigen();
    }
    if (typeof daten.spielzeit === 'number') {
      deckSpielzeitSekunden = daten.spielzeit;
      // Zurück auf die Stufe rechnen — der Regler führt Stufen, nicht
      // Sekunden.
      deckSpielzeitEl.value = String(Math.round(deckSpielzeitSekunden / 10));
      deckSpielzeitAnzeigen();
    }
    if (typeof daten.autoMix === 'boolean') deckAutoMixSetzen(daten.autoMix);
    if (typeof daten.lautstaerke === 'number') deckGesamtLautstaerkeSetzen(daten.lautstaerke);
    if (typeof daten.cross === 'number') deckCrossSetzen(daten.cross, false);
    // Ältere gemerkte Stände kennen die Plattendrehung nicht: dann bleibt 5 s.
    if (typeof daten.drehungSekunden === 'number') deckDrehungSetzen(daten.drehungSekunden);
    // Ältere Stände kennen das Design nicht: dann bleibt „Diner – Chrom".
    // Ein unbekanntes Design wird beim Setzen zum Standard.
    if (typeof daten.design === 'string') deckDesignSetzen(daten.design);
    // Ältere Stände kennen die Perspektive nicht: dann bleibt „stark".
    // Ein unbekannter Wert wird beim Setzen zum Standard.
    if (typeof daten.perspektive === 'string') deckPerspektiveSetzen(daten.perspektive);
    // Nur ein Objekt wird übernommen; die einzelnen Werte prüft der Baustein
    // (Ungültiges fällt dort auf den Standard zurück).
    if (daten.songtextFenster && typeof daten.songtextFenster === 'object') songtextFensterWerte = daten.songtextFenster;
  },
  'playdeck');   // historischer Name des Teils (bis 17.10.2026): einmalige Übernahme


/* ====================================================================
   (10d) PlayDecker — Mehrfachauswahl und Songtext (Nachtrag 06.08.2026)
   ==================================================================== */

/* --- Mehrere Titel auf einmal verschieben oder entfernen ------------- */

/** Verschiebt ALLE angekreuzten Titel um eine Stelle.

    DIE FALLE, die eine naive Umsetzung stellt: Verschiebt man die Zeilen
    einzeln nacheinander nach oben, ueberholen sie einander. Aus 2,3,4
    wird dann nicht 1,2,3, sondern ein Durcheinander — weil die zweite
    Verschiebung schon auf der veraenderten Liste arbeitet.

    Deshalb wird die Liste NEU AUFGEBAUT statt in ihr herumgeschoben:
    Die angekreuzten Titel wandern als geschlossener Block, ihre
    Reihenfolge untereinander bleibt erhalten, und der Merker `laufend`
    wird am Ende ueber die Videokennung wiedergefunden statt mitgerechnet. */
function deckMehrfachVerschieben(deck, richtung) {
  if (!deck.markiert.size) return;
  const laufenderTitel = deck.titel[deck.laufend];
  const stellen = deck.titel
    .map((t, i) => (deck.markiert.has(t.video_id) ? i : -1))
    .filter(i => i >= 0);

  // Am Rand angekommen? Dann bewegt sich gar nichts - sonst wuerde der
  // Block zerrissen, weil der erste nicht weiter kann und die uebrigen
  // schon.
  if (richtung < 0 && stellen[0] === 0) {
    deckMelden(deck, 'Ganz oben angekommen.');
    return;
  }
  if (richtung > 0 && stellen[stellen.length - 1] === deck.titel.length - 1) {
    deckMelden(deck, 'Ganz unten angekommen.');
    return;
  }

  const neu = [...deck.titel];
  // Beim Hochschieben von vorn nach hinten abarbeiten, beim
  // Runterschieben umgekehrt - so tritt sich der Block nie selbst auf
  // die Fuesse.
  const reihenfolge = richtung < 0 ? stellen : [...stellen].reverse();
  reihenfolge.forEach(i => {
    const ziel = i + richtung;
    [neu[i], neu[ziel]] = [neu[ziel], neu[i]];
  });

  deck.titel = neu;
  // Den laufenden Titel ueber seine Kennung wiederfinden. Ihn
  // mitzurechnen waere fehleranfaellig; Suchen ist hier eindeutig.
  if (laufenderTitel) {
    const gefunden = deck.titel.findIndex(t => t === laufenderTitel);
    if (gefunden >= 0) deck.laufend = gefunden;
  }
  deckQueueZeichnen(deck);
}

/** Entfernt ALLE angekreuzten Titel auf einmal. */
function deckMehrfachEntfernen(deck) {
  if (!deck.markiert.size) return;
  const laufenderTitel = deck.titel[deck.laufend];
  const laufenderBetroffen = laufenderTitel
    && deck.markiert.has(laufenderTitel.video_id);
  const anzahl = deck.markiert.size;

  deck.titel = deck.titel.filter(t => !deck.markiert.has(t.video_id));
  deck.markiert.clear();

  if (!deck.titel.length) {
    deck.laufend = -1;
    deck.el.anzahl.textContent = '0 Titel';
    deckQueueZeichnen(deck);
    deckMelden(deck, 'Warteschlange ist jetzt leer.');
    return;
  }
  if (laufenderBetroffen) {
    // Der laufende Titel war dabei: Der Player spielt ihn zu Ende, die
    // Marke rueckt auf den, der jetzt an seiner Stelle steht.
    deck.laufend = Math.min(deck.laufend, deck.titel.length - 1);
  } else if (deckAlterTitelLaeuft(deck)) {
    // E1: Der alte Titel laeuft noch zu Ende; die Marke bleibt VOR dem
    // (jetzt) ersten Titel - er kommt danach.
  } else {
    const gefunden = deck.titel.findIndex(t => t === laufenderTitel);
    deck.laufend = gefunden >= 0 ? gefunden : 0;
  }
  deck.el.anzahl.textContent = `${deck.titel.length} Titel`;
  deckQueueZeichnen(deck);
  deckMelden(deck, laufenderBetroffen
    ? `${anzahl} Titel entfernt — der laufende spielt noch zu Ende.`
    : `${anzahl} Titel entfernt.`);
}

/* --- Titel zwischen den Warteschlangen verschieben --------------------
       (Änderungswunsch 5 vom 12.08.2026)

   Wie im ManLister: Die ANGEKREUZTEN Titel wandern und verschwinden aus
   der Quelle.

   EINGEORDNET WIRD DIREKT UNTER DEM AKTIVEN TITEL des Zieldecks
   (Erweiterung vom 12.08.2026, ausdrücklicher Wunsch des Nutzers:
   „da finde ich sie besser"). Zuerst landeten sie am Ende — bei einer
   langen Warteschlange muss man sie dort suchen, und als Nächstes hören
   will man sie meistens auch. Dieselbe Stelle benutzt „An Deck senden"
   beim Hinzufügen schon (`splice(laufend + 1, …)`); damit landen beide
   Wege an derselben Stelle, statt sich zu widersprechen.

   Der laufende Titel selbst wird dabei NICHT angefasst: Eingefügt wird
   HINTER ihm, seine Position bleibt also, und der Ton läuft weiter.

   DER SPIELENDE TITEL WANDERT NICHT MIT, auch wenn er angekreuzt ist.
   Ihn unter dem Player wegzuziehen hiesse, die Musik anzuhalten —
   dieselbe Rücksicht, die „An Deck senden" schon nimmt. Er bleibt
   angekreuzt stehen, und die Meldung sagt, dass er zurückgehalten wurde.
   Still übergehen wäre die schlechtere Lösung: Dann fehlte ein Titel,
   und niemand wüsste warum.

   ABER NUR, WENN WIRKLICH GESPIELT WIRD. Zuerst stand hier, dass der
   Titel an der Marke `laufend` IMMER bleibt. Das war zu viel des Guten:
   Bei einem stehenden Deck ist keine Musik anzuhalten — und weil
   `laufend` nach dem Laden einer Liste auf 0 steht, liesse sich ein Deck
   dann NIE ganz leerräumen; ein Titel bliebe immer hängen. Steht das
   Deck, darf deshalb alles wandern, und die Anzeige des Decks wird
   danach auf den neuen Titel nachgeführt.
   -------------------------------------------------------------------- */

function deckZwischenWarteschlangen(von, nach) {
  if (!von.markiert.size) return;

  // Spielt dieses Deck gerade wirklich? Nur dann ist sein Titel geschützt.
  const spieltGerade = von.spieler && von.spieler.getPlayerState
    && von.spieler.getPlayerState() === DECK_LAEUFT;
  const laufenderTitel = (spieltGerade && von.laufend >= 0) ? von.titel[von.laufend] : null;
  // Der Titel an der Marke - unabhängig davon, ob er geschützt ist. Über
  // ihn wird die Marke nach dem Umbau wiedergefunden.
  const titelAnDerMarke = von.laufend >= 0 ? von.titel[von.laufend] : null;

  const wandern = von.titel.filter(t =>
    von.markiert.has(t.video_id) && t !== laufenderTitel);
  const laufenderZurueckgehalten = Boolean(laufenderTitel)
    && von.markiert.has(laufenderTitel.video_id);

  if (!wandern.length) {
    deckMelden(von, laufenderZurueckgehalten
      ? 'Nur der laufende Titel war angekreuzt — der bleibt, wo er ist.'
      : 'Nichts angekreuzt.');
    return;
  }

  // --- Aus der Quelle nehmen ---
  von.titel = von.titel.filter(t => !wandern.includes(t));
  // Die Kreuzchen der gewanderten Titel verschwinden mit ihnen; ein
  // zurückgehaltener laufender Titel behält seines.
  wandern.forEach(t => von.markiert.delete(t.video_id));

  // DIE MARKE NACHFÜHREN. Sie zeigt auf eine POSITION, nicht auf ein
  // Lied - wird die Liste umgebaut, ohne sie nachzuziehen, markiert die
  // Warteschlange plötzlich etwas anderes, als der Player spielt.
  // Wiedergefunden wird über die IDENTITÄT des Titels, nicht über
  // gerechnete Positionen; dasselbe Vorgehen wie in
  // deckMehrfachEntfernen.
  const markenTitelBlieb = titelAnDerMarke && von.titel.includes(titelAnDerMarke);
  if (!von.titel.length) {
    von.laufend = -1;
  } else if (markenTitelBlieb) {
    von.laufend = von.titel.indexOf(titelAnDerMarke);
  } else if (deckAlterTitelLaeuft(von)) {
    // E1: Im Player läuft noch der Titel von vor dem Laden. Die Marke
    // bleibt VOR dem (jetzt) ersten Titel - er kommt danach. Nichts
    // bereitlegen: Das hielte die laufende Musik an (Party-Regel).
  } else {
    // Der Titel an der Marke ist mitgewandert (nur möglich, wenn das Deck
    // NICHT spielt). Die Marke rückt auf den, der jetzt an seiner Stelle
    // steht - und die Anzeige des Decks muss mit, sonst stünde auf dem
    // Plattenteller ein Titel, der hier gar nicht mehr liegt.
    von.laufend = Math.min(Math.max(von.laufend, 0), von.titel.length - 1);
    deckTitelAnzeigen(von, von.titel[von.laufend]);
    // Kernkorrektur K1: der Merker des jetzt bereitgelegten Titels (wie
    // beim Springen) - sonst verwürfe das Deck später dessen Ende.
    // L3: Spielt nichts, wartet der Wächter danach auf einen Start.
    deckRuheBisStart(deckIrgendeinsSpielt());
    deckBereitlegen(von, von.titel[von.laufend]);
    deckAnzeigeNachfuehren(von);
  }
  von.el.anzahl.textContent = `${von.titel.length} Titel`;

  // --- Direkt unter den aktiven Titel des Ziels legen ---
  const zielWarLeer = !nach.titel.length;
  // Bei leerem Ziel steht `laufend` auf -1; dann ist Stelle 0 gemeint.
  // Sonst: unmittelbar HINTER dem aktiven Titel.
  const einfuegeStelle = nach.laufend >= 0 ? nach.laufend + 1 : 0;
  nach.titel.splice(einfuegeStelle, 0, ...wandern);
  // UND DER MERKER „durchgelaufen" MUSS WEG. Dieselbe Falle wie beim
  // Einreihen über „An Deck senden": Ein Deck, dessen Warteschlange
  // einmal zu Ende war, bliebe sonst für die Übergabe dauerhaft
  // gesperrt - obwohl hier gerade frische Titel angekommen sind.
  nach.fertig = false;
  if (zielWarLeer && deckAlterTitelLaeuft(nach)) {
    // E1: Das Ziel spielt noch seinen alten Titel zu Ende (es war eine
    // leere Liste geladen worden). Die Marke bleibt VOR dem ersten der
    // neuen Titel - er kommt danach. Nichts bereitlegen (Party-Regel).
  } else if (zielWarLeer) {
    nach.laufend = 0;
    deckTitelAnzeigen(nach, nach.titel[0]);
    // Kernkorrektur K1: der Merker des bereitgelegten Titels (wie beim
    // Springen) - sonst verwürfe das Deck später dessen Ende.
    // Nur VORMERKEN, nicht starten - das Starten bleibt beim Nutzer.
    // L3: Spielt nichts, wartet der Wächter danach auf einen Start.
    deckRuheBisStart(deckIrgendeinsSpielt());
    deckBereitlegen(nach, nach.titel[0]);
    deckAnzeigeNachfuehren(nach);
  }
  nach.el.anzahl.textContent = `${nach.titel.length} Titel`;

  deckQueueZeichnen(von);
  deckQueueZeichnen(nach);

  const zielName = nach.kennung.toUpperCase();
  deckMelden(von, `${wandern.length} Titel nach Deck ${zielName} verschoben`
    + (laufenderZurueckgehalten ? ' — der laufende bleibt hier.' : '.'));
  deckMelden(nach, zielWarLeer
    ? `${wandern.length} Titel von Deck ${von.kennung.toUpperCase()} übernommen.`
    : `${wandern.length} Titel eingereiht — sie kommen als Nächstes.`);
  standGeplant();
}

const deckNachBKnopf = kernElement('deck-nach-b');
const deckNachAKnopf = kernElement('deck-nach-a');
if (deckNachBKnopf) deckNachBKnopf.onclick = () => deckZwischenWarteschlangen(decks.a, decks.b);
if (deckNachAKnopf) deckNachAKnopf.onclick = () => deckZwischenWarteschlangen(decks.b, decks.a);


['a', 'b'].forEach(k => {
  const deck = decks[k];
  deck.el.qAlle.onclick = () => {
    deck.titel.forEach(t => deck.markiert.add(t.video_id));
    deckQueueZeichnen(deck);
  };
  deck.el.qKeine.onclick = () => {
    deck.markiert.clear();
    deckQueueZeichnen(deck);
  };
  deck.el.qHoch.onclick = () => deckMehrfachVerschieben(deck, -1);
  deck.el.qRunter.onclick = () => deckMehrfachVerschieben(deck, +1);
  deck.el.qWeg.onclick = () => deckMehrfachEntfernen(deck);
});


/* --- Songtext: schwebendes Fenster (Bauauftrag 13, Phase 6) ----------
   GEMESSEN am 06.08.2026 an vier Titeln: Alle vier hatten einen Text,
   KEINER davon zeitsynchron. Der Aufruf mit Zeitmarken scheitert
   durchgehend mit "HTTP 400: Request contains an invalid arg".

   Seit Phase 6 steht der Text nicht mehr fest in der Mittelspalte,
   sondern im schwebenden Songtext-Fenster - demselben Baustein wie im
   Jukeboxer (static/jukeboxer/songtext_fenster.js, ohne PlayLister-
   Bezug). Es schätzt das Mitlaufen aus der Spielzeit und lässt sich per
   Klick auf eine Zeile von Hand nachführen. Dass das nicht zeitsynchron
   ist, steht im Kopf des Fensters.

   Hier steht nur die kleine HÜLLE: Sie sagt dem Fenster, welcher Titel
   läuft und wo die Wiedergabe steht.
   ------------------------------------------------------------------ */

const songtextKnopf = kernElement('deck-songtext-knopf');
let songtextFenster = null;
// Das Deck, dem das Fenster zuletzt gefolgt ist. Spielt gerade keines,
// bleibt der Text dieses Decks stehen, statt zu verschwinden.
let songtextDeckZuletzt = null;
// Gemerkte Werte des Fensters (Lage, Größe, Tempo, Schrift) aus dem Stand
// des PlayDeckers - wirksam, sobald das Fenster zum ersten Mal entsteht.
let songtextFensterWerte = null;

/** Welchem Deck folgt das Fenster?
    (1) Läuft eine Überblendung, gilt schon ab ihrem Beginn das Ziel-Deck.
    (2) Sonst das spielende Deck; spielen beide (Crossfader von Hand),
        das lautere - siehe deckImVordergrund().
    (3) Spielt keines, bleibt es beim zuletzt verfolgten Deck. */
function songtextDeck() {
  const deck = deckBlende ? deckBlende.nach : deckImVordergrund();
  if (deck) songtextDeckZuletzt = deck;
  return songtextDeckZuletzt;
}

function songtextFensterHolen() {
  if (songtextFenster) return songtextFenster;
  // Eigene Ablage direkt im <body>: Das Fenster ist so im Vollbild
  // sichtbar und verschwindet mit dem Reiter (Regel in style.css).
  const ablage = document.createElement('div');
  ablage.className = 'stf-ablage';
  ablage.dataset.fuer = 'deck';
  document.body.appendChild(ablage);
  const spielerVon = () => { const d = songtextDeck(); return d && d.spieler ? d.spieler : null; };
  songtextFenster = SongtextFenster.erstellen({
    behaelter: ablage,
    farbsatz: 'bernstein',
    werte: songtextFensterWerte,
    huelle: {
      // Der Titel im Player (E1: der alte, solange er zu Ende läuft).
      titel() { const d = songtextDeck(); return d ? deckTitelImPlayer(d) || null : null; },
      async textLaden(t) {
        if (!t.video_id) return { vorhanden: false, grund: 'keine Videokennung' };
        return umgebung.songtext(t);
      },
      position() { const p = spielerVon(); return p && p.getCurrentTime ? p.getCurrentTime() || 0 : 0; },
      // Die ECHTE Titeldauer, auch bei fester Spielzeit (Auftrag (5D)):
      // Das Mitlaufen endet dann einfach früher.
      dauer() { const p = spielerVon(); return p && p.getDuration ? p.getDuration() || 0 : 0; },
      spielt() { const p = spielerVon(); return !!p && p.getPlayerState && p.getPlayerState() === DECK_LAEUFT; },
      // Gemerkt über die vorhandene Speicherung des PlayDeckers (Stand-Teil
      // „playdecker", Feld songtextFenster).
      speichern(werte) { songtextFensterWerte = werte; standGeplant(); },
    },
  });
  return songtextFenster;
}

songtextKnopf.addEventListener('click', () => {
  const fenster = songtextFensterHolen();
  fenster.umschalten();
});
// Der Knopf zeigt, ob das Fenster offen ist (es kann sich auch selbst
// schließen: ✕ oder Esc). Ein kurzer Blick genügt - kein eigener Takt.
setInterval(() => {
  songtextKnopf.classList.toggle('offen', !!songtextFenster && songtextFenster.istOffen());
}, 500);

/** Welches Deck ist gerade vorn? Danach richtet sich, wessen Text steht.
    Bei Gleichstand entscheidet, welches ueberhaupt spielt. */
function deckImVordergrund() {
  const aLaeuft = decks.a.spieler && decks.a.spieler.getPlayerState() === DECK_LAEUFT;
  const bLaeuft = decks.b.spieler && decks.b.spieler.getPlayerState() === DECK_LAEUFT;
  if (aLaeuft && !bLaeuft) return decks.a;
  if (bLaeuft && !aLaeuft) return decks.b;
  if (!aLaeuft && !bLaeuft) return null;
  return deckCross <= 50 ? decks.a : decks.b;   // beide laufen: der lautere
}

/* ---------------------------------------------------------------------
   ENDE des verschobenen Codes.
   --------------------------------------------------------------------- */

    /** Die Werte des PlayDeckers für das Mobil-Paket (Auftrag 15, Block
        „playdecker"): Aussehen, Wiedergabe-Einstellungen und je Deck die
        zuletzt geladene lokale Playlist. Nur lesen - eine Kopie. */
    function paketWerte() {
      return {
        design: deckDesign,
        perspektive: deckPerspektive,
        blendSekunden: deckBlendSekunden,
        spielzeit: deckSpielzeitSekunden,
        drehungSekunden: deckDrehungSekunden,
        letztePlaylist: { a: decks.a.quellePlaylist || null, b: decks.b.quellePlaylist || null },
      };
    }

    return Object.freeze({
      decks, DECK_LAEUFT, deckZeitText, deckMelden, deckAuswahlFuellen,
      deckTitelAnzeigen, deckQueueZeichnen, deckAnzeigeNachfuehren, paketWerte,
      deckTitelImPlayer, deckFrischeListeBereitlegen, deckSpieltOderStartet,
      deckTitelVomPlayer,
    });
  }

  global.PlayDeckerKern = Object.freeze({ starten });
})(window);
