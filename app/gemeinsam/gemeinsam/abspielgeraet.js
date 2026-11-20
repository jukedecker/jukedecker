/* =====================================================================
   ABSPIELGERÄT – der Vermittler zwischen Kernen und Gerät
   (Auftrag 18, Teil B, Phase 2)

   WOZU: Bis Auftrag 17 bewegten PlayDecker- und Jukeboxer-Kern den
   Plattenspieler selbst (Klassen an Platte und Tonarm, Etikett, Variablen).
   Seit Auftrag 18 gibt es zwei Abspielgeräte: den Plattenspieler
   (static/gemeinsam/plattenspieler_detail.js) und die Kassette
   (static/gemeinsam/kassette_detail.js). Welches gilt, bestimmt das
   DESIGN (Eintrag „abspielgeraet“ in static/designs/designs.js) - es gibt
   keine eigene Einstellung dafür.

   Die Kerne fragen deshalb nur noch „das Abspielgerät“ an und kennen keine
   Einzelheiten des Plattenspielers mehr. Dieser Vermittler
   (1) tut für den Plattenspieler GENAU das, was die Kerne bisher selbst
       taten - dieselben Handgriffe am HTML in derselben Reihenfolge (der
       Code ist wörtlich aus den Kernen hierher gezogen). Geprüft mit
       pruefe_playdecker_gleich.py und pruefe_bedienteile.py --jbx-ablauf:
       In den Plattenspieler-Designs entsteht Zeichen für Zeichen dasselbe
       HTML mit denselben Player-Befehlen.
   (2) gibt jede Nachricht zusätzlich an die Kassette weiter, wenn das
       Design eine verlangt. Die Kassette entsteht erst dann (vorher steht
       sie nicht im HTML) und verschwindet wieder beim Wechsel auf ein
       Plattenspieler-Design.

   „WURZEL“ heißt hier wie im Plattenspieler-Baustein: das Element mit der
   Klasse .jbx, in dem der Plattenspieler steckt - im Jukeboxer seine ganze
   Wurzel, im PlayDecker die Mini-Wurzel je Deck (#deck-a-teller).

   SCHNITTSTELLE (global Abspielgeraet):
     einrichten(wurzel, { beiStartStop, frontschrift, rahmen, modul })
         Plattenspieler einsetzen (PlattenspielerDetail.einrichten) und
         die Wurzel für einen späteren Gerätewechsel merken.
         modul: 'playdecker' | 'jukeboxer' (wohin die Kassette gehört)
     perspektiveSetzen(wurzel, p)     flach / leicht / stark
     tellerUndArm(wurzel, dreht, arm) Einstellungen des Jukeboxers
     drehung(wurzel, sekunden)        Sekunden pro Umdrehung (Jukeboxer)
     nachfuehren(wurzel, zustand, anteil, sekunden?)
         PlayDecker, im Takt: YouTube-Zustand (1 läuft, 2 Pause, 3 puffert,
         0 Ende, 5 bereit, -1 ungestartet) und Fortschritt 0…1
     fortschritt(wurzel, anteil, sekunden?)  Jukeboxer, im Takt
     titelZeigen(wurzel, { html, kennung })  PlayDecker: neuer Titel im Deck
         (Beschriftung des Etiketts; das Cover kommt danach mit coverSetzen)
     coverSetzen(wurzel, adresse)            PlayDecker: Cover trägt
     titelWechsel(wurzel, { … })             Jukeboxer: der ganze Wechsel
         (Ablauf und Wartezeiten wie bisher plattenWechsel im Kern)
     istKassette(wurzel)              -> bool
     wechselArt(wurzel, art)          Einstellung „Kassettenwechsel“
   ===================================================================== */
