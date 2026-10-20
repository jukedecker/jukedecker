/* ======================================================================
   JukeDecker - Kern-Probe fuer M17 ("Kern im Paket")

   DIESE DATEI WIRD NIE DIREKT VON DER MESSSEITE GELADEN. Das Bauskript
   werkzeuge/kern_probe_paket_bauen.py packt sie (zusammen mit
   probe_stil.css) in eine Probe-Datei im Paketformat. Ralle bringt diese
   Datei aufs Geraet, die Messseite liest sie ein, legt den Code in
   IndexedDB ab und startet ihn von dort - auf zwei Wegen:
   (1) als klassisches Skript ueber eine Blob-Adresse in <script src>,
   (2) als Modul ueber import() einer Blob-Adresse.
   Genau das soll gemessen werden: Darf Code, der NICHT von github.io
   kommt, sondern aus dem Geraetespeicher, auf dem Geraet laufen?

   Das Bauskript setzt davor die Zeile  const STAND = "...";  (eine
   Kennung, die bei jedem Bau neu ausgewuerfelt wird). Daran sieht man im
   Protokoll, dass wirklich der Code aus der Probe-Datei lief.

   Was die Probe sichtbar tut:
   (1) Sie zeichnet einen eigenen Probe-Plattenteller, der sich dreht
       (Gestaltung aus probe_stil.css, ebenfalls aus der Probe-Datei).
   (2) Sie prueft, ob ihr Stil wirkt (die Drehung ist eine Animation aus
       dem Stil der Probe-Datei).
   (3) Sie spielt einen Testtitel ueber den Player der Messseite.
   Schnittstelle zur Messseite (api): flaeche, log(text), titelSpielen(s).
   ====================================================================== */

/** Startet die Probe. art = 'skript' oder 'modul' (welcher Weg lief). */
async function kernProbeStarten(api, art) {
  const t0 = performance.now();
  api.log(`Probe ${STAND} laeuft als ${art}.`);

  // (1) Probe-Plattenteller zeichnen
  const flaeche = api.flaeche;
  flaeche.textContent = '';
  const huelle = document.createElement('div');
  huelle.className = 'kp-huelle';
  huelle.innerHTML =
    '<div class="kp-teller"><div class="kp-platte"><div class="kp-etikett">' +
    '<span>KERN</span><b></b></div></div></div>' +
    '<div class="kp-schrift"></div>';
  huelle.querySelector('.kp-etikett b').textContent = STAND.slice(0, 6);
  huelle.querySelector('.kp-schrift').textContent = `Probe ${STAND} · Weg: ${art}`;
  flaeche.appendChild(huelle);

  // (2) Wirkt der Stil aus der Probe-Datei? Die Platte bekommt ihre
  // Drehung NUR von dort (Animation "kpDrehen").
  const platte = huelle.querySelector('.kp-platte');
  const animation = getComputedStyle(platte).animationName;
  const stilWirkt = animation === 'kpDrehen';
  api.log(`Stil aus der Probe-Datei wirkt: ${stilWirkt ? 'ja' : 'NEIN'} (Animation "${animation}"). Zeichnen dauerte ${Math.round(performance.now() - t0)} ms.`);

  // (3) Testtitel ueber den Player der Messseite
  const ergebnis = await api.titelSpielen(10);
  api.log(`Testtitel ueber den Player der Messseite: ${ergebnis.ok ? 'OK' : 'NICHT OK'} - ${ergebnis.text}`);
  return { stand: STAND, art, stilWirkt, wiedergabe: ergebnis.ok };
}
