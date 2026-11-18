/* =====================================================================
   WIEDERGABE-REGELN – gemeinsam für PlayDecker und Jukeboxer (Auftrag 13)

   Wo PlayDecker und Jukeboxer denselben Begriff haben (Überblenddauer,
   feste Spielzeit), sollen Beschriftung, Wertebereich und Stufenlogik
   gleich sein - und zwar nicht durch zwei Abschriften, sondern durch
   EINE Stelle. Hier stehen deshalb nur reine Rechenregeln: keine
   Seitenelemente, kein Player, kein Server. Die Datei läuft so auch
   später unverändert in der Mobil-Version.

   WAS BEWUSST NICHT HIER STEHT: die eigentliche Blend-Mechanik
   (Lautstärkerampen, zwei Player gegeneinander). Im PlayDecker hängt sie
   fest an dessen zwei Decks, am Crossfader und am Wächter - sie
   herauszulösen hieße, der PlayDecker umzubauen. Der Jukeboxer baut
   seine Blende deshalb selbst, nach denselben Regeln von hier.

   Bereitgestellt als window.WiedergabeRegeln. Muss VOR app.js geladen
   werden, weil der PlayDecker deckSpielzeitAusStufe() hierher weiterreicht.
   ===================================================================== */
(function (global) {
  'use strict';

  /** Überblenddauer: 0 bis 20 Sekunden in ganzen Sekunden, 0 = harter Schnitt. */
  const UEBERBLENDUNG = Object.freeze({
    beschriftung: 'Überblenddauer', min: 0, max: 20, schritt: 1, standard: 4
  });

  /** Feste Spielzeit: Der Regler arbeitet mit STUFEN, nicht mit Sekunden.
      Stufe 0 = aus, Stufe n = n x 10 Sekunden, also 10 bis 600 s. So
      springt der Regler von „aus" direkt auf 10 s - dazwischen gibt es
      nichts (1 bis 9 Sekunden wären als Spielzeit sinnlos). */
  const SPIELZEIT = Object.freeze({
    beschriftung: 'Feste Spielzeit', stufeMin: 0, stufeMax: 60, sekundenJeStufe: 10
  });

  /** Stufe des Reglers -> Sekunden (0 = aus). */
  function spielzeitAusStufe(stufe) {
    const n = Number(stufe) || 0;
    return n <= 0 ? 0 : n * SPIELZEIT.sekundenJeStufe;
  }

  /** Sekunden -> Stufe des Reglers (Umkehrung, z. B. beim Wiederherstellen). */
  function stufeAusSpielzeit(sekunden) {
    const s = Number(sekunden) || 0;
    return s <= 0 ? 0 : Math.round(s / SPIELZEIT.sekundenJeStufe);
  }

  /** Sekunden als „m:ss". */
  function zeitText(sekunden) {
    const s = Math.max(0, Math.floor(Number(sekunden) || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  /** Anzeige der Überblenddauer: Wert und Zusatzzeile wie im PlayDecker. */
  function ueberblendWert(sekunden) { return `${sekunden} s`; }
  function ueberblendZusatz(sekunden) { return sekunden === 0 ? 'harter Schnitt' : 'weiche Überblendung'; }

  /** Anzeige der festen Spielzeit: Wert und Zusatzzeile wie im PlayDecker. */
  function spielzeitWert(sekunden) { return sekunden > 0 ? `${sekunden} s` : 'aus'; }
  function spielzeitZusatz(sekunden) {
    return sekunden > 0 ? `jeder Titel endet nach ${zeitText(sekunden)}` : 'Titel laufen in voller Länge';
  }

  /** Wann endet ein Titel WIRKLICH? Ist die Aufnahme kürzer als die feste
      Spielzeit, gewinnt die Aufnahme. Ist die Länge (noch) unbekannt (0),
      gilt die feste Spielzeit. 0 als Ergebnis heißt: unbekannt. */
  function spielEnde(dauer, festeSpielzeit) {
    const d = Number(dauer) || 0;
    const f = Number(festeSpielzeit) || 0;
    if (!f) return d;
    if (!d) return f;
    return Math.min(d, f);
  }

  /** Muss jetzt die Blende in den nächsten Titel beginnen? Ja, sobald die
      Restzeit bis zum Ende höchstens die Überblenddauer beträgt - dann ist
      die Blende genau zum Ende fertig (gleiche Regel wie im PlayDecker). */
  function blendeFaellig(ende, position, blendSekunden) {
    if (!(blendSekunden > 0) || !(ende > 0)) return false;
    const rest = ende - (Number(position) || 0);
    return rest > 0 && rest <= blendSekunden;
  }

  /* SPULEN (Auftrag 17) - dieselbe Rechnung für die Fortschrittsleiste
     des PlayDeckers und den Fortschrittsbalken des Jukeboxers. Den Player
     selbst bedient jeder Abspieler weiter auf seine Weise. */

  /** Welcher Anteil (0 bis 1) einer Fortschrittsleiste liegt unter dem
      Zeiger? x ist die waagerechte Stelle von Maus oder Finger, links und
      breite beschreiben die Leiste (alles in Bildschirmpunkten, z. B. aus
      getBoundingClientRect). Links daneben zählt als 0, rechts als 1. */
  function anteilAnStelle(x, links, breite) {
    if (!(breite > 0)) return 0;
    return Math.min(1, Math.max(0, ((Number(x) || 0) - links) / breite));
  }

  /** Wohin darf gespult werden? Nie vor den Anfang und nie näher ans Ende
      als `abstandEnde` Sekunden. Sonst meldet der Player sofort
      „Titelende", und statt zu spulen käme der nächste Titel.
      `ende` ist das Titelende in Sekunden (0 = unbekannt, dann Anfang). */
  function spulZiel(sekunden, ende, abstandEnde) {
    const grenze = Math.max((Number(ende) || 0) - (Number(abstandEnde) || 0), 0);
    return Math.min(Math.max(Number(sekunden) || 0, 0), grenze);
  }

  /** Darf in diesem Zustand des YouTube-Players gesprungen werden, OHNE
      dass der Sprung die Wiedergabe startet? (Nacharbeit Auftrag 17,
      Party-Regel.) Gemessen am 20.10.2026 mit einem Diagnose-Player:
      (1) „nur geladen" (5) und „zu Ende" (0): Ein Sprung STARTET die
          Wiedergabe - und zwar ohne jede Prüfung der Party-Regel. Ebenso
          „noch nicht gestartet" (-1). Dort also nie springen.
      (2) „pausiert" (2): bleibt pausiert, auch ohne Zwischenzustand.
      (3) „spielt" (1): spielt an der neuen Stelle weiter.
      (4) „puffert" (3): entsteht nur bei einem Player, der spielt oder
          gerade gestartet wird (der Sprung im pausierten Zustand puffert
          nicht, siehe (2)). Der Sprung startet also nichts, was nicht
          ohnehin startet. Wer genauer weiß, dass gerade nichts spielen
          soll, gibt `sollSpielen = false` mit - dann zählt Puffern nicht.
      Gilt für PlayDecker und Jukeboxer, auch in der Mobil-Version. */
  const YT_SPIELT = 1, YT_PAUSIERT = 2, YT_PUFFERT = 3;
  function sprungErlaubt(ytZustand, sollSpielen = true) {
    return ytZustand === YT_SPIELT || ytZustand === YT_PAUSIERT
      || (ytZustand === YT_PUFFERT && !!sollSpielen);
  }

  global.WiedergabeRegeln = Object.freeze({
    UEBERBLENDUNG, SPIELZEIT,
    spielzeitAusStufe, stufeAusSpielzeit, zeitText,
    ueberblendWert, ueberblendZusatz, spielzeitWert, spielzeitZusatz,
    spielEnde, blendeFaellig,
    anteilAnStelle, spulZiel, sprungErlaubt
  });
})(typeof window !== 'undefined' ? window : globalThis);
