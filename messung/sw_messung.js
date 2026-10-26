/* ======================================================================
   JukeDecker - Vorabmessung: Service Worker der Messseite
   (Auftrag 14: M2, M4, M16B)

   Ein Service Worker ist ein kleines Skript, das der Browser unabhaengig
   von der Seite aufbewahrt. Er legt die Dateien der Messseite auf dem
   Geraet ab, damit sie auch ohne Netz startet (M4).

   Bereich: Er liegt in /jukedecker/messung/ und gilt deshalb NUR fuer
   diesen Ordner (die Startseite /jukedecker/ und spaeter die App gehen
   ihn nichts an).

   Regeln:
   (1) Dateien der Messseite: sofort aus dem Speicher liefern und im
       Hintergrund nachsehen, ob es Neues gibt ("stale-while-revalidate").
       So startet die Seite ohne Netz - wie spaeter der JukeDecker.
   (2) netzprobe.json: IMMER aus dem Netz, nie aus dem Speicher. Daran
       erkennt die Seite, ob das Netz wirklich da ist (M4, M6).
   (3) Teilen an die App (M16B, "share_target" im Manifest): Android
       schickt die geteilte Datei als POST an ./teilen-empfang. Der
       Service Worker legt sie in einem eigenen Speicher ab und leitet auf
       die Messseite weiter, die sie dort abholt. Die Datei verlaesst
       dabei das Geraet NICHT.
   (4) YouTube und alles andere wird nicht angefasst - der Player braucht
       ohnehin Internet, und Inhalte von YouTube werden nicht gespeichert.
   ====================================================================== */
'use strict';

// Bei jeder Aenderung an den Dateien hochzaehlen - dann holt sich das
// Geraet die neue Fassung und raeumt die alte weg. MUSS zur
// SEITENVERSION in messung.js passen.
const VERSION = 'jd-messung-2';
const APP_SPEICHER = 'jd-messung-app-' + VERSION;
const GETEILT_SPEICHER = 'jd-messung-geteilt';
const GETEILT_SCHLUESSEL = 'geteilt/datei';
const NUR_NETZ = ['netzprobe.json'];

// Alles, was die Seite zum Starten braucht (relativ zum Ordner des
// Service Workers - so funktioniert es in jedem Unterpfad).
const APP_DATEIEN = [
  './',
  'index.html',
  'messung.js',
  'manifest.json',
  'symbol-192.png',
  'symbol-512.png',
  'testliste.json',
  'plattenspieler/jukeboxer.css',
  'plattenspieler/plattenspieler_detail.css',
  'plattenspieler/plattenspieler_detail.js',
  'plattenspieler/design_basis.css',
  'plattenspieler/diner-chrom.css',
];

self.addEventListener('install', ereignis => {
  ereignis.waitUntil(
    caches.open(APP_SPEICHER)
      .then(speicher => speicher.addAll(APP_DATEIEN))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ereignis => {
  ereignis.waitUntil(
    caches.keys()
      .then(namen => Promise.all(namen
        .filter(n => n.startsWith('jd-messung-app-') && n !== APP_SPEICHER)
        .map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ereignis => {
  const anfrage = ereignis.request;
  const url = new URL(anfrage.url);
  const eigenerOrdner = new URL('./', self.location.href).pathname;   // z. B. /jukedecker/messung/

  // Regel (3): geteilte Datei annehmen (POST vom Android-Teilen-Menue).
  if (anfrage.method === 'POST' && url.origin === self.location.origin
      && url.pathname === eigenerOrdner + 'teilen-empfang') {
    ereignis.respondWith(geteilteDateiAnnehmen(anfrage));
    return;
  }
  if (anfrage.method !== 'GET') return;
  if (url.origin !== self.location.origin || !url.pathname.startsWith(eigenerOrdner)) return;   // Regel (4)

  const relativ = url.pathname.slice(eigenerOrdner.length);
  if (NUR_NETZ.includes(relativ)) return;                                   // Regel (2)
  ereignis.respondWith(ausSpeicherUndAuffrischen(ereignis, anfrage));      // Regel (1)
});

async function ausSpeicherUndAuffrischen(ereignis, anfrage) {
  const speicher = await caches.open(APP_SPEICHER);
  // ignoreSearch: ./?geteilt=1 oder ./?geoeffnet=1 ist dieselbe Seite.
  const treffer = await speicher.match(anfrage, { ignoreSearch: true });
  const ausNetz = fetch(anfrage)
    .then(antwort => {
      // Nur vollstaendige, eigene Antworten ablegen (keine Fehlerseiten).
      if (antwort.ok && antwort.type === 'basic') speicher.put(anfrage, antwort.clone());
      return antwort;
    });
  if (treffer) {
    // Auffrischen im Hintergrund; scheitert es (offline), ist das kein Fehler.
    ereignis.waitUntil(ausNetz.catch(() => null));
    return treffer;
  }
  return ausNetz;
}

/** M16B: Die geteilte Datei aus dem Formular nehmen, ablegen, weiterleiten.
    Abgelegt wird die Datei selbst plus Zahlen fuer das Protokoll - KEIN
    Name und kein Inhalt geht irgendwohin ausser in den Geraetespeicher. */
async function geteilteDateiAnnehmen(anfrage) {
  const ziel = new URL('./?geteilt=1', self.location.href);
  try {
    const formular = await anfrage.formData();
    const dateien = formular.getAll('datei').filter(d => d && typeof d === 'object' && 'size' in d);
    const angaben = {
      zeit: new Date().toISOString(),
      dateien: dateien.length,
      groesse: dateien.length ? dateien[0].size : 0,
      typ: dateien.length ? (dateien[0].type || '(leer)') : '',
      // Nur die LAENGE der Begleittexte - der Inhalt geht niemanden etwas an.
      laenge_titel: String(formular.get('titel') || '').length,
      laenge_text: String(formular.get('text') || '').length,
      laenge_adresse: String(formular.get('adresse') || '').length,
    };
    const speicher = await caches.open(GETEILT_SPEICHER);
    await speicher.delete(GETEILT_SCHLUESSEL);
    if (dateien.length) {
      await speicher.put(GETEILT_SCHLUESSEL, new Response(dateien[0], {
        headers: { 'Content-Type': dateien[0].type || 'application/octet-stream' },
      }));
    }
    await speicher.put('geteilt/angaben', new Response(JSON.stringify(angaben), {
      headers: { 'Content-Type': 'application/json' },
    }));
  } catch (fehler) {
    const speicher = await caches.open(GETEILT_SPEICHER);
    await speicher.put('geteilt/angaben', new Response(JSON.stringify({
      zeit: new Date().toISOString(), fehler: `${fehler.name}: ${fehler.message}`,
    }), { headers: { 'Content-Type': 'application/json' } }));
  }
  // 303: Der Browser holt die Messseite danach mit GET.
  return Response.redirect(ziel.href, 303);
}

self.addEventListener('message', ereignis => {
  const antworten = daten => ereignis.ports[0] && ereignis.ports[0].postMessage(daten);
  const nachricht = ereignis.data || {};
  if (nachricht.art === 'version') antworten({ version: VERSION });
});
