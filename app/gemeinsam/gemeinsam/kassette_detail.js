/* =====================================================================
   KASSETTENDECK – gemeinsamer Baustein (Auftrag 18, Teil C)

   Das zweite Abspielgerät neben dem Plattenspieler
   (plattenspieler_detail.js). Es steht im PlayDecker in jedem
   Deck-Fenster und im Jukeboxer in der Kuppel - aber nur, wenn das Design
   es verlangt (designs.js: abspielgeraet 'kassette'). Angelegt, gefüttert
   und wieder entfernt wird es ausschließlich vom Vermittler
   static/gemeinsam/abspielgeraet.js. Gestaltung: kassette_detail.css.

   DIESER BAUSTEIN KENNT WEDER DEN PLAYLISTER NOCH DEN JUKEBOXER. Er
   bekommt nur Nachrichten: Cover, Zustand des Players, Fortschritt,
   Titelwechsel.

   WAS ES ZEIGT (Vorlage Mockups/mockup_Kassette_K3C1_J4A.html)
   (1) Die Kassette im Schacht: Etikett = Cover des Titels, darüber ein
       Streifen mit Interpret und Titel; im Sichtfenster die Bandwickel
       (links voll, rechts dünn - sie folgen dem Fortschritt) und die
       beiden Spulennaben, die sich drehen, solange der Player WIRKLICH
       spielt (Zustand aus dem Player, nie aus einem Zeitfenster - Lehre
       M17C).
   (2) Rechts das Zählwerk „ZEIT ▶ 1:31“ in Leuchtziffern und zwei
       LED-Säulen L/R mit dB-Skala. Die LEDs sind eine reine Animation
       (kein Mikrofon, kein Abgreifen von Ton - der eingebettete Player
       gibt den Pegel nicht heraus) und laufen nur, wenn das Deck spielt.
   (3) Zierbeschriftung „STUDIO-KASSETTENDECK“, „DECK A“ und Schrauben.
       Bandsorte, Rauschunterdrückung, Tempo und ⏏ gibt es NICHT (sie
       sähen aus wie Bedienelemente - Auftrag 18, (1) und (4)(2)).

   KASSETTENWECHSEL (Auftrag 18, Teil C2): Bei jedem neuen Titel wird die
   Kassette gewechselt. Arten: klappe, schlitten, umdrehen, fallschacht,
   abwechselnd, zufall, aus. Höchstens 2,0 s. Die Musik wartet nie darauf
   - das ist nur das Bild. Während des Wechsels stehen die Spulen, die
   LEDs sind dunkel, das Zählwerk zeigt „WECHSEL -:--“; die Titelanzeige
   des Moduls zeigt den neuen Titel, sobald die neue Kassette sichtbar ist
   (Klasse ag-wechsel-frueh bis dahin). Ein zweiter Wechsel springt sofort
   ans Ende des ersten. Bei unsichtbarer Seite gibt es nur das Endbild.
   Nur CSS-Transformationen (translate/rotate/opacity), damit es auf dem
   Handy flüssig läuft; kein filter am Element mit preserve-3d (sonst ist
   die Rückseite beim Umdrehen gespiegelt).

   SCHNITTSTELLE (global KassetteDetail) - nur für abspielgeraet.js:
     einrichten(wurzel, { frontschrift, modul })  -> Element .ag-kassette
     entfernen(element)
     cover(element, hintergrund, beschriftungHtml) Etikett ohne Wechsel
     wechseln(element, hintergrund, beschriftungHtml, hatteVorher?)
     zustand(element, ytZustand, anteil, sekunden)  PlayDecker im Takt
     fortschritt(element, anteil, sekunden)         Jukeboxer im Takt
     wechselArt(element, art)                       Einstellung
     DAUER                                           ms je Art (Prüfung)
   ===================================================================== */
