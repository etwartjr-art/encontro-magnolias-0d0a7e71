// PWA service worker registration with iframe/preview guard
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = window.location.hostname;
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com") ||
  host.includes("lovable.app");

if (isPreviewHost || isInIframe) {
  // Make sure no SW lingers in preview/iframe contexts
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  }
} else if ("serviceWorker" in navigator) {
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      /* noop */
    });
}
