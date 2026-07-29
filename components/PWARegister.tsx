"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const registerSW = () => {
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

        // Once a new worker takes control, the page's already-loaded JS is
        // stale relative to the server - reload once to pick up the fresh
        // build. Guard with a sessionStorage flag so a misbehaving worker
        // can't trigger a reload loop.
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
