/* ======================================================================
   JukeDecker - Messseite abgeschaltet (20.11.2026)

   Die Messseite ist am 20.11.2026 abgeschaltet worden, sie ist in der
   Git-Geschichte erhalten. Von ihr bleibt nur diese eine Datei.

   Warum es sie noch gibt: Ein Geraet, auf dem die Messseite einmal lief,
   hat ihren alten Service Worker noch. Der lieferte die Seite weiter aus
   dem Geraetespeicher, auch wenn sie im Internet fehlt (gemessen
   20.11.2026). Beim naechsten Aufruf von /jukedecker/messung/ holt das
   Geraet diese Fassung. Sie
   (1) raeumt die Speicher der Messseite weg (Namen beginnen mit
       "jd-messung-"),
   (2) meldet sich selbst ab,
   (3) laedt offene Fenster der Messseite neu. Dann kommt die Seite
       "nicht gefunden" (404).

   Die App unter /jukedecker/app/ hat ihren eigenen Service Worker und
   eigene Speicher ("jukedecker-..."). Diese Datei fasst sie nie an.
   ====================================================================== */
'use strict';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen.filter((n) => n.startsWith('jd-messung-')).map((n) => caches.delete(n)));
    await self.registration.unregister();
    const fenster = await self.clients.matchAll({ type: 'window' });
    fenster.forEach((f) => f.navigate(f.url));
  })());
});
