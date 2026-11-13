// Request alerts for a locked phone. Installed by the dashboard, push only.
self.addEventListener("push", (e) => {
  const m = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(m.title ?? "New request", {
      body: m.body,
      tag: m.tag,
      icon: "/icon-192.png",
      data: { url: m.url ?? "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url ?? "/dashboard";
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((open) => {
        const tab = open.find((c) =>
          new URL(c.url).pathname.startsWith("/dashboard"),
        );
        if (!tab) return self.clients.openWindow(url);
        tab.navigate(url);
        return tab.focus();
      }),
  );
});
