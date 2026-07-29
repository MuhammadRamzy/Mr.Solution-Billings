"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const registerSW = () => {
        // A controllerchange fires both on a brand-new install (nothing to
        // reload - there was no stale page to begin with) and on a genuine
        // update replacing an already-active worker. Only the latter means
        // this page's JS is now stale; capture which case we're in before
        // registering, otherwise every first-time visit reloads itself and
        // can race with in-flight navigations (e.g. the post-login redirect).
        const hadExistingController = !!navigator.serviceWorker.controller;

        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("Service Worker registered successfully with scope:", reg.scope);
            // Proactively check for a newer worker whenever the tab regains
            // focus - otherwise a tab left open across a deploy can keep
            // running stale JS indefinitely (server actions reference IDs
            // baked in at build time, so an old bundle calling a new server
            // silently fails - it looks exactly like "nothing happens").
            document.addEventListener("visibilitychange", () => {
              if (document.visibilityState === "visible") reg.update();
            });
          })
          .catch((err) => {
            console.error("Service Worker registration failed:", err);
          });

        if (!hadExistingController) return;

        // Once a new worker takes control of an already-controlled page, the
        // page's already-loaded JS is stale relative to the server - reload
        // once to pick up the fresh build. Guard with a sessionStorage flag
        // so a misbehaving worker can't trigger a reload loop.
        let reloading = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (reloading) return;
          if (sessionStorage.getItem("sw-reloaded") === "1") return;
          reloading = true;
          sessionStorage.setItem("sw-reloaded", "1");
          window.location.reload();
        });
      };

      if (document.readyState === "complete") {
        registerSW();
      } else {
        window.addEventListener("load", registerSW);
        return () => window.removeEventListener("load", registerSW);
      }
    }
  }, []);

  return null;
}
