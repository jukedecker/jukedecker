/* KOPIE fuer die JukeDecker-Messseite (Auftrag 14, M21) - Stand 20.10.2026.
   Quelle: PlayLister, Datei static/gemeinsam/plattenspieler_detail.js. Hier NICHT weiterpflegen:
   Die Messseite braucht nur einen festen Stand fuer die Leistungsmessung. */
/* =====================================================================
   DETAILLIERTER PLATTENSPIELER – gemeinsamer Baustein (Auftrag 16, Phase 2)

   Setzt in einen vorhandenen, einfachen Plattenspieler die Detailteile
   ein (Laufwerksplatte, Vorderfront mit Füßen, Zarge, Stroboskop,
   Bedienteile, Tonarm-Zeichnung, Zylinder-Körper) und passt das Gerät
   so in seinen Rahmen ein, dass nichts den Rahmen durchdringt.
   Gestaltung: plattenspieler_detail.css (gleicher Ordner).

   DIESER BAUSTEIN KENNT WEDER DEN PLAYLISTER NOCH DEN JUKEBOXER. Er
   arbeitet nur auf einer „Wurzel" (Element mit der Klasse .jbx), in der
   der einfache Plattenspieler steckt - genau so, wie ihn der
   Jukeboxer-Kern anlegt:
     .jbx-kuppel-glas            der Rahmen (Glaskuppel bzw. Fenster)
       .jbx-teller-flaeche       Größen-Container, trägt die Perspektive
         .jbx-teller-box         die Laufwerksplatte (Teile kommen hier hinein)
           .jbx-teller  .jbx-platte-halter > .jbx-platte > .jbx-etikett
           .jbx-tonarm  .jbx-tonarm-basis
   Bewegt wird der Plattenspieler weiterhin von außen über die Klassen
   jbx-dreht (Platte), jbx-auf-platte (Tonarm), jbx-pausiert (Wurzel)
   und die Variablen --fortschritt und --umdrehung. Der Jukeboxer nutzt
   ihn einmal, der PlayDecker zweimal (je Deck eine Mini-Wurzel).

   SCHNITTSTELLE (global PlattenspielerDetail):
     einrichten(wurzel, { beiStartStop, frontschrift, rahmen })
       beiStartStop  Funktion für die Taste START/STOP am Laufwerk
                     (Jukeboxer: Pause/Abspielen, PlayDecker: ▶/⏸ des Decks)
       frontschrift  Schriftzug vorn rechts, z. B. „JUKEBOXER · DIREKTANTRIEB";
                     der Mittelpunkt „·" erscheint rot. Nur Text, kein HTML.
       rahmen        'kuppel' (Standard: Rechteck mit Bogen oben, Jukeboxer)
                     oder 'rechteck' (ohne Bogen, senkrecht mittig, PlayDecker)
     einpassen(wurzel)
       rechnet die Einpassung neu. Läuft von selbst bei Größenänderung des
       Rahmens (auch wenn ein verdeckter Reiter sichtbar wird), beim
       Wechsel der Perspektive und nach dem Laden der Schriften. Von außen
       nur nötig, wenn sich etwas ändert, das der Baustein nicht sieht.

   Die Perspektive steuert das Merkmal data-perspektive an der Wurzel:
   fehlt es = flach, „leicht" = 22°, „stark" = 45°. Das setzt der Nutzer
   des Bausteins (Jukeboxer: Einstellung, PlayDecker: fest „stark").
   ===================================================================== */
