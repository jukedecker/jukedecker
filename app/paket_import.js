/* =========================================================================
   JukeDecker – Paket-Import: Prüfen, Vergleichen, Übernehmen in einem Zug

   WOHER DIE REGELN KOMMEN: Dies ist dieselbe Prüfung wie am PC
   (PlayLister/mobilpaket.py, Funktion pruefen(), und pruefe_mobilpaket.py),
   Zeile für Zeile übertragen. Verbindlich ist Jukebox/Jukeboxer_Datenstruktur.html
   (Fassung 5): Paketversion 1 und 2 werden gelesen, eine höhere abgelehnt.

   ABLAUF:
   (1) dateiLesen(datei, weg)  Datei lesen → JSON → pruefen(). Danach ist
       alles vorbereitet (Cover schon als Bild-Blob), aber NICHTS gespeichert.
   (2) Der Dialog zeigt Prüfung, Inhalt und den Vergleich mit dem Paket auf
       dem Gerät (vergleichen()).
   (3) uebernehmen(ergebnis, …)  in einem Zug:
       Schritt 1 neues Paket vollständig schreiben,
       Schritt 2 umschalten,
       Schritt 3 altes Paket löschen.
       Scheitert Schritt 1 oder 2, gilt das alte Paket unverändert weiter.

   DIE PRÜFSUMME (Datenstruktur, Regel 8) rechnet diese Datei genau wie
   Python nach: kanonische Form, SHA-256. Zwei Testvektoren (Version 1 und
   2) stehen unten fest drin; testvektorenPruefen() rechnet beide nach.

   DATENSCHUTZ: Ins Protokoll kommen nur Zahlen und die Art eines Fehlers,
   nie Playlist-Namen, Titel, der Dateiname oder der Rechnername aus dem
   Paket (quelle.rechner wird nicht einmal gespeichert).
   ========================================================================= */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------
  // (A) Feste Werte – 1 : 1 aus mobilpaket.py und jukeboxer_speicher.py
  // ---------------------------------------------------------------------
  const FORMAT_NAME = 'playlister_mobilpaket';
  const BEKANNTE_VERSIONEN = [1, 2];
  const KOPF_FELDER = {
    1: ['format', 'version', 'erstellt', 'quelle', 'inhalt', 'playlisten', 'cover', 'jukeboxer', 'pruefsumme']
  };
  KOPF_FELDER[2] = KOPF_FELDER[1].concat(['songtexte', 'playdecker']);
  const PLAYDECKER_FELDER = ['design', 'perspektive', 'blendSekunden', 'spielzeit', 'drehungSekunden', 'letztePlaylist'];
  const PLAYDECKER_STANDARD = { design: 'diner-chrom', perspektive: 'stark', blendSekunden: 4, spielzeit: 0, drehungSekunden: 5 };
  const SONGTEXT_FELDER = ['vorhanden', 'zeitmarken', 'text', 'quelle', 'zeilen'];
  const COVER_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  const ANZAHL_GENRES = 10;
  const NAME_MAXLAENGE = 14;
  const SYMBOLE = ['gitarre', 'note', 'herz', 'hut', 'saxofon', 'mikrofon', 'feder',
    'welle', 'kopfhoerer', 'schluessel', 'stern', 'platte'];
  const PERSPEKTIVEN = ['flach', 'leicht', 'stark'];
  const WAHL_WIEDERGABE = {
    reihenfolge: ['reihe', 'zufall'],
    amEnde: ['wiederholen', 'naechstesGenre', 'stoppen'],
    nachSchlange: ['weiter', 'zufall', 'stille']
  };
  const WAHL_EFFEKTE = {
    plattenwechsel: ['schwenken', 'wechsler', 'blende', 'aus'],
    aktivKnopf: ['leuchten', 'pulsieren', 'farbwechsel', 'aus'],
    rueckmeldung: ['aufblitzen', 'blinken', 'aus'],
    neon: ['pulsieren', 'regenbogen', 'ruhig', 'aus'],
    coverWechsel: ['umdrehen', 'blende', 'aus'],
    perspektive: PERSPEKTIVEN
  };
  const TEMPO_WERTE = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const UMDREHUNG_WERTE = Array.from({ length: 17 }, (_, n) => 2 + 0.5 * n);
  const WIEDERGABE_FELDER = ['ueberblenden', 'ueberblendDauer', 'festeSpielzeit', 'reihenfolge',
    'amEnde', 'nachSchlange', 'songtext', 'spultasten'];
  const EFFEKTE_FELDER = ['animationen', 'plattenwechsel', 'tellerDreht', 'tonarm', 'aktivKnopf',
    'rueckmeldung', 'neon', 'coverWechsel', 'tempo', 'umdrehungSekunden', 'design', 'perspektive'];
  const WAHLMODI = ['sofort', 'warteschlange'];
  const DESIGN_STANDARD = 'diner-chrom';

  // Größte Datei, die überhaupt eingelesen wird. Echte Pakete haben wenige
  // MB (gemessen 8 MB in 0,7 s); viel größere Dateien sind sicher keine
  // Pakete und würden das Handy nur lange beschäftigen.
  const GROESSTE_DATEI = 100 * 1024 * 1024;

  /** Kennungen der Designs, die diese App kennt (aus gemeinsam/designs/designs.js). */
  function bekannteDesigns() {
    const liste = global.PlayListerDesigns ? global.PlayListerDesigns.liste.map((d) => d.kennung) : [];
    return new Set(liste.concat([DESIGN_STANDARD]));
  }

  // Kleine Helfer, damit die Prüfungen wie in Python lesbar bleiben.
  const istObjekt = (w) => w !== null && typeof w === 'object' && !Array.isArray(w);
  const istGanzzahl = (w) => typeof w === 'number' && Number.isInteger(w);
  const istZahl = (w) => typeof w === 'number' && Number.isFinite(w);
  const feldnamen = (o) => Object.keys(o).sort();
  const gleicheFelder = (o, felder) => {
    const a = feldnamen(o);
    const b = felder.slice().sort();
    return a.length === b.length && a.every((f, i) => f === b[i]);
  };
  const zeichenAnzahl = (text) => Array.from(text).length;     // wie len() in Python
  const darstellen = (w) => (typeof w === 'string' ? `'${w}'` : JSON.stringify(w));

  // ---------------------------------------------------------------------
  // (B) Prüfsumme: kanonische Form und SHA-256 (Datenstruktur, Regel 8)
  // ---------------------------------------------------------------------

  /**
   * Die kanonische Zeichenkette - genau wie Python
   * json.dumps(…, sort_keys=True, separators=(",", ":"), ensure_ascii=False).
   * Zahlen: JavaScript kennt kein 1.0 (es ist 1) - das entspricht Regel (5).
   * Zeichenketten: JSON.stringify maskiert dieselben Zeichen wie Python.
   */
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
        if (!/^[\x00-\x7f]*$/.test(s)) throw new Error('Schlüssel ist nicht ASCII');
      }
      return '{' + schluessel.map((s) => JSON.stringify(s) + ':' + kanonisch(wert[s])).join(',') + '}';
    }
    throw new Error(`unerwarteter Typ ${typeof wert}`);
  }

  async function sha256(text) {
    const summe = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return 'sha256:' + Array.from(new Uint8Array(summe), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /** Prüfsumme über {playlisten, cover, jukeboxer?, songtexte?, playdecker?}. */
  function pruefsummeBerechnen(paket) {
    const grundlage = { playlisten: paket.playlisten, cover: paket.cover };
    for (const block of ['jukeboxer', 'songtexte', 'playdecker']) {
      if (block in paket) grundlage[block] = paket[block];
    }
    return sha256(kanonisch(grundlage));
  }

  // Die beiden Testvektoren aus PlayLister/mobilpaket_pruefsumme_testvektor.json
  // (Version 1) und …_testvektor_v2.json (Version 2). Erfundene Prüfdaten,
  // keine echten Inhalte. Hier wörtlich übernommen.
  const TESTVEKTOREN = [
  { version: 1, eingabe: {"playlisten": [{"id": "Prüf-Liste_1", "name": "Größe & Übung „Sommer“", "herkunft": "YouTube", "geaendert": "2026-10-08T22:30:00", "titel": [{"video_id": "abcDEF12345", "titel": "Ölfass", "interpret": "Bär", "dauer_sekunden": 1.0, "cover": null, "verfuegbar": true}, {"video_id": "", "titel": "Ohne Kennung", "interpret": "", "dauer_sekunden": 0, "cover": null, "verfuegbar": false}]}], "cover": {}, "jukeboxer": {"wahlmodus": "sofort", "effekte": {"tempo": 1.25, "animationen": true, "neon": "ruhig"}, "genres": [{"nr": 1, "name": "Klassik", "symbol": "schluessel", "playlist": "Prüf-Liste_1"}], "wiedergabe": {"ueberblendDauer": 4.0, "festeSpielzeit": 0}}}, pruefsumme: 'sha256:14cc62f333e7047842c1f571790d066c924b1d9270960be3cd3b5bf7ecce1174' },
  { version: 2, eingabe: {"playlisten": [{"id": "Prüf-Liste_1", "name": "Größe & Übung „Sommer“", "herkunft": "YouTube", "geaendert": "2026-10-08T22:30:00", "titel": [{"video_id": "abcDEF12345", "titel": "Ölfass", "interpret": "Bär", "dauer_sekunden": 1.0, "cover": null, "verfuegbar": true}, {"video_id": "", "titel": "Ohne Kennung", "interpret": "", "dauer_sekunden": 0, "cover": null, "verfuegbar": false}]}], "cover": {}, "jukeboxer": {"wahlmodus": "sofort", "effekte": {"tempo": 1.25, "animationen": true, "neon": "ruhig"}, "genres": [{"nr": 1, "name": "Klassik", "symbol": "schluessel", "playlist": "Prüf-Liste_1"}], "wiedergabe": {"ueberblendDauer": 4.0, "festeSpielzeit": 0}}, "songtexte": {"abcDEF12345": {"vorhanden": true, "zeitmarken": true, "quelle": "Quelle: Prüfverlag", "text": "Öl im Fass\nGrüße „aus“ dem Süden", "zeilen": [{"text": "Öl im Fass", "start": 0}, {"text": "Grüße „aus“ dem Süden", "start": 12.345}, {"text": "", "start": 17.0}, {"text": "Schluss", "start": 0.001}]}}, "playdecker": {"design": "neon-klassik", "perspektive": "leicht", "blendSekunden": 6, "spielzeit": 90, "drehungSekunden": 5.5, "letztePlaylist": {"a": "Prüf-Liste_1", "b": null}}}, pruefsumme: 'sha256:e9d19d9778bef10e4bd41f3d8708c3bde82fb301af8439ff734dd847032f3ea4' },
  ];

  /** Rechnet beide Testvektoren nach. Liefert [{version, ok}] (für Protokoll und Prüfung). */
  async function testvektorenPruefen() {
    const ergebnis = [];
    for (const tv of TESTVEKTOREN) {
      let ok = false;
      try { ok = (await sha256(kanonisch(tv.eingabe))) === tv.pruefsumme; } catch (fehler) { ok = false; }
      ergebnis.push({ version: tv.version, ok });
    }
    return ergebnis;
  }

  // ---------------------------------------------------------------------
  // (C) Prüfbausteine des Jukeboxer-Blocks (jukeboxer_speicher.py)
  // ---------------------------------------------------------------------

  function felderGenau(objekt, erlaubt, pflicht, wo) {
    if (!istObjekt(objekt)) throw new Error(`${wo} muss ein Objekt sein.`);
    const fremd = Object.keys(objekt).filter((f) => !erlaubt.includes(f)).sort();
    if (fremd.length) throw new Error(`${wo}: unbekannte Angabe(n) ${fremd.join(', ')}.`);
    const fehlend = pflicht.filter((f) => !(f in objekt)).sort();
    if (fehlend.length) throw new Error(`${wo}: es fehlt ${fehlend.join(', ')}.`);
  }

  function jaNein(objekt, feld, wo) {
    if (typeof objekt[feld] !== 'boolean') throw new Error(`${wo}: „${feld}“ muss ja oder nein (true/false) sein.`);
  }

  function auswahl(objekt, feld, erlaubt, wo) {
    if (!erlaubt.includes(objekt[feld])) {
      throw new Error(`${wo}: „${feld}“ hat den unbekannten Wert ${darstellen(objekt[feld])} (erlaubt: ${erlaubt.join(', ')}).`);
    }
  }

  function playlistIdPruefen(wert, wo) {
    if (typeof wert !== 'string' || !wert.trim() || zeichenAnzahl(wert) > 200) {
      throw new Error(`${wo}: die Playlist-Angabe ist ungueltig.`);
    }
    if (['/', '\\', '\0', ':'].some((z) => wert.includes(z)) || wert === '.' || wert === '..') {
      throw new Error(`${wo}: die Playlist-Angabe darf keine Pfadzeichen enthalten.`);
    }
  }

  function genresPruefen(genres) {
    if (!Array.isArray(genres) || genres.length !== ANZAHL_GENRES) {
      throw new Error(`Es muessen genau ${ANZAHL_GENRES} Genre-Knoepfe sein.`);
    }
    genres.forEach((knopf, i) => {
      const platz = i + 1;
      const wo = `Genre-Knopf ${platz}`;
      felderGenau(knopf, ['nr', 'name', 'symbol', 'playlist'], ['nr', 'name', 'symbol'], wo);
      if (knopf.nr !== platz || !istGanzzahl(knopf.nr)) throw new Error(`${wo}: die Nummer muss ${platz} sein.`);
      const name = knopf.name;
      if (typeof name !== 'string' || !name.trim()) throw new Error(`${wo}: die Beschriftung darf nicht leer sein.`);
      if (zeichenAnzahl(name) > NAME_MAXLAENGE) {
        throw new Error(`${wo}: die Beschriftung „${name}“ ist laenger als ${NAME_MAXLAENGE} Zeichen.`);
      }
      if (name !== name.trim()) throw new Error(`${wo}: die Beschriftung beginnt oder endet mit Leerzeichen.`);
      if (!SYMBOLE.includes(knopf.symbol)) throw new Error(`${wo}: unbekanntes Symbol ${darstellen(knopf.symbol)}.`);
      if (knopf.playlist !== undefined && knopf.playlist !== null) playlistIdPruefen(knopf.playlist, wo);
    });
  }

  function wiedergabePruefen(wiedergabe) {
    const wo = 'Wiedergabe';
    felderGenau(wiedergabe, WIEDERGABE_FELDER, WIEDERGABE_FELDER, wo);
    ['ueberblenden', 'songtext', 'spultasten'].forEach((f) => jaNein(wiedergabe, f, wo));
    const dauer = wiedergabe.ueberblendDauer;
    if (!istGanzzahl(dauer) || dauer < 0 || dauer > 20) {
      throw new Error('Wiedergabe: die Ueberblenddauer muss 0 bis 20 Sekunden sein.');
    }
    const spielzeit = wiedergabe.festeSpielzeit;
    if (!istGanzzahl(spielzeit) || !(spielzeit === 0 || (spielzeit >= 10 && spielzeit <= 600)) || spielzeit % 10) {
      throw new Error('Wiedergabe: die feste Spielzeit muss 0 (aus) oder 10 bis 600 Sekunden in Zehnerschritten sein.');
    }
    Object.entries(WAHL_WIEDERGABE).forEach(([feld, erlaubt]) => auswahl(wiedergabe, feld, erlaubt, wo));
  }

  /** Lesen ist tolerant: fehlende neuere Felder und unbekannte Designs → Standard (Hinweis). */
  function effekteErgaenzen(effekte) {
    const neu = { ...effekte };
    const hinweise = [];
    if (!('umdrehungSekunden' in neu)) {
      hinweise.push('Feld umdrehungSekunden fehlt (aelteres Paket) - es gilt 5 s.');
      neu.umdrehungSekunden = 5;
    }
    if (!('design' in neu)) {
      hinweise.push(`Feld design fehlt (aelterer Stand) - es gilt „${DESIGN_STANDARD}“.`);
      neu.design = DESIGN_STANDARD;
    } else if (typeof neu.design !== 'string' || !bekannteDesigns().has(neu.design)) {
      hinweise.push(`Design ${darstellen(neu.design)} ist hier unbekannt - es gilt „${DESIGN_STANDARD}“.`);
      neu.design = DESIGN_STANDARD;
    }
    if (!('perspektive' in neu)) {
      hinweise.push('Feld perspektive fehlt (aelterer Stand) - es gilt „stark“.');
      neu.perspektive = 'stark';
    } else if (typeof neu.perspektive !== 'string' || !PERSPEKTIVEN.includes(neu.perspektive)) {
      hinweise.push(`Perspektive ${darstellen(neu.perspektive)} ist hier unbekannt - es gilt „stark“.`);
      neu.perspektive = 'stark';
    }
    return { effekte: neu, hinweise };
  }

  function effektePruefen(effekte) {
    const wo = 'Effekte';
    felderGenau(effekte, EFFEKTE_FELDER, EFFEKTE_FELDER, wo);
    ['animationen', 'tellerDreht', 'tonarm'].forEach((f) => jaNein(effekte, f, wo));
    Object.entries(WAHL_EFFEKTE).forEach(([feld, erlaubt]) => auswahl(effekte, feld, erlaubt, wo));
    if (!istZahl(effekte.tempo) || !TEMPO_WERTE.includes(effekte.tempo)) {
      throw new Error('Effekte: das Tempo muss 0,5 bis 2 in Viertelschritten sein.');
    }
    if (!istZahl(effekte.umdrehungSekunden) || !UMDREHUNG_WERTE.includes(effekte.umdrehungSekunden)) {
      throw new Error('Effekte: die Plattendrehung muss 2 bis 10 Sekunden pro Umdrehung in Halbsekunden-Schritten sein.');
    }
    if (typeof effekte.design !== 'string' || !bekannteDesigns().has(effekte.design)) {
      throw new Error(`Effekte: unbekanntes Design ${darstellen(effekte.design)}.`);
    }
  }

  // ---------------------------------------------------------------------
  // (D) Songtexte und PlayDecker-Block (Version 2)
  // ---------------------------------------------------------------------

  function songtextPruefen(eintrag) {
    if (!istObjekt(eintrag)) return ['ist kein Objekt.'];
    const fehler = [];
    const fremd = Object.keys(eintrag).filter((f) => !SONGTEXT_FELDER.includes(f)).sort();
    if (fremd.length) fehler.push(`unbekannte Felder ${fremd.join(', ')}.`);
    if (eintrag.vorhanden !== true) fehler.push('vorhanden muss true sein (ohne Text kommt kein Eintrag ins Paket).');
    if (typeof eintrag.text !== 'string' || !eintrag.text.trim()) fehler.push('text fehlt oder ist leer.');
    if (typeof eintrag.zeitmarken !== 'boolean') fehler.push('zeitmarken muss true/false sein.');
    if ('quelle' in eintrag && typeof eintrag.quelle !== 'string') fehler.push('quelle muss Text sein.');
    if (eintrag.zeitmarken === true) {
      const zeilen = eintrag.zeilen;
      if (!Array.isArray(zeilen) || !zeilen.length) {
        fehler.push('zeitmarken = true, aber keine zeilen.');
      } else {
        for (let i = 0; i < zeilen.length; i++) {
          const z = zeilen[i];
          if (!istObjekt(z) || !gleicheFelder(z, ['text', 'start']) || typeof z.text !== 'string'
              || !istZahl(z.start) || z.start < 0) {
            fehler.push(`Zeile ${i + 1}: muss genau text und start (Sekunden >= 0) haben.`);
            break;
          }
        }
      }
    } else if ('zeilen' in eintrag) {
      fehler.push('zeilen nur bei zeitmarken = true.');
    }
    return fehler;
  }

  /** PlayDecker-Block lesen (tolerant, Regel 9). Liefert {block, hinweise}, wirft bei ungültigen Werten. */
  function playdeckerPruefen(block, ids) {
    if (!istObjekt(block)) throw new Error('ist kein Objekt.');
    const fremd = Object.keys(block).filter((f) => !PLAYDECKER_FELDER.includes(f)).sort();
    if (fremd.length) throw new Error(`unbekannte Felder ${fremd.join(', ')}.`);
    const hinweise = [];
    const neu = { ...block };
    for (const feld of PLAYDECKER_FELDER) {
      if (!(feld in neu)) {
        hinweise.push(`PlayDecker: Feld ${feld} fehlt - es gilt der Standard.`);
        neu[feld] = feld === 'letztePlaylist' ? { a: null, b: null } : PLAYDECKER_STANDARD[feld];
      }
    }
    if (typeof neu.design !== 'string' || !bekannteDesigns().has(neu.design)) {
      hinweise.push(`PlayDecker: Design ${darstellen(neu.design)} ist hier unbekannt - es gilt „diner-chrom“.`);
      neu.design = DESIGN_STANDARD;
    }
    if (typeof neu.perspektive !== 'string' || !PERSPEKTIVEN.includes(neu.perspektive)) {
      hinweise.push(`PlayDecker: Perspektive ${darstellen(neu.perspektive)} ist hier unbekannt - es gilt „stark“.`);
      neu.perspektive = 'stark';
    }
    if (!istGanzzahl(neu.blendSekunden) || neu.blendSekunden < 0 || neu.blendSekunden > 20) {
      throw new Error('blendSekunden muss eine ganze Zahl von 0 bis 20 sein.');
    }
    if (!istGanzzahl(neu.spielzeit) || neu.spielzeit < 0 || neu.spielzeit > 600 || neu.spielzeit % 10) {
      throw new Error('spielzeit muss 0 (aus) oder 10 bis 600 in Zehnerschritten sein.');
    }
    const d = neu.drehungSekunden;
    if (!istZahl(d) || d < 2 || d > 10 || !Number.isInteger(d * 2)) {
      throw new Error('drehungSekunden muss 2 bis 10 in halben Sekunden sein.');
    }
    const lp = neu.letztePlaylist;
    if (!istObjekt(lp) || !gleicheFelder(lp, ['a', 'b'])) throw new Error('letztePlaylist muss genau a und b haben.');
    for (const deck of ['a', 'b']) {
      const wert = lp[deck];
      if (wert !== null && (typeof wert !== 'string' || !ids.has(wert))) {
        throw new Error(`letztePlaylist.${deck} verweist auf ${darstellen(wert)}, die nicht im Paket ist.`);
      }
    }
    return { block: neu, hinweise };
  }

  // ---------------------------------------------------------------------
  // (E) Cover: Base64 prüfen und gleich in ein Bild (Blob) umwandeln
  // ---------------------------------------------------------------------

  // Gültiges Base64 wie Python b64decode(validate=True): nur das Alphabet,
  // Länge durch 4 teilbar, höchstens zwei „=“ am Ende.
  const BASE64_MUSTER = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

  function base64Bytes(text) {
    const roh = atob(text);
    const bytes = new Uint8Array(roh.length);
    for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
    return bytes;
  }

  /** Bildtyp an den ersten Bytes (wie cover_cache.bildtyp_erkennen) - '' heißt: kein Bild. */
  function bildtypErkennen(b) {
    const text = (von, bis) => String.fromCharCode(...b.slice(von, bis));
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b[0] === 0x89 && text(1, 8) === 'PNG\r\n\x1a\n') return 'image/png';
    if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'image/webp';
    if (text(0, 6) === 'GIF87a' || text(0, 6) === 'GIF89a') return 'image/gif';
    return '';
  }

  // ---------------------------------------------------------------------
  // (F) Prüfen – wie mobilpaket.pruefen()
  // ---------------------------------------------------------------------

  /** Die Gründe für eine Ablehnung im Klartext (Mockup Bild 4). */
  const GRUND = {
    format: 'Das ist kein Paket aus dem PlayLister.',
    version: 'Das Paket ist für eine neuere JukeDecker-Version. Bitte App aktualisieren (App einmal mit Internet öffnen).',
    versionUnbekannt: 'Die Paketversion ist unbekannt. Das ist kein gültiges Paket aus dem PlayLister.',
    pruefsumme: 'Die Datei ist beschädigt (Prüfsumme stimmt nicht).',
    inhalt: 'Das Paket ist fehlerhaft und wird nicht übernommen.',
    speicher: 'Zu wenig Speicher auf dem Gerät.'
  };

  /**
   * Prüft ein eingelesenes Paket. Liefert
   * { ok, art, grund, fehler[], hinweise[], angaben{}, vorbereitet{} }.
   * art: null (gültig) | 'format' | 'version' | 'pruefsumme' | 'inhalt'.
   */
  async function pruefen(paket) {
    const fehler = [];
    const hinweise = [];
    const abgelehnt = (art, grund) => ({ ok: false, art, grund, fehler, hinweise, angaben: {}, vorbereitet: null });

    if (!istObjekt(paket)) {
      fehler.push('Das Paket ist kein JSON-Objekt.');
      return abgelehnt('format', GRUND.format);
    }
    // (1) Format und Version
    if (paket.format !== FORMAT_NAME) {
      fehler.push(`Format ist ${darstellen(paket.format)}, erwartet '${FORMAT_NAME}'.`);
      return abgelehnt('format', GRUND.format);
    }
    const version = paket.version;
    if (typeof version !== 'number' || !BEKANNTE_VERSIONEN.includes(version)) {
      fehler.push(`Version ${darstellen(version)} ist unbekannt (diese Fassung kennt ${BEKANNTE_VERSIONEN.join(' und ')}).`);
      const neuer = istGanzzahl(version) && version > Math.max(...BEKANNTE_VERSIONEN);
      return abgelehnt('version', neuer ? GRUND.version : GRUND.versionUnbekannt);
    }
    for (const feld of ['erstellt', 'quelle', 'inhalt', 'playlisten', 'cover', 'pruefsumme']) {
      if (!(feld in paket)) fehler.push(`Pflichtfeld „${feld}“ fehlt.`);
    }
    const fremd = Object.keys(paket).filter((f) => !KOPF_FELDER[version].includes(f)).sort();
    if (fremd.length) fehler.push(`Unbekannte Felder im Kopf: ${fremd.join(', ')}.`);
    if (fehler.length) return abgelehnt('format', GRUND.format);

    let playlisten = paket.playlisten;
    let cover = paket.cover;
    if (!Array.isArray(playlisten)) { fehler.push('„playlisten“ ist keine Liste.'); playlisten = []; }
    if (!istObjekt(cover)) { fehler.push('„cover“ ist kein Objekt.'); cover = {}; }

    // (2) Prüfsumme
    let pruefsummeOk = false;
    const t0 = performance.now();
    try {
      const erwartet = await pruefsummeBerechnen(paket);
      pruefsummeOk = paket.pruefsumme === erwartet;
      if (!pruefsummeOk) {
        fehler.push(`Pruefsumme stimmt NICHT (Datei: ${paket.pruefsumme}, berechnet: ${erwartet}) - das Paket ist beschaedigt oder veraendert.`);
      }
    } catch (f) {
      fehler.push(`Pruefsumme nicht berechenbar: ${f.message}`);
    }
    const pruefzeit = performance.now() - t0;

    // (3) Playlisten und Titel
    const ids = new Set();
    const benutzteCover = new Set();
    let titelGesamt = 0;
    let ohneCover = 0;
    playlisten.forEach((pl, i) => {
      const wo = `Playlist ${i + 1}`;
      if (!istObjekt(pl)) { fehler.push(`${wo} ist kein Objekt.`); return; }
      const felder = ['id', 'name', 'herkunft', 'geaendert', 'titel'];
      if (!gleicheFelder(pl, felder)) { fehler.push(`${wo}: Felder ${feldnamen(pl).join(', ')} statt ${felder.slice().sort().join(', ')}.`); return; }
      if (typeof pl.id !== 'string' || !pl.id) fehler.push(`${wo}: id fehlt.`);
      else if (ids.has(pl.id)) fehler.push(`${wo}: id ${darstellen(pl.id)} kommt doppelt vor.`);
      ids.add(pl.id);
      if (!Array.isArray(pl.titel)) { fehler.push(`${wo}: titel ist keine Liste.`); return; }
      pl.titel.forEach((t, tn) => {
        const two = `${wo} (${pl.name}), Titel ${tn + 1}`;
        const tfelder = ['video_id', 'titel', 'interpret', 'dauer_sekunden', 'cover', 'verfuegbar'];
        if (!istObjekt(t) || !gleicheFelder(t, tfelder)) { fehler.push(`${two}: Felder stimmen nicht.`); return; }
        titelGesamt += 1;
        if (!istGanzzahl(t.dauer_sekunden) || t.dauer_sekunden < 0) fehler.push(`${two}: dauer_sekunden muss eine ganze Zahl >= 0 sein.`);
        if (typeof t.verfuegbar !== 'boolean') fehler.push(`${two}: verfuegbar muss true/false sein.`);
        if (t.cover === null) ohneCover += 1;
        else if (!(typeof t.cover === 'string' && Object.prototype.hasOwnProperty.call(cover, t.cover))) {
          fehler.push(`${two}: Cover-Verweis ${darstellen(t.cover)} fehlt in „cover“.`);
        } else benutzteCover.add(t.cover);
      });
    });

    // (4) Cover: jedes dekodierbar, ein Bild, und benutzt – dabei gleich als Blob vorbereiten
    let coverBytes = 0;
    const coverVorbereitet = [];
    for (const [schluessel, c] of Object.entries(cover)) {
      const wo = `Cover ${schluessel}`;
      if (!/^[0-9a-f]{16}$/.test(schluessel)) fehler.push(`${wo}: Schluessel ist keine 16-stellige Hex-Kennung.`);
      if (!istObjekt(c) || !gleicheFelder(c, ['mime', 'daten'])) { fehler.push(`${wo}: Felder muessen genau mime und daten sein.`); continue; }
      if (!COVER_MIMES.includes(c.mime)) fehler.push(`${wo}: Bildtyp ${darstellen(c.mime)} nicht erlaubt.`);
      let roh;
      try {
        if (typeof c.daten !== 'string' || !BASE64_MUSTER.test(c.daten)) throw new Error('kein Base64');
        roh = base64Bytes(c.daten);
      } catch (f) {
        fehler.push(`${wo}: Base64 nicht dekodierbar.`);
        continue;
      }
      coverBytes += roh.length;
      const erkannt = bildtypErkennen(roh.subarray(0, 16));
      if (!erkannt) fehler.push(`${wo}: Die Daten sind KEIN Bild.`);
      else if (erkannt !== c.mime) fehler.push(`${wo}: angegeben ${c.mime}, tatsaechlich ${erkannt}.`);
      if (!benutzteCover.has(schluessel)) fehler.push(`${wo}: wird von keinem Titel benutzt.`);
      coverVorbereitet.push({ schluessel, bild: new Blob([roh], { type: c.mime }) });
    }

    // (5) Jukeboxer-Block: Form und Genre-Verweise
    let jukeboxer = null;
    if ('jukeboxer' in paket) {
      const jb = paket.jukeboxer;
      if (!istObjekt(jb) || !gleicheFelder(jb, ['genres', 'wiedergabe', 'effekte', 'wahlmodus'])) {
        fehler.push('Jukeboxer-Block: Felder muessen genau genres, wiedergabe, effekte, wahlmodus sein.');
      } else {
        try {
          genresPruefen(jb.genres);
          wiedergabePruefen(jb.wiedergabe);
          let effekte = jb.effekte;
          if (istObjekt(effekte)) {
            const ergaenzt = effekteErgaenzen(effekte);
            effekte = ergaenzt.effekte;
            hinweise.push(...ergaenzt.hinweise);
          }
          effektePruefen(effekte);
          if (!WAHLMODI.includes(jb.wahlmodus)) throw new Error('unbekannter Wahlmodus.');
          jukeboxer = { genres: jb.genres, wiedergabe: jb.wiedergabe, effekte, wahlmodus: jb.wahlmodus };
        } catch (f) {
          fehler.push(`Jukeboxer-Block: ${f.message}`);
        }
        for (const g of Array.isArray(jb.genres) ? jb.genres : []) {
          if (istObjekt(g) && g.playlist && !ids.has(g.playlist)) {
            fehler.push(`Genre-Knopf ${g.nr} „${g.name}“ verweist auf ${darstellen(g.playlist)}, die nicht im Paket ist.`);
          }
        }
      }
    }

    // (5A) Songtexte (Version 2): nur zu Titeln im Paket, jeder vollständig
    const kennungen = new Set();
    playlisten.forEach((pl) => {
      if (istObjekt(pl) && Array.isArray(pl.titel)) pl.titel.forEach((t) => { if (istObjekt(t) && t.video_id) kennungen.add(t.video_id); });
    });
    let anzahlSongtexte = 0;
    let songtexte = {};
    if ('songtexte' in paket) {
      const st = paket.songtexte;
      if (!istObjekt(st)) {
        fehler.push('„songtexte“ ist kein Objekt.');
      } else {
        anzahlSongtexte = Object.keys(st).length;
        songtexte = st;
        for (const [kennung, eintrag] of Object.entries(st)) {
          if (!kennungen.has(kennung)) fehler.push(`Songtext ${darstellen(kennung)}: gehoert zu keinem Titel im Paket.`);
          songtextPruefen(eintrag).forEach((f) => fehler.push(`Songtext ${darstellen(kennung)}: ${f}`));
        }
      }
    }

    // (5B) PlayDecker-Block (Version 2) – Lesen ist tolerant
    let playdecker = null;
    if ('playdecker' in paket) {
      try {
        const geprueft = playdeckerPruefen(paket.playdecker, ids);
        playdecker = geprueft.block;
        hinweise.push(...geprueft.hinweise);
      } catch (f) {
        fehler.push(`PlayDecker-Block: ${f.message}`);
      }
    }

    // (6) Inhalt-Angaben im Kopf passen zum Inhalt?
    const inhalt = istObjekt(paket.inhalt) ? paket.inhalt : {};
    if (inhalt.playlisten !== playlisten.length) fehler.push(`Kopf nennt ${inhalt.playlisten} Playlisten, enthalten sind ${playlisten.length}.`);
    if (inhalt.titel !== titelGesamt) fehler.push(`Kopf nennt ${inhalt.titel} Titel, enthalten sind ${titelGesamt}.`);
    if (inhalt.cover !== Object.keys(cover).length) fehler.push(`Kopf nennt ${inhalt.cover} Cover, enthalten sind ${Object.keys(cover).length}.`);
    if (version >= 2 && inhalt.songtexte !== anzahlSongtexte) fehler.push(`Kopf nennt ${inhalt.songtexte} Songtexte, enthalten sind ${anzahlSongtexte}.`);
    if (ohneCover) hinweise.push(`${ohneCover} Titel ohne Cover (Ersatzetikett auf dem Geraet).`);

    const genreBelegt = jukeboxer ? jukeboxer.genres.filter((g) => g.playlist).length : 0;
    const angaben = {
      version,
      erstellt: typeof paket.erstellt === 'string' ? paket.erstellt : '',
      playlistenVersion: istObjekt(paket.quelle) && typeof paket.quelle.playlister_version === 'string' ? paket.quelle.playlister_version : '',
      playlisten: playlisten.length,
      titel: titelGesamt,
      cover: Object.keys(cover).length,
      coverBilddaten: coverBytes,
      songtexte: anzahlSongtexte,
      genreBelegt,
      mitJukeboxer: !!jukeboxer,
      mitPlaydecker: !!playdecker,
      pruefsummeOk,
      pruefzeitMs: Math.round(pruefzeit),
      angegebeneBytes: istGanzzahl(inhalt.bytes) ? inhalt.bytes : null
    };

    if (fehler.length) {
      // Reihenfolge der Gründe wie im Mockup: beschädigt vor fehlerhaft.
      return { ok: false, art: pruefsummeOk ? 'inhalt' : 'pruefsumme', grund: pruefsummeOk ? GRUND.inhalt : GRUND.pruefsumme,
        fehler, hinweise, angaben, vorbereitet: null };
    }
    return {
      ok: true, art: null, grund: '', fehler, hinweise, angaben,
      vorbereitet: { playlisten, cover: coverVorbereitet, songtexte, jukeboxer, playdecker }
    };
  }

  // ---------------------------------------------------------------------
  // (G) Datei lesen (Teilen oder Dateiauswahl)
  // ---------------------------------------------------------------------

  /**
   * Liest eine Datei und prüft sie. „datei“ ist ein File oder Blob,
   * „weg“ 'Teilen' oder 'Dateiauswahl', „name“ der angezeigte Dateiname
   * (nur für den Dialog, nie fürs Protokoll).
   */
  async function dateiLesen(datei, weg, name) {
    const zeiten = {};
    const datei_ = { name: name || datei.name || '', groesse: datei.size, typ: datei.type || '' };
    const ergebnisMit = (teil) => ({ weg, datei: datei_, zeiten, ...teil });
    if (datei.size > GROESSTE_DATEI) {
      return ergebnisMit({ ok: false, art: 'format', grund: GRUND.format,
        fehler: [`Die Datei ist ${Math.round(datei.size / 1048576)} MB groß - viel zu groß für ein Paket.`],
        hinweise: [], angaben: {}, vorbereitet: null });
    }
    let t = performance.now();
    let text;
    try {
      text = await datei.text();
    } catch (f) {
      return ergebnisMit({ ok: false, art: 'format', grund: GRUND.format, fehler: [`Datei nicht lesbar: ${f.name}`],
        hinweise: [], angaben: {}, vorbereitet: null });
    }
    zeiten.lesenMs = Math.round(performance.now() - t);
    t = performance.now();
    let paket;
    try {
      paket = JSON.parse(text);
    } catch (f) {
      return ergebnisMit({ ok: false, art: 'format', grund: GRUND.format, fehler: ['Die Datei ist kein gültiges JSON.'],
        hinweise: [], angaben: {}, vorbereitet: null });
    }
    zeiten.zerlegenMs = Math.round(performance.now() - t);
    text = null;   // Speicher freigeben - der Text kann viele MB groß sein
    t = performance.now();
    const geprueft = await pruefen(paket);
    zeiten.pruefenMs = Math.round(performance.now() - t);
    if (geprueft.angaben && geprueft.angaben.angegebeneBytes !== null && geprueft.angaben.angegebeneBytes !== undefined
        && geprueft.angaben.angegebeneBytes !== datei.size) {
      geprueft.hinweise.push(`Kopf nennt ${geprueft.angaben.angegebeneBytes} Bytes, die Datei hat ${datei.size} Bytes.`);
    }
    return ergebnisMit(geprueft);
  }

  // ---------------------------------------------------------------------
  // (H) Vergleich mit dem Gerät und Werte des Geräts
  // ---------------------------------------------------------------------

  /** „2026-11-09T23:18:05+01:00“ → „09.11.2026, 23:18“ (Uhrzeit des PCs, ohne Umrechnung). */
  function datumText(iso) {
    const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(String(iso || ''));
    return m ? `${m[3]}.${m[2]}.${m[1]}, ${m[4]}:${m[5]}` : '–';
  }

  /**
   * Was passiert beim Übernehmen mit dem Gerät? Liefert
   * { erstesPaket, altesPaket (Kopf|null), genreFrage (bool), genreVerlust[] }.
   * Regeln (Datenstruktur, Regel 7; Antwort R3):
   * (1) Gerätewerte (Designs, Perspektiven, Plattendrehung, Überblenddauer,
   *     feste Spielzeit, Effekte, Wiedergabe, Wahlmodus) kommen nur beim
   *     ERSTEN Paket aus dem Paket.
   * (2) Die Genre-Belegung kommt vom PC, solange sie am Gerät nicht von
   *     Hand geändert wurde. Sonst fragt der Dialog (Häkchen, Standard aus).
   */
  function vergleichen(ergebnis, altesPaket, einstellungen) {
    const neueIds = new Set(ergebnis.vorbereitet.playlisten.map((p) => p.id));
    const genreFrage = !!(einstellungen.genresVonHand && ergebnis.vorbereitet.jukeboxer);
    // Welche von Hand belegten Knöpfe würden ohne Übernahme leer, weil ihre
    // Playlist im neuen Paket fehlt?
    const genreVerlust = (einstellungen.genres || [])
      .filter((g) => g && g.playlist && !neueIds.has(g.playlist))
      .map((g) => g.nr);
    return { erstesPaket: !einstellungen.werteAusPaket, altesPaket, genreFrage, genreVerlust };
  }

  /** Die Einstellungen des Geräts nach dem Übernehmen (siehe vergleichen()). */
  function einstellungenNachImport(alte, ergebnis, genreVomPc) {
    const neu = JSON.parse(JSON.stringify(alte));
    const v = ergebnis.vorbereitet;
    const neueIds = new Set(v.playlisten.map((p) => p.id));
    if (!neu.werteAusPaket) {
      const pd = v.playdecker || PLAYDECKER_STANDARD;
      neu.playdecker = {
        design: pd.design, perspektive: pd.perspektive, blendSekunden: pd.blendSekunden,
        spielzeit: pd.spielzeit, drehungSekunden: pd.drehungSekunden
      };
      if (v.jukeboxer) {
        neu.jukeboxer = { wiedergabe: v.jukeboxer.wiedergabe, effekte: v.jukeboxer.effekte, wahlmodus: v.jukeboxer.wahlmodus };
      }
      neu.werteAusPaket = true;
    }
    if (v.jukeboxer && (!neu.genresVonHand || genreVomPc)) {
      neu.genres = JSON.parse(JSON.stringify(v.jukeboxer.genres));
      neu.genresVonHand = false;
    } else if (Array.isArray(neu.genres)) {
      // Von Hand belegt und nicht übernommen: Knöpfe ohne Playlist im neuen
      // Paket werden leer (offen im Dialog gesagt, nicht still).
      neu.genres = neu.genres.map((g) => (g && g.playlist && !neueIds.has(g.playlist) ? { ...g, playlist: null } : g));
    }
    return neu;
  }

  // ---------------------------------------------------------------------
  // (I) Übernehmen in einem Zug
  // ---------------------------------------------------------------------

  /**
   * Schritt 1 neues Paket schreiben → Schritt 2 umschalten (mit den neuen
   * Einstellungen) → Schritt 3 altes löschen. Liefert Zeiten fürs Protokoll.
   * Wirft {art: 'speicher'|'schreiben', grund} - das alte Paket gilt dann weiter.
   */
  async function uebernehmen(ergebnis, alteEinstellungen, genreVomPc) {
    const S = global.JukeDeckerSpeicher;
    const v = ergebnis.vorbereitet;
    const altesPaket = await S.aktivesPaket();
    const kennung = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const zeiten = {};
    const kopf = {
      version: ergebnis.angaben.version,
      erstellt: ergebnis.angaben.erstellt,
      playlisterVersion: ergebnis.angaben.playlistenVersion,
      inhalt: {
        playlisten: ergebnis.angaben.playlisten, titel: ergebnis.angaben.titel,
        cover: ergebnis.angaben.cover, songtexte: ergebnis.angaben.songtexte
      },
      bytes: ergebnis.datei.groesse,
      weg: ergebnis.weg,
      eingelesen: new Date().toISOString(),
      jukeboxer: v.jukeboxer,
      playdecker: v.playdecker
    };
    const fehlerArt = (f) => (f && f.name === 'QuotaExceededError'
      ? { art: 'speicher', grund: GRUND.speicher, technisch: f.name }
      : { art: 'schreiben', grund: `Das Paket konnte nicht gespeichert werden (${f && f.name ? f.name : 'Fehler'}). Das bisherige Paket bleibt.`, technisch: f && f.name });

    let t = performance.now();
    try {
      await S.paketSchreiben(kennung, { kopf, playlisten: v.playlisten, cover: v.cover, songtexte: v.songtexte });
    } catch (f) {
      // Nichts geschrieben (eine Transaktion). Zur Sicherheit trotzdem aufräumen.
      try { await S.paketLoeschen(kennung); } catch (_) { /* egal */ }
      throw fehlerArt(f);
    }
    zeiten.schreibenMs = Math.round(performance.now() - t);

    t = performance.now();
    const neueEinstellungen = einstellungenNachImport(alteEinstellungen, ergebnis, genreVomPc);
    try {
      await S.umschalten(kennung, neueEinstellungen);
    } catch (f) {
      try { await S.paketLoeschen(kennung); } catch (_) { /* egal */ }
      throw fehlerArt(f);
    }
    zeiten.umschaltenMs = Math.round(performance.now() - t);

    t = performance.now();
    let altGeloescht = true;
    if (altesPaket) {
      try {
        await S.paketLoeschen(altesPaket.kennung);
      } catch (f) {
        // Kein Fehler für den Nutzer: Das neue Paket gilt schon. Der Rest
        // wird beim nächsten Start weggeräumt (aufraeumen()).
        altGeloescht = false;
      }
    }
    zeiten.loeschenMs = Math.round(performance.now() - t);
    return { kennung, zeiten, altGeloescht, einstellungen: neueEinstellungen, hatteAltes: !!altesPaket };
  }

  global.JukeDeckerPaket = Object.freeze({
    kanonisch, sha256, pruefsummeBerechnen, testvektorenPruefen,
    pruefen, dateiLesen, vergleichen, einstellungenNachImport, uebernehmen,
    datumText, GRUND, PLAYDECKER_STANDARD
  });
})(window);
