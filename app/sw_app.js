/* =========================================================================
   JukeDecker – Service Worker der App (Auftrag 15, Phase 2)

   Ein Service Worker ist ein kleines Skript, das der Browser unabhängig
   von der Seite aufbewahrt. Er macht dreierlei:
   (1) OFFLINE-BETRIEB: Alle Dateien der App liegen im Offline-Speicher
       „jukedecker-v<Version>“. Die App startet daraus – auch ohne Netz.
       Nur YouTube (der Player) braucht Internet; davon wird nichts
       gespeichert (Nutzungsbedingungen).
   (2) NEUE FASSUNG: Ändert sich eine Datei, ändert sich ihre Prüfsumme in
       der Liste unten - damit ist dieses Skript für den Browser „neu“. Er
       lädt dann die neue Fassung vollständig in einen NEUEN Speicher und
       räumt den alten weg. Die laufende Seite lädt sich dabei NICHT neu
       (Party-Regel); die neue Fassung gilt ab dem nächsten Öffnen.
   (3) TEILEN: Android schickt ein geteiltes Paket als Formular (POST) an
       ./teilen-empfang (share_target im Manifest). Der Service Worker legt
       die Datei im Gerätespeicher „jukedecker-geteilt“ ab und leitet auf
       ./?geteilt=1 weiter. Die Datei verlässt dabei das Gerät nicht.

   BEREICH: Dieses Skript liegt in /jukedecker/app/ und gilt nur dort. Die
   Messseite (/jukedecker/messung/) hat ihren eigenen Service Worker; ihre
   Speicher („jd-messung-…“) fasst dieses Skript nie an.
   ========================================================================= */
'use strict';

// <<< VON app_zusammenstellen.py ERZEUGT – NICHT VON HAND ÄNDERN >>>
const VERSION = 'v1.15.2';
const OFFLINE_LISTE = [
  ['app.css', 'fe95e734cb9457242e75acacaf34e5fd426ee78a07bf6ee6b73b8b156746cd6e'],
  ['app.js', '4d3c8def37de4dea1f41bf30448f2da4c920a2693c18c14726ec36c1f90fcb65'],
  ['datenquelle_geraet.js', 'c57b741a9a1a1e4ee642985820d86682e132535685d0b0963b028909972ffc25'],
  ['gemeinsam/designs/design_basis.css', 'b3c3a3151786520e27d749d12544891b8096b62c6052431146d1efcd75501050'],
  ['gemeinsam/designs/designs.js', '752648277fa3ecfbcfeed355815a8a596600c1de9aed602d9bf4ddb86013b120'],
  ['gemeinsam/designs/diner-chrom.css', '9d733e05e96d8de98cf7c79015c78fd22297f7acc7aaf7c30a3fdf79c30bbd55'],
  ['gemeinsam/designs/diner-messing.css', '0e5f51dc6dcb1bd3146c1a4c5043aa4982059cdf01f893ccf9a72d5f38693420'],
  ['gemeinsam/designs/mitternacht.css', '12a33e670a73d8f69b6e2b5d67be5acc20e388f1e70042f2bb4ac1077413b218'],
  ['gemeinsam/designs/neon-klassik.css', 'f0cb0bb0b4a031f80472b400c69eb9c4581820e2b5aaca43ef24a3e2083c9669'],
  ['gemeinsam/designs/wurlitzer-holz.css', '37f0cd28d3e063f7ad9b322e02721a8fad481bd7a10dfcaaf74b0444c4cc7f71'],
  ['gemeinsam/jukeboxer/jukeboxer.css', '0ad922d699e715e1bb6d7eae52f9c57b4b9e9ab4c96405a7505e7fc2c5058f13'],
  ['gemeinsam/jukeboxer/schriften/BarlowSemiCondensed-Regular.ttf', 'e8c7242f612b13d026e18a94b63b0fd079e91a3faf009d1b6981dbb5f16d1153'],
  ['gemeinsam/jukeboxer/schriften/BarlowSemiCondensed-SemiBold.ttf', 'bd299f4bc5b44d30be8d42e9bad3a5df7d66af1cd55d0ed72a8b8916360a1424'],
  ['gemeinsam/jukeboxer/schriften/Bungee-Regular.ttf', 'c4f5361ce120af3e6b9156d0bf379fa19cda2ea0cd18ac01fd99596c6bf66e3f'],
  ['gemeinsam/jukeboxer/schriften/Oswald-Variabel.ttf', '5b38c246e255a12f5712d640d56bcced0472466fc68983d2d0410ec0457c2817'],
  ['gemeinsam/jukeboxer/schriften/Pacifico-Regular.ttf', '5b6c0d5334a7bf77dea52b975c5a0c408878c0f7115ed5b6fb151f634b7bf701'],
  ['gemeinsam/jukeboxer/schriften/ShareTechMono-Regular.ttf', '9ceab1f87414829af259c0f537573ae03ef7dd3147c0b27a36a1a0beb6732677'],
  ['index.html', '2284cc068a627c4ce8913cfc29b9edcc3c9c0a0cf8c09f38cf54f1ffba90d28c'],
  ['manifest.json', '48db62a7c3515f60dd2b244edad9a3b1b0874228e5db9739eeff727930fc504a'],
  ['paket_import.js', 'c590c4f9da217bce9550adecc94a4e9813dafc47520bb7c6d5ff53976a870a1f'],
  ['symbol-192.png', '9260c7ef6769bd1250f967770e96ed30b18b6f839986741ce6704e224ab4da78'],
  ['symbol-512.png', '579de93a1af8e63055a9dda65efe803bc1068f760caa46b8d1a572da172149c2'],
  ['version.js', '2672bbb5147ac23ac007d5923957bba505952a92d45a36451b1abda1cadd3401'],
];
// <<< ENDE DES ERZEUGTEN TEILS >>>

