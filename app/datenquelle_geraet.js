/* =========================================================================
   JukeDecker – Gerätespeicher (IndexedDB)

   WAS HIER LIEGT: alles, was die App ohne PC braucht. Datenbank
   „jukedecker_app“. Die Messseite hat eine eigene („jukedecker_messung“),
   beide liegen unter derselben Adresse jukedecker.github.io und teilen
   sich nur das Speicherkontingent, nicht die Daten.

   ABLAGEN:
   (1) pakete      je Paket ein Eintrag: Kopf (Datum, Version, Zahlen),
                   Jukeboxer- und PlayDecker-Block. Schlüssel „kennung“.
   (2) playlisten  je Playlist ein Eintrag, Schlüssel [paket, id].
   (3) cover       je Cover ein Bild (Blob, nicht Base64), Schlüssel
                   [paket, schluessel].
   (4) songtexte   je Titel ein Songtext, Schlüssel [paket, video_id].
   (5) zustand     benannte Werte: welches Paket gilt („aktivesPaket“),
                   die Einstellungen des Geräts („einstellungen“).
   (6) protokoll   das Diagnose-Protokoll (höchstens 1000 Einträge).

   WARUM JEDES PAKET EINE EIGENE KENNUNG HAT (Auftrag 15, Phase 2 (2D),
   „Übernehmen in einem Zug“): Das neue Paket wird zuerst VOLLSTÄNDIG
   unter seiner neuen Kennung geschrieben. Erst danach zeigt
   „aktivesPaket“ darauf (umschalten), erst danach wird das alte gelöscht.
   Bricht etwas ab (Speicher voll, App geschlossen), zeigt „aktivesPaket“
   weiter auf das alte, vollständige Paket. Reste eines abgebrochenen
   Imports räumt aufraeumen() beim nächsten Start weg.

   Keine Namen von Playlisten in diesem Code. Alle Inhalte kommen aus dem
   Paket im Gerätespeicher.
   ========================================================================= */