(function (global) {
  'use strict';

  // Gemerkte Angaben je Wurzel: Optionen von einrichten(), letzter Zustand
  // (für eine Kassette, die erst später entsteht). Eine WeakMap verändert
  // das HTML nicht.
  const merker = new WeakMap();
  const angaben = (wurzel) => {
    if (!merker.has(wurzel)) merker.set(wurzel, { optionen: {}, cover: null, text: null, zustand: -1, anteil: 0, sekunden: 0, kennung: null, art: null });
    return merker.get(wurzel);
  };
  const alleWurzeln = new Set();

  const PLATTE = () => global.PlattenspielerDetail || null;
  const KASSETTE = () => global.KassetteDetail || null;

  /** Verlangt das Design um diese Wurzel eine Kassette? Das Merkmal
      data-abspielgeraet setzt designs.js am Element mit data-design. */
  function istKassette(wurzel) {
    const traeger = wurzel && wurzel.closest('[data-design]');
    return !!(traeger && traeger.dataset.abspielgeraet === 'kassette');
  }
  /** Die Kassette dieser Wurzel, falls es sie gerade gibt */
  function kassetteVon(wurzel) {
    const a = angaben(wurzel);
    return a.kassette && a.kassette.isConnected ? a.kassette : null;
  }

  /* ---------------------------------------------------------------
     GERÄTEWECHSEL: Design gewechselt -> Kassette anlegen bzw. entfernen
     --------------------------------------------------------------- */
  function geraetAbgleichen(wurzel) {
    const a = angaben(wurzel);
    const k = KASSETTE();
    if (istKassette(wurzel) && k) {
      if (!kassetteVon(wurzel)) {
        a.kassette = k.einrichten(wurzel, a.optionen);
        if (a.art) k.wechselArt(a.kassette, a.art);
        // Den bekannten Stand sofort übernehmen (ohne Wechsel-Bewegung)
        k.cover(a.kassette, a.cover, a.text);
        k.zustand(a.kassette, a.zustand, a.anteil, a.sekunden);
      }
    } else if (a.kassette) {
      if (k) k.entfernen(a.kassette);
      else a.kassette.remove();
      a.kassette = null;
    }
  }
  function allesAbgleichen() { alleWurzeln.forEach((w) => { if (w.isConnected) geraetAbgleichen(w); }); }
  if (global.PlayListerDesigns && global.PlayListerDesigns.beiWechsel) {
    global.PlayListerDesigns.beiWechsel(() => allesAbgleichen());
  }

  /* ---------------------------------------------------------------
     EINRICHTEN
     --------------------------------------------------------------- */
  function einrichten(wurzel, optionen) {
    const a = angaben(wurzel);
    a.optionen = Object.assign({}, optionen || {});
    alleWurzeln.add(wurzel);
    if (PLATTE()) {
      PLATTE().einrichten(wurzel, {
        beiStartStop: a.optionen.beiStartStop,
        frontschrift: a.optionen.frontschrift,
        rahmen: a.optionen.rahmen,
      });
    }
    geraetAbgleichen(wurzel);
  }

  /* ---------------------------------------------------------------
     EINSTELLUNGEN (Perspektive, Teller, Tonarm, Drehung)
     --------------------------------------------------------------- */
  // Perspektive: „flach" = ohne Merkmal (Draufsicht). Der Baustein bemerkt
  // den Wechsel selbst und passt das Gerät neu ein (wörtlich aus beiden Kernen).
  function perspektiveSetzen(wurzel, perspektive) {
    if (!wurzel) return;
    if (perspektive === 'flach') delete wurzel.dataset.perspektive;
    else wurzel.dataset.perspektive = perspektive;
  }
  // Jukeboxer, Effekte „Plattenteller dreht sich" und „Tonarm schwenkt"
  function tellerUndArm(wurzel, dreht, arm) {
    wurzel.dataset.teller = dreht ? 'an' : 'aus';
    wurzel.dataset.tonarm = arm ? 'an' : 'aus';
  }
  // Jukeboxer: Sekunden pro Umdrehung (die Kassette dreht ihre Spulen im
  // selben Maß - sie liest dieselbe Variable)
  function drehung(wurzel, sekunden) {
    wurzel.style.setProperty('--umdrehung', `${sekunden}s`);
  }

  /* ---------------------------------------------------------------
     PLAYDECKER: Gerät nach dem Zustand seines Players stellen
     (bis Auftrag 17: deckPlattenspielerNachfuehren im PlayDecker-Kern)
     (1) Aufgelegt (Tonarm auf der Platte, Platte im Drehbetrieb) ist sie,
         solange ein Titel spielt, pausiert oder puffert. Bei Ende oder
         frisch geladenem Titel hebt sich der Arm.
     (2) Drehen tut sie nur, wenn der Player WIRKLICH läuft.
     (3) Der Tonarm wandert mit dem Fortschritt nach innen.
     --------------------------------------------------------------- */
  function nachfuehren(wurzel, zustand, anteil, sekunden) {
    if (!wurzel) return;
    const platte = wurzel.querySelector('.jbx-platte');
    const arm = wurzel.querySelector('.jbx-tonarm');
    const aufgelegt = zustand === 1 || zustand === 2 || zustand === 3;
    if (platte) platte.classList.toggle('jbx-dreht', aufgelegt);
    if (arm) arm.classList.toggle('jbx-auf-platte', aufgelegt);
    wurzel.classList.toggle('jbx-pausiert', aufgelegt && zustand !== 1);
    const wert = aufgelegt && Number.isFinite(anteil) ? Math.min(Math.max(anteil, 0), 1) : 0;
    wurzel.style.setProperty('--fortschritt', wert.toFixed(4));
    // Für die Kassette merken und weitergeben
    const a = angaben(wurzel);
    a.zustand = zustand; a.anteil = wert; a.sekunden = Number.isFinite(sekunden) ? sekunden : 0;
    const k = kassetteVon(wurzel);
    if (k && KASSETTE()) KASSETTE().zustand(k, zustand, wert, a.sekunden);
  }

  /* ---------------------------------------------------------------
     JUKEBOXER: Fortschritt im Takt (Tonarm wandert mit)
     --------------------------------------------------------------- */
  function fortschritt(wurzel, anteil, sekunden) {
    wurzel.style.setProperty('--fortschritt', anteil.toFixed(4));
    const a = angaben(wurzel);
    a.anteil = anteil; a.sekunden = Number.isFinite(sekunden) ? sekunden : 0;
    const k = kassetteVon(wurzel);
    if (k && KASSETTE()) KASSETTE().fortschritt(k, anteil, a.sekunden);
  }

  /* ---------------------------------------------------------------
     PLAYDECKER: neuer Titel im Deck (bis Auftrag 17 in deckTitelAnzeigen)
     Beschriftung des Etiketts (Interpret und Titel bzw. „PLAYDECKER“),
     dann das Etikett zurücksetzen: Bis feststeht, ob ein Bild trägt,
     steht der Schriftzug darauf.
     --------------------------------------------------------------- */
  function titelZeigen(wurzel, { html, kennung }) {
    const beschriftung = wurzel.querySelector('.jbx-etikett-text');
    if (beschriftung) beschriftung.innerHTML = html;
    const etikett = wurzel.querySelector('.jbx-etikett');
    if (etikett) {
      etikett.style.backgroundImage = '';
      etikett.classList.remove('jbx-mit-cover');
    }
    if (beschriftung) beschriftung.hidden = false;
    const a = angaben(wurzel);
    const vorher = a.kennung;
    const neuerTitel = (kennung || null) !== vorher;
    a.kennung = kennung || null; a.cover = null; a.text = html;
    const k = kassetteVon(wurzel);
    if (k && KASSETTE()) {
      // Ein neuer Titel bringt den Kassettenwechsel (beim allerersten
      // Titel ohne Bewegung - es gab noch keine Kassette zum Herausnehmen)
      if (neuerTitel && a.kennung) KASSETTE().wechseln(k, null, html, !!vorher);
      else KASSETTE().cover(k, null, html);
    }
  }
  /** PlayDecker: Ein Cover trägt wirklich - es kommt aufs Etikett.
      Ersatzbild dahinter: Fällt das Bild später doch aus, bleibt ein
      rotes Etikett statt einer leeren Fläche. */
  function coverSetzen(wurzel, adresse) {
    const etikett = wurzel.querySelector('.jbx-etikett');
    if (etikett) {
      etikett.style.backgroundImage = `url('${adresse}'), var(--cover-ersatz)`;
      etikett.classList.add('jbx-mit-cover');
    }
    const beschriftung = wurzel.querySelector('.jbx-etikett-text');
    if (beschriftung) beschriftung.hidden = true;
    const a = angaben(wurzel);
    a.cover = `url('${adresse}'), var(--cover-ersatz)`;
    const k = kassetteVon(wurzel);
    if (k && KASSETTE()) KASSETTE().cover(k, a.cover, a.text);
  }

  /* ---------------------------------------------------------------
     JUKEBOXER: der ganze Titelwechsel am Gerät
     (bis Auftrag 17: plattenWechsel im Jukeboxer-Kern, wörtlich übernommen)
     Ablauf beim Plattenspieler: Tonarm hebt ab → Platte stoppt → alte
     Platte fährt raus → Etikett bekommt das neue Cover → neue Platte fährt
     rein → Tonarm senkt sich (hier beginnt beim harten Schnitt der Ton:
     beimAufsetzen) → Platte dreht sich.
     Angaben vom Kern:
       hatteVorher   lag schon ein Titel auf?
       stil          'schwenken' | 'wechsler' | 'blende' | 'aus'
       armBewegt     schwenkt der Tonarm (Effekte)?
       warte(ms)     die Wartefunktion des Kerns (Tempo der Animationen)
       cover         Versprechen auf den Hintergrund (Cover) des Titels
       anzeigen(h)   der Kern zeigt Titel und Cover in seiner Anzeige
       beimAufsetzen der Ton darf beginnen
       kennung       Video-Kennung (für die Kassette)
       text          Beschriftung des Kassetten-Etiketts (HTML, geschützt)
     KASSETTE (Auftrag 18, (5)(3)(B)): Die Musik wartet nie auf die
     Animation. Der Ton beginnt sofort, die Kassette wechselt daneben.
     --------------------------------------------------------------- */
  async function titelWechsel(wurzel, w) {
    const a = angaben(wurzel);
    a.kennung = w.kennung || null;
    const k = kassetteVon(wurzel);
    if (k && KASSETTE()) {
      const platte = wurzel.querySelector('.jbx-platte'), arm = wurzel.querySelector('.jbx-tonarm');
      wurzel.style.setProperty('--fortschritt', 0);
      if (arm) arm.classList.remove('jbx-auf-platte');
      const hintergrund = await w.cover;
      a.cover = hintergrund || null; a.anteil = 0; a.sekunden = 0;
      const etikett = wurzel.querySelector('.jbx-etikett');
      if (etikett) {
        etikett.style.backgroundImage = hintergrund || '';
        etikett.classList.toggle('jbx-mit-cover', !!hintergrund);
      }
      a.text = w.text || null;
      KASSETTE().wechseln(k, hintergrund || null, a.text, w.hatteVorher);
      w.anzeigen(hintergrund);
      if (arm) arm.classList.add('jbx-auf-platte');
      if (w.beimAufsetzen) w.beimAufsetzen();
      if (platte) platte.classList.add('jbx-dreht');
      return;
    }

    // --- Plattenspieler: wörtlich wie bisher im Kern ---
    const halter = wurzel.querySelector('.jbx-platte-halter'), platte = wurzel.querySelector('.jbx-platte'),
      arm = wurzel.querySelector('.jbx-tonarm');
    const { hatteVorher, stil, armBewegt, warte } = w;
    // Das Cover hat der Kern schon angefordert - so ist es da, wenn die neue Platte kommt.
    const coverVersprechen = w.cover;
    wurzel.classList.add('jbx-wechsel');

    arm.classList.remove('jbx-auf-platte');
    wurzel.style.setProperty('--fortschritt', 0);
    if (hatteVorher && armBewegt) await warte(550);
    platte.classList.remove('jbx-dreht');

    const bewegung = {
      schwenken: ['jbx-raus-rechts', 'jbx-von-links'],
      wechsler: ['jbx-raus-oben', 'jbx-raus-oben'],
      blende: ['jbx-ausgeblendet', 'jbx-ausgeblendet']
    }[stil];

    const hintergrund = await coverVersprechen;
    if (bewegung) {
      const [raus, rein] = bewegung;
      if (hatteVorher) {
        halter.classList.add(raus);
        await warte(680);
      }
      // Platte unsichtbar an die Startposition setzen, neues Cover drauf …
      halter.classList.add('jbx-sofort');
      halter.classList.remove(raus);
      halter.classList.add(rein);
      void halter.offsetWidth;
      etikettSetzen(wurzel, hintergrund);
      w.anzeigen(hintergrund);
      // … und hereinfahren lassen
      halter.classList.remove('jbx-sofort', rein);
      await warte(680);
    } else {
      etikettSetzen(wurzel, hintergrund);
      w.anzeigen(hintergrund);
    }

    arm.classList.add('jbx-auf-platte');
    // Der Tonarm senkt sich: Hier beginnt (beim harten Schnitt) der Ton.
    if (w.beimAufsetzen) w.beimAufsetzen();
    if (armBewegt) await warte(550);
    platte.classList.add('jbx-dreht');
    wurzel.classList.remove('jbx-wechsel');
    a.cover = hintergrund || null;
    a.text = w.text || null;
  }

  /* ---------------------------------------------------------------
     EINSTELLUNG „Kassettenwechsel“ (Auftrag 18, (5)(2)): welche Bewegung
     die Kassette beim Titelwechsel macht. Wirkt nur bei der Kassette;
     der Wert wird auch gemerkt, solange es noch keine gibt.
     --------------------------------------------------------------- */
  function wechselArt(wurzel, art) {
    const a = angaben(wurzel);
    a.art = art || null;
    const k = kassetteVon(wurzel);
    if (k && KASSETTE() && a.art) KASSETTE().wechselArt(k, a.art);
  }

  function etikettSetzen(wurzel, hintergrund) {
    const etikett = wurzel.querySelector('.jbx-etikett');
    etikett.style.backgroundImage = hintergrund || '';
    etikett.classList.toggle('jbx-mit-cover', !!hintergrund);
  }

  global.Abspielgeraet = Object.freeze({
    einrichten, perspektiveSetzen, tellerUndArm, drehung,
    nachfuehren, fortschritt, titelZeigen, coverSetzen, titelWechsel, istKassette, wechselArt,
  });
})(window);
