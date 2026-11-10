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

  global.JukeDeckerSpeicher = Object.freeze({
    oeffnen, zustandLesen, zustandSchreiben,
    aktivesPaket, paketSchreiben, umschalten, paketLoeschen, aktivesPaketEntfernen, aufraeumen,
    playlisten, cover, songtext, zaehlen,
    protokollSchreiben, protokollLesen, PROTOKOLL_HOECHSTENS,
    speicherSchaetzung
  });
})(window);
