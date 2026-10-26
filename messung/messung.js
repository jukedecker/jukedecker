/* ======================================================================
   JukeDecker - Vorabmessung (Bauauftrag 14): Messlogik + Protokoll

   Grundlage ist die Messseite aus Auftrag 12 (Jukebox/diagnose/web/).
   Die Messpunkt-Nummern sind dieselben, damit sich die Ergebnisse
   vergleichen lassen. Neu: M16 bis M21.

   Grundsaetze:
   (1) Jede Messung schreibt ROHWERTE ins Protokoll (Zahl, Fehlercode,
       Zustand), keine Vermutungen. Eine gescheiterte Messung ist ein
       Messwert, kein Absturz.
   (2) Das Protokoll wird nach JEDEM Eintrag sofort in den Geraetespeicher
       (localStorage) geschrieben. So uebersteht es gesperrten Bildschirm,
       App-Wechsel, Absturz und Neustart.
   (3) DATENSCHUTZ (M16): Aus einem Mobil-Paket kommen nur ZAHLEN ins
       Protokoll (Groessen, Zeiten, Anzahl). Keine Titel, keine
       Playlist-Namen, nicht der Rechnername aus dem Paketkopf. Die Seite
       schickt den Paketinhalt nirgendwohin, er bleibt im Geraetespeicher.
   (4) Es gibt keinen PC-Server mehr: Die Seite kommt von GitHub Pages.
       "Netz da?" prueft netzprobe.json, die der Service Worker nie aus
       dem Speicher beantwortet.
   ====================================================================== */
'use strict';

// MUSS zu VERSION in sw_messung.js passen.
const SEITENVERSION = 'jd-messung-3';
// Eigener Ursprung (eigene GitHub-Organisation "jukedecker"): Speicher,
// Caches und Service Worker teilt sich die Seite mit keiner anderen App.
const ERWARTETER_URSPRUNG = 'https://jukedecker.github.io';
const PROTOKOLL_SCHLUESSEL = 'jukedecker_messprotokoll_v1';
const DB_NAME = 'jukedecker_messung';
const DB_VERSION = 1;
// Ablagen in IndexedDB: Test-Playlist (M9), eingelesenes Paket (M16),
// Code aus der Probe-Datei (M17).
const DB_ABLAGEN = {
  playlisten: 'name',
  paket_playlisten: 'nr',
  paket_cover: 'schluessel',
  paket_info: 'name',
  kern: 'name',
};
const GETEILT_SPEICHER = 'jd-messung-geteilt';   // wie in sw_messung.js

// Zustandsnummern des YouTube-Players, ausgeschrieben - sonst stuende im
// Protokoll nur "2" und niemand wuesste, was gemeint ist.
const ZUSTAND = { '-1': 'ungestartet', 0: 'beendet', 1: 'laeuft', 2: 'pausiert', 3: 'puffert', 5: 'bereit' };

// Fehlercodes des YouTube-Players mit Bedeutung. 150 kommt auch, wenn
// YouTube den URSPRUNG ablehnt (Fund 18.08.2026: nackte IP-Adresse).
const FEHLERCODE = {
  2: 'ungueltige Video-Kennung',
  5: 'HTML5-Player-Fehler',
  100: 'Video nicht gefunden / privat',
  101: 'Einbettung vom Eigentuemer verboten',
  150: 'Einbettung verboten ODER Ursprung abgelehnt',
  152: 'Einbettung abgelehnt (Herkunftsnachweis)',
  153: 'Herkunftsnachweis fehlt (Referrer/Ursprung)',
};

const $ = id => document.getElementById(id);
const warte = ms => new Promise(r => setTimeout(r, ms));

/** Wartet, bis eine Bedingung eintritt oder die Zeit ablaeuft.
    Liefert true/false statt zu werfen. */
async function warteBis(pruefung, grenzeMs, taktMs = 200) {
  const ende = Date.now() + grenzeMs;
  while (Date.now() < ende) {
    if (pruefung()) return true;
    await warte(taktMs);
  }
  return pruefung();
}

