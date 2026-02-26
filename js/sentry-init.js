/* ============================================
   SENTRY INITIALIZATION
   Executado após secrets.js via defer.
   ============================================ */
if (window.Sentry && window.ENV && window.ENV.SENTRY_DSN) {
    Sentry.init({
        dsn: window.ENV.SENTRY_DSN,
        environment: 'production',
        ignoreErrors: [
            'NetworkError', 'Failed to fetch', 'Network request failed',
            /^chrome-extension:\/\//
        ]
    });
}
