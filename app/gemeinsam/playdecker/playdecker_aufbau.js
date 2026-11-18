/* =====================================================================
   PLAYDECKER-AUFBAU (Auftrag 15, Phase 1)

   Das HTML-Gerüst des PlayDecker-Panels (#panel-deck): Leuchtschild, die
   beiden Decks mit Plattenspieler-Rohbau, Titelkarten und Tasten, das Pult,
   die Warteschlangen, das Einstellungsfenster, die Karte „Lokal
   gespeicherte Playlisten" und die Fußzeile.

   Bis Auftrag 15 stand es in templates/index.html. Es wurde von dort
   WÖRTLICH hierher verschoben (Zeichen für Zeichen, einschließlich der
   Kommentare und Leerzeichen), damit es die Mobil-Version (JukeDecker)
   ohne zweite Abschrift benutzen kann. Geprüft mit
   pruefe_playdecker_gleich.py: Die Seite am PC ist danach gleich.

   AUFRUF: PlayDeckerAufbau.einsetzen(wurzel)
     wurzel = das leere Element <section id="panel-deck">. Danach stehen alle
     IDs deck-…, die der PlayDecker-Kern (playdecker_kern.js) braucht.
     Muss VOR dem Kern laufen - am PC sogar vor app.js, weil app.js beim
     Laden schon die Karte der lokalen Playlisten (#lokal-liste) sucht.
   PlayDeckerAufbau.html() liefert das Gerüst als Text.

   WARUM EIN TEXT UND KEIN Aufbau Element für Element: So bleibt das
   Gerüst lesbar wie eine HTML-Datei, und der Vergleich mit dem bisherigen
   Stand ist trivial.
   ===================================================================== */
