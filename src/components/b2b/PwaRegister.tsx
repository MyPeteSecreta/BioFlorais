"use client";

/** Registra o service worker do app "Bio Florais Vendas" (escopo /b2b/). Só em produção (no dev atrapalharia o hot reload). */

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/b2b/sw.js", { scope: "/b2b/" }).catch(() => undefined);
  }, []);

  return null;
}
