const CACHE_NAME = 'shynote-v1';
const ASSETS_TO_CACHE = [
	'/',
	'/static/index.html',
	'/static/style.css',
	'/static/app.js',
	'/static/manifest.json',
	'/static/logo.png',
	'/static/favicon.ico',
	'/static/icon-192.png',
	'/static/icon-512.png',
	'https://cdn.tailwindcss.com',
	'https://unpkg.com/vue@3/dist/vue.global.js',
	'https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js',
	'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
	'https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.min.css',
	'https://unpkg.com/nord-highlightjs@0.1/dist/nord.css',
	'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap',
	'https://cdn.jsdelivr.net/gh/wan2land/d2coding/d2coding.css',
	'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(ASSETS_TO_CACHE).catch(err => {
				console.warn('Cache addAll failed for some assets, continuing', err);
			});
		})
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					if (cacheName !== CACHE_NAME) {
						return caches.delete(cacheName);
					}
				})
			);
		})
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	// Only handle GET requests
	if (event.request.method !== 'GET') return;

	// Skip cross-origin requests that might fail or API requests
	const url = new URL(event.request.url);
	if (url.pathname.startsWith('/api/')) return;

	event.respondWith(
		caches.match(event.request).then((response) => {
			return response || fetch(event.request).catch(() => {
				if (event.request.mode === 'navigate') {
					return caches.match('/static/index.html');
				}
			});
		})
	);
});
