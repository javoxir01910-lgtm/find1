// Grant Finder - Service Worker (PWA Offline Support)
const CACHE_NAME = 'grant-finder-cache-v1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './index_v2.html',
  './app_v2.js',
  './grants_data.js',
  './grants_data.json',
  './manifest.json',
  './favicon.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './tahlil_hisoboti.html'
];

// O'rnatish jarayoni - asosiy resurslarni keshga yuklash
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Resurslar keshlanmoqda...');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Ba\'zi fayllar keshlashda xato:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Faollashuv jarayoni - eski keshlarni tozalash
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Eski kesh tozalandi:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Tarmoq so'rovlarini boshqarish (Network First with Cache Fallback)
self.addEventListener('fetch', (event) => {
  // Faqat GET so'rovlarni boshqarish
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Mahalliy fayllar yoki tashqi CDN shrift/ikonkalar
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return fetch(event.request)
        .then((networkResponse) => {
          // Muvaffaqiyatli tarmoq javobini keshga saqlash
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => {
          // Tarmoq bo'lmasa keshdan qaytarish (Oflayn rejim)
          return cache.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Agar HTML sahifa so'ralgan bo'lsa va keshda yo'q bo'lsa, asosiy index.html ga yo'naltirish
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return cache.match('./index.html');
            }
          });
        });
    })
  );
});
