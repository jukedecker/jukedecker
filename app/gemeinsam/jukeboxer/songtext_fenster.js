/* =====================================================================
   SCHWEBENDES SONGTEXT-FENSTER (Bauauftrag 13, Phase 6)

   Ein Fenster, das über der Seite schwebt und den Songtext des laufenden
   Titels zeigt. Der Text rollt gleichmäßig mit der Wiedergabe durch, das
   Tempo ist im Fenster einstellbar, und ein Klick auf eine Zeile
   synchronisiert von Hand. Genutzt vom PlayDecker (PC) und vom Jukeboxer
   (PC und später die Mobil-Version).

   DIE WICHTIGSTE REGEL: Dieser Baustein kennt weder den Server noch den
   PlayLister, den PlayDecker oder den Jukeboxer. Kein fetch, keine
   Adresse. Alles, was er wissen muss, fragt er bei der übergebenen
   „Hülle" ab. So kann die Mobil-Version ihn unverändert übernehmen.

   ---------------------------------------------------------------------
   VERTRAG: DIE HÜLLE
   ---------------------------------------------------------------------
     titel()          -> der gerade spielende Titel { video_id, titel,
                         interpret } oder null. Wechselt er, lädt das
                         Fenster den neuen Text und beginnt oben.
     textLaden(titel) -> Promise<{ vorhanden, text?, quelle?, grund?,
                         zeitmarken?, zeilen? }>
                         zeilen = [{ text, start }] (start in Sekunden),
                         nur wenn zeitmarken = true
     position()       -> Wiedergabeposition in Sekunden (die ECHTE des
                         Players - Pause, Spulen und Springen wirken
                         dadurch von selbst)
     dauer()          -> echte Titeldauer in Sekunden (0 = noch unbekannt)
     spielt()         -> bool, läuft gerade Ton
     speichern?(werte) - wahlfrei: { tempo, schrift, x, y, breite, hoehe }
                         sanft verzögert nach jeder Änderung

   START:  SongtextFenster.erstellen({ behaelter, farbsatz, huelle, werte? })
     behaelter - Element, in das das Fenster gehängt wird (es liegt dort
                 mit position: fixed, darf also nicht unter einem Element
                 mit transform/filter liegen)
     farbsatz  - 'bernstein' (Walnuss/Bernstein) oder 'mint'
                 (Mint/Kirschrot); nur CSS-Variablen, siehe
                 songtext_fenster.css
     werte     - gemerkte Werte; fehlt etwas, gilt der Standard
   Liefert { oeffnen(), schliessen(), umschalten(), istOffen(), werte() }.

   ---------------------------------------------------------------------
   GLEICHMÄSSIGES DURCHLAUFEN, KEINE „AKTUELLE ZEILE"
   (Entscheidung des Nutzers bei der Sichtabnahme, 17.10.2026)
   ---------------------------------------------------------------------
   YouTube liefert zu den Texten keine Zeitmarken (gemessen 06.08.2026).
   Eine hervorgehobene Zeile täte so, als wüsste das Fenster, was gerade
   gesungen wird - das weiß es nicht. Deshalb:
   (1) Der Text rollt stufenlos und gleichmäßig. Beim Faktor 1,0 läuft er
       über die Titeldauer, abzüglich 8 % Vorspann und 5 % Abspann.
   (2) Alle Zeilen sind gleich hell. Eine angeklickte Zeile leuchtet nur
       kurz zur Bestätigung auf.
   (3) Gerechnet wird mit dem ANTEIL am Text (0 = Anfang, 1 = Ende) auf
       der Lesehöhe (ein Drittel der Fensterhöhe). Ein Anteil bleibt
       richtig, wenn Schriftgröße oder Fenstergröße sich ändern.
   (4) Ein ANKER ist ein Paar (Anteil, Wiedergabeposition). Ohne Anker
       von Hand gilt (0, Vorspann). Der Anteil jetzt ist
       Anker-Anteil + (Position - Anker-Position) × Geschwindigkeit.
       Ein Klick auf eine Zeile setzt den Anker: Diese Zeile steht jetzt
       auf der Lesehöhe, ab dort rollt der Text mit dem Tempo weiter.
   Weil die Rechnung an der echten Position hängt, nicht an einer
   eigenen Uhr, stehen Pause und Spulen von selbst richtig.

   ---------------------------------------------------------------------
   MIT ZEITMARKEN (Freigabe des Projektleiters, 18.10.2026)
   ---------------------------------------------------------------------
   Liefert die Hülle Zeitmarken (Startzeit je Zeile), ist die Markierung
   ehrlich - dann:
   (1) Die gesungene Zeile ist hervorgehoben und steht auf der Lesehöhe,
       die übrigen sind leicht gedimmt. Der Kopf sagt „zeitsynchron".
   (2) Ein Klick oder die Pfeiltasten setzen einen VERSATZ für den ganzen
       Titel (gleicht z. B. den Vorspann eines Musikvideos aus): Die
       gewählte Zeile ist ab jetzt dran, alle folgenden Wechsel verschieben
       sich um denselben Betrag. Gemerkt nur für diese Sitzung, je Titel.
   (3) „Versatz zurücksetzen" erscheint nur, wenn ein Versatz gesetzt ist.
   (4) Tempo und „Auto" sind ausgegraut - sie gelten nur ohne Zeitmarken.
   ===================================================================== */
