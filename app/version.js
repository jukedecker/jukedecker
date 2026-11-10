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
  const PHASE = 2;
  const NACHBESSERUNG = 0;           // 0 = keine, sonst deren Nummer
  const DATUM = '10.11.2026';        // Tag des Stands
  // ------------------------------------------------------------------------

  const nummer = [HAUPT, AUFTRAG, PHASE].concat(NACHBESSERUNG ? [NACHBESSERUNG] : []).join('.');
  const zusatz = NACHBESSERUNG ? ' (Nachbesserung)' : '';

  global.JukeDeckerVersion = Object.freeze({
    nummer,                                                   // 1.15.2
    version: 'v' + nummer,                                    // v1.15.2
    datum: DATUM,
    // „JukeDecker v1.15.2 · Auftrag 15 Phase 2“ – genau dieser Text steht
    // in den Einstellungen und wird im Prüfplan abgefragt.
    titel: `JukeDecker v${nummer} · Auftrag ${AUFTRAG} Phase ${PHASE}${zusatz}`,
    // Name des Offline-Speichers im Service Worker (dort eingetragen vom
    // Werkzeug app_zusammenstellen.py, hier nur zum Vergleich).
    speichername: 'jukedecker-v' + nummer
  });
})(self);