function zeitstempel(d = new Date()) {
  const zwei = n => String(n).padStart(2, '0');
  return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}. ${zwei(d.getHours())}:${zwei(d.getMinutes())}:${zwei(d.getSeconds())}`;
}

const runde = (zahl, stellen = 1) => (zahl == null || isNaN(zahl)) ? null : Math.round(zahl * 10 ** stellen) / 10 ** stellen;
const mb = bytes => bytes == null ? '?' : (bytes / 1048576).toFixed(2) + ' MB';
const ms = wert => `${Math.round(wert)} ms`;
const jaNein = wert => wert ? 'ja' : 'nein';
const utf8Bytes = text => new TextEncoder().encode(text).length;


/* ======================================================================
   (A) Protokoll
   ====================================================================== */

const Protokoll = {
  eintraege: [],
  speicherOk: true,
  speicherGrund: '',

  laden() {
    try {
      const roh = localStorage.getItem(PROTOKOLL_SCHLUESSEL);
      this.eintraege = roh ? JSON.parse(roh) : [];
    } catch (fehler) {
      this.speicherOk = false;
      this.speicherGrund = `${fehler.name}: ${fehler.message}`;
      this.eintraege = [];
    }
  },

  schreiben(punkt, text) {
    this.eintraege.push({ z: zeitstempel(), p: punkt, t: text });
    try {
      localStorage.setItem(PROTOKOLL_SCHLUESSEL, JSON.stringify(this.eintraege));
    } catch (fehler) {
      this.speicherOk = false;
      this.speicherGrund = `${fehler.name}: ${fehler.message}`;
    }
    this.anzeigen();
  },

  zeile(e) { return `[${e.z}] ${e.p.padEnd(5)}| ${e.t}`; },

  anzeigen() {
    const feld = $('protokoll-anzeige');
    feld.textContent = this.eintraege.map(e => this.zeile(e)).join('\n') || '(noch leer)';
    feld.scrollTop = feld.scrollHeight;
    if (!this.speicherOk) {
      $('speicher-grund').textContent = this.speicherGrund;
      $('warnband-speicher').classList.add('sichtbar');
    }
  },

  loeschen() {
    this.eintraege = [];
    try { localStorage.removeItem(PROTOKOLL_SCHLUESSEL); } catch (e) { /* egal */ }
    this.anzeigen();
  },
};

const log = (punkt, text) => Protokoll.schreiben(punkt, text);


/* ======================================================================
   (B) Geraete-Angaben fuer die Kopfzeile
   ====================================================================== */

let geraet = { modell: '?', android: '?', chrome: '?' };

async function geraetErmitteln() {
  // Chrome auf Android kuerzt den normalen User-Agent (Modell "K",
  // Android "10"). Die genauen Werte gibt es nur ueber diese Abfrage.
  try {
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      const w = await navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion', 'fullVersionList']);
      // "Google Chrome" bevorzugt, sonst "Chromium" (z. B. Entwickler-Fassungen).
      const marken = w.fullVersionList || [];
      const chrome = marken.find(b => b.brand === 'Google Chrome') || marken.find(b => /Chrom/i.test(b.brand));
      geraet = {
        modell: w.model || '(leer)',
        android: (w.platform || navigator.userAgentData.platform || '') + ' ' + (w.platformVersion || '?'),
        chrome: chrome ? chrome.version : '?',
      };
      return;
    }
  } catch (e) { /* Rueckfall unten */ }
  const ua = navigator.userAgent;
  geraet = {
    modell: (ua.match(/Android [^;]+; ([^)]+)\)/) || [])[1] || '?',
    android: (ua.match(/Android ([\d.]+)/) || [])[1] || '?',
    chrome: (ua.match(/Chrome\/([\d.]+)/) || [])[1] || '?',
  };
}

function anzeigemodus() {
  for (const modus of ['fullscreen', 'standalone', 'minimal-ui']) {
    if (matchMedia(`(display-mode: ${modus})`).matches) return `installiert (${modus})`;
  }
  return 'Browser-Tab';
}

function bildschirmText() {
  const o = screen.orientation;
  return `${screen.width} x ${screen.height} (CSS-Pixel), Pixeldichte ${devicePixelRatio}, Fenster ${innerWidth} x ${innerHeight}, Ausrichtung ${o ? o.type : '?'}`;
}

function kopfzeile() {
  return [
    '=== JukeDecker-Vorabmessung - Protokoll ===',
    `Stand Messseite:  ${SEITENVERSION}`,
    `Kopiert am:       ${new Date().toLocaleString('de-DE')}`,
    `Geraetemodell:    ${geraet.modell}`,
    `Android-Version:  ${geraet.android}`,
    `Chrome-Version:   ${geraet.chrome}`,
    `Bildschirm:       ${bildschirmText()}`,
    `Ursprung:         ${location.origin}  (erwartet ${ERWARTETER_URSPRUNG}: ${jaNein(location.origin === ERWARTETER_URSPRUNG)})`,
    `Adresse:          ${location.origin}${location.pathname}`,
    `Anzeigemodus:     ${anzeigemodus()}`,
    `Sicherer Kontext: ${jaNein(window.isSecureContext)}`,
    `Protokollspeicher:${Protokoll.speicherOk ? ' dauerhaft (localStorage)' : ' NICHT dauerhaft - ' + Protokoll.speicherGrund}`,
    `CSP-Verletzungen: ${Object.entries(cspZaehler).map(([r, n]) => `${r} ${n}x`).join(', ') || 'keine'}`,
    `User-Agent:       ${navigator.userAgent}`,
    `Eintraege:        ${Protokoll.eintraege.length}`,
    '===========================================',
  ].join('\n');
}


/* ======================================================================
   (C) Hilfen: Netzprobe, Testliste, IndexedDB, Service Worker
   ====================================================================== */

/** Ist das Netz wirklich da? netzprobe.json beantwortet der Service
    Worker NIE aus dem Speicher. navigator.onLine allein ist unzuverlaessig
    (es sagt nur, ob irgendeine Verbindung besteht). */
async function netzPruefen() {
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), 6000);
  const t0 = performance.now();
  try {
    const antwort = await fetch(`netzprobe.json?t=${Date.now()}`, { cache: 'no-store', signal: abbruch.signal });
    return {
      erreichbar: antwort.ok, grund: antwort.ok ? '' : `HTTP ${antwort.status}`, ms: performance.now() - t0,
      // Fuer M17F: Setzt der Server eine Sicherheitsrichtlinie (CSP)?
      csp: antwort.headers.get('content-security-policy'),
    };
  } catch (fehler) {
    return { erreichbar: false, grund: fehler.name === 'AbortError' ? 'keine Antwort in 6 s' : `${fehler.name}: ${fehler.message}` };
  } finally {
    clearTimeout(uhr);
  }
}

function netzMarke(ergebnis) {
  const marke = $('marke-netz');
  const da = ergebnis ? ergebnis.erreichbar : navigator.onLine;
  marke.textContent = 'Netz: ' + (da ? 'ja' : 'nein') + (ergebnis ? '' : ' (laut Browser)');
  marke.className = 'marke ' + (da ? 'gut' : 'schlecht');
}

let testlisteSpeicher = null;
async function testliste() {
  if (testlisteSpeicher) return testlisteSpeicher;
  const antwort = await fetch('testliste.json');
  return (testlisteSpeicher = await antwort.json());
}

function dbOeffnen() {
  return new Promise((ok, fehler) => {
    const anfrage = indexedDB.open(DB_NAME, DB_VERSION);
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result;
      for (const [name, schluessel] of Object.entries(DB_ABLAGEN)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: schluessel });
      }
    };
    anfrage.onsuccess = () => ok(anfrage.result);
    anfrage.onerror = () => fehler(anfrage.error);
    anfrage.onblocked = () => fehler(new Error('IndexedDB blockiert'));
  });
}

/** Eine Transaktion ueber eine oder mehrere Ablagen. "arbeit" bekommt die
    Transaktion und eine Funktion "ergebnis", mit der sie den Rueckgabewert
    setzt. Erst wenn die Transaktion WIRKLICH abgeschlossen ist (oncomplete),
    gilt das Schreiben als erledigt. */
async function dbTransaktion(ablagen, modus, arbeit) {
  const db = await dbOeffnen();
  try {
    return await new Promise((ok, fehler) => {
      const tx = db.transaction(ablagen, modus);
      let wert;
      tx.oncomplete = () => ok(wert);
      tx.onerror = () => fehler(tx.error);
      tx.onabort = () => fehler(tx.error || new Error('Transaktion abgebrochen'));
      arbeit(tx, w => { wert = w; });
    });
  } finally {
    db.close();
  }
}

const dbSchreiben = (ablage, eintrag) =>
  dbTransaktion(ablage, 'readwrite', tx => tx.objectStore(ablage).put(eintrag));

const dbLesen = (ablage, schluessel) =>
  dbTransaktion(ablage, 'readonly', (tx, ergebnis) => {
    tx.objectStore(ablage).get(schluessel).onsuccess = e => ergebnis(e.target.result);
  });

const dbAlle = ablage =>
  dbTransaktion(ablage, 'readonly', (tx, ergebnis) => {
    tx.objectStore(ablage).getAll().onsuccess = e => ergebnis(e.target.result);
  });

const dbAnzahl = ablage =>
  dbTransaktion(ablage, 'readonly', (tx, ergebnis) => {
    tx.objectStore(ablage).count().onsuccess = e => ergebnis(e.target.result);
  });

/** Fragt den Service Worker ueber einen eigenen Nachrichtenkanal. */
function swFragen(nachricht, grenzeMs = 30000) {
  return new Promise((ok, fehler) => {
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!sw) return fehler(new Error('kein Service Worker steuert diese Seite'));
    const kanal = new MessageChannel();
    const uhr = setTimeout(() => fehler(new Error('Service Worker antwortet nicht')), grenzeMs);
    kanal.port1.onmessage = e => { clearTimeout(uhr); ok(e.data); };
    sw.postMessage(nachricht, [kanal.port2]);
  });
}

async function speicherSchaetzung() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  try { return await navigator.storage.estimate(); } catch (e) { return null; }
}

/** Kurzangabe zur Umgebung, die viele Messpunkte mitschreiben (M17D). */
function umgebungText() {
  const gesteuert = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  return `Modus ${anzeigemodus()}, Netz laut Browser ${jaNein(navigator.onLine)}, vom Service Worker gesteuert ${jaNein(gesteuert)}`;
}


/* ======================================================================
   (D) YouTube-Player (der sichtbare Player der Messseite)
   ====================================================================== */

/** Laedt die YouTube-Schnittstelle EINMAL - auch wenn mehrere Teile der
    Seite (Haupt-Player, M18) sie gleichzeitig anfordern. */
let youtubeLadung = null;
function youtubeLaden() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (youtubeLadung) return youtubeLadung;
  youtubeLadung = new Promise((ok, fehler) => {
    const uhr = setTimeout(() => fehler(new Error('YouTube-Schnittstelle nicht in 15 s geladen (Internet?)')), 15000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(uhr); ok(); };
    const skript = document.createElement('script');
    skript.src = 'https://www.youtube.com/iframe_api';
    skript.onerror = () => { clearTimeout(uhr); fehler(new Error('YouTube-Schnittstelle nicht erreichbar')); };
    document.head.appendChild(skript);
  });
  youtubeLadung.catch(() => { youtubeLadung = null; });
  return youtubeLadung;
}

const Spieler = {
  objekt: null,
  bereit: false,
  zustand: null,        // letzte Zustandsnummer
  fehler: null,         // letzter Fehlercode
  videoId: null,
  seekZaehler: 0,       // M20C: wie oft wurde gesprungen?
  beiZustandZusatz: null,  // fuer M7/M19B: reagiert auf Zustandswechsel

  async anlegen(ersteVideoId) {
    if (this.objekt && this.bereit) return;
    // Ein zweiter Versuch auf demselben Platz geht nicht (YouTube hat das
    // Element schon ersetzt) - dann ehrlich melden statt still zu haengen.
    if (this.objekt) throw new Error('Player kam beim ersten Versuch nicht hoch - Seite neu laden');
    await youtubeLaden();
    await new Promise(ok => {
      const uhr = setTimeout(ok, 15000);
      this.objekt = new YT.Player('spieler', {
        width: '356', height: '200',
        videoId: ersteVideoId,
        playerVars: { playsinline: 1, autoplay: 0, controls: 1, rel: 0 },
        events: {
          onReady: () => { this.bereit = true; clearTimeout(uhr); ok(); },
          onStateChange: e => this.beiZustand(e.data),
          onError: e => this.beiFehler(e.data),
        },
      });
    });
    if (!this.bereit) throw new Error('Player meldete sich nicht in 15 s bereit');
  },

  beiZustand(nummer) {
    this.zustand = nummer;
    this.anzeigeAktualisieren();
    // Waehrend die Seite NICHT sichtbar ist, jeden Zustandswechsel mit
    // Uhrzeit festhalten - genau daran sieht man fuer M8B/M8C/M19B, WANN
    // der Browser die Wiedergabe angehalten (oder gestartet) hat.
    if (document.visibilityState !== 'visible') {
      log(Hintergrund.punkt || 'LEBEN', `Player-Zustand im Hintergrund: ${ZUSTAND[nummer] ?? nummer}`);
    }
    if (this.beiZustandZusatz) this.beiZustandZusatz(nummer);
  },

  beiFehler(code) {
    this.fehler = code;
    this.anzeigeAktualisieren();
  },

  laden(videoId) {
    this.fehler = null;
    this.zustand = null;
    this.videoId = videoId;
    this.objekt.loadVideoById(videoId);
  },

  springen(sekunden) {
    this.seekZaehler += 1;
    this.objekt.seekTo(Math.max(0, sekunden), true);
  },

  position() { try { return this.objekt.getCurrentTime(); } catch (e) { return null; } },
  dauer() { try { return this.objekt.getDuration(); } catch (e) { return null; } },
  zustandText() {
    try { const n = this.objekt.getPlayerState(); return ZUSTAND[n] ?? String(n); } catch (e) { return 'kein Player'; }
  },

  anzeigeAktualisieren(titel) {
    if (titel) this.titelText = `${titel.interpret} – ${titel.titel}`;
    const fehler = this.fehler != null ? ` · Fehler ${this.fehler}` : '';
    $('jetzt').textContent = `${this.titelText || '–'} · ${ZUSTAND[this.zustand] ?? '…'}${fehler}`;
  },

  stoppen() { try { this.objekt.stopVideo(); } catch (e) { /* kein Player */ } },
};

function fehlerText(code) { return `Fehler ${code} (${FEHLERCODE[code] || 'unbekannt'})`; }

/** Laeuft vermutlich WERBUNG vor dem Titel? Gemessen am 26.10.2026 auf
    jukedecker.github.io (Diagnose live_diagnose_player.py): Waehrend eines
    Werbespots meldet der Player den Zustand -1 ("ungestartet") und KEINEN
    Fehler, seine Zeit laeuft aber weiter (es laeuft ja der Spot). Von
    localhost aus kam im Test keine Werbung. Ohne diese Pruefung stuende im
    Protokoll faelschlich "startete nicht". */
async function werbungVermutet(p) {
  try {
    const vorher = p.getCurrentTime();
    await warte(1500);
    return p.getPlayerState() === -1 && p.getCurrentTime() > vorher + 0.5;
  } catch (e) {
    return false;
  }
}

/** Zusatz fuer Meldungen "laeuft nicht": haengt " - vermutlich WERBUNG"
    an, wenn der Player gerade einen Spot zu spielen scheint. */
async function werbungsZusatz(p) {
  return (p && await werbungVermutet(p)) ? ' - vermutlich WERBUNG vor dem Titel (Zustand ungestartet, Zeit laeuft)' : '';
}

/** Spielt EINEN Titel fuer `sekunden` und misst, ob er wirklich lief. */
async function titelSpielen(titel, sekunden, punkt) {
  Spieler.anzeigeAktualisieren(titel);
  const t0 = Date.now();
  Spieler.laden(titel.video_id);
  Spieler.anzeigeAktualisieren(titel);
  let kam = await warteBis(() => Spieler.zustand === 1 || Spieler.fehler != null, 15000);
  // Werbung vor dem Titel: bis zu 90 s weiter warten und die Dauer notieren.
  let werbung = '';
  if (!kam && await werbungVermutet(Spieler.objekt)) {
    const tWerbung = Date.now();
    $('grosse-anzeige').textContent = `${punkt}: vermutlich Werbung – bitte warten`;
    kam = await warteBis(() => Spieler.zustand === 1 || Spieler.fehler != null, 90000);
    werbung = kam
      ? `, vorher vermutlich WERBUNG (Titel kam ${runde((Date.now() - t0) / 1000, 0)} s nach dem Laden, davon ${runde((Date.now() - tWerbung) / 1000, 0)} s Nachwarten)`
      : ', vermutlich WERBUNG, Titel kam auch nach 90 s weiterer Wartezeit nicht';
    $('grosse-anzeige').textContent = '';
  }
  if (Spieler.fehler != null) {
    return { ok: false, text: `${fehlerText(Spieler.fehler)} nach ${Date.now() - t0} ms${werbung}` };
  }
  if (!kam) {
    const aktivierung = navigator.userActivation ? jaNein(navigator.userActivation.hasBeenActive) : '?';
    return { ok: false, text: `startete nicht in 15 s, Zustand "${Spieler.zustandText()}" (Nutzergeste bisher: ${aktivierung})${werbung}` };
  }
  const anlaufMs = Date.now() - t0;
  const pos0 = Spieler.position();
  for (let rest = sekunden; rest > 0; rest--) {
    $('grosse-anzeige').textContent = `${punkt}: noch ${rest} s`;
    await warte(1000);
    if (Spieler.fehler != null) break;
  }
  $('grosse-anzeige').textContent = '';
  const gespielt = (Spieler.position() ?? 0) - (pos0 ?? 0);
  if (Spieler.fehler != null) return { ok: false, text: `${fehlerText(Spieler.fehler)} waehrend der Wiedergabe` };
  return {
    ok: gespielt >= sekunden * 0.6,
    text: `Anlauf ${anlaufMs} ms${werbung}, gespielt ${runde(gespielt)} s von ${sekunden} s, Zustand "${Spieler.zustandText()}", stumm: ${(() => { try { return jaNein(Spieler.objekt.isMuted()); } catch (e) { return '?'; } })()}`,
  };
}

/** M5/M6: drei Titel nacheinander je 15 s. Faellt ein Titel aus,
    springt der naechste aus der Liste ein - und das wird vermerkt. */
async function wiedergabeMessen(punkt) {
  const netz = await netzPruefen();
  netzMarke(netz);
  log(punkt, `Start. Netz erreichbar (github.io): ${jaNein(netz.erreichbar)}${netz.erreichbar ? '' : ' (' + netz.grund + ')'}, Internet laut Browser: ${jaNein(navigator.onLine)}, ${umgebungText()}`);
  if (punkt === 'M6') {
    log(punkt, 'Bedingung M6: Der PC ist AUS (Angabe des Nutzers durch Wahl dieses Knopfs). Das Geraet ist online.');
  }
  if (!netz.erreichbar) log(punkt, 'Hinweis: Ohne Netz kann YouTube nicht spielen - Ergebnis ist fuer M5/M6 nicht aussagekraeftig.');
  const liste = await testliste();
  try {
    await Spieler.anlegen(liste.titel[0].video_id);
  } catch (fehler) {
    log(punkt, `Player nicht nutzbar: ${fehler.message}`);
    log(punkt, 'Ergebnis: 0 von 3 gespielt (Player/Schnittstelle nicht geladen)');
    return;
  }
  const gespielt = [];
  for (let i = 0; i < liste.titel.length && gespielt.length < 3; i++) {
    const titel = liste.titel[i];
    const r = await titelSpielen(titel, 15, punkt);
    log(punkt, `Titel ${i + 1} ${titel.video_id} "${titel.interpret} - ${titel.titel}": ${r.ok ? 'OK' : 'NICHT OK'} - ${r.text}`);
    if (r.ok) gespielt.push(i);
  }
  Spieler.stoppen();
  // Titel 4 und 5 sind Ersatz: Wurden sie gebraucht, ist einer der
  // ersten drei ausgefallen - das soll im Protokoll klar stehen.
  const ersatz = gespielt.some(i => i >= 3);
  const liste3 = gespielt.map(i => `${i + 1} (${liste.titel[i].video_id})`).join(', ') || '-';
  log(punkt, `Ergebnis: ${gespielt.length} von 3 gespielt. Gespielt wurden Titel ${liste3}${ersatz ? ' - ERSATZTITEL eingesprungen' : ''}.`);
}


/* ======================================================================
   (E) Lebenszyklus: Sichtbarkeit, Einfrieren, Netz, Drehen
   Grundlage fuer M4, M8, M14 und M19B - laeuft immer mit.
   ====================================================================== */

const Hintergrund = {
  punkt: null,        // 'M8B', 'M8C' oder 'M19B', solange ein Dauerlauf laeuft
  wegSeit: null,
  positionWeg: null,
  zustandWeg: null,
};

let wachsperre = null;
let wachsperreGewuenscht = false;
const cspZaehler = {};   // M17F: Verletzungen der Sicherheitsrichtlinie je Regel

function lebenszyklusBeobachten() {
  document.addEventListener('visibilitychange', async () => {
    const punkt = Hintergrund.punkt || 'LEBEN';
    if (document.visibilityState === 'hidden') {
      Hintergrund.wegSeit = Date.now();
      Hintergrund.positionWeg = Spieler.objekt ? Spieler.position() : null;
      Hintergrund.zustandWeg = Spieler.objekt ? Spieler.zustandText() : 'kein Player';
      log(punkt, `Seite unsichtbar (gesperrt/App gewechselt). Player: ${Hintergrund.zustandWeg}, Position ${runde(Hintergrund.positionWeg)} s`);
    } else {
      const wegMs = Hintergrund.wegSeit ? Date.now() - Hintergrund.wegSeit : null;
      let text = `Seite wieder sichtbar nach ${wegMs != null ? runde(wegMs / 1000) + ' s' : '?'}.`;
      if (Spieler.objekt) {
        const pos = Spieler.position();
        const weiter = (pos != null && Hintergrund.positionWeg != null) ? pos - Hintergrund.positionWeg : null;
        text += ` Player jetzt: ${Spieler.zustandText()}, Position ${runde(pos)} s`;
        if (weiter != null && wegMs) {
          // DER objektive Beleg fuer M8B/M8C (M8E): Ist die Position waehrend
          // der Abwesenheit mitgelaufen, lief der Ton weiter. (Bei M19B
          // wechselt der Titel - dort zaehlt der Eintrag "Folgetitel".)
          text += ` -> Position lief ${runde(weiter)} s weiter in ${runde(wegMs / 1000)} s Abwesenheit (${weiter > wegMs / 1000 * 0.8 ? 'Ton lief vermutlich DURCH' : weiter > 2 ? 'Ton lief TEILWEISE' : 'Ton STAND'})`;
        }
      }
      log(punkt, text);
      // Wake Lock geht beim Verstecken verloren - wie die App es spaeter
      // tun wird, wird er hier neu angefordert, und das wird notiert.
      if (wachsperreGewuenscht && (!wachsperre || wachsperre.released)) {
        try {
          wachsperre = await navigator.wakeLock.request('screen');
          log('M8A', 'Wake Lock nach Rueckkehr neu angefordert: ja');
        } catch (e) {
          log('M8A', `Wake Lock nach Rueckkehr neu anfordern: FEHLER ${e.name}: ${e.message}`);
        }
      }
    }
  });
  // Chrome friert Seiten im Hintergrund ein - das waere die Erklaerung,
  // wenn auch die Zeitgeber stehen bleiben.
  document.addEventListener('freeze', () => log(Hintergrund.punkt || 'LEBEN', 'Seite wurde vom Browser EINGEFROREN (freeze)'));
  document.addEventListener('resume', () => log(Hintergrund.punkt || 'LEBEN', 'Seite wurde wieder AUFGETAUT (resume)'));
  addEventListener('pageshow', e => { if (e.persisted) log('LEBEN', 'Seite aus dem Zurueck-Speicher wiederhergestellt'); });
  addEventListener('online', () => { netzMarke(); log('LEBEN', 'Browser meldet: Internet wieder da'); });
  addEventListener('offline', () => { netzMarke(); log('LEBEN', 'Browser meldet: Internet weg'); });

  // M17F: Blockiert eine Sicherheitsrichtlinie (CSP) etwas? Jede
  // Verletzung kommt hier an - auch eine, die Chrome sonst nur in der
  // Entwicklerkonsole zeigen wuerde.
  // Je Regel (z. B. img-src) werden nur die ersten 3 Verletzungen
  // einzeln notiert, alle weiteren nur gezaehlt (sonst schreibt ein
  // gesperrtes Cover-Raster hunderte gleiche Zeilen). Die Summe steht in
  // der Kopfzeile des Protokolls.
  document.addEventListener('securitypolicyviolation', e => {
    const regel = e.violatedDirective;
    cspZaehler[regel] = (cspZaehler[regel] || 0) + 1;
    if (cspZaehler[regel] <= 3) {
      log('CSP', `Sicherheitsrichtlinie blockierte: ${regel} (Quelle ${String(e.blockedURI).slice(0, 40)}, Modus ${e.disposition})${cspZaehler[regel] === 3 ? ' - weitere Verletzungen dieser Regel werden nur gezaehlt' : ''}`);
    }
  });

  // M14: Jede Drehung wird mit Anzeigemodus notiert.
  const ausrichtungNotieren = anlass => {
    const o = screen.orientation;
    log('M14', `${anlass}: Ausrichtung ${o ? o.type : '?'} (Winkel ${o ? o.angle : '?'}), Fenster ${innerWidth} x ${innerHeight}, Modus ${anzeigemodus()}`);
  };
  if (screen.orientation) screen.orientation.addEventListener('change', () => ausrichtungNotieren('Gedreht'));
  ausrichtungNotieren('Beim Oeffnen');
}


/* ======================================================================
   (F) Pruefsumme wie im Mobil-Paket (PlayLister/mobilpaket.py)

   Die Regeln stehen in PlayLister/mobilpaket.py (Kopf) und im Testvektor
   PlayLister/mobilpaket_pruefsumme_testvektor.json:
   (1) Grundlage {playlisten, cover, jukeboxer} - jukeboxer nur, wenn da
   (2) Schluessel auf ALLEN Ebenen sortiert, Listen in ihrer Reihenfolge
   (3) keine Leerzeichen, Trenner "," und ":"
   (4) Umlaute bleiben Zeichen (keine \u-Folgen), kein NaN/Unendlich
   (5) ganzzahlige Kommazahlen werden Ganzzahlen (1.0 -> 1) - in
       JavaScript gibt es 1.0 ohnehin nicht, JSON.stringify(1) ist "1"
   (6) alle Schluessel ASCII (dann sortieren Python und JavaScript gleich)
   (7) SHA-256 ueber die UTF-8-Bytes, "sha256:<64 hex>"
   Zeichenketten: JSON.stringify maskiert dieselben Zeichen wie Python
   mit ensure_ascii=False (Anfuehrungszeichen, Rueckstrich, Steuerzeichen
   unter 0x20; Steuerzeichen klein geschrieben als \u00xx).
   ====================================================================== */

function kanonisch(wert) {
  if (wert === null) return 'null';
  if (typeof wert === 'boolean') return wert ? 'true' : 'false';
  if (typeof wert === 'number') {
    if (!Number.isFinite(wert)) throw new Error('NaN/Unendlich ist nicht erlaubt');
    return JSON.stringify(wert);
  }
  if (typeof wert === 'string') return JSON.stringify(wert);
  if (Array.isArray(wert)) return '[' + wert.map(kanonisch).join(',') + ']';
  if (typeof wert === 'object') {
    const schluessel = Object.keys(wert).sort();
    for (const s of schluessel) {
      if (!/^[\x00-\x7f]*$/.test(s)) throw new Error('Schluessel ist nicht ASCII');
    }
    return '{' + schluessel.map(s => JSON.stringify(s) + ':' + kanonisch(wert[s])).join(',') + '}';
  }
  throw new Error(`unerwarteter Typ ${typeof wert}`);
}

async function sha256(text) {
  const daten = new TextEncoder().encode(text);
  const summe = await crypto.subtle.digest('SHA-256', daten);
  return 'sha256:' + Array.from(new Uint8Array(summe), b => b.toString(16).padStart(2, '0')).join('');
}

// Der Testvektor aus PlayLister/mobilpaket_pruefsumme_testvektor.json
// (nur "eingabe" und "pruefsumme"; enthaelt keine echten Daten).
const PRUEFSUMMEN_TESTVEKTOR = {
  eingabe: {
    playlisten: [{
      id: 'Prüf-Liste_1',
      name: 'Größe & Übung „Sommer“',
      herkunft: 'YouTube',
      geaendert: '2026-10-08T22:30:00',
      titel: [
        { video_id: 'abcDEF12345', titel: 'Ölfass', interpret: 'Bär', dauer_sekunden: 1.0, cover: null, verfuegbar: true },
        { video_id: '', titel: 'Ohne Kennung', interpret: '', dauer_sekunden: 0, cover: null, verfuegbar: false },
      ],
    }],
    cover: {},
    jukeboxer: {
      wahlmodus: 'sofort',
      effekte: { tempo: 1.25, animationen: true, neon: 'ruhig' },
      genres: [{ nr: 1, name: 'Klassik', symbol: 'schluessel', playlist: 'Prüf-Liste_1' }],
      wiedergabe: { ueberblendDauer: 4.0, festeSpielzeit: 0 },
    },
  },
  pruefsumme: 'sha256:14cc62f333e7047842c1f571790d066c924b1d9270960be3cd3b5bf7ecce1174',
};

async function testvektorPruefen() {
  const t0 = performance.now();
  try {
    const summe = await sha256(kanonisch(PRUEFSUMMEN_TESTVEKTOR.eingabe));
    return { ok: summe === PRUEFSUMMEN_TESTVEKTOR.pruefsumme, ms: performance.now() - t0 };
  } catch (e) {
    return { ok: false, ms: performance.now() - t0, fehler: `${e.name}: ${e.message}` };
  }
}

/** Base64 -> Bytes. Bewusst ohne fetch(data:...), damit eine spaetere
    Sicherheitsrichtlinie (connect-src) nicht hineinfunkt. */
function base64Bytes(text) {
  const roh = atob(text);
  const bytes = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
  return bytes;
}


/* ======================================================================
   (G) M16 Mobil-Paket einlesen und M17 Probe-Datei einlesen

   EIN Eingang fuer alle drei Wege (Dateiauswahl, Teilen, Oeffnen mit):
   Die Datei wird gelesen, als JSON zerlegt und nach ihrem Feld "format"
   weitergereicht - ein Mobil-Paket an M16, eine Probe-Datei an M17.
   ====================================================================== */

const WEG_PUNKT = { Dateiauswahl: 'A', Teilen: 'B', 'Oeffnen mit': 'C' };

async function dateiEinlesen(datei, weg) {
  const kennung = WEG_PUNKT[weg] || '';
  const t0 = performance.now();
  let text;
  try {
    text = await datei.text();
  } catch (e) {
    return log('M16' + kennung, `${weg}: Datei nicht lesbar - ${e.name}: ${e.message}`);
  }
  const lesen = performance.now() - t0;
  const t1 = performance.now();
  let inhalt;
  try {
    inhalt = JSON.parse(text);
  } catch (e) {
    return log('M16' + kennung, `${weg}: Datei mit ${datei.size} Bytes ist kein gueltiges JSON (${e.name}).`);
  }
  const zerlegen = performance.now() - t1;
  text = null;   // Speicher freigeben - der Text kann viele MB gross sein
  const zeiten = { lesen, zerlegen, groesse: datei.size };
  const format = inhalt && typeof inhalt === 'object' ? inhalt.format : null;
  if (format === 'playlister_mobilpaket') return paketMessen(inhalt, zeiten, weg);
  if (format === 'jukedecker_kernprobe') return probeEinlesen(inhalt, zeiten, weg);
  // Das unbekannte Format selbst wird NICHT notiert - es koennte etwas
  // Persoenliches sein.
  log('M16' + kennung, `${weg}: Datei mit ${datei.size} Bytes hat ein unbekanntes Format (weder Mobil-Paket noch Probe-Datei).`);
}

/** M16A/B/C: Ein echtes Mobil-Paket pruefen, in IndexedDB schreiben und
    NUR Zahlen protokollieren. */
async function paketMessen(paket, zeiten, weg) {
  const punkt = 'M16' + (WEG_PUNKT[weg] || '');
  log(punkt, `Mobil-Paket angekommen ueber ${weg}: ${zeiten.groesse} Bytes (${mb(zeiten.groesse)}), Lesezeit ${ms(zeiten.lesen)}, JSON-Zerlegen ${ms(zeiten.zerlegen)}. ${umgebungText()}`);
  if (paket.version !== 1) log(punkt, `Hinweis: Paketversion ist nicht 1 - die Messseite kennt nur Version 1.`);
  const playlisten = Array.isArray(paket.playlisten) ? paket.playlisten : [];
  const cover = paket.cover && typeof paket.cover === 'object' ? paket.cover : {};

  // (1) Testvektor: Rechnet diese Seite die Pruefsumme genauso wie der PC?
  const tv = await testvektorPruefen();
  log(punkt, `Pruefsummen-Testvektor: ${tv.ok ? 'bestanden' : 'NICHT bestanden'} (${ms(tv.ms)})${tv.fehler ? ' - ' + tv.fehler : ''}`);

  // (2) Pruefsumme des Pakets
  const t0 = performance.now();
  let pruefsummeOk = false;
  let kanonischBytes = null;
  try {
    const grundlage = { playlisten: paket.playlisten, cover: paket.cover };
    if ('jukeboxer' in paket) grundlage.jukeboxer = paket.jukeboxer;
    const zeichen = kanonisch(grundlage);
    kanonischBytes = utf8Bytes(zeichen);
    pruefsummeOk = (await sha256(zeichen)) === paket.pruefsumme;
    log(punkt, `Pruefsumme des Pakets ${pruefsummeOk ? 'stimmt' : 'stimmt NICHT'} (kanonische Form ${kanonischBytes} Bytes, Pruefzeit ${ms(performance.now() - t0)}).`);
  } catch (e) {
    log(punkt, `Pruefsumme nicht berechenbar: ${e.name}: ${e.message}`);
  }

  // (3) Zahlen zum Inhalt (keine Namen!)
  const titelAnzahl = playlisten.reduce((summe, pl) => summe + (Array.isArray(pl.titel) ? pl.titel.length : 0), 0);
  const ohneCover = playlisten.reduce((summe, pl) => summe + (Array.isArray(pl.titel) ? pl.titel.filter(t => !t.cover).length : 0), 0);
  const jb = paket.jukeboxer;
  const belegteKnoepfe = jb && Array.isArray(jb.genres) ? jb.genres.filter(g => g && g.playlist).length : 0;
  log(punkt, `Inhalt: ${playlisten.length} Playlisten, ${titelAnzahl} Titel (davon ${ohneCover} ohne Cover), ${Object.keys(cover).length} Cover, Jukeboxer-Block: ${jaNein(jb)}${jb ? ` (${belegteKnoepfe} Genre-Knoepfe belegt)` : ''}.`);

  // (4) In IndexedDB schreiben - so, wie es die App spaeter tun wird:
  // Playlisten als Datensaetze, Cover als Bild-Blobs (nicht als Base64).
  const vorher = await speicherSchaetzung();
  const t1 = performance.now();
  let coverBytes = 0;
  let coverFehler = 0;
  try {
    const coverDatensaetze = [];
    for (const [schluessel, c] of Object.entries(cover)) {
      try {
        const bytes = base64Bytes(c.daten);
        coverBytes += bytes.length;
        coverDatensaetze.push({ schluessel, bild: new Blob([bytes], { type: c.mime || 'image/jpeg' }) });
      } catch (e) {
        coverFehler += 1;
      }
    }
    const tUmwandeln = performance.now() - t1;
    const t2 = performance.now();
    await dbTransaktion(['paket_playlisten', 'paket_cover', 'paket_info'], 'readwrite', tx => {
      tx.objectStore('paket_playlisten').clear();
      tx.objectStore('paket_cover').clear();
      playlisten.forEach((pl, nr) => tx.objectStore('paket_playlisten').put({ nr, daten: pl }));
      coverDatensaetze.forEach(d => tx.objectStore('paket_cover').put(d));
      if (jb) tx.objectStore('paket_info').put({ name: 'jukeboxer', daten: jb });
      tx.objectStore('paket_info').put({
        name: 'paket', eingelesen: new Date().toISOString(), weg, bytes: zeiten.groesse,
        playlisten: playlisten.length, titel: titelAnzahl, cover: coverDatensaetze.length, pruefsummeOk,
      });
    });
    const tSchreiben = performance.now() - t2;
    const nachher = await speicherSchaetzung();
    log(punkt, `In IndexedDB geschrieben: ${playlisten.length} Playlisten, ${coverDatensaetze.length} Cover (${mb(coverBytes)} Bilddaten${coverFehler ? `, ${coverFehler} Cover NICHT dekodierbar` : ''}). Base64 umwandeln ${ms(tUmwandeln)}, Schreiben ${ms(tSchreiben)}.`);
    if (vorher && nachher) {
      log(punkt, `Speicher: vorher ${mb(vorher.usage)}, nachher ${mb(nachher.usage)} (Zuwachs ${mb(nachher.usage - vorher.usage)}), verfuegbar ${mb(nachher.quota)}.`);
    } else {
      log(punkt, 'Speicher-Schaetzung (navigator.storage.estimate) nicht verfuegbar.');
    }
    log(punkt, `Gesamtzeit vom Lesen bis gespeichert: ${ms(zeiten.lesen + zeiten.zerlegen + (performance.now() - t0))}. Jetzt M16D: Flugmodus an, App neu oeffnen, "Cover aus Speicher anzeigen".`);
  } catch (e) {
    log(punkt, `In IndexedDB schreiben: FEHLER ${e.name}: ${e.message}`);
  }
}

/** M17A/B: Probe-Datei pruefen und den Code in IndexedDB ablegen. Die
    Pruefsumme folgt denselben Regeln wie beim Mobil-Paket, Grundlage ist
    {kern, stand}. */
async function probeEinlesen(probe, zeiten, weg) {
  log('M17', `Probe-Datei angekommen ueber ${weg}: ${zeiten.groesse} Bytes, Lesezeit ${ms(zeiten.lesen)}, JSON-Zerlegen ${ms(zeiten.zerlegen)}.`);
  const kern = probe.kern;
  if (probe.version !== 1 || !kern || typeof kern.skript !== 'string' || typeof kern.modul !== 'string' || typeof kern.stil !== 'string') {
    return log('M17', 'Probe-Datei hat nicht die erwartete Form (version 1, kern.skript/modul/stil) - verworfen.');
  }
  const t0 = performance.now();
  let ok = false;
  try {
    ok = (await sha256(kanonisch({ kern, stand: probe.stand }))) === probe.pruefsumme;
  } catch (e) {
    return log('M17', `Pruefsumme nicht berechenbar: ${e.name}: ${e.message}`);
  }
  const pruefzeit = performance.now() - t0;
  if (!ok) return log('M17', `Pruefsumme der Probe-Datei stimmt NICHT (${ms(pruefzeit)}) - verworfen, nichts gespeichert.`);
  const t1 = performance.now();
  try {
    await dbSchreiben('kern', { name: 'probe', stand: probe.stand, kern, eingelesen: new Date().toISOString() });
  } catch (e) {
    return log('M17', `In IndexedDB schreiben: FEHLER ${e.name}: ${e.message}`);
  }
  log('M17', `Pruefsumme stimmt (${ms(pruefzeit)}). Code abgelegt in ${ms(performance.now() - t1)}: Stand ${probe.stand}, Skript ${utf8Bytes(kern.skript)} Bytes, Modul ${utf8Bytes(kern.modul)} Bytes, Stil ${utf8Bytes(kern.stil)} Bytes. Jetzt M17C1 und M17C2.`);
}

/** M16D: Cover aus dem Geraetespeicher anzeigen (Blob-Adressen). */
let coverAdressen = [];
async function coverAnzeigen() {
  const galerie = $('galerie');
  coverAdressen.forEach(url => URL.revokeObjectURL(url));
  coverAdressen = [];
  galerie.textContent = '';
  const t0 = performance.now();
  let alle;
  try {
    alle = await dbAlle('paket_cover');
  } catch (e) {
    return log('M16D', `Cover lesen: FEHLER ${e.name}: ${e.message}`);
  }
  if (!alle.length) return log('M16D', 'Kein Paket im Speicher - erst M16A (Paket auswaehlen).');
  const lesen = performance.now() - t0;
  // Auf dem Bildschirm hoechstens 400 Bilder (die Seite soll bedienbar
  // bleiben). Geprueft werden ALLE: Jedes Bild wird dekodiert.
  const ZEIGEN_MAX = 400;
  let ok = 0;
  let kaputt = 0;
  const t1 = performance.now();
  await Promise.all(alle.map(async (eintrag, i) => {
    const url = URL.createObjectURL(eintrag.bild);
    coverAdressen.push(url);
    const bild = new Image();
    bild.alt = '';
    bild.src = url;
    if (i < ZEIGEN_MAX) galerie.append(bild);
    try {
      await Promise.race([bild.decode(), warte(10000).then(() => { throw new Error('Zeit'); })]);
      ok += 1;
    } catch (e) {
      kaputt += 1;
    }
  }));
  log('M16D', `Cover aus dem Geraetespeicher: ${ok} von ${alle.length} angezeigt${kaputt ? `, ${kaputt} NICHT anzeigbar` : ''}. Lesen ${ms(lesen)}, Dekodieren ${ms(performance.now() - t1)}. ${umgebungText()}.`);
  if (navigator.onLine) log('M16D', 'Hinweis: Der Browser meldet Netz - fuer M16D bitte im Flugmodus wiederholen.');
}

/** M16B: Kam die Seite ueber "Teilen" (share_target)? Der Service Worker
    hat die Datei dann im Speicher GETEILT_SPEICHER abgelegt. */
async function geteiltesAbholen() {
  const adresse = new URL(location.href);
  if (!adresse.searchParams.has('geteilt')) return;
  // Die Adresse sofort bereinigen, damit ein Neuladen nicht erneut einliest.
  adresse.searchParams.delete('geteilt');
  history.replaceState(null, '', adresse.pathname + adresse.search);
  try {
    const speicher = await caches.open(GETEILT_SPEICHER);
    const angabenAntwort = await speicher.match('geteilt/angaben');
    const angaben = angabenAntwort ? await angabenAntwort.json() : null;
    if (!angaben) return log('M16B', 'Seite ueber "Teilen" geoeffnet, aber der Service Worker hat nichts abgelegt.');
    if (angaben.fehler) return log('M16B', `Teilen kam an, aber das Formular war nicht lesbar: ${angaben.fehler}`);
    log('M16B', `Teilen kam an: ${angaben.dateien} Datei(en), ${angaben.groesse} Bytes, Typ "${angaben.typ}", Begleittexte (Laenge): Titel ${angaben.laenge_titel}, Text ${angaben.laenge_text}, Adresse ${angaben.laenge_adresse}.`);
    const dateiAntwort = await speicher.match('geteilt/datei');
    await speicher.delete('geteilt/datei');
    await speicher.delete('geteilt/angaben');
    if (!dateiAntwort) return;
    const blob = await dateiAntwort.blob();
    await dateiEinlesen(new File([blob], 'geteilt.json', { type: blob.type }), 'Teilen');
  } catch (e) {
    log('M16B', `Geteilte Datei abholen: FEHLER ${e.name}: ${e.message}`);
  }
}

/** M16C: "Oeffnen mit" (file_handlers). Chrome reicht die Datei ueber
    launchQueue herein - falls der Browser das kann. */
function oeffnenMitBeobachten() {
  const vorhanden = 'launchQueue' in window;
  log('M16C', `Schnittstelle fuer "Oeffnen mit" (launchQueue) vorhanden: ${jaNein(vorhanden)}${new URL(location.href).searchParams.has('geoeffnet') ? ', Seite wurde ueber "Oeffnen mit" gestartet' : ''}`);
  if (!vorhanden) return;
  window.launchQueue.setConsumer(async parameter => {
    const dateien = parameter && parameter.files ? parameter.files : [];
    if (!dateien.length) return;
    log('M16C', `"Oeffnen mit" lieferte ${dateien.length} Datei(en).`);
    try {
      const datei = await dateien[0].getFile();
      await dateiEinlesen(datei, 'Oeffnen mit');
    } catch (e) {
      log('M16C', `Datei aus "Oeffnen mit" nicht lesbar: ${e.name}: ${e.message}`);
    }
  });
}


/* ======================================================================
   (H) M17 Code aus dem Geraetespeicher starten

   Zwei Wege, beide mit Blob-Adressen (blob:https://jukedecker.github.io/…):
   (1) 'skript': <script src="blob:…">. Der Code meldet sich ueber
       window.KernProbeAnmeldung({ art, stand, starten }) zurueck.
   (2) 'modul':  import("blob:…"). Das Modul exportiert stand und starten.
   Der Stil kommt in beiden Faellen als <link rel="stylesheet" href="blob:…">.
   ====================================================================== */

const probeAufraeumen = [];

function probeBeenden() {
  while (probeAufraeumen.length) {
    try { probeAufraeumen.pop()(); } catch (e) { /* egal */ }
  }
  $('kern-flaeche').textContent = '';
}

async function probeStarten(art) {
  probeBeenden();
  const t0 = performance.now();
  let eintrag;
  try {
    eintrag = await dbLesen('kern', 'probe');
  } catch (e) {
    return log('M17', `Weg ${art}: Geraetespeicher nicht lesbar - ${e.name}: ${e.message}`);
  }
  if (!eintrag) return log('M17', `Weg ${art}: Keine Probe im Geraetespeicher - erst die Probe-Datei auswaehlen. ${umgebungText()}`);
  const tSpeicher = performance.now() - t0;

  // Stil aus dem Speicher
  const stilAdresse = URL.createObjectURL(new Blob([eintrag.kern.stil], { type: 'text/css' }));
  const verweis = document.createElement('link');
  verweis.rel = 'stylesheet';
  verweis.href = stilAdresse;
  const stilGeladen = await new Promise(ok => {
    verweis.onload = () => ok('ja');
    verweis.onerror = () => ok('NEIN (Fehler)');
    setTimeout(() => ok('keine Rueckmeldung in 5 s'), 5000);
    document.head.append(verweis);
  });
  probeAufraeumen.push(() => { verweis.remove(); URL.revokeObjectURL(stilAdresse); });

  // Code aus dem Speicher
  let anmeldung;
  try {
    if (art === 'skript') {
      const adresse = URL.createObjectURL(new Blob([eintrag.kern.skript], { type: 'text/javascript' }));
      const skript = document.createElement('script');
      anmeldung = await new Promise((ok, fehler) => {
        window.KernProbeAnmeldung = ok;
        skript.onerror = () => fehler(new Error('Skript liess sich nicht laden (onerror)'));
        setTimeout(() => fehler(new Error('Skript meldete sich nicht in 5 s')), 5000);
        skript.src = adresse;
        document.head.append(skript);
      });
      probeAufraeumen.push(() => { skript.remove(); URL.revokeObjectURL(adresse); delete window.KernProbeAnmeldung; });
    } else {
      const adresse = URL.createObjectURL(new Blob([eintrag.kern.modul], { type: 'text/javascript' }));
      const modul = await import(adresse);
      anmeldung = { art: 'modul', stand: modul.stand, starten: modul.starten };
      probeAufraeumen.push(() => URL.revokeObjectURL(adresse));
    }
  } catch (e) {
    return log('M17', `Weg ${art}: FEHLER beim Laden - ${e.name}: ${e.message}. ${umgebungText()}`);
  }
  const tLaden = performance.now() - t0;
  log('M17', `Weg ${art}: Code geladen und angemeldet in ${ms(tLaden)} (davon Geraetespeicher ${ms(tSpeicher)}), Stil geladen: ${stilGeladen}, Stand im Code ${anmeldung.stand} (abgelegt ${eintrag.stand}: ${jaNein(anmeldung.stand === eintrag.stand)}). ${umgebungText()}`);

  // Die Schnittstelle, die der Probe-Code bekommt.
  const api = {
    flaeche: $('kern-flaeche'),
    log: text => log('M17', `Probe meldet: ${text}`),
    async titelSpielen(sekunden) {
      const titel = (await testliste()).titel[0];
      try { await Spieler.anlegen(titel.video_id); } catch (e) { return { ok: false, text: `Player nicht nutzbar: ${e.message}` }; }
      const r = await titelSpielen(titel, sekunden, 'M17');
      Spieler.stoppen();
      return r;
    },
  };
  try {
    const ergebnis = await anmeldung.starten(api);
    log('M17', `Weg ${art}: ERGEBNIS - Code lief: ja, Stil wirkt: ${jaNein(ergebnis && ergebnis.stilWirkt)}, Wiedergabe: ${jaNein(ergebnis && ergebnis.wiedergabe)}.`);
  } catch (e) {
    log('M17', `Weg ${art}: Code startete, brach dann ab - ${e.name}: ${e.message}`);
  }
}


/* ======================================================================
   (I) M18 Zwei unsichtbare Player A/B (wie der Jukeboxer am PC)
   ====================================================================== */

const Doppel = {
  slots: {
    A: { p: null, zustand: null, fehler: null },
    B: { p: null, zustand: null, fehler: null },
  },
  laeuft: false,

  async anlegen() {
    await youtubeLaden();
    for (const name of ['A', 'B']) {
      const s = this.slots[name];
      if (s.p) continue;
      // Eigenes Kind-Element: YT.Player ersetzt das Ziel durch das iframe.
      const ziel = document.createElement('div');
      $('doppel-ablage').appendChild(ziel);
      await new Promise((ok, fehler) => {
        const uhr = setTimeout(() => fehler(new Error(`Player ${name} meldete sich nicht in 15 s bereit`)), 15000);
        const p = new YT.Player(ziel, {
          width: '200', height: '113',
          playerVars: { autoplay: 0, playsinline: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3 },
          events: {
            onReady: () => { clearTimeout(uhr); s.p = p; ok(); },
            onStateChange: e => { s.zustand = e.data; },
            onError: e => { s.fehler = e.data; },
          },
        });
      });
    }
  },

  wert(name, funktion) { try { return this.slots[name].p[funktion](); } catch (e) { return null; } },
  zustandText(name) { const n = this.wert(name, 'getPlayerState'); return ZUSTAND[n] ?? String(n); },
  stoppen() { for (const name of ['A', 'B']) { try { this.slots[name].p.stopVideo(); } catch (e) { /* kein Player */ } } this.laeuft = false; },

  laden(name, videoId, lautstaerke) {
    const s = this.slots[name];
    s.zustand = null;
    s.fehler = null;
    s.p.setVolume(lautstaerke);
    s.p.loadVideoById(videoId);
  },

  momentaufnahme() {
    const teil = name => `${name}: ${this.zustandText(name)}, Pos ${runde(this.wert(name, 'getCurrentTime'))} s, Lautstaerke ${this.wert(name, 'getVolume')}, stumm ${jaNein(this.wert(name, 'isMuted'))}`;
    return `${teil('A')} | ${teil('B')}`;
  },
};

async function ueberblendungMessen() {
  Spieler.stoppen();
  const liste = (await testliste()).titel;
  const titelA = liste[1];   // langer Titel (406 s)
  const titelB = liste[0];
  try { await Doppel.anlegen(); } catch (e) { return log('M18', `Player A/B nicht nutzbar: ${e.message}`); }
  Doppel.laeuft = true;
  const A = Doppel.slots.A;
  const B = Doppel.slots.B;
  log('M18', `Start. ${umgebungText()}. Player A und B angelegt (unsichtbar, 1 x 1 Pixel).`);

  // (18A) A spielt
  const t0 = Date.now();
  Doppel.laden('A', titelA.video_id, 100);
  if (!await warteBis(() => A.zustand === 1 || A.fehler != null, 15000) || A.fehler != null) {
    const zusatz = await werbungsZusatz(A.p);
    Doppel.stoppen();
    return log('M18', `Player A startete nicht: ${A.fehler != null ? fehlerText(A.fehler) : 'Zustand ' + Doppel.zustandText('A')}${zusatz}. Bei Werbung M18 einfach wiederholen.`);
  }
  log('M18', `A laeuft nach ${Date.now() - t0} ms.`);
  const dauerA = Doppel.wert('A', 'getDuration') || titelA.dauer_sekunden;
  A.p.seekTo(Math.max(0, dauerA - 16), true);
  $('grosse-anzeige').textContent = 'M18: A spielt …';
  await warteBis(() => (Doppel.wert('A', 'getCurrentTime') || 0) >= dauerA - 10.2 || !Doppel.laeuft, 20000, 100);
  if (!Doppel.laeuft) return log('M18', 'Abgebrochen.');

  // (18B) 10 s vor dem Ende: B startet mit Lautstaerke 0 - OHNE Antippen
  const aktivierung = navigator.userActivation ? `Nutzergeste gerade aktiv: ${jaNein(navigator.userActivation.isActive)}` : 'Nutzergeste: ?';
  const tB = Date.now();
  Doppel.laden('B', titelB.video_id, 0);
  const bKam = await warteBis(() => B.zustand === 1 || B.fehler != null, 8000, 100);
  const bZusatz = bKam && B.zustand === 1 ? '' : await werbungsZusatz(B.p);
  log('M18', `M18D1 B gestartet ohne Antippen: ${jaNein(bKam && B.zustand === 1)} nach ${Date.now() - tB} ms (${aktivierung})${B.fehler != null ? ', ' + fehlerText(B.fehler) : ''}${bZusatz}. ${Doppel.momentaufnahme()}`);

  // (18C) 6 s Ueberblendung: A 100 -> 0, B 0 -> 100
  const posA0 = Doppel.wert('A', 'getCurrentTime');
  const posB0 = Doppel.wert('B', 'getCurrentTime');
  const DAUER = 6000;
  const start = Date.now();
  let mitteNotiert = false;
  $('grosse-anzeige').textContent = 'M18: Überblendung …';
  while (Doppel.laeuft) {
    const anteil = Math.min(1, (Date.now() - start) / DAUER);
    try { A.p.setVolume(Math.round(100 * (1 - anteil))); B.p.setVolume(Math.round(100 * anteil)); } catch (e) { /* weiter */ }
    if (!mitteNotiert && anteil >= 0.5) { mitteNotiert = true; log('M18', `Mitte der Ueberblendung: ${Doppel.momentaufnahme()}`); }
    if (anteil >= 1) break;
    await warte(100);
  }
  await warte(300);
  const posA1 = Doppel.wert('A', 'getCurrentTime');
  const posB1 = Doppel.wert('B', 'getCurrentTime');
  const weiterA = (posA1 ?? 0) - (posA0 ?? 0);
  const weiterB = (posB1 ?? 0) - (posB0 ?? 0);
  const echt = (Date.now() - start) / 1000;
  log('M18', `Ende der Ueberblendung: ${Doppel.momentaufnahme()}`);
  log('M18', `M18D2 Beide gleichzeitig: in ${runde(echt)} s lief A ${runde(weiterA)} s, B ${runde(weiterB)} s weiter -> ${weiterA > echt * 0.6 && weiterB > echt * 0.6 ? 'BEIDE liefen gleichzeitig' : 'NICHT beide gleichzeitig'}.`);
  log('M18', 'M18D3: getVolume zeigt nur den gesetzten Wert, nicht den Ton. Ob die Lautstaerke wirkt, sagt erst das Gehoer: bitte unten bestaetigen (und M18D3 Lautstaerke-Spruenge).');

  // B noch kurz allein weiterspielen lassen, dann aufraeumen
  try { A.p.stopVideo(); } catch (e) { /* egal */ }
  $('grosse-anzeige').textContent = 'M18: B spielt allein …';
  await warte(6000);
  Doppel.stoppen();
  $('grosse-anzeige').textContent = 'M18: fertig – bitte bestätigen, was zu hören war';
  log('M18', 'Fertig. Jetzt bestaetigen, was zu HOEREN war.');
}

async function lautstaerkeSpruengeMessen() {
  Spieler.stoppen();
  const titel = (await testliste()).titel[2];
  try { await Doppel.anlegen(); } catch (e) { return log('M18', `Player nicht nutzbar: ${e.message}`); }
  Doppel.laeuft = true;
  const B = Doppel.slots.B;
  Doppel.laden('B', titel.video_id, 100);
  if (!await warteBis(() => B.zustand === 1 || B.fehler != null, 15000) || B.fehler != null) {
    Doppel.stoppen();
    return log('M18', `Lautstaerke-Spruenge: Player startete nicht (${B.fehler != null ? fehlerText(B.fehler) : Doppel.zustandText('B')})`);
  }
  log('M18', 'M18D3 Lautstaerke-Spruenge: 8 Wechsel zwischen 100 und 10, alle 2,5 s. Bitte hinhoeren.');
  const gelesen = [];
  for (let i = 0; i < 8 && Doppel.laeuft; i++) {
    const wert = i % 2 === 0 ? 10 : 100;
    B.p.setVolume(wert);
    $('grosse-anzeige').textContent = `M18D3: jetzt ${wert === 10 ? 'LEISE (10)' : 'LAUT (100)'}`;
    await warte(2500);
    gelesen.push(`${wert}->${Doppel.wert('B', 'getVolume')}`);
  }
  Doppel.stoppen();
  $('grosse-anzeige').textContent = 'M18D3: fertig – bitte bestätigen';
  log('M18', `M18D3 gesetzt -> gelesen (getVolume): ${gelesen.join(', ')}. Jetzt bestaetigen: Spruenge hoerbar oder nicht.`);
}


/* ======================================================================
   (J) M19 Autoplay-Grenzen
   ====================================================================== */

async function ersterStartMessen() {
  const tKlick = performance.now();
  const aktiv = navigator.userActivation;
  const gesteText = aktiv ? `Nutzergeste beim Antippen aktiv: ${jaNein(aktiv.isActive)}, schon einmal getippt: ${jaNein(aktiv.hasBeenActive)}` : 'Nutzergeste: nicht messbar';
  const vorher = Spieler.objekt ? 'Player gab es schon (nicht der erste Start dieser Sitzung)' : 'erster Player dieser Sitzung';
  const titel = (await testliste()).titel[0];
  try { await Spieler.anlegen(titel.video_id); } catch (e) { return log('M19A', `Player nicht nutzbar: ${e.message}`); }
  const tBefehl = performance.now();
  const r = await titelSpielen(titel, 5, 'M19A');
  Spieler.stoppen();
  log('M19A', `${r.ok ? 'Erster Titel STARTETE' : 'Erster Titel startete NICHT'} - ${r.text}. ${gesteText}, ${vorher}, Zeit seit Seitenstart ${ms(tKlick)}, Antippen bis Abspielbefehl ${ms(tBefehl - tKlick)}.`);
}

async function folgetitelMessen() {
  const liste = (await testliste()).titel;
  const erster = liste[2];   // 186 s
  const zweiter = liste[0];
  try { await Spieler.anlegen(erster.video_id); } catch (e) { return log('M19B', `Player nicht nutzbar: ${e.message}`); }
  Spieler.laden(erster.video_id);
  Spieler.anzeigeAktualisieren(erster);
  if (!await warteBis(() => Spieler.zustand === 1 || Spieler.fehler != null, 15000) || Spieler.fehler != null) {
    return log('M19B', `Erster Titel startete nicht (${Spieler.fehler != null ? fehlerText(Spieler.fehler) : Spieler.zustandText()})${await werbungsZusatz(Spieler.objekt)}. Bei Werbung M19B wiederholen.`);
  }
  const dauer = Spieler.dauer() || erster.dauer_sekunden;
  Spieler.springen(dauer - 25);
  Hintergrund.punkt = 'M19B';
  log('M19B', 'Erster Titel laeuft, 25 s vor dem Ende. JETZT Bildschirm sperren, 60 s warten. Den Folgetitel startet NUR das Ereignis "beendet" - ohne Antippen.');
  $('grosse-anzeige').textContent = 'M19B: JETZT sperren – 60 s warten';
  // Ereignisgesteuert statt mit Zeitgebern: Im Hintergrund drosselt
  // Chrome Zeitgeber, die Player-Ereignisse kommen trotzdem an.
  let endeZeit = null;
  Spieler.beiZustandZusatz = nummer => {
    if (nummer === 0 && endeZeit === null) {
      endeZeit = Date.now();
      const sichtbar = document.visibilityState;
      const geste = navigator.userActivation ? jaNein(navigator.userActivation.isActive) : '?';
      Spieler.laden(zweiter.video_id);
      Spieler.anzeigeAktualisieren(zweiter);
      log('M19B', `Erster Titel beendet, Folgetitel geladen (Seite ${sichtbar === 'visible' ? 'SICHTBAR' : 'UNSICHTBAR'}, Nutzergeste aktiv: ${geste}).`);
    } else if (nummer === 1 && endeZeit !== null) {
      log('M19B', `Folgetitel LAEUFT ${Date.now() - endeZeit} ms nach "beendet", ohne Antippen (Seite ${document.visibilityState === 'visible' ? 'sichtbar' : 'UNSICHTBAR'}).`);
      Spieler.beiZustandZusatz = null;
    }
  };
}

async function pauseFuenfMinutenMessen() {
  const titel = (await testliste()).titel[1];
  try { await Spieler.anlegen(titel.video_id); } catch (e) { return log('M19C', `Player nicht nutzbar: ${e.message}`); }
  const r = await titelSpielen(titel, 5, 'M19C');
  if (!r.ok) return log('M19C', `Titel startete nicht: ${r.text}`);
  Spieler.objekt.pauseVideo();
  // Bildschirm anlassen, sonst misst M19C das Sperren und nicht die Pause.
  let sperre = null;
  try { sperre = await navigator.wakeLock.request('screen'); } catch (e) { /* ohne geht es auch */ }
  log('M19C', `Pausiert. Jetzt 5 Minuten NICHT beruehren (Wake Lock: ${jaNein(sperre)}).`);
  const start = Date.now();
  let warUnsichtbar = false;
  while (Date.now() - start < 300000) {
    if (document.visibilityState !== 'visible') warUnsichtbar = true;
    const rest = Math.ceil((300000 - (Date.now() - start)) / 1000);
    $('grosse-anzeige').textContent = `M19C: nicht berühren – noch ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`;
    await warte(1000);
  }
  const geste = navigator.userActivation ? jaNein(navigator.userActivation.isActive) : '?';
  const vorher = Spieler.zustandText();
  Spieler.objekt.playVideo();
  const lief = await warteBis(() => Spieler.zustand === 1, 10000);
  await warte(3000);
  log('M19C', `Nach ${runde((Date.now() - start) / 1000)} s Pause: "weiter" OHNE Antippen ${lief ? 'STARTETE' : 'startete NICHT'} (vorher "${vorher}", jetzt "${Spieler.zustandText()}", Nutzergeste aktiv: ${geste}${warUnsichtbar ? ', ACHTUNG: Seite war zwischendurch unsichtbar' : ''}).`);
  Spieler.stoppen();
  if (sperre) sperre.release().catch(() => null);
  $('grosse-anzeige').textContent = '';
}


/* ======================================================================
   (K) M20 Spulen per Finger (Fortschrittsbalken wie im Jukeboxer)

   Pointer-Events + touch-action: none. Waehrend des Ziehens wird NUR die
   Anzeige bewegt - gesprungen wird EINMAL beim Loslassen (M20C).
   ====================================================================== */

const Spulen = {
  geste: null,
  uhr: null,

  anteilAus(ereignis) {
    const k = $('spul-leiste').getBoundingClientRect();
    return Math.min(1, Math.max(0, (ereignis.clientX - k.left) / k.width));
  },

  anzeigen(anteil, sekunden, dauer) {
    $('spul-fuellung').style.width = `${anteil * 100}%`;
    $('spul-griff').style.left = `${anteil * 100}%`;
    $('spul-leiste').setAttribute('aria-valuenow', String(Math.round(anteil * 100)));
    const mmss = s => (s == null || isNaN(s)) ? '–' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    $('spul-zeit').textContent = `${mmss(sekunden)} / ${mmss(dauer)} · ${Spieler.zustandText()}`;
  },

  nachfuehren() {
    if (this.geste || !Spieler.objekt) return;
    const dauer = Spieler.dauer();
    const pos = Spieler.position();
    if (dauer > 0) this.anzeigen(pos / dauer, pos, dauer);
  },

  einrichten() {
    const leiste = $('spul-leiste');
    leiste.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (!Spieler.objekt || !(Spieler.dauer() > 0)) { log('M20', 'Erst "M20 Titel laden".'); return; }
      leiste.setPointerCapture(e.pointerId);
      this.geste = {
        id: e.pointerId, typ: e.pointerType, t0: performance.now(), x0: e.clientX,
        bewegungen: 0, weg: 0, gerollt: false, scrollY0: scrollY,
        zustandVorher: Spieler.zustand, seeksVorher: Spieler.seekZaehler, anteil: this.anteilAus(e),
      };
      leiste.classList.add('zieht');
      this.anzeigen(this.geste.anteil, this.geste.anteil * Spieler.dauer(), Spieler.dauer());
    });
    leiste.addEventListener('pointermove', e => {
      const g = this.geste;
      if (!g || e.pointerId !== g.id) return;
      g.bewegungen += 1;
      g.weg = Math.max(g.weg, Math.abs(e.clientX - g.x0));
      g.anteil = this.anteilAus(e);
      this.anzeigen(g.anteil, g.anteil * Spieler.dauer(), Spieler.dauer());
    });
    leiste.addEventListener('pointerup', e => {
      const g = this.geste;
      if (!g || e.pointerId !== g.id) return;
      this.geste = null;
      leiste.classList.remove('zieht');
      const dauer = Spieler.dauer();
      const ziel = g.anteil * dauer;
      Spieler.springen(ziel);
      const art = g.weg < 8 ? 'M20A Antippen' : 'M20B Ziehen';
      const gerollt = Math.round(scrollY - g.scrollY0);
      const gestendauer = performance.now() - g.t0;
      // Kurz warten, bis der Player den Sprung umgesetzt hat.
      setTimeout(() => {
        const nachher = Spieler.zustand;
        let pause = '';
        if (g.zustandVorher === 2) pause = nachher === 2 ? ' -> M20D blieb PAUSIERT (richtig)' : ` -> M20D NICHT pausiert geblieben (jetzt ${ZUSTAND[nachher] ?? nachher})`;
        log('M20', `${art}: ${g.typ}, ${g.bewegungen} Bewegungen, ${Math.round(g.weg)} px, Geste ${ms(gestendauer)}. M20C seekTo-Aufrufe in dieser Geste: ${Spieler.seekZaehler - g.seeksVorher}. Ziel ${runde(ziel)} s, jetzt ${runde(Spieler.position())} s. Seite gerollt: ${g.gerollt || gerollt ? `JA (${gerollt} px)` : 'nein'}. Zustand vorher "${ZUSTAND[g.zustandVorher] ?? g.zustandVorher}", nachher "${ZUSTAND[nachher] ?? nachher}"${pause}.`);
      }, 1500);
    });
    leiste.addEventListener('pointercancel', e => {
      const g = this.geste;
      if (!g || e.pointerId !== g.id) return;
      this.geste = null;
      leiste.classList.remove('zieht');
      log('M20', `Geste ABGEBROCHEN (pointercancel) nach ${g.bewegungen} Bewegungen - der Browser hat die Geste uebernommen (z. B. zum Rollen). Kein Sprung.`);
    });
    addEventListener('scroll', () => { if (this.geste) this.geste.gerollt = true; }, { passive: true });
  },
};


/* ======================================================================
   (L) M21 Darstellung und Leistung: detaillierter Plattenspieler
   (Kopie aus dem PlayLister in plattenspieler/, Rahmenart "rechteck"
   wie im PlayDecker, Perspektive "stark")
   ====================================================================== */

function plattenspielerBauen(deck) {
  const wurzel = document.createElement('div');
  wurzel.className = 'jbx deck-spieler';
  wurzel.dataset.perspektive = 'stark';
  // Derselbe Rohbau wie im PlayLister (templates/index.html, #deck-a-teller).
  wurzel.innerHTML =
    '<div class="jbx-kuppel-glas"><div class="jbx-teller-flaeche"><div class="jbx-teller-box">' +
    '<div class="jbx-teller"></div>' +
    '<div class="jbx-platte-halter"><div class="jbx-platte"><div class="jbx-etikett"><span class="jbx-etikett-text"></span></div></div></div>' +
    '<div class="jbx-tonarm"></div>' +
    '<div class="jbx-tonarm-basis"></div>' +
    '</div></div></div>';
  wurzel.querySelector('.jbx-etikett-text').textContent = `DECK ${deck}`;
  return wurzel;
}

/** Bildrate ueber eine feste Zeit mit requestAnimationFrame messen. */
function bildrateMessen(dauerMs) {
  return new Promise(fertig => {
    const zeiten = [];
    let warUnsichtbar = false;
    const schritt = t => {
      if (document.visibilityState !== 'visible') warUnsichtbar = true;
      zeiten.push(t);
      if (t - zeiten[0] < dauerMs) requestAnimationFrame(schritt);
      else {
        const abstaende = zeiten.slice(1).map((z, i) => z - zeiten[i]).sort((a, b) => a - b);
        const n = abstaende.length;
        fertig({
          bilder: n, sekunden: (zeiten[zeiten.length - 1] - zeiten[0]) / 1000,
          median: abstaende[Math.floor(n / 2)], p95: abstaende[Math.floor(n * 0.95)], laengstes: abstaende[n - 1],
          ueber25: abstaende.filter(a => a > 25).length, ueber50: abstaende.filter(a => a > 50).length, warUnsichtbar,
        });
      }
    };
    requestAnimationFrame(schritt);
  });
}

async function plattenspielerMessen(anzahl) {
  const punkt = anzahl === 1 ? 'M21A' : 'M21B';
  if (!window.PlattenspielerDetail) return log(punkt, 'Baustein PlattenspielerDetail fehlt (plattenspieler/plattenspieler_detail.js nicht geladen).');
  const flaeche = $('plattenspieler-flaeche');
  flaeche.textContent = '';
  flaeche.classList.toggle('zwei', anzahl === 2);
  const wurzeln = [];
  for (const deck of ['A', 'B'].slice(0, anzahl)) {
    const wurzel = plattenspielerBauen(deck);
    flaeche.append(wurzel);
    PlattenspielerDetail.einrichten(wurzel, {
      beiStartStop: () => wurzel.classList.toggle('jbx-pausiert'),
      frontschrift: `PLAYDECKER · DECK ${deck}`,
      rahmen: 'rechteck',
    });
    wurzel.style.setProperty('--fortschritt', '0.35');
    wurzel.querySelector('.jbx-platte').classList.add('jbx-dreht');
    wurzel.querySelector('.jbx-tonarm').classList.add('jbx-auf-platte');
    wurzeln.push(wurzel);
  }
  flaeche.scrollIntoView({ block: 'center' });
  // Kurz Zeit fuer Einpassung und Tonarm-Bewegung, dann messen.
  await warte(1200);
  $('grosse-anzeige').textContent = `${punkt}: messe 10 s – nicht berühren`;
  const r = await bildrateMessen(10000);
  $('grosse-anzeige').textContent = '';
  const fps = r.bilder / r.sekunden;
  const rahmen = wurzeln[0].getBoundingClientRect();
  log(punkt, `${anzahl} Plattenspieler (Perspektive stark): ${r.bilder} Bilder in ${runde(r.sekunden)} s = ${runde(fps)} Bilder/s. Abstand Median ${runde(r.median)} ms, 95 % unter ${runde(r.p95)} ms, laengstes ${runde(r.laengstes)} ms, ueber 25 ms: ${r.ueber25}, ueber 50 ms: ${r.ueber50}.${r.warUnsichtbar ? ' ACHTUNG: Seite war zwischendurch unsichtbar - ungueltig.' : ''}`);
  log(punkt, `Fenster je Plattenspieler ${Math.round(rahmen.width)} x ${Math.round(rahmen.height)} px, Einpassung ${wurzeln.map(w => w.dataset.einpassung).join(' / ')}.`);
  // M21D: Bildschirm und Geraet
  log('M21D', `Bildschirm ${bildschirmText()}, Beruehrungspunkte ${navigator.maxTouchPoints}, Prozessorkerne ${navigator.hardwareConcurrency || '?'}, Arbeitsspeicher ${navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '?'}.`);
}


/* ======================================================================
   (M) Die Messpunkte (Knoepfe)
   ====================================================================== */

let installAufforderung = null;   // gemerktes beforeinstallprompt-Ereignis

const AKTIONEN = {

  // ---- M1 Sicherer Ursprung ---------------------------------------------
  async m1() { await ursprungMessen(); },

  // ---- M2 Service Worker ------------------------------------------------
  async m2() {
    if (!('serviceWorker' in navigator)) return log('M2', 'Service Worker: vom Browser NICHT unterstuetzt');
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return log('M2', 'Service Worker: NICHT registriert (siehe Eintrag beim Seitenstart)');
    let version = '?';
    try { version = (await swFragen({ art: 'version' }, 5000)).version; } catch (e) { version = `keine Antwort (${e.message})`; }
    log('M2', `Service Worker registriert: ja, Bereich ${reg.scope}, aktiv: ${jaNein(reg.active)} (${reg.active ? reg.active.state : '-'}), wartend: ${jaNein(reg.waiting)}, steuert diese Seite: ${jaNein(navigator.serviceWorker.controller)}, Version: ${version}`);
  },

  // ---- M3 Installierbarkeit --------------------------------------------
  async m3() {
    log('M3', `beforeinstallprompt bisher ausgeloest: ${jaNein(installAufforderung)}, Anzeigemodus jetzt: ${anzeigemodus()}`);
  },
  async m3_installieren() {
    if (!installAufforderung) return log('M3', 'Keine Installations-Aufforderung verfuegbar (schon installiert, oder Chrome bietet es nicht an). Alternativ: Chrome-Menue (drei Punkte) -> "Zum Startbildschirm hinzufuegen" / "App installieren".');
    installAufforderung.prompt();
    const wahl = await installAufforderung.userChoice;
    log('M3', `Installations-Dialog: Nutzer waehlte "${wahl.outcome}"`);
    installAufforderung = null;
    $('knopf-installieren').disabled = true;
  },

  // ---- M4 Offline-Start --------------------------------------------------
  async m4() { await offlineStartPruefen('M4'); },

  // ---- M5 / M6 Wiedergabe ------------------------------------------------
  async m5() { await wiedergabeMessen('M5'); },
  async m6() { await wiedergabeMessen('M6'); },

  // ---- M7 Automatischer Titelwechsel ------------------------------------
  async m7() {
    const liste = (await testliste()).titel.slice(0, 3);
    try { await Spieler.anlegen(liste[0].video_id); } catch (e) { return log('M7', `Player nicht nutzbar: ${e.message}`); }
    log('M7', `Start: ${liste.length} Titel, je 5 s vor das Ende gesprungen. Den Wechsel loest NUR das Ereignis "beendet" aus.`);

    // Wie im spaeteren JukeDecker: Kommt "beendet", laedt der Code selbst
    // den naechsten Titel. Die Messung prueft, ob das ohne Zutun klappt.
    let index = 0;
    let endeZeit = null;
    const wechsel = [];
    Spieler.beiZustandZusatz = nummer => {
      if (nummer !== 0) return;
      endeZeit = Date.now();
      index++;
      if (index < liste.length) {
        Spieler.laden(liste[index].video_id);
        Spieler.anzeigeAktualisieren(liste[index]);
      }
    };
    try {
      Spieler.laden(liste[0].video_id);
      Spieler.anzeigeAktualisieren(liste[0]);
      for (let i = 0; i < liste.length; i++) {
        const laeuft = await warteBis(() => index === i && Spieler.zustand === 1, 20000);
        const zusatz = laeuft ? '' : await werbungsZusatz(Spieler.objekt);
        if (i > 0) {
          wechsel.push(laeuft);
          log('M7', `Wechsel ${i} -> ${i + 1}: ${laeuft ? `naechster Titel lief ${Date.now() - endeZeit} ms nach "beendet"` : `NICHT gestartet (Zustand ${Spieler.zustandText()}${Spieler.fehler != null ? ', ' + fehlerText(Spieler.fehler) : ''})${zusatz}`}`);
        } else if (!laeuft) {
          log('M7', `Titel 1 startete nicht (Zustand ${Spieler.zustandText()})${zusatz}. Bei Werbung M7 wiederholen.`);
        }
        if (!laeuft) break;
        const dauer = Spieler.dauer();
        Spieler.springen(Math.max(0, dauer - 5));
        const beendet = await warteBis(() => index > i, 25000);
        if (!beendet) { log('M7', `Titel ${i + 1}: Ereignis "beendet" kam NICHT (Zustand ${Spieler.zustandText()})`); break; }
        if (i === liste.length - 1) log('M7', `Titel ${i + 1}: "beendet" kam (letzter Titel)`);
      }
    } finally {
      Spieler.beiZustandZusatz = null;
    }
    log('M7', `Ergebnis: ${wechsel.filter(Boolean).length} von ${liste.length - 1} Wechseln selbstaendig`);
  },

  // ---- M8A Wake Lock -----------------------------------------------------
  async m8a() {
    if (!('wakeLock' in navigator)) return log('M8A', 'Wake Lock: vom Browser NICHT unterstuetzt');
    try {
      wachsperre = await navigator.wakeLock.request('screen');
      wachsperreGewuenscht = true;
      log('M8A', 'Wake Lock angefordert: ja. Jetzt 3 Minuten NICHTS beruehren.');
      wachsperre.addEventListener('release', () => log('M8A', `Wake Lock wurde freigegeben (Sichtbarkeit: ${document.visibilityState})`));
    } catch (e) {
      return log('M8A', `Wake Lock anfordern: FEHLER ${e.name}: ${e.message}`);
    }
    const start = Date.now();
    while (Date.now() - start < 180000) {
      const rest = Math.ceil((180000 - (Date.now() - start)) / 1000);
      $('grosse-anzeige').textContent = `M8A: nicht berühren – noch ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`;
      await warte(1000);
    }
    $('grosse-anzeige').textContent = 'M8A: fertig – bitte unten bestätigen';
    log('M8A', `3 Minuten vorbei. Wake Lock noch aktiv: ${jaNein(wachsperre && !wachsperre.released)}, Seite sichtbar: ${jaNein(document.visibilityState === 'visible')}, tatsaechlich vergangen: ${runde((Date.now() - start) / 1000)} s`);
  },

  // ---- M8B / M8C Hintergrund --------------------------------------------
  async m8b() { await dauerlaufStarten('M8B', 'Jetzt den Bildschirm von Hand sperren, 60 s warten, entsperren.'); },
  async m8c() { await dauerlaufStarten('M8C', 'Jetzt zu einer anderen App wechseln, 60 s warten, zurueckkommen.'); },

  // ---- M8D Fortsetzen ---------------------------------------------------
  async m8d() {
    if (!Spieler.objekt) return log('M8D', 'Kein Player vorhanden - erst M8B oder M8C ausfuehren');
    const vorher = Spieler.zustandText();
    const posVorher = Spieler.position();
    Spieler.objekt.playVideo();
    const lief = await warteBis(() => Spieler.zustand === 1, 8000);
    await warte(3000);
    log('M8D', `Fortsetzen: vorher "${vorher}" bei ${runde(posVorher)} s -> ${lief ? 'laeuft wieder' : 'laeuft NICHT'}, jetzt "${Spieler.zustandText()}" bei ${runde(Spieler.position())} s`);
    Hintergrund.punkt = null;
  },

  // ---- M9 Geraetespeicher -----------------------------------------------
  async m9() {
    const schaetzung = await speicherSchaetzung();
    log('M9', schaetzung ? `Speicher belegt ${mb(schaetzung.usage)} von verfuegbar ${mb(schaetzung.quota)}` : 'navigator.storage.estimate: nicht verfuegbar');
    if (navigator.storage && navigator.storage.persist) {
      const vorher = await navigator.storage.persisted();
      const ergebnis = await navigator.storage.persist();
      log('M9', `Dauerhafter Speicher: vorher ${vorher}, Anfrage persist() ergab ${ergebnis}`);
    } else {
      log('M9', 'navigator.storage.persist: nicht verfuegbar');
    }
    const liste = await testliste();
    try {
      await dbSchreiben('playlisten', { name: 'testliste', geschrieben: new Date().toISOString(), titel: liste.titel });
      const zurueck = await dbLesen('playlisten', 'testliste');
      log('M9', `Test-Playlist in IndexedDB geschrieben und zurueckgelesen: ${jaNein(zurueck && zurueck.titel.length === liste.titel.length)} (${liste.titel.length} Titel). Jetzt App SCHLIESSEN, neu oeffnen, "M9 noch da?" druecken (M9B), spaeter nach Neustart des Geraets (M9C).`);
    } catch (e) {
      log('M9', `IndexedDB schreiben: FEHLER ${e.name}: ${e.message}`);
    }
  },
  async m9_pruefen() {
    try {
      const eintrag = await dbLesen('playlisten', 'testliste');
      log('M9', `IndexedDB: ${eintrag ? `Test-Playlist VORHANDEN (${eintrag.titel.length} Titel, geschrieben ${eintrag.geschrieben})` : 'Test-Playlist NICHT vorhanden'}. ${umgebungText()}`);
    } catch (e) {
      log('M9', `IndexedDB lesen: FEHLER ${e.name}: ${e.message}`);
    }
  },

  // ---- M11 Media Session -------------------------------------------------
  async m11() {
    if (!('mediaSession' in navigator)) return log('M11', 'Media Session: vom Browser NICHT unterstuetzt');
    const liste = (await testliste()).titel;
    const titel = liste[0];
    try { await Spieler.anlegen(titel.video_id); } catch (e) { return log('M11', `Player nicht nutzbar: ${e.message}`); }
    let index = 0;
    const setzen = t => {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.titel, artist: t.interpret, album: 'JukeDecker-Messung',
        artwork: [{ src: t.bild, sizes: '600x600', type: 'image/jpeg' }],
      });
    };
    setzen(titel);
    const taste = (name, wirkung) => {
      try {
        navigator.mediaSession.setActionHandler(name, () => { log('M11', `Taste "${name}" auf Sperrbildschirm/Benachrichtigung gedrueckt`); wirkung(); });
      } catch (e) { log('M11', `Taste "${name}" nicht unterstuetzt`); }
    };
    taste('play', () => Spieler.objekt.playVideo());
    taste('pause', () => Spieler.objekt.pauseVideo());
    taste('nexttrack', () => { index = (index + 1) % liste.length; setzen(liste[index]); Spieler.laden(liste[index].video_id); });
    taste('previoustrack', () => { index = (index + liste.length - 1) % liste.length; setzen(liste[index]); Spieler.laden(liste[index].video_id); });
    Spieler.laden(titel.video_id);
    Spieler.anzeigeAktualisieren(titel);
    const lief = await warteBis(() => Spieler.zustand === 1, 15000);
    navigator.mediaSession.playbackState = 'playing';
    log('M11', `Anzeige gesetzt ("${titel.interpret} - ${titel.titel}"), Musik laeuft: ${jaNein(lief)}${lief ? '' : await werbungsZusatz(Spieler.objekt)}. Jetzt Sperrbildschirm/Benachrichtigung ansehen und Tasten probieren.`);
  },

  // ---- M16 Mobil-Paket ----------------------------------------------------
  async m16d() { await coverAnzeigen(); },
  async m16_loeschen() {
    if (!confirm('Eingelesenes Paket aus dem Gerätespeicher löschen?')) return;
    try {
      await dbTransaktion(['paket_playlisten', 'paket_cover', 'paket_info'], 'readwrite', tx => {
        ['paket_playlisten', 'paket_cover', 'paket_info'].forEach(n => tx.objectStore(n).clear());
      });
      $('galerie').textContent = '';
      log('M16', 'Eingelesenes Paket aus dem Geraetespeicher geloescht.');
    } catch (e) {
      log('M16', `Loeschen: FEHLER ${e.name}: ${e.message}`);
    }
  },

  // ---- M17 Kern im Paket ---------------------------------------------------
  async m17_skript() { await probeStarten('skript'); },
  async m17_modul() { await probeStarten('modul'); },
  async m17_ende() { probeBeenden(); Spieler.stoppen(); log('M17', 'Probe beendet.'); },

  // ---- M18 Zwei Player ------------------------------------------------------
  async m18() { await ueberblendungMessen(); },
  async m18_lautstaerke() { await lautstaerkeSpruengeMessen(); },

  // ---- M19 Autoplay ----------------------------------------------------------
  async m19a() { await ersterStartMessen(); },
  async m19b() { await folgetitelMessen(); },
  async m19c() { await pauseFuenfMinutenMessen(); },

  // ---- M20 Spulen --------------------------------------------------------------
  async m20_laden() {
    const titel = (await testliste()).titel[1];
    try { await Spieler.anlegen(titel.video_id); } catch (e) { return log('M20', `Player nicht nutzbar: ${e.message}`); }
    Spieler.laden(titel.video_id);
    Spieler.anzeigeAktualisieren(titel);
    const lief = await warteBis(() => Spieler.zustand === 1, 15000);
    if (!Spulen.uhr) Spulen.uhr = setInterval(() => Spulen.nachfuehren(), 250);
    log('M20', `Titel geladen, laeuft: ${jaNein(lief)}${lief ? '' : await werbungsZusatz(Spieler.objekt)}. Jetzt auf den Balken tippen und ziehen.`);
  },
  async m20_pause() {
    if (!Spieler.objekt) return log('M20', 'Erst "M20 Titel laden".');
    if (Spieler.zustand === 1) Spieler.objekt.pauseVideo(); else Spieler.objekt.playVideo();
    await warte(800);
    log('M20', `Pause/Weiter: jetzt "${Spieler.zustandText()}"`);
  },

  // ---- M21 Plattenspieler -------------------------------------------------------
  async m21a() { await plattenspielerMessen(1); },
  async m21b() { await plattenspielerMessen(2); },
  async m21_ende() { $('plattenspieler-flaeche').textContent = ''; },

  // ---- Allgemein ---------------------------------------------------------
  async stopp() {
    Spieler.stoppen();
    Spieler.beiZustandZusatz = null;
    Doppel.stoppen();
    Hintergrund.punkt = null;
    log('INFO', 'Wiedergabe von Hand gestoppt');
  },
  async kopieren() { await protokollKopieren(); },
  async teilen() {
    const text = kopfzeile() + '\n' + Protokoll.eintraege.map(e => Protokoll.zeile(e)).join('\n');
    if (!navigator.share) return meldung('Teilen wird hier nicht unterstuetzt - bitte "Protokoll kopieren".');
    try { await navigator.share({ title: 'JukeDecker-Messprotokoll', text }); meldung('Geteilt.'); }
    catch (e) { meldung(`Teilen abgebrochen (${e.name}).`); }
  },
  async speichern() {
    const text = kopfzeile() + '\n' + Protokoll.eintraege.map(e => Protokoll.zeile(e)).join('\n');
    const datum = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const verweis = document.createElement('a');
    verweis.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    verweis.download = `JukeDecker_Messprotokoll_${(geraet.modell || 'Geraet').replace(/\W+/g, '_')}_${datum}.txt`;
    document.body.append(verweis);
    verweis.click();
    verweis.remove();
    meldung('Datei wird gespeichert (Ordner "Downloads").');
  },
  async loeschen() {
    if (confirm('Protokoll wirklich loeschen? Vorher kopiert?')) { Protokoll.loeschen(); meldung('Protokoll geloescht.'); }
  },
  async aufraeumen() {
    if (!confirm('ALLE Messdaten dieser Seite löschen (Protokoll, eingelesenes Paket, Probe-Code, Offline-Speicher)? Vorher das Protokoll kopiert?')) return;
    Spieler.stoppen();
    Doppel.stoppen();
    meldung(`Aufgeräumt: ${await messdatenLoeschen()}. Jetzt die App deinstallieren.`);
  },
};

/* ---- Bausteine, die mehrere Messpunkte nutzen -------------------------- */

async function ursprungMessen() {
  const netz = await netzPruefen();
  netzMarke(netz);
  log('M1', `Adresse ${location.origin}${location.pathname}, Ursprung passt zu ${ERWARTETER_URSPRUNG}: ${jaNein(location.origin === ERWARTETER_URSPRUNG)}, sicherer Kontext (isSecureContext): ${jaNein(window.isSecureContext)}`);
  // M17F: Gibt die Seite eine Sicherheitsrichtlinie vor?
  const metaCsp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  log('M17F', `Sicherheitsrichtlinie (CSP): im Seitenkopf ${metaCsp ? 'JA' : 'keine'}, vom Server ${netz.erreichbar ? (netz.csp ? `JA: ${netz.csp}` : 'keine') : '? (kein Netz)'}`);
}

async function offlineStartPruefen(punkt) {
  const netz = await netzPruefen();
  netzMarke(netz);
  const nav = performance.getEntriesByType('navigation')[0];
  const gesteuert = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  const ueberSW = nav ? nav.workerStart > 0 : null;
  let urteil;
  if (!netz.erreichbar && gesteuert) urteil = 'Seite kam OHNE Netz aus dem Geraetespeicher -> Offline-Start BELEGT';
  else if (!netz.erreichbar) urteil = 'Kein Netz, aber Seite NICHT vom Service Worker gesteuert -> Offline-Start nicht belegt';
  else urteil = 'Netz ist da -> fuer M4 Flugmodus einschalten und App neu oeffnen';
  log(punkt, `Netz erreichbar (github.io): ${jaNein(netz.erreichbar)}${netz.erreichbar ? ` (${ms(netz.ms)})` : ` (${netz.grund})`}, Internet laut Browser: ${jaNein(navigator.onLine)}, Seite vom Service Worker gesteuert: ${jaNein(gesteuert)}, Seitenaufruf lief ueber Service Worker: ${ueberSW == null ? '?' : jaNein(ueberSW)}, Modus: ${anzeigemodus()}. ${urteil}`);
  log(punkt, await appSpeicherText());
}

/** Wie viele Dateien liegen im App-Speicher der Messseite, und gibt es
    andere Speicher auf demselben Ursprung? Hintergrund: Speicher gilt je
    URSPRUNG, nicht je Pfad. Laege eine zweite App auf demselben Ursprung,
    koennte sie den Offline-Speicher dieser Seite loeschen (so geschehen
    bei der Planung, deshalb hat der JukeDecker eine eigene Organisation).
    Erwartet wird hier: keine anderen Speicher. (Nur Anzahlen, keine
    fremden Inhalte.) */
async function appSpeicherText() {
  if (!('caches' in window)) return 'App-Speicher (Cache Storage): nicht verfuegbar';
  try {
    const namen = await caches.keys();
    const eigene = namen.filter(n => n.startsWith('jd-messung-app-'));
    const fremde = namen.filter(n => !n.startsWith('jd-messung-'));
    let dateien = 0;
    for (const n of eigene) dateien += (await (await caches.open(n)).keys()).length;
    return `App-Speicher der Messseite: ${eigene.length ? `${dateien} Dateien (${eigene.join(', ')})` : 'FEHLT'}; andere Speicher auf diesem Ursprung: ${fremde.length}`;
  } catch (e) {
    return `App-Speicher nicht lesbar: ${e.name}: ${e.message}`;
  }
}

/** Aufraeumen (Anleitung, Abschnitt Aufraeumen): loescht NUR, was die
    Messseite angelegt hat - ihre Datenbank, ihre Caches, ihr Protokoll und
    ihren Service Worker. (Da der JukeDecker einen eigenen Ursprung hat,
    wuerde auch "Website-Daten loeschen" in Chrome nur ihn treffen - dieser
    Knopf geht aber ohne Umweg ueber die Chrome-Einstellungen.) */
async function messdatenLoeschen() {
  const ergebnis = [];
  try {
    await new Promise((ok, fehler) => {
      const anfrage = indexedDB.deleteDatabase(DB_NAME);
      anfrage.onsuccess = ok;
      anfrage.onerror = () => fehler(anfrage.error);
      anfrage.onblocked = ok;   // wird geloescht, sobald die Seite zu ist
    });
    ergebnis.push('Datenbank geloescht');
  } catch (e) { ergebnis.push(`Datenbank: ${e.message}`); }
  try {
    const namen = (await caches.keys()).filter(n => n.startsWith('jd-messung-'));
    await Promise.all(namen.map(n => caches.delete(n)));
    ergebnis.push(`${namen.length} Speicher geloescht`);
  } catch (e) { ergebnis.push(`Speicher: ${e.message}`); }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    // Nur die eigene Registrierung (Bereich = Ordner der Messseite).
    if (reg && new URL(reg.scope).pathname === new URL('./', location.href).pathname) {
      await reg.unregister();
      ergebnis.push('Service Worker abgemeldet');
    }
  } catch (e) { ergebnis.push(`Service Worker: ${e.message}`); }
  Protokoll.loeschen();
  return ergebnis.join(', ');
}

async function dauerlaufStarten(punkt, anweisung) {
  const liste = (await testliste()).titel;
  // Der laengste Titel, damit er waehrend der 60 s nicht von selbst endet.
  const titel = [...liste].sort((a, b) => b.dauer_sekunden - a.dauer_sekunden)[0];
  try { await Spieler.anlegen(titel.video_id); } catch (e) { return log(punkt, `Player nicht nutzbar: ${e.message}`); }
  Spieler.laden(titel.video_id);
  Spieler.anzeigeAktualisieren(titel);
  const lief = await warteBis(() => Spieler.zustand === 1 || Spieler.fehler != null, 15000);
  Hintergrund.punkt = punkt;
  const zusatz = lief && Spieler.zustand === 1 ? '' : await werbungsZusatz(Spieler.objekt);
  log(punkt, `Musik "${titel.titel}" laeuft: ${jaNein(lief && Spieler.zustand === 1)}${Spieler.fehler != null ? ' - ' + fehlerText(Spieler.fehler) : ''}${zusatz}. ${anweisung}`);
  $('grosse-anzeige').textContent = `${punkt}: ${anweisung}`;
}

function meldung(text) {
  $('meldung').textContent = text;
  setTimeout(() => { if ($('meldung').textContent === text) $('meldung').textContent = ''; }, 6000);
}

async function protokollKopieren() {
  const text = kopfzeile() + '\n' + Protokoll.eintraege.map(e => Protokoll.zeile(e)).join('\n');
  // Das Textfeld wird IMMER gezeigt: Klappt das automatische Kopieren
  // nicht, kann man dort von Hand markieren.
  const feld = $('protokoll-text');
  feld.value = text;
  feld.classList.add('sichtbar');
  try {
    await navigator.clipboard.writeText(text);
    return meldung(`Protokoll kopiert (${Protokoll.eintraege.length} Eintraege). Jetzt z. B. in eine Nachricht einfuegen.`);
  } catch (e) { /* Rueckfall */ }
  feld.focus();
  feld.select();
  try {
    if (document.execCommand('copy')) return meldung('Protokoll kopiert (Ersatzweg).');
  } catch (e) { /* Rueckfall */ }
  meldung('Automatisches Kopieren nicht moeglich - Text im Feld unten ist markiert: lange druecken -> Kopieren.');
}


/* ======================================================================
   (N) Seitenstart
   ====================================================================== */

async function serviceWorkerRegistrieren() {
  const marke = $('marke-sw');
  if (!('serviceWorker' in navigator)) {
    marke.textContent = 'Service Worker: nicht unterstuetzt';
    marke.className = 'marke schlecht';
    return log('M2', 'Service Worker: vom Browser NICHT unterstuetzt (unsicherer Ursprung?)');
  }
  try {
    // Relativ: Der Bereich ist damit der Ordner der Messseite.
    const reg = await navigator.serviceWorker.register('sw_messung.js');
    // Auf "bereit" nie endlos warten: Scheitert z. B. das Ablegen der
    // Dateien, wuerde die Seite sonst haengen und M4/M9 nie messen.
    const bereit = await Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      warte(10000).then(() => false),
    ]);
    if (!bereit) {
      const z = w => (w ? w.state : '-');
      marke.textContent = 'Service Worker: nicht bereit';
      marke.className = 'marke warn';
      return log('M2', `Service Worker registriert, aber nach 10 s NICHT bereit (installierend: ${z(reg.installing)}, wartend: ${z(reg.waiting)}, aktiv: ${z(reg.active)})`);
    }
    marke.textContent = 'Service Worker: aktiv';
    marke.className = 'marke gut';
    log('M2', `Service Worker registriert beim Seitenstart: ja (Bereich ${reg.scope}), steuert Seite bereits: ${jaNein(navigator.serviceWorker.controller)}`);
  } catch (e) {
    marke.textContent = 'Service Worker: FEHLER';
    marke.className = 'marke schlecht';
    log('M2', `Service Worker registrieren: FEHLER ${e.name}: ${e.message}`);
  }
}

function knoepfeVerbinden() {
  document.querySelectorAll('button[data-aktion]').forEach(knopf => {
    knopf.addEventListener('click', async () => {
      const aktion = AKTIONEN[knopf.dataset.aktion];
      if (!aktion || knopf.classList.contains('laeuft')) return;
      knopf.classList.add('laeuft');
      try {
        await aktion();
      } catch (fehler) {
        log('FEHLR', `${knopf.dataset.aktion}: ${fehler.name}: ${fehler.message}`);
      } finally {
        knopf.classList.remove('laeuft');
      }
    });
  });
  // Bestaetigungs-Knoepfe: schreiben die Beobachtung des Nutzers ins Protokoll.
  document.querySelectorAll('button.bestaetigung[data-punkt]').forEach(knopf => {
    knopf.addEventListener('click', () => {
      log(knopf.dataset.punkt, 'Nutzer: ' + knopf.dataset.text);
      knopf.classList.add('gemerkt');
      setTimeout(() => knopf.classList.remove('gemerkt'), 1500);
    });
  });
  // Dateiauswahl M16A und M17: derselbe Eingang, das Format entscheidet.
  for (const id of ['paket-datei', 'probe-datei']) {
    $(id).addEventListener('change', async e => {
      const datei = e.target.files && e.target.files[0];
      e.target.value = '';   // dieselbe Datei darf erneut gewaehlt werden
      if (datei) await dateiEinlesen(datei, 'Dateiauswahl');
    });
  }
}

async function start() {
  Protokoll.laden();
  Protokoll.anzeigen();
  knoepfeVerbinden();
  Spulen.einrichten();
  netzMarke();
  if (!navigator.share) $('knopf-teilen').disabled = true;

  $('marke-stand').textContent = 'Stand: ' + SEITENVERSION;
  $('marke-modus').textContent = 'Modus: ' + anzeigemodus();
  const sicher = $('marke-sicher');
  sicher.textContent = 'Sicherer Ursprung: ' + jaNein(window.isSecureContext);
  sicher.className = 'marke ' + (window.isSecureContext ? 'gut' : 'schlecht');

  await geraetErmitteln();
  log('START', `Seite geoeffnet (${SEITENVERSION}). Modus: ${anzeigemodus()}, Geraet: ${geraet.modell}, ${geraet.android}, Chrome ${geraet.chrome}`);

  // Installations-Ereignisse (M3) so frueh wie moeglich abfangen.
  addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installAufforderung = e;
    $('knopf-installieren').disabled = false;
    log('M3', 'beforeinstallprompt ausgeloest: ja (Seite ist installierbar)');
  });
  addEventListener('appinstalled', () => log('M3', 'appinstalled: App wurde installiert'));

  lebenszyklusBeobachten();
  oeffnenMitBeobachten();
  await ursprungMessen();
  await serviceWorkerRegistrieren();
  await offlineStartPruefen('M4');

  // Was liegt von frueheren Aufrufen noch im Geraetespeicher?
  try {
    const eintrag = await dbLesen('playlisten', 'testliste');
    if (eintrag) log('M9', `Beim Start: Test-Playlist aus IndexedDB VORHANDEN (geschrieben ${eintrag.geschrieben})`);
    const paket = await dbLesen('paket_info', 'paket');
    if (paket) log('M16', `Beim Start: eingelesenes Paket VORHANDEN (${paket.playlisten} Playlisten, ${paket.titel} Titel, ${await dbAnzahl('paket_cover')} Cover, eingelesen ${paket.eingelesen})`);
    const probe = await dbLesen('kern', 'probe');
    if (probe) log('M17', `Beim Start: Probe-Code VORHANDEN (Stand ${probe.stand}, eingelesen ${probe.eingelesen})`);
  } catch (e) {
    log('M9', `IndexedDB beim Start nicht lesbar: ${e.name}: ${e.message}`);
  }

  // M16B: Kam die Seite ueber "Teilen"?
  await geteiltesAbholen();
}

start();
