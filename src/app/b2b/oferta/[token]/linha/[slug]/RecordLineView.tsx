"use client";

import { useEffect } from "react";

/**
 * Registra a visita do cliente à linha fora da oferta. É um POST depois
 * de montar, para que prefetch ou robôs não contem como visita; o
 * servidor também limita a 1 registro a cada 30 min por oferta e linha.
 */
export default function RecordLineView({ token, lineSlug }: { token: string; lineSlug: string }) {
  useEffect(() => {
    void fetch("/api/b2b/line-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ b2bToken: token, lineSlug }),
      keepalive: true,
    }).catch(() => undefined);
  }, [token, lineSlug]);

  return null;
}
