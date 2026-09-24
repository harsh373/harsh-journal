// Minimal service worker — just enough for Chrome to treat the app as installable.
// Deliberately does NOT cache anything: this app's content (journal entries, Cloudinary
// photos) is meant to always be live and current, so aggressive caching here would risk
// showing stale days or missing photos. If real offline support is wanted later, this is
// the file to extend with a cache strategy.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass every request straight through to the network, unchanged.
  event.respondWith(fetch(event.request));
});