// Web push service worker for Pointy Points.
// Receives push events and shows native notifications. Clicking a
// notification opens (or focuses) the URL in `data.url`.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Pointy Points", body: event.data.text() };
  }
  const {
    title = "Pointy Points",
    body = "",
    url = "/",
    tag,
  } = payload || {};

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon.png",
      badge: "/icon.png",
      tag,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // If a window for our origin is already open, focus it and navigate.
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch {
              /* cross-origin or unsupported — fall through to openWindow */
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
