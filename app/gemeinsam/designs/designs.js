/* =====================================================================
   DESIGN-SYSTEM – AUSWAHLLISTE, LADER und DEKOR-EBENE
   (Auftrag 16, erweitert in Auftrag 18)

   Diese Datei ist die EINE Liste aller Designs. Sie
   (1) lädt beim Start die Gestaltungsdateien design_basis.css und je
       Design <kennung>.css aus demselben Ordner wie diese Datei,
   (2) stellt die Liste für die Auswahlfelder bereit (Jukeboxer:
       Einstellungen -> Effekte -> „Design"; PlayDecker: Einstellungsfenster),
   (3) hilft beim Setzen: unbekannte Kennungen werden zum Standard,
   (4) seit Auftrag 18: Ein Design-Eintrag kann zusätzlich angeben
       (4A) abspielgeraet: 'platte' (Standard) oder 'kassette' - welches
            Gerät im Deck bzw. in der Kuppel steht. setzen() trägt das als
            Merkmal data-abspielgeraet ein (nur, wenn es NICHT der
            Plattenspieler ist - bei Plattenspieler-Designs bleibt das HTML
            also genau wie bisher). Den Wechsel des Geräts übernimmt
            static/gemeinsam/abspielgeraet.js.
       (4B) dekor: Name einer Dekor-Datei designs/dekor/<name>.js. Sie
            zeichnet in die DEKOR-EBENE (siehe unten, Abschnitt Dekor).
       (4C) eine eigene Anordnung (nur der Kassetten-Jukeboxer) steht in
            dessen CSS-Datei unter [data-abspielgeraet="kassette"].

   Ein NEUES Design: neue Datei <kennung>.css in diesem Ordner + eine
   Zeile in DESIGNS unten (dazu, wenn gewünscht, eine Dekor-Datei).

   Diese Datei kennt weder Flask noch den PlayLister - sie läuft so auch
   in der Mobil-Version. Sie muss im <head> stehen (VOR dem ersten
   Zeichnen), damit nichts kurz ungefärbt aufblitzt.

   VON AUSSEN (global PlayListerDesigns):
     liste                -> [{ kennung, titel, abspielgeraet, dekor }]
     standard             -> 'diner-chrom'
     gueltig(kennung)     -> die Kennung, wenn es sie gibt, sonst der Standard
     eintrag(kennung)     -> der Eintrag (unbekannt: der des Standards)
     setzen(element, k)   -> setzt data-design="k" (geprüft) am Element,
                             dazu data-abspielgeraet und die Dekor-Ebene
     beiWechsel(fn)       -> fn(element, kennung, eintrag) nach jedem setzen()
     dekorAnmelden(name, def) - nur für die Dekor-Dateien (siehe unten)
   ===================================================================== */