(function (global) {
  'use strict';

  // Standardwerte und Grenzen - dieselben prüft der Server beim Speichern.
  const STANDARD = Object.freeze({ tempo: 1, schrift: 24, breite: 460, hoehe: 520, x: null, y: null });
  const TEMPO_MIN = 0.5, TEMPO_MAX = 2, TEMPO_SCHRITT = 0.05;
  const SCHRIFT_MIN = 16, SCHRIFT_MAX = 48, SCHRIFT_SCHRITT = 2;
  const BREITE_MIN = 280, HOEHE_MIN = 200;

  const VORSPANN = 0.08;            // Anteil der Titeldauer vor dem ersten Wort
  const ABSPANN = 0.05;             // Anteil nach dem letzten Wort
  const TAKT_MS = 200;              // so oft wird nach einem Titelwechsel geschaut
  const LESEPAUSE_MS = 4000;        // nach dem Mausrad: so lange freies Lesen
  const LESEHOEHE = 1 / 3;          // hierhin rollt eine angeklickte Zeile
  const AUFLEUCHTEN_MS = 1200;      // so lange leuchtet eine angeklickte Zeile
  const NACHZIEHEN = 0.2;           // Anteil des Abstands, den das Rollen je Bild aufholt
  const SCHAETZEN_MAX_S = 1;        // so weit wird zwischen zwei Positionsmeldungen geschätzt
  const RAND_PX = 8;                // Mindestabstand zum Bildschirmrand
  const SPEICHERN_VERZOEGERUNG_MS = 800;

  // Text sicher in HTML einsetzen (Sonderzeichen unschädlich machen)
  const sicher = (text) => String(text ?? '').replace(/[&<>"']/g, (z) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
  const begrenzt = (wert, min, max) => Math.min(max, Math.max(min, wert));
  // Tempo auf das Raster 0,05 runden (gegen Kommazahl-Krümel wie 1.0500000001)
  const tempoRunden = (wert) =>
    Number((Math.round(begrenzt(wert, TEMPO_MIN, TEMPO_MAX) / TEMPO_SCHRITT) * TEMPO_SCHRITT).toFixed(2));
  const zahlText = (wert, stellen) => wert.toFixed(stellen).replace('.', ',');

  /** Übernimmt nur gültige gemerkte Werte; alles andere bleibt Standard.
      (Die strenge Prüfung macht die Speicherstelle - hier wird nur nichts
      Unsinniges übernommen, falls doch etwas Krummes ankommt.) */
  function werteUebernehmen(gemerkt) {
    const w = { ...STANDARD };
    if (!gemerkt || typeof gemerkt !== 'object') return w;
    const zahl = (x) => typeof x === 'number' && Number.isFinite(x);
    if (zahl(gemerkt.tempo)) w.tempo = tempoRunden(gemerkt.tempo);
    if (zahl(gemerkt.schrift)) w.schrift = begrenzt(Math.round(gemerkt.schrift), SCHRIFT_MIN, SCHRIFT_MAX);
    if (zahl(gemerkt.breite)) w.breite = Math.max(BREITE_MIN, Math.round(gemerkt.breite));
    if (zahl(gemerkt.hoehe)) w.hoehe = Math.max(HOEHE_MIN, Math.round(gemerkt.hoehe));
    if (zahl(gemerkt.x)) w.x = Math.max(0, Math.round(gemerkt.x));
    if (zahl(gemerkt.y)) w.y = Math.max(0, Math.round(gemerkt.y));
    return w;
  }

  function erstellen({ behaelter, farbsatz = 'bernstein', huelle, werte }) {
    if (!behaelter || !huelle) throw new Error('SongtextFenster: Behälter und Hülle sind Pflicht.');
    const w = werteUebernehmen(werte);

    /* ---------------- Das Fenster aufbauen ------------------------- */
    const fenster = document.createElement('section');
    fenster.className = `stf-fenster stf--${farbsatz === 'mint' ? 'mint' : 'bernstein'}`;
    // Kein role="dialog": Das Fenster ist nicht modal. Wer es offen lässt,
    // soll mit Esc trotzdem das Vollbild verlassen können, solange das
    // Fenster nicht den Fokus hat (Esc-Regel aus Phase 2b: zuerst das
    // Fenster, wenn es den Fokus hat).
    fenster.setAttribute('role', 'region');
    fenster.setAttribute('aria-label', 'Songtext');
    fenster.tabIndex = -1;
    fenster.hidden = true;
    fenster.innerHTML = `
      <header class="stf-kopf" title="Am Kopf ziehen, um das Fenster zu verschieben">
        <div class="stf-kopf-text">
          <b class="stf-titel">Songtext</b>
          <small class="stf-hinweis">nicht zeitsynchron, per Klick nachführen</small>
        </div>
        <button type="button" class="stf-zu" aria-label="Songtext schließen" title="Schließen (Esc)">✕</button>
      </header>
      <div class="stf-text" tabindex="0" aria-live="off"
           title="Klick auf eine Zeile: Sie rückt auf die Lesehöhe, der Text rollt von dort weiter. Pfeiltasten: eine Zeile, Bild-Tasten: eine Strophe">
        <div class="stf-zeilen"></div>
      </div>
      <footer class="stf-leiste">
        <button type="button" class="stf-mitlaufen" title="Durchlaufen anhalten (die Musik läuft weiter)">⏸</button>
        <span class="stf-gruppe stf-tempo">
          <span class="stf-beschriftung">Tempo</span>
          <button type="button" class="stf-tempo-weniger" aria-label="Tempo langsamer" title="langsamer">−</button>
          <input type="range" class="stf-tempo-regler" min="${TEMPO_MIN}" max="${TEMPO_MAX}" step="${TEMPO_SCHRITT}"
                 aria-label="Tempo des Durchlaufens, 0,5- bis 2-fach">
          <button type="button" class="stf-tempo-mehr" aria-label="Tempo schneller" title="schneller">+</button>
          <b class="stf-tempo-wert"></b>
          <button type="button" class="stf-auto" title="Tempo 1,0× und die Stelle wieder aus der Spielzeit berechnen">Auto</button>
        </span>
        <button type="button" class="stf-versatz" hidden title="Versatz zurücksetzen - die Zeiten gelten wieder genau wie geliefert"></button>
        <span class="stf-gruppe stf-schrift">
          <button type="button" class="stf-schrift-kleiner" aria-label="Schrift kleiner" title="Schrift kleiner">A−</button>
          <button type="button" class="stf-schrift-groesser" aria-label="Schrift größer" title="Schrift größer">A+</button>
        </span>
      </footer>`;
    behaelter.appendChild(fenster);
    const $ = (sel) => fenster.querySelector(sel);
    const textKasten = $('.stf-text');
    const zeilenKasten = $('.stf-zeilen');

    /* ---------------- Zustand -------------------------------------- */
    let zeilen = [];             // [{ text, leer, el, start? }]
    let synchron = false;        // true = echte Zeitmarken für diesen Titel
    let versatz = 0;             // Sekunden, um die alle Zeitmarken verschoben gelten
    const versaetze = new Map(); // je Titel gemerkter Versatz (nur diese Sitzung)
    let aktuell = -1;            // gesungene Zeile (nur mit Zeitmarken)
    let titelSchluessel = null;  // welcher Titel gerade angezeigt wird
    let ladeNummer = 0;          // gegen verspätete Antworten nach einem Titelwechsel
    let anker = null;            // { a, t } von Hand gesetzt; null = automatisch
    let mitlaufen = true;        // ⏸/▶ im Fenster (die Musik bleibt davon unberührt)
    let eingefroren = 0;         // Anteil, bei dem das Durchlaufen angehalten wurde
    let lesenBis = 0;            // bis zu diesem Zeitpunkt rollt das Fenster nicht selbst
    let rollenSofort = true;     // nächstes Bild ohne Nachziehen (nach Laden, Öffnen)
    let takt = null;
    let bild = null;             // laufende Bild-Schleife (requestAnimationFrame)
    let speichernUhr = null;
    let angewandt = null;        // zuletzt selbst gesetzte Größe (siehe Größe ändern)
    // Zwischen zwei Positionsmeldungen des Players wird geschätzt - sonst
    // rollte der Text in kleinen Rucken (der Player meldet nur grob).
    let letztePosition = -1, letzteMeldung = 0;

    /* ---------------- Zeitlogik ------------------------------------ */
    function jetzt() {
      let t = 0, d = 0, laeuft = false;
      try { t = Number(huelle.position()) || 0; } catch (_) { t = 0; }
      try { d = Number(huelle.dauer()) || 0; } catch (_) { d = 0; }
      try { laeuft = !!huelle.spielt(); } catch (_) { laeuft = false; }
      const uhr = performance.now();
      if (t !== letztePosition) { letztePosition = t; letzteMeldung = uhr; }
      else if (laeuft) t += Math.min(SCHAETZEN_MAX_S, (uhr - letzteMeldung) / 1000);
      return { t, d };
    }
    // Anteil des Texts pro Sekunde beim eingestellten Tempo
    const geschwindigkeit = (d) => {
      const strecke = d * (1 - VORSPANN - ABSPANN);
      return strecke > 0 ? w.tempo / strecke : 0;
    };
    // Welcher Anteil des Texts steht gerade auf der Lesehöhe?
    function anteilJetzt() {
      if (!mitlaufen) return eingefroren;
      const { t, d } = jetzt();
      const a = anker || { a: 0, t: VORSPANN * d };
      return begrenzt(a.a + (t - a.t) * geschwindigkeit(d), 0, 1);
    }
    // Neuer Anker: Anteil a gilt ab JETZT
    function ankern(a) {
      anker = { a, t: jetzt().t };
      if (!mitlaufen) eingefroren = a;
    }

    /* ---------------- Rollen: Anteil <-> Bildlauf ------------------- */
    // Der Innenabstand oben ist so groß wie die Lesehöhe, unten wie der
    // Rest. Dadurch gilt einfach: Bildlauf = Anteil × größter Bildlauf.
    // Anteil 0 = erste Zeile auf der Lesehöhe, Anteil 1 = letzte Zeile.
    const groessterBildlauf = () => Math.max(0, textKasten.scrollHeight - textKasten.clientHeight);
    // Anteil, bei dem Zeile i (ihre Mitte) auf der Lesehöhe steht
    function anteilVonZeile(i) {
      const z = zeilen[i];
      const max = groessterBildlauf();
      if (!z || !z.el || max <= 0) return 0;
      const bildlauf = z.el.offsetTop + z.el.offsetHeight / 2 - textKasten.clientHeight * LESEHOEHE;
      return begrenzt(bildlauf / max, 0, 1);
    }
    // Die Zeile, die gerade auf der Lesehöhe steht (für Pfeil-/Bild-Tasten)
    function zeileAufLesehoehe() {
      const punkt = textKasten.scrollTop + textKasten.clientHeight * LESEHOEHE;
      let treffer = -1;
      for (let i = 0; i < zeilen.length; i++) {
        if (zeilen[i].leer || !zeilen[i].el) continue;
        if (zeilen[i].el.offsetTop <= punkt) treffer = i; else break;
      }
      return treffer < 0 ? zeilen.findIndex((z) => !z.leer) : treffer;
    }

    // Mit Zeitmarken: die Zeile, deren (verschobene) Startzeit zuletzt
    // erreicht wurde; -1 = vor der ersten Zeile.
    function zeitzeileJetzt() {
      const t = jetzt().t;
      let treffer = -1;
      for (let i = 0; i < zeilen.length; i++) {
        if (zeilen[i].start + versatz <= t) treffer = i; else break;
      }
      return treffer;
    }
    function hervorheben(i) {
      if (i === aktuell) return;
      if (zeilen[aktuell] && zeilen[aktuell].el) zeilen[aktuell].el.classList.remove('stf-aktuell');
      aktuell = i;
      if (zeilen[i] && zeilen[i].el) zeilen[i].el.classList.add('stf-aktuell');
    }
    // Bildlauf, bei dem Zeile i (ihre Mitte) auf der Lesehöhe steht
    const bildlaufFuerZeile = (i) => anteilVonZeile(i) * groessterBildlauf();

    /* Ein Bild: den Text an die errechnete Stelle rollen. Kleine Abstände
       werden weich nachgezogen (das glättet die groben Positionsmeldungen
       des Players), nach dem Laden oder Öffnen geht es sofort. */
    function rollen() {
      if (!zeilen.length) return;
      // Mit Zeitmarken folgt die Markierung auch beim freien Lesen weiter -
      // nur das Rollen wartet.
      if (synchron && mitlaufen) hervorheben(zeitzeileJetzt());
      if (Date.now() < lesenBis) return;
      const ziel = synchron ? (aktuell >= 0 ? bildlaufFuerZeile(aktuell) : 0)
        : anteilJetzt() * groessterBildlauf();
      const ist = textKasten.scrollTop;
      if (rollenSofort) { textKasten.scrollTop = ziel; rollenSofort = false; return; }
      const abstand = ziel - ist;
      if (Math.abs(abstand) < 0.3) return;
      textKasten.scrollTop = ist + abstand * NACHZIEHEN;
    }
    function bildSchleife() {
      bild = null;
      if (fenster.hidden) return;
      try { rollen(); } catch (_) { /* nächstes Bild */ }
      bild = global.requestAnimationFrame(bildSchleife);
    }

    /* ---------------- Anzeige -------------------------------------- */
    function meldungZeigen(text, zusatz) {
      zeilen = [];
      zeilenKasten.innerHTML = `<p class="stf-meldung">${sicher(text)}</p>`
        + (zusatz ? `<p class="stf-meldung stf-meldung-zusatz">${sicher(zusatz)}</p>` : '');
      textKasten.scrollTop = 0;
    }

    function textZeigen(text, quelle, zeitzeilen) {
      if (zeitzeilen) {
        // Mit Zeitmarken: jede gelieferte Zeile mit ihrer Startzeit
        zeilen = zeitzeilen.map((z) => ({ text: String(z.text), leer: !String(z.text).trim(), start: Number(z.start) }));
      } else {
        // Leerzeilen am Anfang und Ende tragen nichts bei
        const roh = String(text).replace(/\r/g, '').split('\n');
        while (roh.length && !roh[0].trim()) roh.shift();
        while (roh.length && !roh[roh.length - 1].trim()) roh.pop();
        zeilen = roh.map((zeile) => ({ text: zeile, leer: !zeile.trim() }));
      }
      aktuell = -1;
      zeilenKasten.innerHTML = zeilen.map((z, i) => z.leer
        ? `<p class="stf-zeile stf-leer" data-i="${i}" aria-hidden="true"></p>`
        : `<p class="stf-zeile" data-i="${i}">${sicher(z.text)}</p>`).join('')
        + (quelle ? `<p class="stf-quelle">${sicher(quelle)}</p>` : '');
      zeilenKasten.querySelectorAll('.stf-zeile').forEach((el) => { zeilen[Number(el.dataset.i)].el = el; });
      rollenSofort = true;
    }

    function kopfSetzen(titel) {
      const name = titel ? [titel.titel, titel.interpret].filter(Boolean).join(' – ') : 'Songtext';
      $('.stf-titel').textContent = name || 'Songtext';
      $('.stf-titel').title = name || '';
    }

    async function laden(titel) {
      const nummer = ++ladeNummer;
      anker = null; mitlaufen = true; eingefroren = 0; lesenBis = 0;
      synchron = false; aktuell = -1;
      versatz = versaetze.get(titelSchluessel) || 0;
      mitlaufenAnzeigen();
      modusAnzeigen();
      kopfSetzen(titel);
      if (!titel) { meldungZeigen('Gerade läuft kein Titel.'); return; }
      meldungZeigen('Songtext wird geholt …');
      try {
        const antwort = await huelle.textLaden(titel);
        if (nummer !== ladeNummer) return;            // inzwischen anderer Titel
        const zeitzeilen = antwort && antwort.zeitmarken && Array.isArray(antwort.zeilen)
          && antwort.zeilen.length && antwort.zeilen.every((z) => Number.isFinite(Number(z.start)))
          ? antwort.zeilen : null;
        if (antwort && antwort.vorhanden && (zeitzeilen || String(antwort.text || '').trim())) {
          synchron = !!zeitzeilen;
          textZeigen(antwort.text, antwort.quelle, zeitzeilen);
          modusAnzeigen();
        } else {
          meldungZeigen('Für diesen Titel wurde kein Songtext gefunden',
            antwort && antwort.grund ? `(${antwort.grund})` : '');
        }
      } catch (fehler) {
        if (nummer !== ladeNummer) return;
        meldungZeigen('Für diesen Titel wurde kein Songtext gefunden',
          `(nicht abrufbar: ${fehler && fehler.message ? fehler.message : 'unbekannt'})`);
      }
    }

    /* Titelwechsel erkennen (eigener Takt, auch im Hintergrund-Tab). */
    function titelPruefen() {
      let titel = null;
      try { titel = huelle.titel(); } catch (_) { titel = null; }
      const schluessel = titel ? (titel.video_id || `${titel.titel}|${titel.interpret}`) : null;
      if (schluessel === titelSchluessel) return;
      // Kein Titel mehr (z. B. alles gestoppt): Der Text bleibt stehen,
      // statt zu verschwinden. Nur ein ANDERER Titel lädt neu.
      if (schluessel === null && titelSchluessel !== null) return;
      titelSchluessel = schluessel;
      laden(titel);
    }

    /* ---------------- Hand-Synchronisation ------------------------- */
    // Kurzes Aufleuchten als Bestätigung - KEINE dauernde Hervorhebung.
    function aufleuchten(el) {
      el.classList.remove('stf-gesetzt');
      void el.offsetWidth;                       // Animation neu starten
      el.classList.add('stf-gesetzt');
      setTimeout(() => el.classList.remove('stf-gesetzt'), AUFLEUCHTEN_MS);
    }
    function zeileSetzen(i) {
      if (!zeilen.length) return;
      // Leerzeile angeklickt: die nächste Textzeile ist gemeint
      let ziel = begrenzt(i, 0, zeilen.length - 1);
      while (zeilen[ziel].leer && ziel < zeilen.length - 1) ziel++;
      while (zeilen[ziel].leer && ziel > 0) ziel--;
      lesenBis = 0;
      if (synchron) {
        // Versatz für den ganzen Titel: Diese Zeile ist ab JETZT dran.
        versatz = jetzt().t - zeilen[ziel].start;
        versaetze.set(titelSchluessel, versatz);
        hervorheben(ziel);
        versatzAnzeigen();
        if (zeilen[ziel].el) aufleuchten(zeilen[ziel].el);
        return;
      }
      ankern(anteilVonZeile(ziel));
      if (zeilen[ziel].el) aufleuchten(zeilen[ziel].el);
    }
    const textzeileAb = (start, schritt) => {
      for (let i = start; i >= 0 && i < zeilen.length; i += schritt) if (!zeilen[i].leer) return i;
      return -1;
    };
    // Erste Zeile der Strophe, in der Zeile i steht
    const strophenAnfang = (i) => {
      let s = i;
      while (s > 0 && !zeilen[s - 1].leer) s--;
      return s;
    };
    // Ausgangszeile für Pfeil- und Bild-Tasten: mit Zeitmarken die
    // gesungene Zeile, sonst die auf der Lesehöhe.
    const basisZeile = () => (synchron ? aktuell : zeileAufLesehoehe());
    function zeileVorZurueck(schritt) {
      const ziel = textzeileAb(basisZeile() + schritt, schritt);
      if (ziel >= 0) zeileSetzen(ziel);
    }
    function stropheVorZurueck(schritt) {
      const basis = Math.max(0, basisZeile());
      // Texte mit Zeitmarken haben oft keine Leerzeilen: dann gilt ein
      // Sprung um vier Zeilen als „Strophe".
      if (!zeilen.some((z) => z.leer)) {
        const ziel = begrenzt(basis + 4 * schritt, 0, zeilen.length - 1);
        if (ziel !== basis) zeileSetzen(ziel);
        return;
      }
      if (schritt > 0) {
        // nächste Strophe: hinter der nächsten Leerzeile
        let i = basis;
        while (i < zeilen.length && !zeilen[i].leer) i++;
        const ziel = textzeileAb(i, 1);
        if (ziel >= 0) zeileSetzen(ziel);
      } else {
        // vorige Strophe: vor dem Anfang der jetzigen
        const anfang = strophenAnfang(basis);
        const davor = textzeileAb(anfang - 1, -1);
        zeileSetzen(davor >= 0 ? strophenAnfang(davor) : textzeileAb(0, 1));
      }
    }

    zeilenKasten.addEventListener('click', (e) => {
      const el = e.target.closest('.stf-zeile');
      if (el) zeileSetzen(Number(el.dataset.i));
    });
    // Mausrad (und Wischen): freies Lesen, nach 4 s rollt der Text weich
    // zurück an die errechnete Stelle.
    const lesen = () => { lesenBis = Date.now() + LESEPAUSE_MS; };
    textKasten.addEventListener('wheel', lesen, { passive: true });
    textKasten.addEventListener('touchmove', lesen, { passive: true });

    /* ---------------- Tastatur (nur wenn das Fenster den Fokus hat) - */
    fenster.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      // Regler und Knöpfe behalten ihre eigenen Pfeiltasten
      const imRegler = e.target && e.target.matches && e.target.matches('input');
      if (e.key === 'Escape') {
        // Zuerst das Fenster - und NUR das Fenster: Das Vollbild darunter
        // bekommt diesen Tastendruck nicht mehr zu sehen.
        e.preventDefault(); e.stopPropagation();
        schliessen();
        return;
      }
      if (imRegler) return;
      const aktion = { ArrowUp: () => zeileVorZurueck(-1), ArrowDown: () => zeileVorZurueck(1),
        PageUp: () => stropheVorZurueck(-1), PageDown: () => stropheVorZurueck(1) }[e.key];
      if (aktion) { e.preventDefault(); e.stopPropagation(); aktion(); }
    });

    /* ---------------- Bedienleiste --------------------------------- */
    function mitlaufenAnzeigen() {
      const knopf = $('.stf-mitlaufen');
      knopf.textContent = mitlaufen ? '⏸' : '▶';
      knopf.title = mitlaufen ? 'Durchlaufen anhalten (die Musik läuft weiter)' : 'Durchlaufen fortsetzen';
      fenster.classList.toggle('stf-angehalten', !mitlaufen);
    }
    $('.stf-mitlaufen').addEventListener('click', () => {
      if (mitlaufen) {
        eingefroren = anteilJetzt();
        mitlaufen = false;
      } else {
        // Weiter von genau der Stelle, an der angehalten wurde
        mitlaufen = true;
        anker = { a: eingefroren, t: jetzt().t };
      }
      mitlaufenAnzeigen();
    });

    function tempoAnzeigen() {
      $('.stf-tempo-regler').value = String(w.tempo);
      $('.stf-tempo-wert').textContent = `${zahlText(w.tempo, 2)}×`;
    }
    function tempoSetzen(wert) {
      if (synchron) return;          // gilt nur ohne Zeitmarken
      const neu = tempoRunden(wert);
      if (neu === w.tempo) { tempoAnzeigen(); return; }
      // Vor dem Wechsel an der jetzigen Stelle ankern - sonst spränge der
      // Text, weil die neue Geschwindigkeit rückwirkend gälte. Ausnahme:
      // Noch im Vorspann bei automatischem Anker - dort steht der Text
      // ohnehin, und der Vorspann soll erhalten bleiben.
      const { t, d } = jetzt();
      if (mitlaufen && (anker || t > VORSPANN * d)) ankern(anteilJetzt());
      w.tempo = neu;
      tempoAnzeigen();
      merken();
    }
    $('.stf-tempo-regler').addEventListener('input', (e) => tempoSetzen(Number(e.target.value)));
    $('.stf-tempo-weniger').addEventListener('click', () => tempoSetzen(w.tempo - TEMPO_SCHRITT));
    $('.stf-tempo-mehr').addEventListener('click', () => tempoSetzen(w.tempo + TEMPO_SCHRITT));
    $('.stf-auto').addEventListener('click', () => {
      if (synchron) return;
      // Zurück zur Rechnung aus der Spielzeit: Tempo 1,0, kein Anker von Hand
      anker = null; mitlaufen = true; lesenBis = 0;
      mitlaufenAnzeigen();
      if (w.tempo !== 1) { w.tempo = 1; tempoAnzeigen(); merken(); }
    });

    /* Kopfhinweis, Tempo-Gruppe und Versatz-Knopf passend zum Modus */
    function modusAnzeigen() {
      fenster.classList.toggle('stf-synchron', synchron);
      $('.stf-hinweis').textContent = synchron ? 'zeitsynchron' : 'nicht zeitsynchron – per Klick nachführen';
      $('.stf-text').title = synchron
        ? 'Klick auf eine Zeile: Sie ist ab jetzt dran (Versatz für den ganzen Titel). Pfeiltasten: eine Zeile, Bild-Tasten: eine Strophe'
        : 'Klick auf eine Zeile: Sie rückt auf die Lesehöhe, der Text rollt von dort weiter. Pfeiltasten: eine Zeile, Bild-Tasten: eine Strophe';
      fenster.querySelectorAll('.stf-tempo button, .stf-tempo input').forEach((el) => { el.disabled = synchron; });
      $('.stf-tempo').title = synchron ? 'Tempo gilt nur für Texte ohne Zeitmarken' : '';
      versatzAnzeigen();
    }
    function versatzAnzeigen() {
      const knopf = $('.stf-versatz');
      const sichtbar = synchron && Math.abs(versatz) >= 0.05;
      knopf.hidden = !sichtbar;
      if (sichtbar) knopf.textContent = `Versatz zurücksetzen (${versatz > 0 ? '+' : '−'}${zahlText(Math.abs(versatz), 1)} s)`;
    }
    $('.stf-versatz').addEventListener('click', () => {
      versatz = 0;
      versaetze.delete(titelSchluessel);
      versatzAnzeigen();
    });

    function schriftAnzeigen() {
      fenster.style.setProperty('--stf-groesse', `${w.schrift}px`);
      $('.stf-schrift-kleiner').disabled = w.schrift <= SCHRIFT_MIN;
      $('.stf-schrift-groesser').disabled = w.schrift >= SCHRIFT_MAX;
    }
    function schriftSetzen(wert) {
      w.schrift = begrenzt(wert, SCHRIFT_MIN, SCHRIFT_MAX);
      schriftAnzeigen();
      rollenSofort = true;      // Umbruch neu - dieselbe Stelle sofort wieder zeigen
      merken();
    }
    $('.stf-schrift-kleiner').addEventListener('click', () => schriftSetzen(w.schrift - SCHRIFT_SCHRITT));
    $('.stf-schrift-groesser').addEventListener('click', () => schriftSetzen(w.schrift + SCHRIFT_SCHRITT));

    $('.stf-zu').addEventListener('click', () => schliessen());

    /* ---------------- Lage: verschieben, Größe, sichtbarer Bereich -- */
    // Gemerkte Lage + Bildschirm -> tatsächliche Lage. Was nicht mehr auf
    // den Bildschirm passt (z. B. nach einem Wechsel auf einen kleineren),
    // wird hereingerückt statt abgelehnt.
    function lageAnwenden() {
      const vw = global.innerWidth, vh = global.innerHeight;
      const breite = Math.min(w.breite, Math.max(BREITE_MIN, vw - 2 * RAND_PX));
      const hoehe = Math.min(w.hoehe, Math.max(HOEHE_MIN, vh - 2 * RAND_PX));
      const x = w.x === null ? vw - breite - 24 : w.x;          // Standard: rechts oben
      const y = w.y === null ? 90 : w.y;
      fenster.style.width = `${breite}px`;
      fenster.style.height = `${hoehe}px`;
      angewandt = { breite, hoehe };
      fenster.style.left = `${begrenzt(x, RAND_PX, Math.max(RAND_PX, vw - breite - RAND_PX))}px`;
      fenster.style.top = `${begrenzt(y, RAND_PX, Math.max(RAND_PX, vh - hoehe - RAND_PX))}px`;
    }
    global.addEventListener('resize', () => { if (!fenster.hidden) lageAnwenden(); });

    // Verschieben am Kopf (Pointer-Ereignisse: Maus, Stift und Finger)
    const kopf = $('.stf-kopf');
    let ziehen = null;
    kopf.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      const r = fenster.getBoundingClientRect();
      ziehen = { dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId };
      kopf.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    kopf.addEventListener('pointermove', (e) => {
      if (!ziehen || e.pointerId !== ziehen.id) return;
      w.x = Math.round(e.clientX - ziehen.dx);
      w.y = Math.round(e.clientY - ziehen.dy);
      lageAnwenden();
    });
    const ziehenEnde = (e) => {
      if (!ziehen || e.pointerId !== ziehen.id) return;
      ziehen = null;
      // Gemerkt wird, wo das Fenster wirklich steht (nach dem Hereinrücken)
      const r = fenster.getBoundingClientRect();
      w.x = Math.round(r.left); w.y = Math.round(r.top);
      merken();
    };
    kopf.addEventListener('pointerup', ziehenEnde);
    kopf.addEventListener('pointercancel', ziehenEnde);

    // Größe: CSS „resize" an der unteren rechten Ecke; hier nur beobachten.
    // Der Innenabstand oben/unten folgt der Höhe (Lesehöhe, siehe Rollen).
    // Von Hand geändert ist die Größe genau dann, wenn sie von der zuletzt
    // selbst gesetzten (lageAnwenden) abweicht - nur das wird gemerkt.
    const beobachter = new ResizeObserver(() => {
      if (fenster.hidden) return;
      const hoehe = textKasten.clientHeight;
      zeilenKasten.style.paddingTop = `${Math.round(hoehe * LESEHOEHE)}px`;
      zeilenKasten.style.paddingBottom = `${Math.round(hoehe * (1 - LESEHOEHE))}px`;
      const r = fenster.getBoundingClientRect();
      const breite = Math.round(r.width), hoeheFenster = Math.round(r.height);
      if (angewandt && (Math.abs(breite - angewandt.breite) > 1 || Math.abs(hoeheFenster - angewandt.hoehe) > 1)) {
        w.breite = Math.max(BREITE_MIN, breite);
        w.hoehe = Math.max(HOEHE_MIN, hoeheFenster);
        angewandt = { breite: w.breite, hoehe: w.hoehe };
        merken();
      }
      rollenSofort = true;
    });
    beobachter.observe(fenster);

    /* ---------------- Merken (wahlfrei über die Hülle) ------------- */
    function merken() {
      if (typeof huelle.speichern !== 'function') return;
      clearTimeout(speichernUhr);
      speichernUhr = setTimeout(() => {
        try { huelle.speichern(werteKopie()); } catch (_) { /* Speichern ist Komfort */ }
      }, SPEICHERN_VERZOEGERUNG_MS);
    }
    const werteKopie = () => ({ tempo: w.tempo, schrift: w.schrift, x: w.x, y: w.y, breite: w.breite, hoehe: w.hoehe });

    /* ---------------- Öffnen / Schließen --------------------------- */
    function oeffnen() {
      if (!fenster.hidden) { fenster.focus({ preventScroll: true }); return; }
      fenster.hidden = false;
      lageAnwenden();
      tempoAnzeigen();
      schriftAnzeigen();
      mitlaufenAnzeigen();
      rollenSofort = true;
      titelPruefen();
      if (!takt) takt = setInterval(() => { try { titelPruefen(); } catch (_) { /* nächster Takt */ } }, TAKT_MS);
      if (!bild) bild = global.requestAnimationFrame(bildSchleife);
      fenster.focus({ preventScroll: true });
    }
    function schliessen() {
      if (fenster.hidden) return;
      fenster.hidden = true;
      clearInterval(takt); takt = null;
      if (bild) { global.cancelAnimationFrame(bild); bild = null; }
    }

    tempoAnzeigen();
    schriftAnzeigen();
    return {
      oeffnen,
      schliessen,
      umschalten() { if (fenster.hidden) oeffnen(); else schliessen(); },
      istOffen: () => !fenster.hidden,
      werte: werteKopie,
      /** Nur zum Nachmessen: Anteil, Zeile auf der Lesehöhe, Anker. */
      diagnose() {
        const { t, d } = jetzt();
        const max = groessterBildlauf();
        return { anteil: Number(anteilJetzt().toFixed(3)), angezeigt: max ? Number((textKasten.scrollTop / max).toFixed(3)) : 0,
          zeileLesehoehe: zeileAufLesehoehe(), zeilen: zeilen.length, textzeilen: zeilen.filter((z) => !z.leer).length,
          position: Number(t.toFixed(1)), dauer: Number(d.toFixed(1)), tempo: w.tempo,
          anker: anker && { a: Number(anker.a.toFixed(3)), t: Number(anker.t.toFixed(1)) }, mitlaufen,
          synchron, aktuell, startAktuell: zeilen[aktuell] && zeilen[aktuell].start !== undefined ? zeilen[aktuell].start : null,
          versatz: Number(versatz.toFixed(2)),
          lesen: Date.now() < lesenBis };
      }
    };
  }

  global.SongtextFenster = Object.freeze({ erstellen, STANDARD });
})(typeof window !== 'undefined' ? window : globalThis);