(function (global) {
  'use strict';

  // Das Gerüst - unverändert aus templates/index.html (nicht neu einrücken:
  // jedes Zeichen landet so im Seiteninhalt).
  const GERUEST = `
      <!-- Leuchtschild wie im Jukeboxer (Auftrag 16) -->
      <header class="deck-schild">
        <span class="deck-schild-text">PlayDecker</span>
        <span class="deck-schild-sub">by Gallus Optus</span>
      </header>
      <div class="pult">
        <div class="decks">

          <!-- DECK A -->
          <div class="deck" id="deck-a-karte">
            <div class="deck-kopf">
              <span class="deck-lbl">A</span>
              <span class="deck-pl">
                <b id="deck-a-liste">keine Playlist</b>
                <span id="deck-a-anzahl">—</span>
              </span>
            </div>

            <div class="deck-wahl">
              <select id="deck-a-auswahl"><option value="">Playlist wählen …</option></select>
              <button type="button" class="knopf knopf--klein" id="deck-a-laden">Laden</button>
              <button type="button" class="knopf knopf--klein knopf--geist" id="deck-a-teilen"
                      title="Diese Playlist abwechselnd auf Deck A und B verteilen">Teilen</button>
            </div>

            <!-- PLATTENSPIELER (Auftrag 16): eine Mini-Wurzel „.jbx" mit dem
                 gemeinsamen Baustein static/gemeinsam/plattenspieler_detail.js
                 (derselbe wie im Jukeboxer). Hier steht nur der Rohbau; die
                 Detailteile setzt app.js beim Start ein. Perspektive fest
                 „stark". #deck-a-label ist die Beschriftung auf dem Etikett,
                 solange kein Cover trägt. -->
            <div class="teller-wrap">
              <div class="jbx deck-spieler" id="deck-a-teller" data-perspektive="stark">
                <div class="jbx-kuppel-glas"><div class="jbx-teller-flaeche"><div class="jbx-teller-box">
                  <div class="jbx-teller"></div>
                  <div class="jbx-platte-halter"><div class="jbx-platte"><div class="jbx-etikett"><span class="jbx-etikett-text" id="deck-a-label">PLAYDECKER</span></div></div></div>
                  <div class="jbx-tonarm"></div>
                  <div class="jbx-tonarm-basis"></div>
                </div></div></div>
              </div>
            </div>

            <!-- Der Player erzeugt den Ton, wird aber NICHT gezeigt.
                 Gemessen am 06.08.2026: Die Wiedergabe läuft auch bei
                 versteckter Fläche unverändert weiter (Höhe null und
                 display:none beide geprüft, Position lief in beiden
                 Fällen weiter). Der gewonnene Platz gehört den
                 Bedienelementen. -->
            <div class="deck-rahmen" id="deck-a-rahmen"></div>

            <!-- Titelkarte (Auftrag 16): Fortschritt und Zeiten gemeinsam auf
                 einer Karte wie „Jetzt läuft" im Jukeboxer. Die Gruppe ist
                 nur für die Gestaltung da; Elemente und IDs sind dieselben. -->
            <div class="deck-anzeige">
              <div class="fort"><div class="bal" id="deck-a-balken"></div></div>
              <div class="zeit">
                <span id="deck-a-position">0:00</span>
                <span class="zeit__titel" id="deck-a-titel">—</span>
                <span id="deck-a-dauer">0:00</span>
              </div>
            </div>

            <div class="deck-steuer">
              <button type="button" class="rund" id="deck-a-zurueck" title="Vorheriger Titel">⏮</button>
              <button type="button" class="rund klein" id="deck-a-rueck" title="10 Sekunden zurück">⏪</button>
              <button type="button" class="rund gross" id="deck-a-spiel" title="Abspielen / Pause">▶</button>
              <button type="button" class="rund klein" id="deck-a-spul" title="10 Sekunden vor">⏩</button>
              <button type="button" class="rund" id="deck-a-vor" title="Nächster Titel">⏭</button>
            </div>
            <p class="deck-meldung" id="deck-a-meldung" hidden></p>
          </div>

          <!-- MITTE: Crossfader, VU, Auto-Mix (Phase 3) -->
          <div class="mitte">
            <!-- Hier stand ein VU-Zeiger. Er ist ENTFERNT, weil er nichts
                 Echtes anzeigte: Der eingebettete Player gibt das
                 Tonsignal nicht heraus, ein Pegel wäre also gemalt. Die
                 beiden Zahlen unter dem Regler sind dagegen echt — sie
                 nennen die tatsächlich gesetzten Lautstärken. -->
            <div class="cross-lbl">CROSSFADER</div>
            <div class="crossfader">
              <span class="ab">A</span>
              <input type="range" id="deck-crossfader" min="0" max="100" value="50"
                     aria-label="Crossfader zwischen Deck A und Deck B">
              <span class="ab">B</span>
            </div>
            <div class="cross-werte" id="deck-cross-werte">A 50 · B 50</div>

            <!-- GESAMTLAUTSTÄRKE (Bauauftrag 13, Wunsch des Nutzers): eine
                 Lautstärke für BEIDE Decks. Sie ersetzt weder Crossfader
                 noch Überblendung, sondern wird mit beiden verrechnet.
                 Bewusst flach (Wert in der Kopfzeile): Die Mittelspalte ist
                 schon die höchste Spalte des PlayDeckers. -->
            <div class="dauer-wahl lautstaerke-wahl">
              <div class="lautstaerke-kopf">
                <label for="deck-lautstaerke">Lautstärke</label>
                <b id="deck-lautstaerke-wert">100</b>
              </div>
              <div class="lautstaerke-schiene">
                <span aria-hidden="true">🔈</span>
                <input type="range" id="deck-lautstaerke" min="0" max="100" step="1" value="100"
                       aria-label="Lautstärke">
                <span aria-hidden="true">🔊</span>
              </div>
            </div>

            <!-- Auto-Mix steht ab Werk auf AN (Wunsch A6). Die Klasse
                 „an" ist hier schon gesetzt, damit die Anzeige nicht für
                 einen Wimpernschlag „aus" behauptet; den Zustand setzt
                 deckAutoMixSetzen() beim Start ohnehin noch einmal. -->
            <div class="automix an">
              <span class="kipp an" id="deck-automix-kipp"></span>
              <span class="automix-lab">Auto-Mix</span>
            </div>

            <p class="mitte-hinweis" id="deck-mitte-hinweis">
              Überblendet wird über die Lautstärke — hörbar weich, aber
              nicht taktsynchron.
            </p>

            <!-- SONGTEXT (Phase 6, Bauauftrag 13): Statt des festen Felds
                 öffnet dieser Knopf das schwebende Songtext-Fenster
                 (static/jukeboxer/songtext_fenster.js). Es folgt dem
                 spielenden Deck, bei einer Blende ab ihrem Beginn dem
                 Ziel-Deck. YouTube liefert keine Zeitmarken - das Fenster
                 sagt das im Kopf („nicht zeitsynchron"). -->
            <button type="button" class="songtext-knopf" id="deck-songtext-knopf"
                    title="Songtext in einem schwebenden Fenster zeigen">♪ Songtext</button>

            <!-- EINSTELLUNGEN (Auftrag 17): öffnet das Einstellungsfenster
                 #deck-einstellungen. Gleiche Machart wie der Songtext-Knopf,
                 direkt darunter (Festlegung von Ralle). -->
            <button type="button" class="songtext-knopf deck-einst-knopf" id="deck-einstellungen-knopf"
                    aria-haspopup="dialog" aria-controls="deck-einstellungen"
                    title="Überblendung, Spielzeit, Plattenspieler und Design einstellen">⚙ Einstellungen</button>
          </div>

          <!-- DECK B -->
          <div class="deck" id="deck-b-karte">
            <div class="deck-kopf">
              <span class="deck-lbl">B</span>
              <span class="deck-pl">
                <b id="deck-b-liste">keine Playlist</b>
                <span id="deck-b-anzahl">—</span>
              </span>
            </div>

            <div class="deck-wahl">
              <select id="deck-b-auswahl"><option value="">Playlist wählen …</option></select>
              <button type="button" class="knopf knopf--klein" id="deck-b-laden">Laden</button>
              <button type="button" class="knopf knopf--klein knopf--geist" id="deck-b-teilen"
                      title="Diese Playlist abwechselnd auf Deck A und B verteilen">Teilen</button>
            </div>

            <!-- PLATTENSPIELER (Auftrag 16): eine Mini-Wurzel „.jbx" mit dem
                 gemeinsamen Baustein static/gemeinsam/plattenspieler_detail.js
                 (derselbe wie im Jukeboxer). Hier steht nur der Rohbau; die
                 Detailteile setzt app.js beim Start ein. Perspektive fest
                 „stark". #deck-b-label ist die Beschriftung auf dem Etikett,
                 solange kein Cover trägt. -->
            <div class="teller-wrap">
              <div class="jbx deck-spieler" id="deck-b-teller" data-perspektive="stark">
                <div class="jbx-kuppel-glas"><div class="jbx-teller-flaeche"><div class="jbx-teller-box">
                  <div class="jbx-teller"></div>
                  <div class="jbx-platte-halter"><div class="jbx-platte"><div class="jbx-etikett"><span class="jbx-etikett-text" id="deck-b-label">PLAYDECKER</span></div></div></div>
                  <div class="jbx-tonarm"></div>
                  <div class="jbx-tonarm-basis"></div>
                </div></div></div>
              </div>
            </div>

            <div class="deck-rahmen" id="deck-b-rahmen"></div>

            <!-- Titelkarte (Auftrag 16): Fortschritt und Zeiten gemeinsam auf
                 einer Karte wie „Jetzt läuft" im Jukeboxer. Die Gruppe ist
                 nur für die Gestaltung da; Elemente und IDs sind dieselben. -->
            <div class="deck-anzeige">
              <div class="fort"><div class="bal" id="deck-b-balken"></div></div>
              <div class="zeit">
                <span id="deck-b-position">0:00</span>
                <span class="zeit__titel" id="deck-b-titel">—</span>
                <span id="deck-b-dauer">0:00</span>
              </div>
            </div>

            <div class="deck-steuer">
              <button type="button" class="rund" id="deck-b-zurueck" title="Vorheriger Titel">⏮</button>
              <button type="button" class="rund klein" id="deck-b-rueck" title="10 Sekunden zurück">⏪</button>
              <button type="button" class="rund gross" id="deck-b-spiel" title="Abspielen / Pause">▶</button>
              <button type="button" class="rund klein" id="deck-b-spul" title="10 Sekunden vor">⏩</button>
              <button type="button" class="rund" id="deck-b-vor" title="Nächster Titel">⏭</button>
            </div>
            <p class="deck-meldung" id="deck-b-meldung" hidden></p>
          </div>
        </div>

        <!-- Warteschlangen. Sie zeigen nur, was als Nächstes kommt —
             ein Vorhören-Knopf steht hier bewusst NICHT. -->
        <div class="queues">
          <div class="queue">
            <h4><span>Warteschlange A</span><span id="deck-a-queue-zahl"></span></h4>
            <!-- Werkzeuge für die Mehrfachauswahl. Sie wirken auf ALLE
                 angekreuzten Zeilen; ohne Kreuzchen sagen sie das auch. -->
            <div class="q-leiste">
              <button type="button" class="mini" id="deck-a-q-alle">Alle</button>
              <button type="button" class="mini" id="deck-a-q-keine">Keine</button>
              <span class="q-leiste__zahl" id="deck-a-q-zahl"></span>
              <button type="button" class="mini" id="deck-a-q-hoch" title="Angekreuzte nach oben">▲</button>
              <button type="button" class="mini" id="deck-a-q-runter" title="Angekreuzte nach unten">▼</button>
              <button type="button" class="mini mini--weg" id="deck-a-q-weg" title="Angekreuzte entfernen">✕</button>
              <button type="button" class="mini mini--misch" id="deck-a-q-mischen"
                      title="Die noch kommenden Titel durchschütteln">🔀 Mischen</button>
              <button type="button" class="mini mini--wdh" id="deck-a-q-wiederholen"
                      title="Warteschlange A am Ende wieder von vorn">↻ Wiederholen</button>
              <button type="button" class="mini mini--lok" id="deck-a-q-lokal"
                      title="Diese Warteschlange zusätzlich lokal als Datei speichern">💾 Lokal</button>
              <button type="button" class="mini mini--csv" id="deck-a-q-csv"
                      title="Diese Warteschlange als CSV-Datei herunterladen">📄 CSV</button>
            </div>
            <div id="deck-a-queue"><p class="leer">Noch keine Playlist geladen.</p></div>
          </div>

          <!-- Titel zwischen den Warteschlangen verschieben
               (Änderungswunsch 5 vom 12.08.2026). Bewusst dieselbe Bauart
               wie die Aktionsspalte im ManLister: Jeder Knopf sagt durch
               seine Pfeilrichtung, aus welcher Warteschlange er nimmt und
               in welche er legt — es gibt kein verstecktes „aktives
               Deck", das man erst erraten müsste. -->
          <div class="q-mitte">
            <button type="button" class="akt" id="deck-nach-b" disabled
                    title="Angekreuzte Titel von Warteschlange A nach B verschieben">▶</button>
            <span class="akt-schrift">A nach B</span>

            <button type="button" class="akt" id="deck-nach-a" disabled
                    title="Angekreuzte Titel von Warteschlange B nach A verschieben">◀</button>
            <span class="akt-schrift">B nach A</span>
          </div>

          <div class="queue">
            <h4><span>Warteschlange B</span><span id="deck-b-queue-zahl"></span></h4>
            <div class="q-leiste">
              <button type="button" class="mini" id="deck-b-q-alle">Alle</button>
              <button type="button" class="mini" id="deck-b-q-keine">Keine</button>
              <span class="q-leiste__zahl" id="deck-b-q-zahl"></span>
              <button type="button" class="mini" id="deck-b-q-hoch" title="Angekreuzte nach oben">▲</button>
              <button type="button" class="mini" id="deck-b-q-runter" title="Angekreuzte nach unten">▼</button>
              <button type="button" class="mini mini--weg" id="deck-b-q-weg" title="Angekreuzte entfernen">✕</button>
              <button type="button" class="mini mini--misch" id="deck-b-q-mischen"
                      title="Die noch kommenden Titel durchschütteln">🔀 Mischen</button>
              <button type="button" class="mini mini--wdh" id="deck-b-q-wiederholen"
                      title="Warteschlange B am Ende wieder von vorn">↻ Wiederholen</button>
              <button type="button" class="mini mini--lok" id="deck-b-q-lokal"
                      title="Diese Warteschlange zusätzlich lokal als Datei speichern">💾 Lokal</button>
              <button type="button" class="mini mini--csv" id="deck-b-q-csv"
                      title="Diese Warteschlange als CSV-Datei herunterladen">📄 CSV</button>
            </div>
            <div id="deck-b-queue"><p class="leer">Noch keine Playlist geladen.</p></div>
          </div>
        </div>
      </div>

      <!-- EINSTELLUNGSFENSTER DES PLAYDECKERS (Auftrag 17, 19.10.2026)
           Hierhin sind Überblenddauer, Feste Spielzeit, Plattendrehung und
           Design aus dem Pult umgezogen - mit DENSELBEN IDs wie vorher, damit
           die vorhandene Logik und die gemerkten Werte weiter greifen. Neu ist
           die Perspektive des Plattenspielers (gilt für beide Decks). Jede
           Änderung wirkt sofort, einen Speichern-Knopf gibt es nicht (wie im
           Jukeboxer). Schließen: „Fertig", ✕, Esc oder Klick neben das
           Fenster (app.js, Abschnitt „Einstellungsfenster"). Es liegt im
           Panel, damit es das Design des PlayDeckers trägt. -->
      <div class="deck-einst" id="deck-einstellungen" hidden>
        <div class="deck-einst-karte" role="dialog" aria-modal="true" aria-labelledby="deck-einst-titel">
          <div class="deck-einst-kopf">
            <span id="deck-einst-titel">⚙ Einstellungen</span>
            <button type="button" class="deck-einst-zu" title="Schließen (Esc)" aria-label="Schließen">✕</button>
          </div>

          <div class="deck-einst-abschnitt">Wiedergabe</div>
          <div class="dauer-wahl">
            <label for="deck-dauer">Überblenddauer</label>
            <input type="range" id="deck-dauer" min="0" max="20" step="1" value="4"
                   aria-label="Überblenddauer in Sekunden, 0 bis 20">
            <div class="dauer-wert"><b id="deck-dauer-wert">4 s</b>
              <small id="deck-dauer-zusatz">weiche Überblendung</small></div>
          </div>

          <!-- Feste Spielzeit je Titel. Der Regler hat GANZ LINKS die
               Stellung „aus" und springt von dort auf 10 s — dazwischen
               gibt es nichts. Deshalb steuert er nicht die Sekunden
               selbst, sondern eine Stufennummer; die Umrechnung steht
               in app.js bei deckSpielzeitAusStufe(). -->
          <div class="dauer-wahl spielzeit-wahl">
            <label for="deck-spielzeit">Feste Spielzeit</label>
            <input type="range" id="deck-spielzeit" min="0" max="60" step="1" value="0"
                   aria-label="Feste Spielzeit je Titel: aus, sonst 10 bis 600 Sekunden">
            <div class="dauer-wert"><b id="deck-spielzeit-wert">aus</b>
              <small id="deck-spielzeit-zusatz">Titel laufen in voller Länge</small></div>
          </div>

          <div class="deck-einst-abschnitt">Plattenspieler</div>
          <!-- PLATTENDREHUNG (Nacharbeit zu Bauauftrag 13, 17.10.2026):
               Sekunden pro Umdrehung beider Plattenteller, 2 bis 10 in
               Halbsekunden-Schritten, ab Werk 5. Gemerkt wie die übrigen
               PlayDecker-Einstellungen. -->
          <div class="dauer-wahl drehung-wahl">
            <label for="deck-drehung">Plattendrehung</label>
            <input type="range" id="deck-drehung" min="2" max="10" step="0.5" value="5"
                   aria-label="Plattendrehung: Sekunden pro Umdrehung, 2 bis 10">
            <div class="dauer-wert"><b id="deck-drehung-wert">5 s</b>
              <small>pro Umdrehung</small></div>
          </div>

          <!-- PERSPEKTIVE (Auftrag 17): flach, leicht, stark - gilt für beide
               Decks gemeinsam, Standard stark. -->
          <div class="deck-perspektive-wahl">
            <span class="deck-einst-beschriftung" id="deck-perspektive-titel">Perspektive</span>
            <div class="deck-wahl-knoepfe" id="deck-perspektive" role="group" aria-labelledby="deck-perspektive-titel">
              <button type="button" class="mini" data-p="flach" aria-pressed="false">Flach</button>
              <button type="button" class="mini" data-p="leicht" aria-pressed="false">Leicht</button>
              <button type="button" class="mini an" data-p="stark" aria-pressed="true">Stark</button>
            </div>
          </div>

          <div class="deck-einst-abschnitt">Aussehen</div>
          <!-- DESIGN des PlayDeckers (Auftrag 16): eigene Auswahl, unabhängig
               vom Jukeboxer. Die Einträge füllt app.js aus der Liste in
               static/designs/designs.js; gemerkt wie die übrigen
               PlayDecker-Einstellungen. -->
          <div class="deck-design-wahl">
            <label for="deck-design">Design</label>
            <select id="deck-design" aria-label="Design des PlayDeckers"></select>
          </div>

          <button type="button" class="deck-einst-fertig">Fertig</button>
          <!-- VERSIONSANZEIGE (Auftrag 15): ganz unten in kleiner Schrift,
               z. B. „PlayLister v1.15.2 · Auftrag 15, Phase 2 · Stand
               10.11.2026 · e165f2f". Das Gerüst lässt sie leer: Am PC füllt
               sie static/versionsanzeige.js, in der Mobil-Version die App
               mit ihrer eigenen Version. -->
          <p class="deck-einst-stand" id="deck-stand"></p>
        </div>
      </div>

      <!-- Übersicht der lokal gespeicherten Playlisten.
           WARUM HIER UND NICHT IN EINEM EIGENEN REITER: Der Hauptnutzen
           der lokalen Ablage liegt im PlayDecker — sie macht das Deck von
           der Anmeldung unabhängig, und PlayDecker ist seit dem 11.08. der
           erste Reiter. Geladen wird bewusst NICHT von hier, sondern über
           die Playlist-Auswahl der beiden Decks (dort steht eine eigene
           Gruppe „Lokal gespeichert"): So gibt es EINEN Ladeweg statt
           zweier, und die vorhandene Überschreib-Rückfrage gilt
           automatisch mit. Diese Karte listet und löscht. -->
      <section class="karte lokale-karte">
        <h3>Lokal gespeicherte Playlisten
          <button type="button" class="mini" id="lokal-neu-lesen"
                  title="Liste neu einlesen">↻</button>
        </h3>
        <p class="hinweis">
          <b>ⓘ</b> Diese Listen liegen als Dateien im Ordner
          <code>Playlisten/</code> und brauchen <b>keine Anmeldung</b>.
          Zum Laden die Liste oben in der Playlist-Auswahl eines Decks
          unter „Lokal gespeichert" wählen.
        </p>
        <div id="lokal-liste"><p class="leer">Wird gelesen …</p></div>
      </section>

      <p class="hinweis deck-fusszeile">
        <b>ⓘ</b> Der Ton kommt aus zwei eingebetteten YouTube-Playern.
        Überblendet wird über die <b>Lautstärke</b> — hörbar weich, aber
        nicht taktsynchron. Beatmatch, Klangregelung und Wellenform sind
        damit nicht möglich und deshalb nicht eingebaut; Vorhören
        ebenfalls nicht, weil der Browser nur einen Audioausgang hat.
      </p>
      <!-- Schachbrett-Leiste unten wie im Jukeboxer (Auftrag 16) -->
      <div class="deck-schachbrett" aria-hidden="true"></div>
    `;

  /** Setzt das Gerüst in das (leere) Panel ein. */
  function einsetzen(wurzel) {
    wurzel.innerHTML = GERUEST;
  }

  global.PlayDeckerAufbau = Object.freeze({ einsetzen, html: () => GERUEST });
})(window);
