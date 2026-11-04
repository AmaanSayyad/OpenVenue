"use client";

import { useEffect } from "react";

let reloadedForWorker = false;

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadedForWorker) return;
      reloadedForWorker = true;
      window.location.reload();
    });
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => reg.update())
      .catch(() => undefined);
  }, []);
  return null;
}