(function (global) {
  'use strict';

  // Die Designs in der Reihenfolge der Auswahl. Kennung = Dateiname ohne
  // ".css" und Wert in den Einstellungen; titel = Anzeige in der Oberfläche.
  const DESIGNS = [
    { kennung: 'diner-chrom', titel: 'Diner – Chrom' },
    { kennung: 'diner-messing', titel: 'Diner – Messing' },
    { kennung: 'mitternacht', titel: 'Mitternacht' },
    { kennung: 'wurlitzer-holz', titel: 'Wurlitzer – Holz' },
    { kennung: 'neon-klassik', titel: 'Neon-Klassik' },
    // Auftrag 18: Kassette statt Plattenspieler, eigene Anordnung im Jukeboxer
    { kennung: 'kassette-studio', titel: 'Kassette – Studio-Schwarz', abspielgeraet: 'kassette' },
    // Auftrag 18: Plattenspieler mit Dekor (designs/dekor/weihnachten-stube.js)
    { kennung: 'weihnachten-stube', titel: 'Weihnachten – Stube', dekor: 'weihnachten-stube' },
    // Auftrag 18: Strand-Panorama hinter allen Bedienelementen (designs/dekor/beach-panorama.js)
    { kennung: 'beach-panorama', titel: 'Beach – Strand-Panorama', dekor: 'beach-panorama' }
  ].map((d) => Object.assign({ abspielgeraet: 'platte', dekor: null }, d));
  const STANDARD = 'diner-chrom';

  // Ordner dieser Datei - von dort werden die CSS-Dateien geholt. So
  // stimmt der Pfad am PC (/static/designs/) wie in der Mobil-Version.
  const skript = document.currentScript;
  const ordner = skript ? skript.src.replace(/[^/]*(\?.*)?$/, '') : 'designs/';

  // Die Gestaltungsdateien einbinden. blocking="render": Der Browser
  // wartet mit dem ersten Zeichnen, bis sie da sind (sonst blitzt der
  // PlayLister kurz ohne Design-Farben auf). Ältere Browser übergehen das
  // Merkmal einfach - dann gibt es höchstens dieses kurze Aufblitzen.
  ['design_basis'].concat(DESIGNS.map((d) => d.kennung)).forEach((name) => {
    const verweis = document.createElement('link');
    verweis.rel = 'stylesheet';
    verweis.href = `${ordner}${name}.css`;
    verweis.setAttribute('blocking', 'render');
    document.head.appendChild(verweis);
  });
  // Die Dekor-Dateien (nur Designs mit Dekor). Sie melden sich mit
  // dekorAnmelden() - kommen sie nach dem ersten setzen(), wird das Dekor
  // nachgezogen.
  [...new Set(DESIGNS.map((d) => d.dekor).filter(Boolean))].forEach((name) => {
    const s = document.createElement('script');
    s.src = `${ordner}dekor/${name}.js`;
    document.head.appendChild(s);
  });

  const gueltig = (kennung) => (DESIGNS.some((d) => d.kennung === kennung) ? kennung : STANDARD);
  const eintrag = (kennung) => DESIGNS.find((d) => d.kennung === gueltig(kennung));
  const zuhoerer = [];

  /* -------------------------------------------------------------------
     DEKOR-EBENE (Auftrag 18, Teil B (4))
     Zwei Zeichenschichten je Modul, nur bei Designs mit Dekor:
       .dekor-ebene.dekor-hinten  HINTER den Bedienelementen (erstes Kind
                                  des Gehäuses, z-index -1 im eigenen
                                  Stapel des Gehäuses: über dessen
                                  Hintergrund, unter allem anderen)
       .dekor-ebene.dekor-vorn    VOR den Bedienelementen (letztes Kind);
                                  nur, was nachweislich nichts verdeckt
                                  (Prüfung pruefe_bedienteile.py)
     Beide mit pointer-events: none - sie fangen nie einen Klick.
     Das Gehäuse: im Jukeboxer .jbx-diner, im PlayDecker das Panel selbst.
     Es bekommt data-dekor="<name>" (Gestaltung: design_basis.css).

     Eine Dekor-Datei meldet sich so an:
       PlayListerDesigns.dekorAnmelden('<name>', {
         playdecker(ebene) { … },  jukeboxer(ebene) { … } })
     ebene = { hinten, vorn, gehaeuse, modul, lage(sel) }
       lage(sel) -> Rechteck eines Elements relativ zum Gehäuse
                    ({ x, y, b, h } in px) - zum Ausrichten am Pult usw.
     Die Funktion zeichnet (SVG/CSS, keine Bilder von außen) und darf ein
     Objekt { anpassen() } zurückgeben: anpassen läuft bei jeder
     Größenänderung des Gehäuses (z. B. um Figuren neu zu setzen).
     Schlanke Fassung (Handy, Höhe bis 560 px): Teile mit der Klasse
     dk-voll erscheinen nur in voller Größe, Teile mit dk-schlank nur auf
     dem Handy (design_basis.css).
     ------------------------------------------------------------------- */
  const dekorDateien = {};
  const dekorLaeufe = new WeakMap();      // Gehäuse -> { beobachter, anpassen }
  const dekorTraeger = new Set();         // Elemente mit data-design (für das Nachziehen)

  // Gehäuse des Moduls: im Jukeboxer .jbx-diner (gibt es erst, wenn der
  // Kern seine Wurzel .jbx-wurzel aufgebaut hat - bis dahin null), sonst
  // das Element selbst (PlayDecker-Panel; dessen Mini-Wurzeln der Decks
  // heißen zwar auch .jbx, sind aber keine Jukeboxer-Wurzel).
  function gehaeuseVon(element) {
    if (element.classList.contains('jbx-diner')) return element;
    const diner = element.querySelector('.jbx-diner');
    if (diner) return diner;
    if (element.querySelector('.jbx-wurzel') || element.classList.contains('jbx-wurzel')) return null;
    return element;
  }
  function dekorEntfernen(gehaeuse) {
    gehaeuse.querySelectorAll(':scope > .dekor-ebene').forEach((e) => e.remove());
    const lauf = dekorLaeufe.get(gehaeuse);
    if (lauf && lauf.beobachter) lauf.beobachter.disconnect();
    dekorLaeufe.delete(gehaeuse);
    delete gehaeuse.dataset.dekor;
  }
  function dekorAnwenden(element, versuche = 0) {
    if (!element.isConnected) return;
    const e = eintrag(element.dataset.design);
    const gehaeuse = gehaeuseVon(element);
    if (!gehaeuse) {
      // Jukeboxer: das Gehäuse entsteht erst nach dem ersten setzen()
      if (versuche < 20) setTimeout(() => dekorAnwenden(element, versuche + 1), 50);
      return;
    }
    const name = e.dekor;
    if (gehaeuse.dataset.dekor === (name || undefined) && (!name || dekorLaeufe.has(gehaeuse))) return;
    dekorEntfernen(gehaeuse);
    if (!name || !dekorDateien[name]) return;      // ohne Dekor oder Datei noch nicht da
    const modul = gehaeuse.classList.contains('jbx-diner') ? 'jukeboxer' : 'playdecker';
    const zeichnen = dekorDateien[name][modul];
    if (typeof zeichnen !== 'function') return;
    const neu = (lage) => {
      const d = document.createElement('div');
      d.className = `dekor-ebene dekor-${lage}`;
      d.setAttribute('aria-hidden', 'true');
      return d;
    };
    const hinten = neu('hinten'), vorn = neu('vorn');
    gehaeuse.dataset.dekor = name;
    gehaeuse.prepend(hinten);
    gehaeuse.append(vorn);
    const lage = (sel) => {
      const ziel = typeof sel === 'string' ? gehaeuse.querySelector(sel) : sel;
      if (!ziel) return null;
      const g = gehaeuse.getBoundingClientRect(), r = ziel.getBoundingClientRect();
      return { x: r.left - g.left, y: r.top - g.top, b: r.width, h: r.height };
    };
    const ergebnis = zeichnen({ hinten, vorn, gehaeuse, modul, lage }) || {};
    const lauf = { anpassen: ergebnis.anpassen };
    if (typeof lauf.anpassen === 'function' && global.ResizeObserver) {
      lauf.beobachter = new ResizeObserver(() => { try { lauf.anpassen(); } catch (f) { /* Dekor darf nie stören */ } });
      lauf.beobachter.observe(gehaeuse);
    }
    dekorLaeufe.set(gehaeuse, lauf);
  }
  function dekorAnmelden(name, definition) {
    dekorDateien[name] = definition;
    dekorTraeger.forEach((element) => {
      if (element.isConnected && eintrag(element.dataset.design).dekor === name) dekorAnwenden(element);
    });
  }

  global.PlayListerDesigns = Object.freeze({
    liste: Object.freeze(DESIGNS.map((d) => Object.freeze({ ...d }))),
    standard: STANDARD,
    gueltig,
    eintrag: (kennung) => Object.freeze({ ...eintrag(kennung) }),
    // Setzt das Design am Element (einem Elternteil der .jbx-Wurzel).
    // Wirkt sofort über das CSS - kein Neuladen, keine Unterbrechung der
    // Wiedergabe. Abspielgerät und Dekor ziehen nach (beiWechsel).
    setzen(element, kennung) {
      if (!element) return;
      const k = gueltig(kennung);
      element.dataset.design = k;
      const e = eintrag(k);
      if (e.abspielgeraet && e.abspielgeraet !== 'platte') element.dataset.abspielgeraet = e.abspielgeraet;
      else if (element.dataset.abspielgeraet) delete element.dataset.abspielgeraet;
      if (e.dekor || dekorTraeger.has(element)) {
        dekorTraeger.add(element);
        dekorAnwenden(element);
      }
      zuhoerer.forEach((fn) => { try { fn(element, k, e); } catch (f) { console.error(f); } });
    },
    beiWechsel(fn) { if (typeof fn === 'function') zuhoerer.push(fn); },
    dekorAnmelden,
  });
})(window);
