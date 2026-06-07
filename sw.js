/**
 * sw.js — Service Worker
 * 离线缓存策略: Cache First
 */

const CACHE_NAME = 'teleprompter-v3';

const PRECACHE_URLS = [
  'index.html',
  'css/style.css',
  'js/main.js',
  'js/word.js',
  'js/sentence.js',
  'js/renderer.js',
  'js/tts.js',
  'data/syllable_map.json',
  'data/pinyin_hanzi.json',
  'data/linking_rules.json',
  'data/word_hanzi.json',
  'manifest.json',
];

// 安装：预缓存核心文件
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => {
          return name !== CACHE_NAME;
        }).map((name) => {
          return caches.delete(name);
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 请求拦截：Cache First
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // 只缓存有效响应
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // 离线时返回空响应（非关键资源）
        return new Response('离线', { status: 200 });
      });
    })
  );
});
