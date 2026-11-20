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
  const path = (c) => new URL(c.url).pathname;
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((open) => {
        const same = open.find((c) => path(c) === new URL(url, c.url).pathname);
        if (same) return same.focus();
        // A sale screen holds the vendor's edits: open the request beside it.
        const tab = open.find(
          (c) =>
            path(c).startsWith("/dashboard") &&
            !path(c).startsWith("/dashboard/requests/"),
        );
        if (!tab) return self.clients.openWindow(url);
        tab.navigate(url);
        return tab.focus();
      }),
  );
});