(function (global) {
  'use strict';

  const DB_NAME = 'jukedecker_app';
  const DB_VERSION = 1;
  const PAKET_ABLAGEN = ['playlisten', 'cover', 'songtexte'];
  const PROTOKOLL_HOECHSTENS = 1000;

  let dbVersprechen = null;

  /** Öffnet die Datenbank (einmal) und legt beim ersten Mal die Ablagen an. */
  function oeffnen() {
    if (dbVersprechen) return dbVersprechen;
    dbVersprechen = new Promise((ok, fehl) => {
      const anfrage = indexedDB.open(DB_NAME, DB_VERSION);
      anfrage.onupgradeneeded = () => {
        const db = anfrage.result;
        db.createObjectStore('pakete', { keyPath: 'kennung' });
        db.createObjectStore('playlisten', { keyPath: ['paket', 'id'] });
        db.createObjectStore('cover', { keyPath: ['paket', 'schluessel'] });
        db.createObjectStore('songtexte', { keyPath: ['paket', 'video_id'] });
        db.createObjectStore('zustand', { keyPath: 'name' });
        db.createObjectStore('protokoll', { keyPath: 'nr', autoIncrement: true });
      };
      anfrage.onsuccess = () => {
        const db = anfrage.result;
        // Will eine neuere Fassung der App die Datenbank umbauen, gibt diese
        // Seite sie frei, statt den Umbau zu blockieren.
        db.onversionchange = () => db.close();
        ok(db);
      };
      anfrage.onerror = () => { dbVersprechen = null; fehl(anfrage.error); };
      anfrage.onblocked = () => { /* wartet, bis andere Fenster freigeben */ };
    });
    return dbVersprechen;
  }

  /**
   * Eine Transaktion ausführen. „arbeit(tx)“ stellt die Anfragen; was sie
   * zurückgibt, wird nach dem erfolgreichen Abschluss geliefert:
   * eine IDB-Anfrage → deren Ergebnis, eine Funktion → deren Rückgabe.
   * Scheitert die Transaktion (z. B. QuotaExceededError), wird NICHTS
   * davon gespeichert - IndexedDB macht sie als Ganzes rückgängig.
   */
  function transaktion(ablagen, modus, arbeit) {
    return oeffnen().then((db) => new Promise((ok, fehl) => {
      let tx;
      try {
        tx = db.transaction(ablagen, modus);
      } catch (fehler) {
        fehl(fehler);
        return;
      }
      let ergebnis;
      tx.oncomplete = () => {
        if (ergebnis && typeof ergebnis === 'object' && 'result' in ergebnis && 'readyState' in ergebnis) ok(ergebnis.result);
        else if (typeof ergebnis === 'function') ok(ergebnis());
        else ok(ergebnis);
      };
      tx.onerror = (ereignis) => { ereignis.preventDefault(); };   // Abbruch kommt über onabort
      tx.onabort = () => fehl(tx.error || new DOMException('Transaktion abgebrochen', 'AbortError'));
      try {
        ergebnis = arbeit(tx);
      } catch (fehler) {
        try { tx.abort(); } catch (_) { /* schon zu Ende */ }
        fehl(fehler);
      }
    }));
  }

  // Schlüsselbereich „alle Einträge eines Pakets“ bei Schlüsseln [paket, …].
  // Arrays sortieren in IndexedDB hinter Zahlen und Texten - [k, []] liegt
  // deshalb hinter jedem [k, '…'].
  const bereichFuerPaket = (kennung) => IDBKeyRange.bound([kennung], [kennung, []]);

  // ---------------------------------------------------------------------
  // (A) Zustand: benannte Werte
  // ---------------------------------------------------------------------

  function zustandLesen(name) {
    return transaktion(['zustand'], 'readonly', (tx) => {
      const anfrage = tx.objectStore('zustand').get(name);
      return () => (anfrage.result ? anfrage.result.wert : undefined);
    });
  }

  function zustandSchreiben(name, wert) {
    return transaktion(['zustand'], 'readwrite', (tx) => {
      tx.objectStore('zustand').put({ name, wert });
    });
  }

  // ---------------------------------------------------------------------
  // (B) Pakete: schreiben, umschalten, löschen, lesen
  // ---------------------------------------------------------------------

  /** Das gültige Paket (Eintrag aus „pakete“) oder null. */
  async function aktivesPaket() {
    const kennung = await zustandLesen('aktivesPaket');
    if (!kennung) return null;
    return transaktion(['pakete'], 'readonly', (tx) => tx.objectStore('pakete').get(kennung))
      .then((eintrag) => eintrag || null);
  }

  /**
   * SCHRITT 1 von „Übernehmen in einem Zug“: Das neue Paket vollständig
   * unter seiner neuen Kennung schreiben. Eine einzige Transaktion: Entweder
   * steht danach ALLES da, oder (bei einem Fehler) gar nichts.
   * daten = { kopf, playlisten: [..], cover: [{schluessel, bild}], songtexte: {id: eintrag} }
   */
  function paketSchreiben(kennung, daten) {
    return transaktion(['pakete', ...PAKET_ABLAGEN], 'readwrite', (tx) => {
      daten.playlisten.forEach((pl, nr) => {
        tx.objectStore('playlisten').put({ paket: kennung, id: pl.id, nr, daten: pl });
      });
      daten.cover.forEach((c) => {
        tx.objectStore('cover').put({ paket: kennung, schluessel: c.schluessel, bild: c.bild });
      });
      Object.entries(daten.songtexte || {}).forEach(([videoId, eintrag]) => {
        tx.objectStore('songtexte').put({ paket: kennung, video_id: videoId, daten: eintrag });
      });
      // Der Kopf zuletzt - er ist der Beleg „Paket vollständig“.
      tx.objectStore('pakete').put({ kennung, ...daten.kopf });
    });
  }

  /**
   * SCHRITT 2: umschalten. „aktivesPaket“ zeigt danach auf das neue Paket.
   * Die geänderten Einstellungen des Geräts (z. B. Werte aus dem ersten
   * Paket) kommen in DIESELBE Transaktion - beides gilt zusammen oder gar
   * nicht.
   */
  function umschalten(kennung, einstellungen) {
    return transaktion(['zustand', 'pakete'], 'readwrite', (tx) => {
      // Sicherheitsprüfung: Umschalten nur auf ein vollständig geschriebenes Paket.
      const pruefung = tx.objectStore('pakete').get(kennung);
      pruefung.onsuccess = () => {
        if (!pruefung.result) { tx.abort(); return; }
        tx.objectStore('zustand').put({ name: 'aktivesPaket', wert: kennung });
        if (einstellungen) tx.objectStore('zustand').put({ name: 'einstellungen', wert: einstellungen });
      };
    });
  }

  /** SCHRITT 3 (und „Löschen“ in den Einstellungen): alle Teile eines Pakets entfernen. */
  function paketLoeschen(kennung) {
    return transaktion(['pakete', ...PAKET_ABLAGEN], 'readwrite', (tx) => {
      PAKET_ABLAGEN.forEach((ablage) => tx.objectStore(ablage).delete(bereichFuerPaket(kennung)));
      tx.objectStore('pakete').delete(kennung);
    });
  }

  /** Das gültige Paket abmelden (Einstellungen → „Löschen“), danach die Teile entfernen. */
  async function aktivesPaketEntfernen() {
    const kennung = await zustandLesen('aktivesPaket');
    await transaktion(['zustand'], 'readwrite', (tx) => tx.objectStore('zustand').delete('aktivesPaket'));
    if (kennung) await paketLoeschen(kennung);
    return kennung || null;
  }

  /**
   * Beim Start: Reste abgebrochener Imports oder eines nicht zu Ende
   * gelöschten alten Pakets entfernen. Behalten wird nur das gültige Paket.
   * Liefert die Kennungen, die entfernt wurden (fürs Protokoll).
   */
  async function aufraeumen() {
    const gueltig = await zustandLesen('aktivesPaket');
    const kennungen = new Set(await transaktion(['pakete'], 'readonly', (tx) => tx.objectStore('pakete').getAllKeys()));
    // Teile ohne Kopf (Import vor dem Kopf abgebrochen - kann bei EINER
    // Transaktion nicht vorkommen, wird aber zur Sicherheit mit erfasst).
    for (const ablage of PAKET_ABLAGEN) {
      const schluessel = await transaktion([ablage], 'readonly', (tx) => tx.objectStore(ablage).getAllKeys());
      schluessel.forEach((s) => kennungen.add(s[0]));
    }
    const entfernt = [];
    for (const kennung of kennungen) {
      if (kennung !== gueltig) {
        await paketLoeschen(kennung);
        entfernt.push(kennung);
      }
    }
    return entfernt;
  }

  /** Alle Playlisten eines Pakets in Paket-Reihenfolge (Inhalt wie im Paket). */
  function playlisten(kennung) {
    return transaktion(['playlisten'], 'readonly', (tx) => tx.objectStore('playlisten').getAll(bereichFuerPaket(kennung)))
      .then((liste) => liste.sort((a, b) => a.nr - b.nr).map((e) => e.daten));
  }

  /** Ein Cover als Blob (oder null). */
  function cover(kennung, schluessel) {
    return transaktion(['cover'], 'readonly', (tx) => tx.objectStore('cover').get([kennung, schluessel]))
      .then((e) => (e ? e.bild : null));
  }

  /** Der Songtext zu einem Titel (wie im Paket) oder null. */
  function songtext(kennung, videoId) {
    return transaktion(['songtexte'], 'readonly', (tx) => tx.objectStore('songtexte').get([kennung, videoId]))
      .then((e) => (e ? e.daten : null));
  }

  /** Die Video-Kennungen aller Titel, zu denen das Paket einen Songtext
      mitbringt (nur die Schlüssel, nicht die Texte - schnell und klein). */
  function songtextKennungen(kennung) {
    return transaktion(['songtexte'], 'readonly', (tx) => tx.objectStore('songtexte').getAllKeys(bereichFuerPaket(kennung)))
      .then((schluessel) => new Set(schluessel.map((s) => s[1])));
  }

  /** Anzahl der Einträge je Ablage für ein Paket (für Prüfungen und Anzeige). */
  async function zaehlen(kennung) {
    const ergebnis = {};
    for (const ablage of PAKET_ABLAGEN) {
      ergebnis[ablage] = await transaktion([ablage], 'readonly', (tx) => tx.objectStore(ablage).count(bereichFuerPaket(kennung)));
    }
    return ergebnis;
  }

  // ---------------------------------------------------------------------
  // (C) Diagnose-Protokoll (höchstens 1000 Einträge)
  // ---------------------------------------------------------------------

  let protokollAnzahl = null;

  /** Einen Eintrag anhängen; ältere fallen weg, sobald es mehr als 1000 sind. */
  async function protokollSchreiben(eintrag) {
    await transaktion(['protokoll'], 'readwrite', (tx) => { tx.objectStore('protokoll').add(eintrag); });
    if (protokollAnzahl === null) {
      protokollAnzahl = await transaktion(['protokoll'], 'readonly', (tx) => tx.objectStore('protokoll').count());
    } else {
      protokollAnzahl += 1;
    }
    // In Schüben kürzen (alle 50 Einträge), damit nicht jeder Eintrag zwei
    // Schreibvorgänge kostet. Es bleiben immer genau die neuesten 1000.
    if (protokollAnzahl > PROTOKOLL_HOECHSTENS + 50) await protokollKuerzen();
  }

  async function protokollKuerzen() {
    const schluessel = await transaktion(['protokoll'], 'readonly', (tx) => tx.objectStore('protokoll').getAllKeys());
    const zuViel = schluessel.length - PROTOKOLL_HOECHSTENS;
    if (zuViel > 0) {
      const bis = schluessel[zuViel - 1];
      await transaktion(['protokoll'], 'readwrite', (tx) => tx.objectStore('protokoll').delete(IDBKeyRange.upperBound(bis)));
    }
    protokollAnzahl = Math.min(schluessel.length, PROTOKOLL_HOECHSTENS);
  }

  /** Alle Einträge, älteste zuerst. */
  async function protokollLesen() {
    await protokollKuerzen();
    return transaktion(['protokoll'], 'readonly', (tx) => tx.objectStore('protokoll').getAll());
  }

  /**
   * Alle Einträge löschen (⚙ JukeDecker → Dateiarbeit → „Protokoll leeren“,
   * Nachbesserung 2, M1 (1A5)): Damit fängt eine neue Messung sauber an.
   * Liefert die Zahl der gelöschten Einträge. Nur das Protokoll - Paket und
   * Einstellungen bleiben unberührt.
   */
  async function protokollLeeren() {
    const vorher = await transaktion(['protokoll'], 'readonly', (tx) => tx.objectStore('protokoll').count());
    await transaktion(['protokoll'], 'readwrite', (tx) => { tx.objectStore('protokoll').clear(); });
    protokollAnzahl = 0;
    return vorher;
  }

  // ---------------------------------------------------------------------
  // (D) Speicher
  // ---------------------------------------------------------------------

  /** Belegter und verfügbarer Speicher laut Browser (oder null). */
  async function speicherSchaetzung() {
    try {
      if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate();
    } catch (fehler) { /* nicht verfügbar */ }
    return null;
  }

  // ---------------------------------------------------------------------
  // (E) Datenquelle für die beiden Kerne (Auftrag 15, Phasen 3 und 4)
  //     EINE Stelle für Jukeboxer und PlayDecker: beide lesen dieselben
  //     Playlisten, Cover und Songtexte des gültigen Pakets. Die Teile, die
  //     nur der Rahmen kennt (Einstellungen des Geräts, Party-Regel), reicht
  //     app.js als Rückrufe herein.
  // ---------------------------------------------------------------------

  // Standardwerte des Jukeboxers - 1 : 1 aus PlayLister/jukeboxer_speicher.py
  // (standardwerte()). Sie gelten, wenn das Paket keinen Jukeboxer-Block hat
  // (Pakete der Messung).
  const JUKEBOXER_STANDARD = Object.freeze({
    genres: [['Rock', 'gitarre'], ['Pop', 'note'], ['Soul', 'herz'], ['Country', 'hut'], ['Jazz', 'saxofon'],
      ['Blues', 'mikrofon'], ['Folk', 'feder'], ['Elektronik', 'welle'], ['Hip-Hop', 'kopfhoerer'], ['Klassik', 'schluessel']]
      .map(([name, symbol], i) => ({ nr: i + 1, name, symbol, playlist: null })),
    wiedergabe: { ueberblenden: true, ueberblendDauer: 4, festeSpielzeit: 0, reihenfolge: 'reihe', amEnde: 'wiederholen',
      nachSchlange: 'weiter', songtext: true, spultasten: false },
    effekte: { animationen: true, plattenwechsel: 'wechsler', tellerDreht: true, tonarm: true, aktivKnopf: 'farbwechsel',
      rueckmeldung: 'aufblitzen', neon: 'pulsieren', coverWechsel: 'blende', tempo: 1, umdrehungSekunden: 5,
      design: 'diner-chrom', perspektive: 'stark' },
    wahlmodus: 'sofort',
    lautstaerke: 70
  });

  // Hinweis, wenn zu einem Titel kein Songtext im Paket liegt (Antwort R1 (1E)).
  // Das ist kein Fehler: Das Songtext-Fenster zeigt den Satz in Klammern.
  const KEIN_SONGTEXT = 'Für diesen Titel liegt kein Songtext im Paket.';

  /**
   * Liest das gültige Paket für die Kerne. Hält die Playlisten nach dem
   * ersten Lesen im Arbeitsspeicher (ein Paket ändert sich nicht, solange
   * die Seite offen ist - ein neues Paket lädt die Seite neu, siehe app.js).
   */
  function paketQuelle(kennung) {
    let listen = null;                  // Promise<[Playlist wie im Paket]>
    const coverAdressen = new Map();    // Cover-Schlüssel -> blob:-Adresse
    const alle = () => (listen || (listen = playlisten(kennung)));
    // Kennung „Songtext vorhanden“ (Nachbesserung 1, N4): Die Kerne fragen
    // BEIM ZEICHNEN, also ohne Warten - deshalb liegt die Menge der Titel mit
    // Text im Arbeitsspeicher. Geladen wird sie einmal mit bereit(); bis dahin
    // heißt die Antwort „nein“ (dann fehlt nur das Zeichen, nie ein Text).
    let mitText = new Set();
    let mitTextLadung = null;

    return {
      kennung,
      /** Vor dem Start eines Kerns abwarten: lädt die Menge der Titel mit
          Songtext (wenige Millisekunden, nur Schlüssel). */
      bereit() {
        if (!mitTextLadung) {
          mitTextLadung = songtextKennungen(kennung)
            .then((menge) => { mitText = menge; return menge.size; })
            .catch(() => 0);
        }
        return mitTextLadung;
      },
      /** Liegt zu dieser Video-Kennung ein Songtext im Paket? (ohne Warten) */
      hatSongtext: (videoId) => !!videoId && mitText.has(videoId),
      /** [{ id, name, anzahl, herkunft, geaendert }] in Paket-Reihenfolge. */
      async uebersicht() {
        return (await alle()).map((p) => ({
          id: p.id, name: p.name, anzahl: Array.isArray(p.titel) ? p.titel.length : 0,
          herkunft: p.herkunft, geaendert: p.geaendert
        }));
      },
      /** Eine Playlist { id, name, titel } oder null. Die Titel sind KOPIEN,
          damit kein Kern den Inhalt des anderen verändert. */
      async playlist(id) {
        const p = (await alle()).find((x) => x.id === id);
        if (!p) return null;
        return { id: p.id, name: p.name, titel: JSON.parse(JSON.stringify(p.titel || [])) };
      },
      /** Bildadresse eines Covers (blob:…) oder null. Jedes Bild wird nur
          einmal aus IndexedDB geholt und als Adresse im Gerät gehalten. */
      async coverAdresse(schluessel) {
        if (!schluessel) return null;
        if (!coverAdressen.has(schluessel)) {
          coverAdressen.set(schluessel, cover(kennung, schluessel)
            .then((bild) => (bild ? URL.createObjectURL(bild) : null))
            .catch(() => null));
        }
        return coverAdressen.get(schluessel);
      },
      /** Songtext wie vom PC-Server: { vorhanden, text, zeitmarken, zeilen?, quelle }
          - fehlt er, { vorhanden: false, grund } (kein Fehler). */
      async songtext(videoId) {
        const eintrag = videoId ? await songtext(kennung, videoId) : null;
        if (!eintrag) return { vorhanden: false, grund: KEIN_SONGTEXT };
        return { ...eintrag, vorhanden: true };
      }
    };
  }

  /**
   * Die Datenquelle des Jukeboxers (Vertrag im Kopf von jukeboxer_kern.js).
   * optionen:
   *   paket            - paketQuelle(...)
   *   einstellungen    - () -> die Einstellungen für den Kern (EIN Objekt,
   *                      das der Kern danach selbst verändert - app.js hält
   *                      dieselbe Referenz, siehe dort)
   *   speichern(o)     - Promise; o = Kopie der Kern-Einstellungen
   *   darfStarten()    - Party-Regel: { ja, grund?, grundVorgemerkt? }
   * Konto-Funktionen (kontoPlaylisten, kontoUebernehmen, kontoAktualisieren)
   * gibt es auf dem Gerät nicht - der Kern blendet sie dann selbst aus.
   */
  function jukeboxerQuelle(optionen) {
    const paket = optionen.paket;
    return {
      playlistenAuflisten: () => paket.uebersicht(),
      async playlistLaden(id) {
        const p = await paket.playlist(id);
        if (!p) throw new Error('Diese Playlist ist nicht im Paket.');
        return p;
      },
      coverAdresse: (titel) => paket.coverAdresse(titel && titel.cover),
      einstellungenLaden: async () => optionen.einstellungen(),
      einstellungenSpeichern: (o) => optionen.speichern(o),
      darfStarten: () => optionen.darfStarten(),
      songtext: (titel) => paket.songtext(titel && titel.video_id),
      // NUR APP (wahlfreie Haken des Kerns, Nachbesserung 1):
      // (1) N4: Titelkarten und „Jetzt läuft“ tragen „♪“, wenn das Paket
      //     zu dem Titel einen Songtext hat.
      hatSongtext: (titel) => paket.hatSongtext(titel && titel.video_id),
      // (2) N3: Im Modus „in Warteschlange“ nimmt ein erneutes Antippen den
      //     Titel wieder heraus (am PC bleibt es ohne Wirkung).
      vormerkungAbwaehlbar: () => true
    };
  }

  global.JukeDeckerSpeicher = Object.freeze({
    oeffnen, zustandLesen, zustandSchreiben,
    aktivesPaket, paketSchreiben, umschalten, paketLoeschen, aktivesPaketEntfernen, aufraeumen,
    playlisten, cover, songtext, songtextKennungen, zaehlen,
    protokollSchreiben, protokollLesen, protokollLeeren, PROTOKOLL_HOECHSTENS,
    speicherSchaetzung,
    paketQuelle, jukeboxerQuelle, JUKEBOXER_STANDARD, KEIN_SONGTEXT
  });
})(window);
