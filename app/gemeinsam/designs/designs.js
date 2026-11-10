/* =====================================================================
   DESIGN-SYSTEM – AUSWAHLLISTE und LADER (Auftrag 16)

   Diese Datei ist die EINE Liste aller Designs. Sie
   (1) lädt beim Start die Gestaltungsdateien design_basis.css und je
       Design <kennung>.css aus demselben Ordner wie diese Datei,
   (2) stellt die Liste für die Auswahlfelder bereit (Jukeboxer:
       Einstellungen -> Effekte -> „Design"; PlayDecker: Pult, Phase 3),
   (3) hilft beim Setzen: unbekannte Kennungen werden zum Standard.

   Ein SECHSTES Design: neue Datei <kennung>.css in diesem Ordner + eine
   Zeile in DESIGNS unten. Sonst nichts.

   Diese Datei kennt weder Flask noch den PlayLister - sie läuft so auch
   in der Mobil-Version. Sie muss im <head> stehen (VOR dem ersten
   Zeichnen), damit nichts kurz ungefärbt aufblitzt.

   VON AUSSEN (global PlayListerDesigns):
     liste                -> [{ kennung, titel }] in Anzeigereihenfolge
     standard             -> 'diner-chrom'
     gueltig(kennung)     -> die Kennung, wenn es sie gibt, sonst der Standard
     setzen(element, k)   -> setzt data-design="k" (geprüft) am Element
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
    { kennung: 'neon-klassik', titel: 'Neon-Klassik' }
  ];
  const STANDARD = 'diner-chrom';

  // Ordner dieser Datei - von dort werden die CSS-Dateien geholt. So
  // stimmt der Pfad am PC (/static/designs/) wie später in der Mobil-Version.
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

  const gueltig = (kennung) => (DESIGNS.some((d) => d.kennung === kennung) ? kennung : STANDARD);

  global.PlayListerDesigns = Object.freeze({
    liste: Object.freeze(DESIGNS.map((d) => Object.freeze({ ...d }))),
    standard: STANDARD,
    gueltig,
    // Setzt das Design am Element (einem Elternteil der .jbx-Wurzel).
    // Wirkt sofort über das CSS - kein Neuladen, keine Unterbrechung der
    // Wiedergabe (es ändern sich nur Farben).
    setzen(element, kennung) {
      if (element) element.dataset.design = gueltig(kennung);
    }
  });
})(window);
