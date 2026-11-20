/* =====================================================================
   DEKOR „Beach – Strand-Panorama“ (Auftrag 18, Teil E; Vorlage BK-4)

   Zeichnet in die HINTERE Dekor-Ebene (designs.js) ein Strand-Panorama:
   Abendhimmel mit Sonne, Wolken und Möwen, bewegtes Meer mit glitzernder
   Spiegelung und Segelboot, Sandstrand mit Muscheln, oben das Strohdach;
   dazu Detail-Palmen links und rechts, Surfbrett im Sand, Fackeln mit
   Lichtschein und Hula-Tänzerinnen in Farbe (die langen Haare liegen
   HINTER dem Oberkörper - im Mockup korrigiert). Alles SVG, keine Bilder
   von außen.

   NICHTS VERDECKT BEDIENELEMENTE: Alles liegt in der hinteren Ebene. Die
   Szene ist durch die leicht durchsichtigen Felder und das Glas des
   Plattenspieler-Fensters zu sehen (beach-panorama.css). Figuren stehen
   nur in gemessenen freien Flächen:
   (1) PlayDecker: drei Tänzerinnen, Surfbrett und Fackel unter dem Pult
       (Dreispalten-Aufbau, wenn dort Platz ist).
   (2) Jukeboxer: Zwischen Plattenspieler und „Jetzt läuft“ ist keine
       freie Fläche (12 px). Fünf Tänzerinnen in einer Reihe, Surfbrett
       und Fackel stehen deshalb rechts neben dem Leuchtschild auf einem
       Sandstreifen, die Palme der „freien Fläche“ links daneben.
   (3) Handy (Höhe bis 560 px): Strohdach, Himmel und Meer als
       Hintergrund und eine Palmkrone, ohne Tänzerinnen (dk-schlank).

   LEISTUNG: Was sich bewegt (Wellen, Glitzern, Palmen, Fackeln,
   Tänzerinnen), steckt in EIGENEN kleinen SVG-Elementen. Der Browser
   verschiebt bzw. blendet sie, ohne die ganze Szene neu zu zeichnen.
   „Animationen gesamt: aus“ (Jukeboxer) und „reduzierte Bewegung“ halten
   alles an.
   ===================================================================== */