const APP_SPEICHER = 'jukedecker-' + VERSION;          // z. B. jukedecker-v1.15.2
const GETEILT_SPEICHER = 'jukedecker-geteilt';

self.addEventListener('install', (ereignis) => {
  // cache: 'reload' = am Zwischenspeicher des Browsers vorbei, immer frisch
  // vom Server. GitHub Pages erlaubt 10 Minuten Zwischenspeicherung - ohne
  // 'reload' könnte eine neue Fassung sonst alte Dateien ablegen.
  ereignis.waitUntil((async () => {
    const speicher = await caches.open(APP_SPEICHER);
    await speicher.addAll(['./'].concat(OFFLINE_LISTE.map(([pfad]) => pfad))
      .map((pfad) => new Request(pfad, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (ereignis) => {
  // Nur ALTE Speicher DIESER App wegräumen. „jukedecker-geteilt“ (ein
  // geteiltes Paket, das noch auf eine Entscheidung wartet) und alles der
  // Messseite bleibt unberührt.
  ereignis.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen
      .filter((n) => n.startsWith('jukedecker-v') && n !== APP_SPEICHER)
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request;
  const url = new URL(anfrage.url);
  const eigenerOrdner = new URL('./', self.location.href).pathname;   // /jukedecker/app/

  // (3) Geteilte Datei annehmen (POST vom Android-Teilen-Menü).
  if (anfrage.method === 'POST' && url.origin === self.location.origin && url.pathname === eigenerOrdner + 'teilen-empfang') {
    ereignis.respondWith(geteilteDateiAnnehmen(anfrage));
    return;
  }
  if (anfrage.method !== 'GET') return;
  // Fremde Adressen (YouTube, Bilderserver) und alles außerhalb der App
  // gehen unverändert ins Netz.
  if (url.origin !== self.location.origin || !url.pathname.startsWith(eigenerOrdner)) return;
  ereignis.respondWith(ausSpeicher(anfrage));
});

/** (1) Erst aus dem Offline-Speicher, sonst aus dem Netz (z. B. vor der ersten Installation). */
async function ausSpeicher(anfrage) {
  const speicher = await caches.open(APP_SPEICHER);
  // ignoreSearch: ./?geteilt=1 ist dieselbe Seite wie ./
  const treffer = await speicher.match(anfrage, { ignoreSearch: true });
  if (treffer) return treffer;
  return fetch(anfrage);
}

/** (3) Die geteilte Datei aus dem Formular nehmen, ablegen, weiterleiten. */
async function geteilteDateiAnnehmen(anfrage) {
  const ziel = new URL('./?geteilt=1', self.location.href);
  const speicher = await caches.open(GETEILT_SPEICHER);
  try {
    const formular = await anfrage.formData();
    const dateien = formular.getAll('datei').filter((d) => d && typeof d === 'object' && 'size' in d);
    const name = dateien.length ? String(dateien[0].name || '') : '';
    // Nur die ENDUNG fürs Protokoll; den Namen zeigt allein der Dialog an.
    const endung = /\.[A-Za-z0-9]{1,8}$/.test(name) ? name.slice(name.lastIndexOf('.')).toLowerCase() : '(keine)';
    await speicher.delete('geteilt/datei');
    if (dateien.length) {
      await speicher.put('geteilt/datei', new Response(dateien[0], {
        headers: { 'Content-Type': dateien[0].type || 'application/octet-stream' }
      }));
    }
    await speicher.put('geteilt/angaben', new Response(JSON.stringify({
      zeit: new Date().toISOString(),
      dateien: dateien.length,
      name,
      groesse: dateien.length ? dateien[0].size : 0,
      typ: dateien.length ? (dateien[0].type || '(leer)') : '',
      endung: dateien.length ? endung : ''
    }), { headers: { 'Content-Type': 'application/json' } }));
  } catch (fehler) {
    await speicher.put('geteilt/angaben', new Response(JSON.stringify({
      zeit: new Date().toISOString(), fehler: `${fehler.name}: ${fehler.message}`
    }), { headers: { 'Content-Type': 'application/json' } }));
  }
  // 303: Der Browser holt die App danach mit GET.
  return Response.redirect(ziel.href, 303);
}

// Die Seite fragt nach der Version (Einstellungen: „Neue Fassung liegt bereit“).
self.addEventListener('message', (ereignis) => {
  const nachricht = ereignis.data || {};
  if (nachricht.art === 'version' && ereignis.ports[0]) ereignis.ports[0].postMessage({ version: VERSION });
});
