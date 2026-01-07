const CACHE_NAME = 'shynote-v117'; // Bumped Version
const CRITICAL_ASSETS = [
	'/',
	'/static/index.html',
	'/static/style.css',
	'/static/app.js',
	'/static/local_db.js',
	'/static/manifest.json',
	'/static/logo.png',
	'/static/favicon.ico',
	'/static/icon-192.png',
	'/static/icon-512.png'
];

const EXTERNAL_ASSETS = [
	'https://unpkg.com/vue@3/dist/vue.global.js',
	'https://esm.sh/idb@7.1.1',
	'https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js',
	'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
	'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js',
	'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css',
	'https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown-light.min.css',
	'https://unpkg.com/nord-highlightjs@0.1/dist/nord.css',
	'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap',
	'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0',
	'https://esm.sh/@uiw/codemirror-theme-github@4.23.0?deps=@codemirror/state@6.4.0,@codemirror/view@6.23.0',
	'https://esm.sh/@uiw/codemirror-theme-nord@4.23.0?deps=@codemirror/state@6.4.0,@codemirror/view@6.23.0',
	'https://esm.sh/@codemirror/language@6.10.0?deps=@codemirror/state@6.4.0,@codemirror/view@6.23.0',

	'https://cdn.jsdelivr.net/npm/mobile-drag-drop@2.3.0-rc.2/default.css',
	'https://cdn.jsdelivr.net/npm/mobile-drag-drop@2.3.0-rc.2/index.min.js',
	'https://cdn.jsdelivr.net/npm/mobile-drag-drop@2.3.0-rc.2/scroll-behaviour.min.js'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then(async (cache) => {
			console.log('[SW] Caching critical assets...');
			// 1. Critical Assets: Must succeed for SW to install
			await cache.addAll(CRITICAL_ASSETS);

			console.log('[SW] Caching external assets...');
			// 2. External Assets: Attempt to cache, but don't fail install if they error (e.g. CORS/Timeout)
			try {
				await cache.addAll(EXTERNAL_ASSETS);
			} catch (err) {
				console.warn('[SW] Failed to cache some external assets:', err);
			}
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

	// Skip API requests
	const url = new URL(event.request.url);
	if (url.pathname.startsWith('/api/')) return;
	if (url.pathname.startsWith('/auth/')) return; // Also skip auth

	// Skip unsupported schemes
	if (!url.protocol.startsWith('http')) return;

	event.respondWith(
		caches.match(event.request).then((response) => {
			if (response) {
				return response;
			}

			const fetchRequest = event.request.clone();

			return fetch(fetchRequest).then((response) => {
				if (!response || (response.status !== 200 && response.type !== 'opaque')) {
					return response;
				}

				const responseToCache = response.clone();
				caches.open(CACHE_NAME).then((cache) => {
					cache.put(event.request, responseToCache);
				});

				return response;
			}).catch(() => {
				// Offline Fallback
				if (event.request.mode === 'navigate') {
					// Use '/' as the robust fallback for navigation
					return caches.match('/');
				}
			});
		})
	);
});
