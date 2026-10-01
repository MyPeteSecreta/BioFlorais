"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/** fetch JSON do admin; sessão expirada (401) volta para o login. */
export function useAdminApi() {
  const router = useRouter();

  return useCallback(
    async (url: string, init?: { method?: string; body?: unknown }) => {
      const response = await fetch(url, {
        method: init?.method ?? "GET",
        cache: "no-store",
        headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      });

      if (response.status === 401) {
        router.replace("/admin/login");
      }

      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, data };
    },
    [router]
  );
}