(function (global) {
  'use strict';

  const STIL = `
@keyframes dkbWellen { from { transform: translateX(0); } to { transform: translateX(-60px); } }
@keyframes dkbGlitzern { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
@keyframes dkbWiegen { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(1.2deg); } }
@keyframes dkbHula { 0%, 100% { transform: translateX(-4px) rotate(-3deg); } 50% { transform: translateX(4px) rotate(3deg); } }
@keyframes dkbArme { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }
@keyframes dkbFlackern { 0%, 100% { transform: scale(1, 1); opacity: 1; } 20% { transform: scale(.85, 1.12); opacity: .85; } 45% { transform: scale(1.08, .9); } 70% { transform: scale(.92, 1.06); opacity: .92; } }
@keyframes dkbSchein { 50% { opacity: .55; } }
.dekor-ebene .dkb { position: absolute; left: 0; top: 0; overflow: visible; }
.dekor-ebene .dkb-wellen { animation: dkbWellen 6s linear infinite; will-change: transform; }
.dekor-ebene .dkb-glitzer { animation: dkbGlitzern 1.8s ease-in-out infinite; will-change: opacity; }
.dekor-ebene .dkb-palme { animation: dkbWiegen 5s ease-in-out infinite; will-change: transform; }
.dkb-hula { animation: dkbHula 1.2s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
.dkb-arme { animation: dkbArme 1.2s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 50%; }
.dkb-h1 { animation-delay: -.3s; } .dkb-h2 { animation-delay: -.6s; } .dkb-h3 { animation-delay: -.9s; }
.dkb-flamme { animation: dkbFlackern .9s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
.dkb-schein { animation: dkbSchein 1.6s ease-in-out infinite; }
`;
  function stilEinsetzen() {
    if (document.getElementById('dk-stil-beach')) return;
    const s = document.createElement('style');
    s.id = 'dk-stil-beach';
    s.textContent = STIL;
    document.head.appendChild(s);
  }
  let nummer = 0;

  /* ---------------------------------------------------------------
     BAUSTEINE (SVG-Text)
     --------------------------------------------------------------- */
  function hibiskus(x, y, r, farbe) {
    let g = `<g transform="translate(${x} ${y})">`;
    for (let i = 0; i < 5; i++) g += `<ellipse cx="0" cy="${-r * .6}" rx="${r * .55}" ry="${r * .7}" fill="${farbe}" transform="rotate(${i * 72})"/>`;
    return g + `<circle r="${r * .22}" fill="#ffd84d"/></g>`;
  }
  // Himmel mit Sonne am Horizont, Wolkenstreifen und Möwen (b breit, hz Horizont)
  function himmel(b, hz) {
    const id = `dkbH${++nummer}`;
    const sx = b / 2;
    let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a5a"/><stop offset=".35" stop-color="#7a2a7a"/><stop offset=".7" stop-color="#e8466b"/><stop offset="1" stop-color="#ffb347"/></linearGradient>
      <radialGradient id="${id}s"><stop offset="0" stop-color="#fff3b0"/><stop offset=".35" stop-color="#ffd36a"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient></defs>
      <rect width="${b}" height="${hz}" fill="url(#${id})"/>
      <circle cx="${sx}" cy="${hz}" r="${Math.min(230, hz * .8)}" fill="url(#${id}s)" opacity=".55"/>
      <circle cx="${sx}" cy="${hz + 10}" r="${Math.min(78, hz * .3)}" fill="#ffd36a"/>`;
    [[.1, .2], [.42, .27], [.74, .17]].forEach(([fx, fy], i) => {
      const x = b * fx, y = hz * fy;
      s += `<path d="M${x} ${y} q60 -18 120 0 q40 -10 80 4" stroke="#ffd8b0" stroke-width="${5 - i}" stroke-linecap="round" fill="none" opacity=".45"/>`;
    });
    [[.15, .3], [.18, .35], [.84, .25]].forEach(([fx, fy]) => {
      const x = b * fx, y = hz * fy;
      s += `<path d="M${x} ${y} q8 -7 16 0 q8 -7 16 0" stroke="#2a1030" stroke-width="2.4" fill="none"/>`;
    });
    return s;
  }
  // Meer (Grundfläche) mit Segelboot am Horizont
  function meer(b, hz, unten) {
    return `<rect y="${hz}" width="${b}" height="${unten - hz}" fill="#1c3a74"/><rect y="${hz}" width="${b}" height="18" fill="#3a4f8a" opacity=".7"/>
      <g transform="translate(${b * .78} ${hz - 2})"><path d="M0 0 h40 l-6 8 h-28Z" fill="#2a1030"/><path d="M20 0 V-34 L36 -4Z" fill="#fff4dc" opacity=".9"/><path d="M18 -30 L6 -4 H18Z" fill="#ffd8b0" opacity=".8"/></g>`;
  }
  // Wellenreihen (eigene Ebene, wird verschoben)
  function wellen(b, hz, unten) {
    let s = '';
    const reihen = Math.max(2, Math.min(7, Math.floor((unten - hz - 8) / 14)));
    for (let r = 0; r < reihen; r++) {
      const y = hz + 12 + r * 14, n = Math.ceil((b + 120) / (30 + r * 4)) + 1;
      s += `<path d="M-60 ${y} ${Array.from({ length: n }, () => `q${15 + r * 2} -${3 + r * .6} ${30 + r * 4} 0`).join(' ')}" stroke="#5a7ac0" stroke-width="${1 + r * .25}" fill="none" opacity="${.5 - r * .04}"/>`;
    }
    return s;
  }
  // Sonnenspiegelung (eigene Ebene, glitzert)
  function glitzer(b, hz, unten) {
    let s = '';
    const n = Math.max(3, Math.min(9, Math.floor((unten - hz - 6) / 11)));
    for (let i = 0; i < n; i++) s += `<rect x="${b / 2 - 70 + i * 4 + (i % 2) * 8}" y="${hz + 6 + i * 11}" width="${140 - i * 12}" height="3" rx="1.5" fill="#ffd36a" opacity="${.85 - i * .08}"/>`;
    return s;
  }
  // Sandstrand ab y bis h (darunter einfach Sand)
  function sand(b, y, h) {
    let s = `<defs><linearGradient id="dkbS${++nummer}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8c98a"/><stop offset="1" stop-color="#b8925a"/></linearGradient></defs>
      <path d="M0 ${y} Q${b * .25} ${y - 14} ${b * .5} ${y - 4} T${b} ${y - 10} V${h} H0Z" fill="url(#dkbS${nummer})"/>
      <path d="M0 ${y + 10} Q${b * .3} ${y} ${b * .55} ${y + 8} T${b} ${y + 4}" stroke="#fff4dc" stroke-width="3" fill="none" opacity=".6"/>`;
    [[.08, 14], [.28, 22], [.73, 18], [.88, 26]].forEach(([fx, dy], i) => {
      const x = b * fx;
      s += `<path d="M${x} ${y + dy} q6 -8 12 0 q-6 4 -12 0Z" fill="${['#ffd8e8', '#fff', '#ffe0b0', '#fff'][i]}" stroke="#c9a46a" stroke-width=".8"/>`;
    });
    return s;
  }
  // Strohdach über die ganze Breite (Höhe etwa 40)
  function strohdach(b, faktor = 1) {
    const zacken = Math.ceil(b / 25);
    return `<path d="M0 0 H${b} V${20 * faktor} ${Array.from({ length: zacken }, (_, i) => `L${b - i * 25 - 12} ${(32 + (i % 3) * 7) * faktor} L${b - i * 25 - 25} ${20 * faktor}`).join(' ')} Z" fill="#c8a24a" stroke="#8a6a20"/>`
      + Array.from({ length: Math.ceil(b / 20) }, (_, i) => `<path d="M${i * 20 + 6} 2 l3 ${(18 + (i % 4) * 4) * faktor}" stroke="#a8842a" stroke-width="1.4"/>`).join('');
  }
  // Detail-Palme: Stamm aus Ringen, gefiederte Blätter, Kokosnüsse. Fuß bei (x, y).
  function palme(x, y, h, biegung) {
    const kx = x + biegung, ky = y - h;
    let g = '';
    for (let i = 0; i < 16; i++) {
      const t = i / 16, t2 = (i + 1) / 16;
      const px = x + biegung * t * t, py = y - h * t, qx = x + biegung * t2 * t2, qy = y - h * t2, br = (15 - 7 * t) * Math.min(1, h / 300);
      g += `<path d="M${px - br} ${py} L${qx - br + 1} ${qy} L${qx + br - 1} ${qy} L${px + br} ${py}Z" fill="${i % 2 ? '#7a4a22' : '#a8743a'}"/>`;
    }
    const s = Math.min(1, h / 300);
    const blatt = (w, l) => {
      let b2 = `<g transform="translate(${kx} ${ky}) rotate(${w})"><path d="M0 0 Q${l * .5} -${l * .22} ${l} ${l * .12}" stroke="#1f6b34" stroke-width="3.5" fill="none"/>`;
      for (let i = 1; i < 16; i++) {
        const t = i / 16, px = l * t, py = -l * .22 * 4 * t * (1 - t) * .5 + l * .12 * t * t, fl = (1 - Math.abs(t - .4)) * l * .22;
        b2 += `<path d="M${px} ${py} l${fl * .45} ${-fl}" stroke="${i % 2 ? '#2f8f4a' : '#1f6b34'}" stroke-width="4.5" stroke-linecap="round"/><path d="M${px} ${py} l${fl * .55} ${fl * .8}" stroke="${i % 2 ? '#1f6b34' : '#2f8f4a'}" stroke-width="4.5" stroke-linecap="round"/>`;
      }
      return b2 + '</g>';
    };
    [-160, -125, -90, -55, -20, 15, 160, 195].forEach((w, i) => { g += blatt(w, (120 + (i % 3) * 22) * s); });
    g += `<circle cx="${kx - 8 * s}" cy="${ky + 10 * s}" r="${9 * s}" fill="#5a3a18"/><circle cx="${kx + 8 * s}" cy="${ky + 12 * s}" r="${9 * s}" fill="#6b4a1e"/><circle cx="${kx}" cy="${ky + 20 * s}" r="${8 * s}" fill="#4a2a10"/>`;
    return g;
  }
  // Tänzerin: Blumenkranz, Blumenkette, Grasrock in zwei Lagen, Armbänder.
  // Lange Haare HINTER dem Oberkörper. (x, y) = Füße; Höhe etwa 130 Einheiten.
  function taenzerin(x, y, s, phase, haut, top, haar) {
    let g = `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="2" rx="30" ry="5" fill="#000" opacity=".22"/><g class="dkb-hula dkb-h${phase}">`;
    g += `<path d="M-8 0 Q-12 -22 -9 -42 M8 0 Q12 -22 9 -42" stroke="${haut}" stroke-width="8" stroke-linecap="round" fill="none"/><path d="M-13 -3 h9 M4 -3 h9" stroke="#ffd84d" stroke-width="2"/>`;
    for (let lage = 0; lage < 2; lage++) for (let i = -8; i <= 8; i++) {
      g += `<path d="M${i * 2.6} ${-66 + lage * 8} Q${i * 3.4 + (i % 2 ? 2 : -2)} ${-44 + lage * 6} ${i * 4} ${-22 + lage * 2}" stroke="${[['#8fb84a', '#c9a24a', '#6f9a3a'], ['#b8c860', '#d8b45a', '#9ab84a']][lage][(i + 9) % 3]}" stroke-width="2.6" fill="none"/>`;
    }
    g += `<path d="M-22 -68 Q0 -62 22 -68 L21 -61 Q0 -55 -21 -61Z" fill="#3b6b2a"/>`;
    for (let i = -3; i <= 3; i++) g += hibiskus(i * 6.5, -64, 3.2, ['#ff5fa2', '#ffd84d', '#fff', '#ff9a2a'][(i + 4) % 4]);
    // Haare zuerst - also HINTER Oberkörper und Armen
    g += `<path d="M-11 -112 Q-20 -96 -18 -78 Q-15 -72 -10 -76 L10 -76 Q15 -72 18 -78 Q20 -96 11 -112Z" fill="${haar}"/>`;
    g += `<path d="M-14 -68 Q-16 -98 0 -100 Q16 -98 14 -68Z" fill="${haut}"/><path d="M-14 -88 Q-7 -82 0 -86 Q7 -82 14 -88 V-79 Q7 -74 0 -77 Q-7 -74 -14 -79Z" fill="${top}"/>`;
    g += `<g class="dkb-arme dkb-h${phase}"><path d="M-13 -94 Q-34 -100 -50 -88 Q-56 -84 -60 -86" stroke="${haut}" stroke-width="6.5" fill="none" stroke-linecap="round"/><path d="M13 -94 Q34 -90 48 -102 Q52 -106 57 -105" stroke="${haut}" stroke-width="6.5" fill="none" stroke-linecap="round"/><circle cx="-48" cy="-89" r="4" fill="none" stroke="#ffd84d" stroke-width="2"/><circle cx="46" cy="-101" r="4" fill="none" stroke="#ffd84d" stroke-width="2"/></g>`;
    for (let r = 0; r < 2; r++) for (let i = -5; i <= 5; i++) g += `<circle cx="${i * 2.8}" cy="${-96 + Math.abs(i) * .4 + r * 5 + 4}" r="2.6" fill="${['#ff5fa2', '#ffd84d', '#fff', '#ff9a2a', '#e8264f'][(i + 5 + r * 2) % 5]}"/>`;
    g += `<circle cx="0" cy="-110" r="10.5" fill="${haut}"/><circle cx="-3.5" cy="-111" r="1.2" fill="#2a1408"/><circle cx="3.5" cy="-111" r="1.2" fill="#2a1408"/><path d="M-3 -106 q3 2.5 6 0" stroke="#8a3a2a" stroke-width="1.2" fill="none"/>`;
    g += `<path d="M-11 -113 Q0 -128 11 -113 Q6 -119 0 -119 Q-6 -119 -11 -113Z" fill="${haar}"/>`;
    for (let i = -4; i <= 4; i++) g += hibiskus(i * 3, -119 + Math.abs(i) * .8, 2.6, ['#ff3d7a', '#ffd84d', '#fff', '#ff9a2a'][(i + 8) % 4]);
    return g + '</g></g>';
  }
  function taenzerinnen(x, y, s, anzahl) {
    const tops = ['#e8264f', '#ff9a2a', '#18a6a6', '#ff5fa2', '#ffd84d'];
    const haut = ['#c98e5a', '#a86a3a', '#e0ae80', '#b8794a', '#8a5a32'];
    const haar = ['#1a0f08', '#3a1a08', '#1a0f08', '#4a2a10', '#1a0f08'];
    let g = '';
    for (let i = 0; i < anzahl; i++) g += taenzerin(x + (i - (anzahl - 1) / 2) * 56 * s, y + (i % 2) * 5 * s, s * (i % 2 ? .95 : 1), i % 4, haut[i % 5], tops[i % 5], haar[i % 5]);
    return g;
  }
  // Fackel mit Lichtschein; (x, y) = Spitze des Stabs, Stab 140 lang
  function fackel(x, y, s) {
    return `<g transform="translate(${x} ${y}) scale(${s})"><circle class="dkb-schein" cx="0" cy="-34" r="46" fill="#ff9a2a" opacity=".16"/><circle cx="0" cy="-34" r="24" fill="#ffb347" opacity=".22"/>
      <path d="M-4 0 L-6 140 M4 0 L6 140" stroke="#5a3418" stroke-width="5"/><path d="M-5 30 h10 M-5 60 h10 M-5 90 h10" stroke="#3a2008" stroke-width="2"/>
      <path d="M-12 -14 h24 l-4 16 h-16Z" fill="#7a4a22"/>
      <g class="dkb-flamme"><path d="M0 -58 C16 -36 12 -18 0 -16 C-12 -18 -16 -36 0 -58Z" fill="#ff7a1a"/><path d="M0 -44 C8 -32 6 -22 0 -20 C-6 -22 -8 -32 0 -44Z" fill="#ffd84d"/><path d="M0 -34 C3 -28 2 -23 0 -22 C-2 -23 -3 -28 0 -34Z" fill="#fff"/></g></g>`;
  }
  function surfbrett(x, y, s) {
    return `<g transform="translate(${x} ${y}) rotate(-8) scale(${s})"><path d="M0 0 Q-22 -80 0 -170 Q22 -80 0 0Z" fill="#fffaf0" stroke="#d8c8a8" stroke-width="2"/><path d="M0 -6 V-164" stroke="#ff6b2c" stroke-width="5"/><path d="M-10 -60 Q0 -66 10 -60" stroke="#ff6b2c" stroke-width="3" fill="none"/></g>`;
  }

  /* ---------------------------------------------------------------
     EIN SVG-ELEMENT je Teil (Bewegtes einzeln, siehe LEISTUNG)
     --------------------------------------------------------------- */
  const teil = (klasse, b, h, inhalt, stil = '') =>
    `<svg class="dkb ${klasse}" xmlns="http://www.w3.org/2000/svg" width="${Math.max(1, b)}" height="${Math.max(1, h)}" style="${stil}">${inhalt}</svg>`;
  const palmenTeil = (klasse, x, fussY, h, biegung) => {
    // eigenes Element, Drehpunkt am Fuß
    const breite = 2 * (Math.abs(biegung) + 200), links = x - breite / 2, oben = fussY - h - 160;
    return teil(`dkb-palme ${klasse}`, breite, h + 170, palme(breite / 2, h + 160, h, biegung),
      `left:${links}px;top:${oben}px;transform-origin:50% ${h + 160}px`);
  };

  /** Die Szene: Himmel bis hz, Meer bis sandY, Sand bis h. */
  function szene(b, h, hz, sandY) {
    return teil('', b, hz + 4, himmel(b, hz))
      + teil('', b, sandY - hz + 4, meer(b, 0, sandY - hz), `top:${hz}px`)
      + teil('dkb-wellen', b + 120, sandY - hz, wellen(b + 120, 0, sandY - hz), `top:${hz}px`)
      + teil('dkb-glitzer', b, sandY - hz, glitzer(b, 0, sandY - hz), `top:${hz}px`)
      + teil('', b, h - sandY + 16, sand(b, 14, h - sandY + 16), `top:${sandY - 14}px`)
      + teil('', b, 46, strohdach(b));
  }
  function szeneSchlank(b, h, hz) {
    return teil('dk-schlank', b, hz + 4, himmel(b, hz))
      + teil('dk-schlank', b, h - hz, meer(b, 0, h - hz), `top:${hz}px`)
      + teil('dk-schlank dkb-wellen', b + 120, h - hz, wellen(b + 120, 0, h - hz), `top:${hz}px`)
      + teil('dk-schlank', b, 30, strohdach(b, .6))
      // eine Palmkrone in der oberen linken Ecke
      + teil('dk-schlank dkb-palme', 150, 110, palme(10, 260, 200, 20).replace(/^/, ''), 'left:-40px;top:-150px;transform-origin:50px 260px');
  }

  global.PlayListerDesigns && global.PlayListerDesigns.dekorAnmelden('beach-panorama', {
    /* --- PlayDecker --- */
    playdecker(ebene) {
      stilEinsetzen();
      const { hinten, gehaeuse, lage } = ebene;
      function zeichnen() {
        const b = gehaeuse.clientWidth, h = gehaeuse.clientHeight;
        const queues = lage('.queues'), steuer = lage('#deck-a-karte .deck-steuer'), pult = lage('.mitte');
        const a = lage('#deck-a-karte'), bk = lage('#deck-b-karte');
        const sandY = queues ? queues.y - 26 : h * .5;
        const hz = steuer ? Math.min(steuer.y - 10, sandY - 60) : sandY * .7;
        let voll = szene(b, h, hz, sandY)
          + palmenTeil('dk-voll', 18, sandY + 30, Math.min(340, sandY - 20), 50)
          + palmenTeil('dk-voll', b - 18, sandY + 30, Math.min(340, sandY - 20), -50);
        // Unter dem Pult: drei Tänzerinnen, Surfbrett und Fackel (nur, wenn Platz ist)
        if (pult && a && bk && queues && pult.x > a.x + a.b && pult.x + pult.b < bk.x + 1) {
          const oben = pult.y + pult.h + 4, unten = queues.y - 4, hoehe = unten - oben;
          if (hoehe >= 60) {
            const s = Math.min(.66, hoehe / 135);
            const mx = pult.x + pult.b / 2;
            voll += teil('dk-voll', b, h, surfbrett(mx - 112 * s * 1.5, unten, s * .8)
              + fackel(mx + 112 * s * 1.6, unten - 120 * s, s * .8) + taenzerinnen(mx, unten - 3, s, 3));
          }
        }
        hinten.innerHTML = voll.replace(/class="dkb /g, 'class="dkb dk-voll ').replace(/dk-voll dk-voll/g, 'dk-voll')
          + szeneSchlank(b, h, Math.min(140, h * .3));
      }
      zeichnen();
      return { anpassen: zeichnen };
    },

    /* --- Jukeboxer --- */
    jukeboxer(ebene) {
      stilEinsetzen();
      const { hinten, gehaeuse, lage } = ebene;
      function zeichnen() {
        const b = gehaeuse.clientWidth, h = gehaeuse.clientHeight;
        const kuppel = lage('.jbx-kuppel'), wahl = lage('.jbx-wahl-leiste');
        const sandY = wahl ? wahl.y - 8 : h * .85;
        const hz = kuppel ? Math.min(kuppel.y + kuppel.h * .55, sandY - 60) : h * .6;
        let voll = szene(b, h, hz, sandY)
          + palmenTeil('', 14, sandY + 30, Math.min(340, sandY - 30), 50)
          + palmenTeil('', b - 14, sandY + 30, Math.min(340, sandY - 30), -50);
        // Neben dem Schild: rechts fünf Tänzerinnen, Surfbrett, Fackel auf
        // einem Sandstreifen; links die Palme der freien Fläche
        const text = lage('.jbx-schild-text'), sub = lage('.jbx-schild-sub'), genres = lage('.jbx-genre-tasten');
        if (text && sub && genres && genres.y > text.y) {
          // Platz unter dem Strohdach (Rand rund 30 px, die Fransen reichen
          // etwas tiefer) bis zu den Genre-Tasten
          const unten = genres.y - 6, hoehe = unten - 30;
          if (hoehe >= 50) {
            const s = Math.min(.82, hoehe / 132);
            const rechts = sub.x + sub.b, frei = b - rechts - 30;
            const mx = rechts + Math.max(frei * .5, 140 * s);
            const streifen = `<path d="M${rechts + 10} ${unten + 2} Q${mx} ${unten - 14} ${b - 20} ${unten + 2} V${unten + 8} H${rechts + 10}Z" fill="#e8c98a" opacity=".9"/>`;
            voll += teil('', b, h, streifen + surfbrett(mx - 3.2 * 56 * s, unten, s * .7)
              + fackel(mx + 3.2 * 56 * s, unten - 120 * s * .75, s * .75) + taenzerinnen(mx, unten - 2, s, 5));
            const lx = text.x / 2;
            voll += palmenTeil('', lx, unten + 4, Math.min(hoehe * .62, 200), 14)
              + teil('', b, h, `<path d="M${lx - 90} ${unten + 2} Q${lx} ${unten - 12} ${lx + 90} ${unten + 2} V${unten + 8} H${lx - 90}Z" fill="#e8c98a" opacity=".9"/>`);
          }
        }
        hinten.innerHTML = voll.replace(/class="dkb /g, 'class="dkb dk-voll ').replace(/dk-voll dk-voll/g, 'dk-voll')
          + szeneSchlank(b, h, Math.min(120, h * .3));
      }
      zeichnen();
      return { anpassen: zeichnen };
    },
  });
})(window);
