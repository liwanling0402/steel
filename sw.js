/* ==========================================
   Steel PWA Service Worker v5.0
   - 自动检测 GitHub Pages 子路径
   - 离线缓存所有静态资源
   - Cache First + 后台更新策略
   ========================================== */

const CACHE_NAME = 'steel-pwa-v6-20260603';

// 自动检测部署路径（本地 / 或 GitHub Pages /steel/）
const BASE = self.location.pathname.replace(/\/sw\.js$/, '');
const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/index-app.html',
  BASE + '/logistics.html',
  BASE + '/css/style.css',
  BASE + '/js/storage.js',
  BASE + '/js/production-form.js',
  BASE + '/js/production-list.js',
  BASE + '/js/customer-service.js',
  BASE + '/js/app.js',
  BASE + '/js/app-bundle.js',
  BASE + '/manifest.webmanifest',
  BASE + '/icons/icon-72x72.svg',
  BASE + '/icons/icon-96x96.svg',
  BASE + '/icons/icon-128x128.svg',
  BASE + '/icons/icon-144x144.svg',
  BASE + '/icons/icon-152x152.svg',
  BASE + '/icons/icon-192x192.svg',
  BASE + '/icons/icon-384x384.svg',
  BASE + '/icons/icon-512x512.svg',
  BASE + '/icons/icon-maskable-512x512.svg'
];

// 安装：预缓存
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('SW: cache add failed for', url, err.message);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    }).then(() => self.clients.claim())
  );
});

// 请求拦截：Cache First + 后台更新
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // 后台静默更新
        fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response.clone());
            });
          }
        }).catch(() => {});
        return cached;
      }

      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match(BASE + '/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