(function (global) {
  'use strict';

  // Dauer je Art in Millisekunden (höchstens 2000, Auftrag 18 (5)(4)) und
  // der Zeitpunkt, ab dem die NEUE Kassette sichtbar ist (dann springt die
  // Titelanzeige). Die Bewegungen selbst stehen in kassette_detail.css
  // mit genau diesen Zeiten.
  const DAUER = Object.freeze({ klappe: 1900, schlitten: 1100, umdrehen: 1800, fallschacht: 1700 });
  const NEU_SICHTBAR = Object.freeze({ klappe: 700, schlitten: 350, umdrehen: 900, fallschacht: 450 });
  const ARTEN = ['klappe', 'schlitten', 'umdrehen', 'fallschacht'];
  const EINSTELLUNGEN = ['klappe', 'schlitten', 'umdrehen', 'fallschacht', 'abwechselnd', 'zufall', 'aus'];
  const STANDARD_ART = 'klappe';

  let nummer = 0;
  const zustaende = new WeakMap();   // Element -> { art, reihe, uhren[], laeuft }

  /* ---------------------------------------------------------------
     ZEICHNUNG
     --------------------------------------------------------------- */
  // Eine Kassette als SVG (Maße 214 × 137 wie im Mockup). Das Etikett ist
  // ein eigenes HTML-Feld darüber (es trägt das Cover als Hintergrund wie
  // das Etikett der Platte).
  function kassetteSvg(id) {
    const b = 214, h = 137, spulY = h * .53, spulR = h * .2;
    const fx = b * .25, fb = b * .5, fy = spulY - spulR - 3, fh = spulR * 2 + 6;
    const schraube = (x, y) => `<circle cx="${x}" cy="${y}" r="3" style="fill:#9a9a9a;stroke:#444" stroke-width=".6"/><path d="M${x - 2} ${y} h4 M${x} ${y - 2} v4" style="stroke:#444" stroke-width=".8"/>`;
    const wickel = (x, seite) => `<g class="agk-wickel agk-wickel-${seite}" style="transform-origin:${x}px ${spulY}px"><circle cx="${x}" cy="${spulY}" r="${spulR}" style="fill:#3b2614"/>${[.55, .75, .92].map((f) => `<circle cx="${x}" cy="${spulY}" r="${spulR * f}" fill="none" style="stroke:#56381c" stroke-width=".8"/>`).join('')}</g>`;
    return `<svg class="agk-svg" viewBox="0 0 ${b} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
  <defs><clipPath id="agkFenster-${id}"><rect x="${fx}" y="${fy}" width="${fb}" height="${fh}" rx="${fh / 2}"/></clipPath>
    <mask id="agkLoch-${id}"><rect width="${b}" height="${h}" style="fill:#fff"/><rect x="${b * .06}" y="${h * .07}" width="${b * .88}" height="${h * .72}" rx="5" style="fill:#000"/></mask></defs>
  <!-- Gehäuse der Kassette; wo das Etikett sitzt, ist es ausgespart - das
       Etikett (HTML-Feld mit dem Cover) liegt darunter und scheint durch -->
  <rect x="1" y="1" width="${b - 2}" height="${h - 2}" rx="${h * .06}" mask="url(#agkLoch-${id})" style="fill:var(--agk-gehaeuse, #1c1c1c);stroke:var(--agk-gehaeuse-rand, #3a3a3a)" stroke-width="1.5"/>
  <rect x="${b * .06}" y="${h * .07}" width="${b * .88}" height="${h * .72}" rx="5" fill="none" style="stroke:rgba(0,0,0,.6)" stroke-width="1"/>
  <rect x="4" y="4" width="${b - 8}" height="${h - 8}" rx="${h * .05}" fill="none" style="stroke:rgba(255,255,255,.07)"/>
  <rect x="${fx}" y="${fy}" width="${fb}" height="${fh}" rx="${fh / 2}" style="fill:#0c0806"/>
  <g clip-path="url(#agkFenster-${id})">${wickel(b * .34, 'l')}${wickel(b * .66, 'r')}<path d="M${b * .34} ${spulY + spulR} L${b * .66} ${spulY + spulR * .6}" style="stroke:#3b2614" stroke-width="1"/></g>
  <rect x="${fx}" y="${fy}" width="${fb}" height="${fh}" rx="${fh / 2}" fill="none" style="stroke:#aaa" stroke-width="1"/>
  <path d="M${fx + 8} ${fy + 4} L${fx + fb * .4} ${fy + 4}" style="stroke:rgba(255,255,255,.25)" stroke-width="2" stroke-linecap="round"/>
  <path d="M${b * .18} ${h - 1} L${b * .24} ${h * .82} H${b * .76} L${b * .82} ${h - 1}Z" style="fill:var(--agk-gehaeuse-rand, #3a3a3a)" opacity=".85"/>
  ${[.3, .7].map((f) => `<rect x="${b * f - 4}" y="${h * .87}" width="8" height="${h * .08}" style="fill:#000"/>`).join('')}
  ${[.4, .6].map((f) => `<circle cx="${b * f}" cy="${h * .91}" r="${h * .03}" style="fill:#000"/>`).join('')}
  <rect x="${b * .47}" y="${h * .85}" width="${b * .06}" height="${h * .06}" style="fill:#c8b48a"/>
  ${schraube(b * .04, h * .07)}${schraube(b * .96, h * .07)}${schraube(b * .04, h * .93)}${schraube(b * .96, h * .93)}${schraube(b * .5, h * .78)}
</svg>`;
  }
  // Eine Nabe als eigenes kleines Bild (Mitte = Drehpunkt). Gemessen
  // (app_leistung.py, 20.11.2026): Drehten sich die Naben als Gruppe IN
  // der großen Zeichnung, musste der Browser die ganze Kassette samt Maske
  // in jedem Bild neu berechnen (rund 30 Layouts je Sekunde). Als eigenes
  // Element dreht sie die Grafikkarte allein. Lage: kassette_detail.css.
  function nabeSvg(seite) {
    const r = 137 * .2 * .4, k = 137 * .2 * .17;
    return `<svg class="agk-nabe agk-nabe-${seite}" viewBox="-11.5 -11.5 23 23" aria-hidden="true"><circle r="${r}" style="fill:#f1f1f1;stroke:#777"/>${[0, 60, 120, 180, 240, 300].map((w) => `<rect x="-1.6" y="${-r}" width="3.2" height="${k}" style="fill:#777" transform="rotate(${w})"/>`).join('')}<circle r="${k}" style="fill:#222"/></svg>`;
  }
  // Eine Kassette (Vorder- und Rückseite für „Umdrehen“)
  function kassetteHtml(id) {
    const seite = (klasse) => `<div class="agk-seite ${klasse}">${kassetteSvg(id + klasse)}<div class="agk-naben">${nabeSvg('l')}${nabeSvg('r')}</div>
      <div class="agk-etikett"><div class="agk-streifen"><b class="agk-seite-a">A</b><span class="agk-beschriftung"></span><i>C90</i></div></div></div>`;
    return `<div class="agk-kassette"><div class="agk-dreher">${seite('agk-vorn')}${seite('agk-hinten')}</div></div>`;
  }
  // LED-Säule: 14 Glieder gedimmt, darüber dieselben leuchtend. Den
  // sichtbaren Teil gibt ein Fenster frei, das sich nach unten schiebt,
  // während sein Inhalt gleich weit zurückläuft (nur bei Wiedergabe). Beides
  // sind Verschiebungen, die die Grafikkarte allein rechnet - früher ein
  // clip-path, der in jedem Bild neu gezeichnet werden musste (Leistung).
  function saeule(seite, verzug) {
    const glieder = Array.from({ length: 14 }, (_, i) => `<i class="${i >= 12 ? 'agk-rot' : i >= 10 ? 'agk-gelb' : ''}"></i>`).join('');
    return `<div class="agk-saeule"><div class="agk-glieder">${glieder}</div><div class="agk-pegel" style="animation-delay:-${verzug}s"><div class="agk-glieder agk-pegel-innen">${glieder}</div></div><i class="agk-spitze"></i><span>${seite}</span></div>`;
  }
  function geraetHtml(id, frontschrift, modul) {
    const skala = ['+5', '0', '-5', '-10', '-20', '-30'].map((w) => `<span>${w}</span>`).join('');
    const schrauben = ['ol', 'or', 'ul', 'ur'].map((s) => `<i class="agk-schraube agk-schraube-${s}"></i>`).join('');
    return `${schrauben}<div class="agk-flaeche">
      <div class="agk-schacht"><div class="agk-klappe"></div>${kassetteHtml(id)}</div>
      <div class="agk-rechts">
        <div class="agk-zaehlwerk"><span class="agk-zw-text">ZEIT</span><span class="agk-zw-zeichen">■</span><b class="agk-zeit"><span class="agk-geist">8:88</span><span class="agk-wert">0:00</span></b></div>
        <div class="agk-pegelfeld">${saeule('L', 0)}<div class="agk-skala">${skala}</div>${saeule('R', .6)}</div>
      </div></div>
      <span class="agk-deckschrift">${frontschrift}</span>
      <span class="agk-zierschrift">${modul === 'jukeboxer' ? 'JUKEBOXER · KASSETTENDECK' : 'STUDIO-KASSETTENDECK'}</span>`;
  }

  /* ---------------------------------------------------------------
     EINRICHTEN / ENTFERNEN
     --------------------------------------------------------------- */
  function einrichten(wurzel, optionen) {
    const opt = optionen || {};
    const modul = opt.modul || (wurzel.querySelector('.jbx-kuppel') ? 'jukeboxer' : 'playdecker');
    const ort = modul === 'jukeboxer' ? (wurzel.querySelector('.jbx-kuppel') || wurzel) : wurzel;
    const id = `agk${++nummer}`;
    const el = document.createElement('div');
    el.className = 'ag-kassette';
    el.dataset.modul = modul;
    el.dataset.dreht = 'nein';
    el.setAttribute('aria-hidden', 'true');
    // Deckschrift: im PlayDecker „DECK A“ / „DECK B“ aus der Frontschrift
    const deck = /DECK ([AB])/.exec(opt.frontschrift || '');
    el.innerHTML = geraetHtml(id, deck ? `DECK ${deck[1]}` : 'DECK', modul);
    ort.appendChild(el);
    zustaende.set(el, { art: STANDARD_ART, reihe: 0, uhren: [], laeuft: false, anteil: 0 });
    anteilSetzen(el, 0);
    return el;
  }
  function entfernen(el) {
    const z = zustaende.get(el);
    if (z) z.uhren.forEach(clearTimeout);
    el.remove();
  }

  /* ---------------------------------------------------------------
     ANZEIGEN
     --------------------------------------------------------------- */
  const zeitText = (s) => {
    if (!Number.isFinite(s) || s < 0) s = 0;
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };
  // Bandwickel: links voll (Band noch nicht gelaufen), rechts dünn - sie
  // tauschen mit dem Fortschritt (Maßstab der Wickel 1,15 … 0,62).
  // Gestuft auf zwei Stellen und nur bei Änderung geschrieben (Leistung:
  // Jeder neue Wert zeichnet die Kassette neu; die Stufe ist kleiner als
  // ein Bildpunkt und ändert sich bei einem Titel von 3 Minuten nur etwa
  // alle 3 Sekunden).
  function anteilSetzen(el, anteil) {
    const a = Math.min(Math.max(Number(anteil) || 0, 0), 1);
    const links = (1.15 - .53 * a).toFixed(2), rechts = (.62 + .53 * a).toFixed(2);
    if (el.style.getPropertyValue('--agk-links') !== links) el.style.setProperty('--agk-links', links);
    if (el.style.getPropertyValue('--agk-rechts') !== rechts) el.style.setProperty('--agk-rechts', rechts);
  }
  function etikettSetzen(seite, hintergrund, html) {
    const etikett = seite.querySelector('.agk-etikett');
    etikett.style.backgroundImage = hintergrund || '';
    etikett.classList.toggle('agk-mit-cover', !!hintergrund);
    if (html !== null && html !== undefined) seite.querySelector('.agk-beschriftung').innerHTML = html;
  }
  // Das Etikett der (neuen) Kassette. Läuft gerade „Umdrehen“, gehört das
  // Cover auf die Rückseite - sie ist gleich vorn.
  function cover(el, hintergrund, html) {
    const kassette = el.querySelector('.agk-kassette:not(.agk-alt)');
    const hinten = kassette.querySelector('.agk-hinten');
    etikettSetzen(hinten.dataset.neu ? hinten : kassette.querySelector('.agk-vorn'), hintergrund, html);
  }
  // Zählwerk und Laufzustand. Spulen und LEDs laufen nur bei „läuft“ (1).
  function anzeigen(el, laeuft, pause, sekunden) {
    const z = zustaende.get(el);
    if (z) z.laeuft = laeuft;
    el.dataset.dreht = laeuft ? 'ja' : 'nein';
    el.classList.toggle('agk-pause', pause);
    if (el.classList.contains('ag-wechselt')) return;   // Zählwerk zeigt „WECHSEL -:--“
    el.querySelector('.agk-zw-zeichen').textContent = laeuft ? '▶' : pause ? '❚❚' : '■';
    el.querySelector('.agk-wert').textContent = zeitText(sekunden);
  }
  function zustand(el, yt, anteil, sekunden) {
    anteilSetzen(el, anteil);
    anzeigen(el, yt === 1, yt === 2 || yt === 3, sekunden);
  }
  // Jukeboxer: der Laufzustand kommt aus den Klassen der Jukeboxer-Wurzel
  // (jbx-spielt / jbx-pausiert - dieselben, die den Plattenteller anhalten)
  function fortschritt(el, anteil, sekunden) {
    anteilSetzen(el, anteil);
    const wurzel = el.closest('.jbx');
    const laeuft = !!wurzel && wurzel.classList.contains('jbx-spielt') && !wurzel.classList.contains('jbx-pausiert');
    const pause = !!wurzel && wurzel.classList.contains('jbx-pausiert');
    anzeigen(el, laeuft, pause, sekunden);
  }

  /* ---------------------------------------------------------------
     KASSETTENWECHSEL
     --------------------------------------------------------------- */
  function wechselArt(el, art) {
    const z = zustaende.get(el);
    if (z) z.art = EINSTELLUNGEN.includes(art) ? art : STANDARD_ART;
  }
  // Welche Bewegung diesmal? „abwechselnd“ geht die vier der Reihe nach
  // durch, „zufall“ würfelt (nie zweimal hintereinander dieselbe).
  function artWaehlen(z) {
    if (z.art === 'abwechselnd') { const a = ARTEN[z.reihe % ARTEN.length]; z.reihe++; return a; }
    if (z.art === 'zufall') {
      let a = ARTEN[Math.floor(Math.random() * ARTEN.length)];
      if (a === z.letzte) a = ARTEN[(ARTEN.indexOf(a) + 1) % ARTEN.length];
      return a;
    }
    return z.art;
  }
  // Animationen der Jukeboxer-Wurzel aus („Animationen gesamt: aus“) oder
  // Wunsch des Geräts nach reduzierter Bewegung: dann ohne Bewegung.
  function bewegungAus(el) {
    const wurzel = el.closest('.jbx[data-anim]');
    if (wurzel && wurzel.dataset.anim === 'aus') return true;
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function wechselBeenden(el) {
    const z = zustaende.get(el);
    if (!z) return;
    z.uhren.forEach(clearTimeout);
    z.uhren = [];
    el.querySelectorAll('.agk-alt').forEach((k) => k.remove());
    ARTEN.forEach((a) => el.classList.remove(`agw-${a}`));
    el.classList.remove('ag-wechselt', 'ag-wechsel-frueh', 'agk-schnell');
    delete el.dataset.wechsel;
    const dreher = el.querySelector('.agk-kassette .agk-dreher');
    // „Umdrehen“: die Rückseite trug das neue Cover - jetzt ist es vorn
    const hinten = el.querySelector('.agk-kassette .agk-hinten');
    if (hinten && hinten.dataset.neu) {
      const etikett = hinten.querySelector('.agk-etikett');
      delete hinten.dataset.neu;
      cover(el, etikett.style.backgroundImage || null, hinten.querySelector('.agk-beschriftung').innerHTML);
    }
    if (dreher) dreher.style.removeProperty('transform');
    // Nach dem Wechsel: Zählwerk wieder mit der Zeit (ab 0:00)
    el.querySelector('.agk-zw-text').textContent = 'ZEIT';
    el.querySelector('.agk-zw-zeichen').textContent = z.laeuft ? '▶' : '■';
    el.querySelector('.agk-wert').textContent = '0:00';
  }
  function wechseln(el, hintergrund, html, hatteVorher = true) {
    const z = zustaende.get(el);
    if (!z) return;
    // (6A) Läuft schon ein Wechsel, springt er sofort ans Ende.
    if (el.classList.contains('ag-wechselt')) wechselBeenden(el);
    const art = artWaehlen(z);
    z.letzte = art;
    anteilSetzen(el, 0);
    // (6B) Unsichtbare Seite, „aus“, keine Bewegung gewünscht oder noch
    // gar keine alte Kassette: nur das Endbild.
    if (art === 'aus' || document.hidden || bewegungAus(el) || hatteVorher === false || !DAUER[art]) {
      cover(el, hintergrund, html);
      el.querySelector('.agk-wert').textContent = '0:00';
      return;
    }
    const kassette = el.querySelector('.agk-kassette:not(.agk-alt)');
    if (art === 'umdrehen') {
      // Die Rückseite trägt das neue Cover; gedreht wird der ganze Dreher
      const hinten = kassette.querySelector('.agk-hinten');
      etikettSetzen(hinten, hintergrund, html);
      hinten.dataset.neu = 'ja';
    } else {
      // Die alte Kassette als Kopie davor, die echte bekommt das neue Cover
      const alt = kassette.cloneNode(true);
      alt.classList.add('agk-alt');
      kassette.before(alt);
      cover(el, hintergrund, html);
    }
    el.dataset.wechsel = art;
    el.classList.add('ag-wechselt', 'ag-wechsel-frueh', `agw-${art}`);
    el.querySelector('.agk-zw-text').textContent = 'WECHSEL';
    el.querySelector('.agk-zw-zeichen').textContent = '';
    el.querySelector('.agk-wert').textContent = '-:--';
    z.uhren.push(setTimeout(() => el.classList.remove('ag-wechsel-frueh'), NEU_SICHTBAR[art]));
    if (art === 'fallschacht') {
      // Nach dem Einrasten laufen die Spulen kurz schnell an
      z.uhren.push(setTimeout(() => el.classList.add('agk-schnell'), 1000));
    }
    z.uhren.push(setTimeout(() => wechselBeenden(el), DAUER[art]));
  }

  global.KassetteDetail = Object.freeze({
    einrichten, entfernen, cover, wechseln, zustand, fortschritt, wechselArt,
    DAUER, ARTEN: Object.freeze(ARTEN.slice()), EINSTELLUNGEN: Object.freeze(EINSTELLUNGEN.slice()), STANDARD_ART,
  });
})(window);
