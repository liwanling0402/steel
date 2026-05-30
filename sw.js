/* ==========================================
   Steel PWA Service Worker v4.0
   - 离线缓存所有静态资源
   - 数据层使用 localStorage（不需要网络）
   - Cache First 策略（优先本地）
   - 自动更新静默生效
   ========================================== */

const CACHE_NAME = 'steel-pwa-v4-20260530';
const ASSETS = [
  '/',
  '/index.html',
  '/index-app.html',
  '/css/style.css',
  '/js/storage.js',
  '/js/production-form.js',
  '/js/production-list.js',
  '/js/customer-service.js',
  '/js/app.js',
  '/js/app-bundle.js',
  '/manifest.webmanifest',
  '/icons/icon-72x72.svg',
  '/icons/icon-96x96.svg',
  '/icons/icon-128x128.svg',
  '/icons/icon-144x144.svg',
  '/icons/icon-152x152.svg',
  '/icons/icon-192x192.svg',
  '/icons/icon-384x384.svg',
  '/icons/icon-512x512.svg',
  '/icons/icon-maskable-512x512.svg'
];

// 安装：预缓存所有核心文件
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
    }).then(() => {
      return self.skipWaiting(); // 立即激活
    })
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // 立即控制所有页面
    })
  );
});

// 请求拦截：Cache First + Network Fallback
self.addEventListener('fetch', (event) => {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  // 跳过 chrome-extension 等非 HTTP(S) 请求
  if (!event.request.url.startsWith('http')) return;

  // 对 CDN 资源不做缓存拦截
  if (event.request.url.includes('cdn.tailwindcss.com')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // 命中缓存直接返回
      if (cached) {
        // 后台更新（Stale-While-Revalidate）
        const fetched = fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        }).catch(() => null);

        return cached;
      }

      // 未命中：走网络
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(() => {
        // 网络失败且无缓存：返回离线页面
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
