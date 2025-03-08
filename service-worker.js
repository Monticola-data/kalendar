self.addEventListener("install", (event) => {
    console.log("✅ Service Worker nainstalován!");
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    console.log("✅ Service Worker aktivován!");
});

self.addEventListener("fetch", (event) => {
    console.log("📡 Požadavek na:", event.request.url);
});