(function (global) {
  'use strict';

  // Abstand, den das Gerät mindestens zum Rahmen hält (Pixel). Gemessen
  // wird ab der Außenkante des Rahmen-Elements (der Chromring liegt innen).
  const RAND = 12;
  // Halbierungssuche nach dem größten passenden Maßstab: 16 Schritte im
  // Bereich 0,3 bis 1,6 (wie im abgenommenen Mockup).
  const SUCHE_SCHRITTE = 16, MASSSTAB_MIN = 0.3, MASSSTAB_MAX = 1.6;
  // Unter der Kuppel sitzt das Gerät etwas tiefer als die Mitte (6 % der
  // Innenhöhe), weil oben der Bogen Platz kostet.
  const KUPPEL_VERSATZ = 0.06;

  /* Tonarm (S-Form) als SVG. Einheit: 1/1000 der Höhe H. Breite 220,
     Höhe 880. Drehpunkt (Lagermitte) 110/130, Nadel 110/810.
     Farben über style="…:var(--…)" (Attribute können keine Variablen).
     KENNUNG wird je Gerät durch eine laufende Nummer ersetzt: Mehrere
     Plattenspieler auf einer Seite (Jukeboxer + zwei Decks) dürfen keine
     gleichen SVG-Kennungen haben - sonst greift ein Verlauf auf den eines
     anderen, womöglich verdeckten Geräts zu und bleibt leer. */
  const ARM_VORLAGE = `
<svg class="td-arm" viewBox="0 0 220 880" aria-hidden="true">
  <defs>
    <linearGradient id="tdRohr-KENNUNG" gradientUnits="userSpaceOnUse" x1="96" y1="0" x2="158" y2="0">
      <stop offset="0" style="stop-color:color-mix(in srgb, var(--m-3) 23%, var(--m-4))"/><stop offset=".33" style="stop-color:var(--m-1)"/>
      <stop offset=".6" style="stop-color:color-mix(in srgb, var(--m-2) 94%, var(--m-3))"/><stop offset="1" style="stop-color:var(--m-4)"/>
    </linearGradient>
    <linearGradient id="tdQuer-KENNUNG" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" style="stop-color:color-mix(in srgb, var(--m-3) 9%, var(--m-4))"/><stop offset=".3" style="stop-color:color-mix(in srgb, var(--m-1) 89%, var(--m-2))"/>
      <stop offset=".55" style="stop-color:color-mix(in srgb, var(--m-2) 81%, var(--m-3))"/><stop offset="1" style="stop-color:#2d3438"/>
    </linearGradient>
    <radialGradient id="tdLager-KENNUNG" cx=".38" cy=".32" r=".7">
      <stop offset="0" style="stop-color:var(--m-1)"/><stop offset=".45" style="stop-color:color-mix(in srgb, var(--m-1) 12%, var(--m-2))"/><stop offset="1" style="stop-color:color-mix(in srgb, var(--m-3) 23%, var(--m-4))"/>
    </radialGradient>
  </defs>

  <!-- Gegengewicht (von oben gesehen) mit Auflagekraft-Ring und Skala -->
  <rect x="68" y="6" width="84" height="80" rx="9" fill="url(#tdQuer-KENNUNG)"/>
  <rect x="68" y="30" width="84" height="3" fill="rgba(0,0,0,.3)"/>
  <rect x="68" y="56" width="84" height="3" fill="rgba(0,0,0,.3)"/>
  <rect x="72" y="86" width="76" height="14" rx="2" style="fill:#15191b"/>
  <g style="stroke:color-mix(in srgb, var(--m-1) 70%, var(--m-2))" stroke-width="1.6">
    <line x1="80" y1="88" x2="80" y2="95"/><line x1="90" y1="88" x2="90" y2="93"/><line x1="100" y1="88" x2="100" y2="95"/>
    <line x1="110" y1="88" x2="110" y2="97"/><line x1="120" y1="88" x2="120" y2="95"/><line x1="130" y1="88" x2="130" y2="93"/><line x1="140" y1="88" x2="140" y2="95"/>
  </g>
  <rect x="103" y="100" width="14" height="12" fill="url(#tdRohr-KENNUNG)"/>

  <!-- Kardanlager: Gehäuse, Achsstifte, Lagerkappe -->
  <rect x="76" y="106" width="68" height="50" rx="11" fill="url(#tdQuer-KENNUNG)" style="stroke:#2a3033" stroke-width="2"/>
  <rect x="62" y="124" width="16" height="12" rx="3" fill="url(#tdLager-KENNUNG)"/>
  <rect x="142" y="124" width="16" height="12" rx="3" fill="url(#tdLager-KENNUNG)"/>
  <circle cx="110" cy="130" r="16" fill="url(#tdLager-KENNUNG)" style="stroke:#262c2f" stroke-width="2"/>
  <circle cx="110" cy="130" r="6" style="fill:#1c2124"/>

  <!-- Armrohr in S-Form -->
  <path d="M110,156 C110,340 152,440 141,585 C135,668 104,718 110,746"
        fill="none" stroke="url(#tdRohr-KENNUNG)" stroke-width="15" stroke-linecap="round"/>
  <path d="M106,166 C106,340 147,440 136,585"
        fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2.2" stroke-linecap="round"/>
  <!-- Überwurfmutter am Tonkopf -->
  <rect x="99" y="734" width="22" height="22" rx="4" fill="url(#tdQuer-KENNUNG)" style="stroke:#2a3033" stroke-width="1.5"/>

  <!-- Tonkopf mit Fingerhebel und Tonabnehmer (Kennstreifen in der Akzentfarbe) -->
  <g transform="translate(0 30) rotate(22 110 762)">
    <rect x="91" y="724" width="38" height="80" rx="7" fill="url(#tdQuer-KENNUNG)" style="stroke:var(--m-4)" stroke-width="1.6"/>
    <path d="M129,738 L162,726 L168,714" fill="none" stroke="url(#tdRohr-KENNUNG)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="95" y="754" width="30" height="36" rx="3" style="fill:#13181a"/>
    <rect x="95" y="754" width="30" height="5" style="fill:var(--d-akzent-glow)"/>
    <rect x="107" y="788" width="6" height="9" rx="1" style="fill:color-mix(in srgb, var(--m-1) 26%, var(--m-2))"/>
    <circle cx="100" cy="742" r="2.4" style="fill:#2a3033"/><circle cx="120" cy="742" r="2.4" style="fill:#2a3033"/>
  </g>
</svg>`;

  // Laufende Nummer für die SVG-Kennungen (siehe ARM_VORLAGE)
  let geraeteNummer = 0;

  /* ---------------------------------------------------------------
     KLEINE HELFER
     --------------------------------------------------------------- */
  // Ein leeres Bauteil (div) mit Klasse anlegen - am Ende oder vor „vorDem".
  function teil(klasse, eltern, vorDem) {
    const e = document.createElement('div');
    e.className = klasse;
    if (vorDem) eltern.insertBefore(e, vorDem); else eltern.appendChild(e);
    return e;
  }
  // Text sicher in HTML einsetzen (Sonderzeichen unschädlich machen)
  const sicher = (text) => String(text ?? '').replace(/[&<>"']/g, (z) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
  // Schriftzug vorn: reiner Text, der Mittelpunkt „·" wird rot hervorgehoben.
  const frontschriftHtml = (text) => String(text || '').split('·').map(sicher).join('<b>·</b>');

  /* Einen stehenden Zylinder bauen (Sockel, Knöpfe, Stütze …): Schatten
     und Mantel unter die vorhandene Kappe setzen und die Kappe auf die
     Höhe h heben.
     x, y = Mitte in % (Breite bzw. Höhe der Box), d = Durchmesser in % der
     Breite, h = Höhe in cqmin, dunkel = schwarzer statt Chrom-Mantel.
     Der Mantel liegt in der Ebene der Kappe (NICHT senkrecht - siehe
     plattenspieler_detail.css, Regel B) und reicht vom Kappenmittelpunkt
     nach vorn; seine Länge (Höhe × tan(Neigung)) rechnet das CSS. */
  function saeule(box, kappe, x, y, d, h, dunkel) {
    const schatten = teil('td-fussschatten', box, kappe);
    schatten.style.cssText = `left:${x}%;top:${y}%;width:${d * 1.7}%;aspect-ratio:1`;
    const mantel = teil('td-mantel' + (dunkel ? ' td-dunkel' : ''), box, kappe);
    mantel.style.cssText = `left:${x - d / 2}%;width:${d}%;top:${y}%;--h:${h}cqmin`;
    // Höhe über die eigene Eigenschaft translate - nicht über transform,
    // damit sie nicht mit Animationen kollidiert (Regel D).
    kappe.style.translate = `0 0 ${h}cqmin`;
  }

  // Der Rahmen, in den das Gerät passen muss: die Glaskuppel bzw. das
  // Fenster um die Fläche.
  const rahmenVon = (box) => box.closest('.jbx-kuppel-glas')
    || (box.parentElement && box.parentElement.parentElement) || null;

  /* ---------------------------------------------------------------
     EINRICHTEN
     --------------------------------------------------------------- */
  function einrichten(wurzel, optionen) {
    const { beiStartStop, frontschrift = '', rahmen = 'kuppel' } = optionen || {};
    const box = wurzel && wurzel.querySelector('.jbx-teller-box');
    if (!box) throw new Error('PlattenspielerDetail.einrichten: In der Wurzel fehlt .jbx-teller-box.');
    if (box.querySelector('.td-chassis')) return;            // schon eingerichtet
    const $ = (auswahl) => box.querySelector(auswahl);
    const teller = $('.jbx-teller');
    const halter = $('.jbx-platte-halter');
    const arm = $('.jbx-tonarm');
    const basis = $('.jbx-tonarm-basis');
    if (!teller || !halter || !arm || !basis) {
      throw new Error('PlattenspielerDetail.einrichten: Teller, Platte oder Tonarm fehlen in .jbx-teller-box.');
    }
    wurzel.dataset.rahmen = rahmen === 'rechteck' ? 'rechteck' : 'kuppel';

    /* Die Reihenfolge im Dokument ist Absicht (wie im Mockup): Bei gleich
       hohen Teilen entscheidet sie, welches oben liegt. */

    // Unterste Ebene: Laufwerksplatte, Vorderfront, Schrauben, Puck, Lampe, Netzknopf
    teil('td-chassis', box, box.firstChild);
    const kante = teil('td-kante', box, teller);
    [['1.4%', '2.4%'], ['97.4%', '2.4%'], ['13.6%', '95.6%'], ['97.4%', '95.6%']].forEach(([x, y]) => {
      const schraube = teil('td-schraube', box, teller);
      schraube.style.left = x; schraube.style.top = y;
    });
    teil('td-puck', box, teller);
    teil('td-lampe', box, teller);
    teil('td-netz', box, teller);

    // Teller: Zarge darunter, Stroboskop-Rand und -Licht darüber (unter der Platte)
    teil('td-zarge', box, teller);
    teil('td-strobo', box, halter);
    teil('td-strobolicht', box, halter);

    // Bedienteile vorn und rechts. START/STOP ist ein echter Knopf.
    const start = document.createElement('button');
    start.type = 'button';
    start.className = 'td-start';
    start.textContent = 'START/STOP';
    start.title = 'Start / Stopp';
    start.addEventListener('click', () => { if (typeof beiStartStop === 'function') beiStartStop(); });
    box.insertBefore(start, arm);
    const t33 = teil('td-taste td-an', box, arm); t33.textContent = '33'; t33.style.left = '1.6%';
    const t45 = teil('td-taste', box, arm); t45.textContent = '45'; t45.style.left = '6.6%';
    const skala = teil('td-skala', box, arm);
    skala.innerHTML = '<span>+8</span><span>0</span><span>−8</span>';
    [t33, t45, skala].forEach((e) => e.setAttribute('aria-hidden', 'true'));
    teil('td-pitch', box, arm);
    teil('td-pitchled', box, arm);
    teil('td-ziel', box, arm);

    // Tonarm-Umfeld: Anti-Skating (vor dem Sockel), Stütze und Lifthebel (unter dem Arm)
    teil('td-antiskating', box, basis);
    teil('td-stuetze', box, arm);
    teil('td-lift', box, arm);

    // Tonarm-Zeichnung in das Element, das der Nutzer des Bausteins schwenkt
    geraeteNummer += 1;
    arm.insertAdjacentHTML('beforeend', ARM_VORLAGE.replace(/KENNUNG/g, String(geraeteNummer)));

    // Vorderfront: Füße und Schriftzug
    [6, 82].forEach((links) => { teil('td-fuss', kante).style.left = `${links}%`; });
    const schrift = teil('td-frontschrift', kante);
    schrift.innerHTML = frontschriftHtml(frontschrift);
    schrift.setAttribute('aria-hidden', 'true');

    // Zylinder: Kappe, x, y, Durchmesser, Höhe, dunkel
    saeule(box, basis, 82, 22, 15.7, 4.5, true);
    saeule(box, $('.td-netz'), 4.1, 50, 3.6, 2.6, false);
    saeule(box, $('.td-ziel'), 93.5, 93, 2.3, 6, false);
    saeule(box, $('.td-stuetze'), 84.1, 66, 1.6, 4.5, false);
    saeule(box, $('.td-lift'), 89.5, 62, 0.7, 3.8, false);
    saeule(box, $('.td-antiskating'), 72, 11, 4.4, 1.6, true);
    saeule(box, $('.td-puck'), 5, 10, 4.4, 1, false);

    // Messpunkte an den hinteren Ecken der Deckplatte (für die Einpassung)
    [['1%', '1%'], ['99%', '1%']].forEach(([x, y]) => {
      const sonde = teil('td-sonde', box);
      sonde.style.left = x; sonde.style.top = y;
    });

    /* Leuchten und Stroboskop folgen der Drehung: „läuft" heißt, die
       Platte dreht sich wirklich - sie hat jbx-dreht, die Wurzel ist
       nicht pausiert, und das Drehen ist nicht abgeschaltet (data-teller). */
    const platte = $('.jbx-platte');
    const abgleichen = () => wurzel.classList.toggle('tt-laeuft',
      !!platte && platte.classList.contains('jbx-dreht')
      && !wurzel.classList.contains('jbx-pausiert') && wurzel.dataset.teller !== 'aus');
    if (platte) new MutationObserver(abgleichen).observe(platte, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(abgleichen).observe(wurzel, { attributes: true, attributeFilter: ['class', 'data-teller'] });
    abgleichen();

    wurzel.dataset.tellerStil = 'detail';

    /* Einpassung aktuell halten:
       (1) Größe des Rahmens ändert sich (Fenster, Vollbild, Pult wächst,
           verdeckter Reiter wird sichtbar) - ResizeObserver statt
           window.resize, sonst bliebe ein beim Öffnen verdeckter Reiter
           falsch eingepasst;
       (2) Perspektive oder Rahmenart wechselt;
       (3) Schriften sind geladen (die Umgebung kann sich dadurch verschieben). */
    const neu = () => einpassen(wurzel);
    const glas = rahmenVon(box);
    if (glas && global.ResizeObserver) new ResizeObserver(neu).observe(glas);
    else global.addEventListener('resize', neu);
    new MutationObserver(neu).observe(wurzel, { attributes: true, attributeFilter: ['data-perspektive', 'data-rahmen'] });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(neu);
    neu();
  }

  /* ---------------------------------------------------------------
     EINPASSEN: größtmöglicher Maßstab, bei dem nichts den Rahmen
     durchdringt. Geprüft wird die tatsächlich GEZEICHNETE (perspektivische)
     Lage, nicht die Rechnung:
       – Laufwerksplatte, Vorderfront und Füße gegen das Innenrechteck
         des Rahmens (Rahmen minus RAND auf jeder Seite),
       – die hinteren Ecken der Deckplatte (Messpunkte) zusätzlich gegen
         den Bogen der Kuppel (nur Rahmenart „kuppel").
     Gesucht wird per Halbierung (16 Schritte, Maßstab 0,3 bis 1,6). Zu
     jedem Maßstab wird das Gerät senkrecht mittig gesetzt (unter der
     Kuppel etwas tiefer). Das Ergebnis steht in data-einpassung.
     --------------------------------------------------------------- */
  function einpassen(wurzel) {
    const box = wurzel && wurzel.querySelector('.jbx-teller-box');
    if (!box || wurzel.dataset.tellerStil !== 'detail') return;
    const glas = rahmenVon(box);
    if (!glas) return;
    const g = glas.getBoundingClientRect();
    // Verdeckt (Reiter nicht sichtbar): nichts messen. Der ResizeObserver
    // meldet sich wieder, sobald der Rahmen eine Größe bekommt.
    if (g.width < 2 || g.height < 2) return;

    const innen = { l: g.left + RAND, r: g.right - RAND, o: g.top + RAND, u: g.bottom - RAND };
    const mitBogen = wurzel.dataset.rahmen !== 'rechteck';
    // Bogen oben = die oberen Ecken des Rahmens (border-radius, z. B.
    // „48% 26%" bei der Kuppel). Aus dem CSS gelesen, damit eine spätere
    // Formänderung der Kuppel hier nicht vergessen werden kann.
    const stil = getComputedStyle(glas);
    const radius = (wert) => {
      const [waag, senk = waag] = String(wert || '0').trim().split(/\s+/);
      const umrechnen = (t, bezug) => (t.endsWith('%') ? parseFloat(t) / 100 * bezug : parseFloat(t) || 0);
      return { x: umrechnen(waag, g.width), y: umrechnen(senk, g.height) };
    };
    const eckeL = radius(stil.borderTopLeftRadius);
    const eckeR = radius(stil.borderTopRightRadius);
    // Liegt ein Punkt innerhalb des Rahmens (mit RAND), auch im Bogen?
    const imRahmen = (px, py) => {
      if (px < innen.l || px > innen.r || py < innen.o || py > innen.u) return false;
      if (!mitBogen) return true;
      const pruefeEcke = (ecke, mx) => {
        const rx = ecke.x - RAND, ry = ecke.y - RAND;
        if (rx <= 0 || ry <= 0) return true;
        const dx = (px - mx) / rx, dy = (py - (g.top + ecke.y)) / ry;
        return dx * dx + dy * dy <= 1;
      };
      if (px < g.left + eckeL.x && py < g.top + eckeL.y) return pruefeEcke(eckeL, g.left + eckeL.x);
      if (px > g.right - eckeR.x && py < g.top + eckeR.y) return pruefeEcke(eckeR, g.right - eckeR.x);
      return true;
    };

    const teile = Array.from(box.querySelectorAll('.td-chassis, .td-kante, .td-fuss'));
    const sonden = Array.from(box.querySelectorAll('.td-sonde'));
    const setze = (s, ty) => { box.style.setProperty('--td-s', s); box.style.setProperty('--td-ty', `${ty}px`); };
    const huelle = () => {
      let l = Infinity, r = -Infinity, o = Infinity, u = -Infinity;
      teile.forEach((t) => {
        const k = t.getBoundingClientRect();
        if (!k.width && !k.height) return;         // in der Draufsicht unsichtbar (Vorderfront)
        l = Math.min(l, k.left); r = Math.max(r, k.right); o = Math.min(o, k.top); u = Math.max(u, k.bottom);
      });
      return { l, r, o, u };
    };
    const passt = (s) => {
      setze(s, 0);
      let h = huelle();
      const ty = ((innen.o + innen.u) / 2 - (h.o + h.u) / 2) + (innen.u - innen.o) * (mitBogen ? KUPPEL_VERSATZ : 0);
      setze(s, ty);
      h = huelle();
      if (h.l < innen.l || h.r > innen.r || h.u > innen.u || h.o < innen.o) return false;
      return sonden.every((sonde) => { const k = sonde.getBoundingClientRect(); return imRahmen(k.left, k.top); });
    };

    let unten = MASSSTAB_MIN, oben = MASSSTAB_MAX;
    for (let i = 0; i < SUCHE_SCHRITTE; i++) {
      const mitte = (unten + oben) / 2;
      if (passt(mitte)) unten = mitte; else oben = mitte;
    }
    passt(unten);
    wurzel.dataset.einpassung = unten.toFixed(3);
  }

  global.PlattenspielerDetail = Object.freeze({ einrichten, einpassen });
})(window);
