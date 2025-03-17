const CACHE_NAME = 'calendar-cache-v1';

// ✅ Instalace Service Workeru a načtení všech důležitých souborů do cache
self.addEventListener('install', event => {
  console.log('✅ Service Worker instalován.');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        '/',                   // Přidej zde soubory, které se mají uložit do cache
        '/index.html',
        '/style.css',
        '/script.js',
        '/firebase-auth.js',
        '/firebase.js'
      ]);
    })
    .then(() => self.skipWaiting())
});

// ✅ Aktivace SW – vyčištění starých cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(cacheToDelete => {
          console.log('🗑️ Mažu starou cache:', cacheToDelete);
          return caches.delete(cacheToDelete);
        })
      );
    })
  );

  self.clients.claim();
});

// ✅ Zachycení požadavků – zajištění offline/online režimu
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
