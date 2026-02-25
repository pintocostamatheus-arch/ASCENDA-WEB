const CACHE_NAME = 'ascenda-v15';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/img/logo.svg',
  '/assets/icons/favicon.svg',
  // CSS
  '/css/themes.css',
  '/css/components.css',
  '/css/custom-components.css',
  '/css/layout.css',
  '/css/mobile.css',
  '/css/v12-updates.css',
  '/css/onboarding.css',
  '/css/help-tab.css',
  '/css/medical-dark.css',
  // JS - Config & Utils
  '/js/config.js',
  '/js/utils/date-service.js',
  // JS - Services
  '/js/services/storage.js',
  '/js/services/security.js',
  '/js/services/profile.js',
  '/js/services/weight.js',
  '/js/services/nutrition.js',
  '/js/services/dose-service.js',
  '/js/services/clinical.js',
  '/js/services/symptoms.js',
  '/js/services/instructions.js',
  '/js/services/safety-guard.js',
  '/js/services/insights.js',
  '/js/services/photo-storage.js',
  '/js/services/journey.js',
  '/js/services/dose-analysis.js',
  '/js/services/medication-level.js',
  '/js/services/report.js',
  '/js/services/ui.js',
  '/js/vendor/chart.umd.min.js',
  '/js/vendor/jspdf.umd.min.js',
  '/js/vendor/croppie.min.js',
  '/js/vendor/croppie.min.css',
  '/js/services/charts.js',
  '/js/services/router.js',
  // JS - Main
  '/js/app.js',
  '/js/controllers/help-controller.js',
  '/js/controllers/profile-controller.js',
  '/js/controllers/nutrition-controller.js',
  '/js/controllers/weight-controller.js',
  '/js/controllers/injections-controller.js',
  '/js/controllers/symptoms-controller.js',
  '/js/controllers/journey-controller.js',
  '/js/controllers/onboarding-controller.js',
  '/js/controllers/report-controller.js',
  '/js/services/notifications.js',
  '/js/controllers/notifications-controller.js'
];

// Install – cache shell assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate – clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Web Push: recebe notificações do servidor ────────────────────────────────
// O servidor (Supabase Edge Function) envia o push — o SW exibe independente
// de o app estar aberto, em background ou com a tela bloqueada.
self.addEventListener('push', (e) => {
  if (!e.data) return;

  let payload;
  try {
    payload = e.data.json();
  } catch {
    payload = { title: 'Ascenda', body: e.data.text(), data: {} };
  }

  const options = {
    body: payload.body || '',
    icon: '/assets/icons/favicon.svg',
    badge: '/assets/icons/favicon.svg',
    tag: payload.tag || 'ascenda',
    renotify: false,
    data: payload.data || {}
  };

  e.waitUntil(
    self.registration.showNotification(payload.title || 'Ascenda', options)
  );
});

// ─── Mensagens do app (navegação após clique) ─────────────────────────────────
self.addEventListener('message', (e) => {
  if (!e.data) return;
  // Mantém compatibilidade para navegação via NAVIGATE_TAB
});

// Open app and navigate to the correct tab when notification is clicked
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const tab = e.notification.data?.tab || 'hoje';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // If app is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE_TAB', tab });
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(`/?tab=${tab}`);
      }
    })
  );
});

// Fetch – network-first for HTML, cache-first for assets
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip non-GET and cross-origin
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // HTML pages: network first, fallback to cache
  if (e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request).then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // Other assets: cache first, fallback to network
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        return res;
      });
    })
  );
});
