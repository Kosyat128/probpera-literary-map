export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`;
    void navigator.serviceWorker
      .register(serviceWorkerUrl, { scope: import.meta.env.BASE_URL })
      .then((registration) => {
        const announceUpdate = () => {
          window.dispatchEvent(new Event("probpera:pwa-update"));
        };
        if (registration.waiting) announceUpdate();
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              announceUpdate();
            }
          });
        });
      })
      .catch(() => {
        // Offline support is progressive enhancement; the site remains usable.
      });
  });
}
