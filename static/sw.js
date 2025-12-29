const CACHE_NAME = 'shynote-v40';
const ASSETS_TO_CACHE = [
	'/',
	'/static/index.html',
	'/static/style.css',
	'/static/app.js',
	'/static/local_db.js',
	'/static/manifest.json',
	'/static/logo.png',
	'/static/favicon.ico',
	'/static/icon-192.png',
	'/static/icon-512.png',
	'https://cdn.tailwindcss.com',
	'https://unpkg.com/vue@3/dist/vue.global.js',
	'https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js',
	'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
	'https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown-light.min.css',
	'https://unpkg.com/nord-highlightjs@0.1/dist/nord.css',
	'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap',
	'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0',
	'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css',
	'https://unpkg.com/@codemirror/view@6.23.0/dist/index.css',
	'https://cdn.jsdelivr.net/npm/mobile-drag-drop@2.3.0-rc.2/default.css',
	'https://cdn.jsdelivr.net/npm/mobile-drag-drop@2.3.0-rc.2/index.min.js',
	'https://cdn.jsdelivr.net/npm/mobile-drag-drop@2.3.0-rc.2/scroll-behaviour.min.js'
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
			if (response) {
				return response;
			}

			// Clone the request stream
			const fetchRequest = event.request.clone();

			return fetch(fetchRequest).then((response) => {
				// Check if we received a valid response
				if (!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
					return response;
				}

				// Clone the response stream
				const responseToCache = response.clone();

				caches.open(CACHE_NAME).then((cache) => {
					cache.put(event.request, responseToCache);
				});

				return response;
			}).catch(() => {
				if (event.request.mode === 'navigate') {
					return caches.match('/static/index.html');
				}
			});
		})
	);
});
