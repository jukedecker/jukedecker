/* =====================================================================
   DEKOR „Weihnachten – Stube“ (Auftrag 18, Teil D; Vorlage W1-A)

   Zeichnet in die Dekor-Ebene (designs.js): Schneehaube, blinkende
   Lichterkette, Tannenzweige mit Kugeln, einen Tannenbaum mit sieben
   flackernden Kerzen und Stern, einen winkenden Weihnachtsmann und
   Geschenke. Alles in SVG, ohne Bilder von außen.

   ALLGEMEINE FIGUR: roter Mantel, weißer Bart, Mütze - kein Bezug zu
   einer Marke oder Werbefigur, keine Rentier-Figur mit roter Nase.

   NICHTS VERDECKT BEDIENELEMENTE: Alles liegt in der HINTEREN Ebene (unter
   allen Bedienelementen). Die Figuren stehen nur in freien Flächen, die
   beim Zeichnen gemessen werden:
   (1) PlayDecker: Baum und Weihnachtsmann unter dem Pult, zwischen den
       Decks (nur im breiten Dreispalten-Aufbau, wenn dort Platz ist).
   (2) Jukeboxer: Der Aufbau hat zwischen Plattenspieler und „Jetzt
       läuft“ keine freie Fläche (12 px Abstand). Der große Baum mit
       Geschenken und der Weihnachtsmann stehen deshalb im freien Feld
       rechts bzw. links neben dem Leuchtschild.
   (3) Handy (wenig Höhe): nur Schneehaube, Lichterkette und ein kleiner
       Kerzenbaum in einer Ecke, ohne Weihnachtsmann (Klasse dk-schlank).
   Bewegung: Kerzen flackern, Lichter blinken, der Stern funkelt, der
   Weihnachtsmann winkt. „Animationen gesamt: aus“ (Jukeboxer) und der
   Wunsch des Geräts nach reduzierter Bewegung halten alles an.
   ===================================================================== */
