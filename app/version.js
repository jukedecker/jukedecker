/* =========================================================================
   JukeDecker – die EINE Stelle für die Version der App

   SCHEMA (wie am PC, CLAUDE.md „Versionsanzeige“):
     v<Haupt>.<Auftrag>.<Phase>       z. B. v1.15.2 = Auftrag 15, Phase 2
     v<Haupt>.<Auftrag>.<Phase>.<N>   N-te Nachbesserung innerhalb der Phase

   WER DAS LIEST:
   (1) Die Seite (index.html lädt diese Datei zuerst): Anzeige in den
       Einstellungen und klein auf der Startseite, Kopf des Protokolls.
   (2) Das Werkzeug werkzeuge/app_zusammenstellen.py: Es schreibt die
       Versionsnummer in sw_app.js. Der Offline-Speicher des Service
       Workers heißt deshalb immer „jukedecker-v<Nummer>“. Hat sich eine
       Datei der App geändert, die Nummer aber nicht, bricht das Werkzeug
       ab. Sonst behielte das Gerät alten Code.

   PFLICHT JE PHASE: Vor jedem Statusbericht hochzählen.
   ========================================================================= */
(function (global) {
  'use strict';

  // ---- Von Hand gepflegt -------------------------------------------------
  const HAUPT = 1;
  const AUFTRAG = 15;
  const PHASE = 5;
  const NACHBESSERUNG = 5;           // 0 = keine, sonst deren Nummer
  const DATUM = '20.11.2026';        // Tag des Stands
  // Eigener Name der Stufe statt „Nachbesserung N“ bzw. „Phase N“ (leer =
  // automatisch). Seit dem Abschluss von Auftrag 15: „Abschluss“.
  const STUFE_NAME = 'Abschluss';
  // ------------------------------------------------------------------------

  const nummer = [HAUPT, AUFTRAG, PHASE].concat(NACHBESSERUNG ? [NACHBESSERUNG] : []).join('.');
  // Bei einer Nachbesserung steht sie an der Stelle der Phase:
  // „JukeDecker v1.15.5.2 · Auftrag 15 Nachbesserung 2“; mit eigenem Namen
  // „JukeDecker v1.15.5.5 · Auftrag 15 Abschluss“.
  const stufe = STUFE_NAME || (NACHBESSERUNG ? `Nachbesserung ${NACHBESSERUNG}` : `Phase ${PHASE}`);

  global.JukeDeckerVersion = Object.freeze({
    nummer,                                                   // 1.15.2
    version: 'v' + nummer,                                    // v1.15.2
    datum: DATUM,
    // „JukeDecker v1.15.2 · Auftrag 15 Phase 2“ – genau dieser Text steht
    // in den Einstellungen und wird im Prüfplan abgefragt.
    titel: `JukeDecker v${nummer} · Auftrag ${AUFTRAG} ${stufe}`,
    // Name des Offline-Speichers im Service Worker (dort eingetragen vom
    // Werkzeug app_zusammenstellen.py, hier nur zum Vergleich).
    speichername: 'jukedecker-v' + nummer
  });
})(self);
