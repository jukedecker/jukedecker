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
const VERSION = 'v1.18.6';
const OFFLINE_LISTE = [
  ['app.css', 'e08e0c7ba5d39362c1c727e878186ce960539836ce158ca42efbc179d700dab7'],
  ['app.js', 'eb70f1e32a1712cfb33ca17c7f707f3a49f558cef47806c272c333c42ffab887'],
  ['datenquelle_geraet.js', 'a1c246ba634f96ef3e057dfd417f9bd2c4f0f2df0028eae25ff695255bbf08bf'],
  ['gemeinsam/designs/beach-panorama.css', 'f58720edaad9a11aa3ce9f4bef1abe74bc1db83a0aa5ebd6c9ae2efe8af78e66'],
  ['gemeinsam/designs/dekor/beach-panorama.js', '045c2e75b6896e384d5aed937b455479482881bdf0d84c9d5168488fff62a3b2'],
  ['gemeinsam/designs/dekor/weihnachten-stube.js', 'b4d3049a3ba19290992446c53b27a232f6708583509e027938e8d22e8b07ac6d'],
  ['gemeinsam/designs/design_basis.css', '0479a0be058f00594d63b02828a979462a19b4f1945753dde269d9851272bcb7'],
  ['gemeinsam/designs/designs.js', 'af346473fa3e31b5ffa76b51e6b0aea28215b46f8f0a5e8039747395c3dd05d6'],
  ['gemeinsam/designs/diner-chrom.css', '9d733e05e96d8de98cf7c79015c78fd22297f7acc7aaf7c30a3fdf79c30bbd55'],
  ['gemeinsam/designs/diner-messing.css', '0e5f51dc6dcb1bd3146c1a4c5043aa4982059cdf01f893ccf9a72d5f38693420'],
  ['gemeinsam/designs/kassette-studio.css', 'b5448829e813151e79ea9980234d3cb4b27f7274e3f05315f59c5f076869f653'],
  ['gemeinsam/designs/mitternacht.css', '12a33e670a73d8f69b6e2b5d67be5acc20e388f1e70042f2bb4ac1077413b218'],
  ['gemeinsam/designs/neon-klassik.css', 'f0cb0bb0b4a031f80472b400c69eb9c4581820e2b5aaca43ef24a3e2083c9669'],
  ['gemeinsam/designs/weihnachten-stube.css', '920d5b456844838edc2ff9e07f0aa5b0753dbe9f2fca5d0f9118304c60819cf8'],
  ['gemeinsam/designs/wurlitzer-holz.css', '37f0cd28d3e063f7ad9b322e02721a8fad481bd7a10dfcaaf74b0444c4cc7f71'],
  ['gemeinsam/gemeinsam/abspielgeraet.js', '3d8d1428a1c0042acaf3b7cf5b94ec41ad669b641759e74e45e9c828066f1dcd'],
  ['gemeinsam/gemeinsam/bedienteile.css', '7a43145d7f5ed9761c2084090242f90bc848bf71bb2a8900f34cc052e656f627'],
  ['gemeinsam/gemeinsam/kassette_detail.css', '1f8828de62989b3ca6ae7959ec490c3326882bd4482d241b533e15144289a2f6'],
  ['gemeinsam/gemeinsam/kassette_detail.js', '83ebd6502c2ba61e28fbf32f7b9399cae50a1c4bdb7136ed519e47e23863bd65'],
  ['gemeinsam/gemeinsam/plattenspieler_detail.css', '90ff3a698e4c4cbc4b1f645050222e4edf2ef4dc1a6a0a5f718b20df60c367e7'],
  ['gemeinsam/gemeinsam/plattenspieler_detail.js', 'a873ea488a51786d667a7dc844c3a3556db46254c680bdfe3ede5e595c86f89b'],
  ['gemeinsam/jukeboxer/jukeboxer.css', '061b3896992147f8bfd3c1a361c96aa035e342c08bcbbe2390fa5ffeb186a4f7'],
  ['gemeinsam/jukeboxer/jukeboxer_kern.js', 'f1755c5e275e5befbc56a29e3c84d6129c450a4a9044ad51bf1c2d88ca8350b4'],
  ['gemeinsam/jukeboxer/schriften/BarlowSemiCondensed-Regular.ttf', 'e8c7242f612b13d026e18a94b63b0fd079e91a3faf009d1b6981dbb5f16d1153'],
  ['gemeinsam/jukeboxer/schriften/BarlowSemiCondensed-SemiBold.ttf', 'bd299f4bc5b44d30be8d42e9bad3a5df7d66af1cd55d0ed72a8b8916360a1424'],
  ['gemeinsam/jukeboxer/schriften/Bungee-Regular.ttf', 'c4f5361ce120af3e6b9156d0bf379fa19cda2ea0cd18ac01fd99596c6bf66e3f'],
  ['gemeinsam/jukeboxer/schriften/Oswald-Variabel.ttf', '5b38c246e255a12f5712d640d56bcced0472466fc68983d2d0410ec0457c2817'],
  ['gemeinsam/jukeboxer/schriften/Pacifico-Regular.ttf', '5b6c0d5334a7bf77dea52b975c5a0c408878c0f7115ed5b6fb151f634b7bf701'],
  ['gemeinsam/jukeboxer/schriften/ShareTechMono-Regular.ttf', '9ceab1f87414829af259c0f537573ae03ef7dd3147c0b27a36a1a0beb6732677'],
  ['gemeinsam/jukeboxer/songtext_fenster.css', '728b22e6828cd2a30b64d6f3093a06bb3bccd4ce350ce296733b9f2a4673d9bc'],
  ['gemeinsam/jukeboxer/songtext_fenster.js', '1be029b6acdccda1e3e3eddab5bd2e0b085859f2843b5f2a6e379bbd8b7f57bc'],
  ['gemeinsam/jukeboxer/wiedergabe_regeln.js', '60199a1facd7653c6ff37f908a654ca3bb0935f89998cd08996616e4b9e41826'],
  ['gemeinsam/playdecker/playdecker_aufbau.js', '00a370f829c0779d54525bd9101530cfc804a121034f8248c6e343c40cec15ee'],
  ['gemeinsam/playdecker/playdecker_kern.js', 'cdacba06ce302c60f9ccb312aa05d6dec7a76bd7cd96d373f36f3d84016fed0b'],
  ['gemeinsam/playdecker_design.css', 'de7860785d8e5430d633395a0f279cf023b77ac4ebeb6f1642c34dc7a243f50c'],
  ['gemeinsam/style.css', '9f03f95e31e2b5b999486c70804147a23d8b3810405bc06bb2b45cccfaeec8e1'],
  ['index.html', '806a69655091cca2de201fa34de2f8cba626d4021b4eb3000da8578028b5a5d5'],
  ['jukeboxer_app.js', '216174d37a934fccd46609555727622864264878558d3085e720efd0d29f1a8c'],
  ['manifest.json', '48db62a7c3515f60dd2b244edad9a3b1b0874228e5db9739eeff727930fc504a'],
  ['paket_import.js', '2c8c97b06af79d849ae28b4e3c787ebfaad8d72a37aebf007fdcffbb18e3faf1'],
  ['playdecker_app.js', '530512130955c7592ce2a1c08a708c2d19590537a9ac423880a7e1ac6aee896f'],
  ['symbol-192.png', '9260c7ef6769bd1250f967770e96ed30b18b6f839986741ce6704e224ab4da78'],
  ['symbol-512.png', '579de93a1af8e63055a9dda65efe803bc1068f760caa46b8d1a572da172149c2'],
  ['version.js', 'd35a3fc962bcd12722c1df2931229fa179e8f2dd973e9ffbdb67cf21300df041'],
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