(function (global) {
  'use strict';

  const STIL = `
@keyframes dkwFunkeln { 50% { opacity: .35; } }
@keyframes dkwFlackern { 0%, 100% { transform: scale(1, 1); opacity: 1; } 20% { transform: scale(.85, 1.12); opacity: .85; } 45% { transform: scale(1.08, .9); } 70% { transform: scale(.92, 1.06); opacity: .92; } }
@keyframes dkwWinken { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-22deg); } }
.dkw-funkelt { animation: dkwFunkeln 1.6s ease-in-out infinite; }
.dkw-funkelt2 { animation: dkwFunkeln 1.6s ease-in-out .8s infinite; }
.dkw-stern { animation: dkwFunkeln 2.4s ease-in-out infinite; }
.dkw-flamme { animation: dkwFlackern .9s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
.dkw-f1 { animation-duration: 1.1s; animation-delay: -.3s; } .dkw-f2 { animation-duration: .8s; animation-delay: -.5s; } .dkw-f3 { animation-duration: 1.3s; animation-delay: -.2s; }
.dkw-winkarm { animation: dkwWinken 1.4s ease-in-out infinite; transform-box: fill-box; transform-origin: 0% 100%; }
.dekor-ebene .dkw-svg { position: absolute; overflow: visible; }
`;
  function stilEinsetzen() {
    if (document.getElementById('dk-stil-weihnachten')) return;
    const s = document.createElement('style');
    s.id = 'dk-stil-weihnachten';
    s.textContent = STIL;
    document.head.appendChild(s);
  }

  /* ---------------------------------------------------------------
     BAUSTEINE (SVG-Text; Maße in Einheiten, skaliert beim Einsetzen)
     --------------------------------------------------------------- */
  // Schneehaube über die ganze Breite b (Höhe h)
  function schnee(b, h) {
    let d = `M0 0 H${b} V${h * .5}`;
    for (let x = b; x > 0; x -= 46) d += ` Q${x - 12} ${h * (1.1 + (Math.round(x) % 3) * .25)} ${x - 23} ${h * .6} Q${x - 34} ${h * .2} ${x - 46} ${h * .55}`;
    return `<path d="${d} V0Z" fill="#fff" opacity=".95"/>`;
  }
  // Lichterkette mit blinkenden Birnen (abwechselnder Takt)
  function lichterkette(b, y, abstand = 60, r = 6) {
    const farben = ['#ff4d4d', '#ffd84d', '#4dff88', '#4dc3ff'];
    const n = Math.ceil(b / abstand);
    let s = `<path d="M0 ${y + 6} ${Array.from({ length: n }, (_, i) => `Q${i * abstand + abstand / 2} ${y + 30 * r / 6} ${i * abstand + abstand} ${y + 6}`).join(' ')}" stroke="#1e3a1e" stroke-width="2" fill="none"/>`;
    for (let i = 0; i < n; i++) {
      const f = farben[i % farben.length], x = i * abstand + abstand / 2, yy = y + 22 * r / 6;
      s += `<g class="${i % 2 ? 'dkw-funkelt' : 'dkw-funkelt2'}"><circle cx="${x}" cy="${yy}" r="${r}" fill="${f}"/><circle cx="${x}" cy="${yy}" r="${r * 2}" fill="${f}" opacity=".3"/></g>`;
    }
    return s;
  }
  // Tannenzweig mit Kugeln (von der Ecke schräg nach innen)
  function tannenzweig(x, y, spiegel, s) {
    let g = `<g transform="translate(${x} ${y}) scale(${spiegel ? -s : s} ${s})"><path d="M0 0 L120 60" stroke="#4a3018" stroke-width="5"/>`;
    for (let i = 0; i < 9; i++) {
      const px = i * 13, py = i * 6.5;
      g += `<path d="M${px} ${py} l-6 ${-22 + i} M${px} ${py} l${18 - i} ${-14} M${px} ${py} l-12 ${18 - i} M${px} ${py} l${14} ${16 - i}" stroke="#1f6b3a" stroke-width="3.5" stroke-linecap="round"/>`;
    }
    return g + `<circle cx="60" cy="40" r="9" fill="#d62839"/><circle cx="57" cy="37" r="3" fill="#fff" opacity=".7"/><circle cx="92" cy="58" r="7" fill="#e8c24a"/></g>`;
  }
  // Tannenbaum mit sieben Kerzen und Stern. (x, y) = Mitte am Boden des Topfs.
  // Höhe in Einheiten: 206 (Stern bis Topf).
  function tannenbaum(x, y, s, kerzen = 7) {
    const ebenen = [[0, 120, 70], [-38, 98, 58], [-72, 74, 44], [-102, 50, 30]];
    let g = `<g transform="translate(${x} ${y - 44 * s}) scale(${s})">
      <rect x="-9" y="0" width="18" height="22" fill="#5a3418"/><path d="M-26 22 h52 l-6 22 h-40Z" fill="#b3202e"/><rect x="-26" y="22" width="52" height="5" fill="#e8c24a"/>`;
    ebenen.forEach(([dy, breite, hoehe]) => {
      g += `<path d="M0 ${dy - hoehe} L${breite / 2} ${dy} H${-breite / 2}Z" fill="#1f6b3a"/><path d="M0 ${dy - hoehe} L${breite / 2} ${dy} H${breite / 2 - 8}Z" fill="#185a30"/>`;
    });
    [[-30, -8, '#d62839'], [24, -14, '#e8c24a'], [-16, -48, '#e8c24a'], [18, -56, '#d62839'], [-6, -86, '#d62839'], [32, 2, '#3a7bd5']].forEach(([kx, ky, f]) => {
      g += `<circle cx="${kx}" cy="${ky}" r="5" fill="${f}"/><circle cx="${kx - 1.5}" cy="${ky - 1.5}" r="1.5" fill="#fff" opacity=".7"/>`;
    });
    const orte = [[-56, -2], [56, -2], [-26, -40], [26, -40], [-18, -76], [18, -76], [0, -112]].slice(0, kerzen);
    orte.forEach(([kx, ky], i) => {
      g += `<rect x="${kx - 2.5}" y="${ky - 12}" width="5" height="12" fill="#fff6e0" stroke="#d8c8a0" stroke-width=".6"/>
        <g class="dkw-flamme dkw-f${i % 4}"><ellipse cx="${kx}" cy="${ky - 18}" rx="7" ry="9" fill="#ffb02e" opacity=".25"/><path d="M${kx} ${ky - 25} C${kx + 4} ${ky - 19} ${kx + 3} ${ky - 13} ${kx} ${ky - 13} C${kx - 3} ${ky - 13} ${kx - 4} ${ky - 19} ${kx} ${ky - 25}Z" fill="#ffcf4a"/><path d="M${kx} ${ky - 21} C${kx + 2} ${ky - 17} ${kx + 1.5} ${ky - 14} ${kx} ${ky - 14} C${kx - 1.5} ${ky - 14} ${kx - 2} ${ky - 17} ${kx} ${ky - 21}Z" fill="#fff"/></g>`;
    });
    g += `<g class="dkw-stern"><path d="M0 -146 l5 11 12 1 -9 8 3 12 -11 -6 -11 6 3 -12 -9 -8 12 -1Z" fill="#ffd84d"/><circle cx="0" cy="-138" r="16" fill="#ffd84d" opacity=".25"/></g></g>`;
    return g;
  }
  // Weihnachtsmann, winkend (allgemeine Figur). (x, y) = Mitte am Boden.
  // Höhe in Einheiten: 122 (Mütze bis Stiefel).
  function weihnachtsmann(x, y, s) {
    return `<g transform="translate(${x} ${y - 10 * s}) scale(${s})">
    <path d="M-30 0 Q-34 -50 0 -58 Q34 -50 30 0Z" fill="#c8102e"/><path d="M-30 0 H30" stroke="#fff" stroke-width="8"/><path d="M0 -58 V0" stroke="#fff" stroke-width="6"/>
    <rect x="-31" y="-22" width="62" height="8" fill="#1a1a1a"/><rect x="-6" y="-24" width="12" height="12" fill="none" stroke="#e8c24a" stroke-width="3"/>
    <rect x="-24" y="0" width="16" height="10" rx="3" fill="#1a1a1a"/><rect x="8" y="0" width="16" height="10" rx="3" fill="#1a1a1a"/>
    <circle cx="0" cy="-72" r="16" fill="#f1c9a5"/><circle cx="-6" cy="-75" r="2" fill="#222"/><circle cx="6" cy="-75" r="2" fill="#222"/><circle cx="0" cy="-70" r="3" fill="#e89a8a"/>
    <path d="M-16 -70 Q-20 -44 0 -38 Q20 -44 16 -70 Q8 -62 0 -64 Q-8 -62 -16 -70Z" fill="#fff"/>
    <path d="M-17 -80 Q0 -112 22 -96 L18 -84Z" fill="#c8102e"/><rect x="-19" y="-86" width="38" height="8" rx="4" fill="#fff"/><circle cx="24" cy="-96" r="6" fill="#fff"/>
    <g class="dkw-winkarm"><path d="M26 -44 Q44 -60 40 -84" stroke="#c8102e" stroke-width="11" stroke-linecap="round" fill="none"/><circle cx="40" cy="-88" r="7" fill="#fff"/></g>
    <path d="M-26 -44 Q-36 -26 -30 -14" stroke="#c8102e" stroke-width="11" stroke-linecap="round" fill="none"/></g>`;
  }
  function geschenk(x, y, b, h, f1, f2) {
    return `<g><rect x="${x}" y="${y - h}" width="${b}" height="${h}" fill="${f1}"/><rect x="${x + b / 2 - b * .09}" y="${y - h}" width="${b * .18}" height="${h}" fill="${f2}"/><rect x="${x}" y="${y - h * .6}" width="${b}" height="${Math.max(3, h * .2)}" fill="${f2}"/><path d="M${x + b / 2} ${y - h} q${-b * .32} ${-b * .32} ${-b * .36} ${-b * .05} q${b * .18} ${b * .09} ${b * .36} ${b * .05} q${b * .32} ${-b * .32} ${b * .36} ${-b * .05} q${-b * .18} ${b * .09} ${-b * .36} ${b * .05}" fill="${f2}"/></g>`;
  }
  const svg = (klasse, inhalt) => `<svg class="dkw-svg ${klasse}" xmlns="http://www.w3.org/2000/svg" style="left:0;top:0" width="100%" height="100%">${inhalt}</svg>`;

  /* ---------------------------------------------------------------
     GEMEINSAM: Schneehaube, Lichterkette, Zweige in den oberen Ecken
     --------------------------------------------------------------- */
  function rahmen(b, schlank) {
    const hSchnee = schlank ? 10 : 22;
    const yLicht = schlank ? 2 : 22;
    return schnee(b, hSchnee) + lichterkette(b, yLicht, schlank ? 38 : 60, schlank ? 3.5 : 6)
      + (schlank ? '' : tannenzweig(-6, 6, false, .9) + tannenzweig(b + 6, 6, true, .9));
  }

  // Kleiner Kerzenbaum für die schlanke Fassung (Handy): obere rechte Ecke
  const eckbaum = (b) => tannenbaum(b - 26, 52, .22, 5);

  global.PlayListerDesigns && global.PlayListerDesigns.dekorAnmelden('weihnachten-stube', {
    /* --- PlayDecker: Baum mit Kerzen und Weihnachtsmann unter dem Pult --- */
    playdecker(ebene) {
      stilEinsetzen();
      const { hinten, gehaeuse, lage } = ebene;
      function zeichnen() {
        const b = gehaeuse.clientWidth;
        let figuren = '';
        const pult = lage('.mitte'), a = lage('#deck-a-karte'), bk = lage('#deck-b-karte'), queues = lage('.queues');
        // Nur im Dreispalten-Aufbau: Pult steht ZWISCHEN den Decks
        if (pult && a && bk && queues && pult.x > a.x + a.b && pult.x + pult.b < bk.x + 1) {
          const oben = pult.y + pult.h + 4, unten = queues.y - 4;
          const hoehe = unten - oben;
          if (hoehe >= 60) {
            const s = Math.min(.62, hoehe / 206);
            const mitte = pult.x + pult.b * .4;
            figuren = tannenbaum(mitte, unten, s) + weihnachtsmann(mitte + 110 * s * 1.6, unten, s * .95);
          }
        }
        hinten.innerHTML = svg('dk-voll', rahmen(b, false) + figuren) + svg('dk-schlank', rahmen(b, true) + eckbaum(b));
      }
      zeichnen();
      return { anpassen: zeichnen };
    },

    /* --- Jukeboxer: großer Baum mit Geschenken und Weihnachtsmann neben
       dem Leuchtschild (dort ist Platz) --- */
    jukeboxer(ebene) {
      stilEinsetzen();
      const { hinten, gehaeuse, lage } = ebene;
      function zeichnen() {
        const b = gehaeuse.clientWidth;
        let figuren = '';
        // Das Schild ist ein Kasten über die ganze Breite - gemessen wird
        // die Schrift (Leuchtschrift links, Unterzeile rechts).
        const text = lage('.jbx-schild-text'), sub = lage('.jbx-schild-sub'), genres = lage('.jbx-genre-tasten');
        const schild = text && sub ? { x: text.x, y: text.y, b: sub.x + sub.b - text.x } : null;
        if (schild && genres && genres.y > schild.y) {
          const unten = genres.y - 6, hoehe = unten - 6;
          if (hoehe >= 60) {
            const s = Math.min(1.35, hoehe / 206);
            const rechts = schild.x + schild.b, frei = b - rechts;
            const baumX = rechts + Math.min(frei * .45, 200);
            const mannX = schild.x - Math.min(schild.x * .45, 170);
            figuren = geschenk(baumX - 80 * s - 30 * s, unten, 44 * s, 34 * s, '#d62839', '#e8c24a')
              + geschenk(baumX + 70 * s, unten, 36 * s, 28 * s, '#1f6b3a', '#fff')
              + tannenbaum(baumX, unten, s)
              + weihnachtsmann(mannX, unten, Math.min(s * 1.4, hoehe / 122 * .95));
          }
        }
        hinten.innerHTML = svg('dk-voll', rahmen(b, false) + figuren) + svg('dk-schlank', rahmen(b, true) + eckbaum(b));
      }
      zeichnen();
      return { anpassen: zeichnen };
    },
  });
})(window);
