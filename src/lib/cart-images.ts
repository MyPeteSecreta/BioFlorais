"use client";

import { useEffect, useState } from "react";

const cache = new Map<string, string | null>();

/** Foto real de cada produto da sacola (pelo slug), buscada uma vez e lembrada no navegador. */
export function useCartImages(slugs: string[]): Record<string, string | null> {
  const key = [...new Set(slugs)].sort().join(",");
  const [, bump] = useState(0);

  useEffect(() => {
    const missing = key.split(",").filter((slug) => slug && !cache.has(slug));

    if (missing.length === 0) return;

    let cancelled = false;

    fetch(`/api/catalog/images?slugs=${encodeURIComponent(missing.join(","))}`)
      .then((response) => (response.ok ? response.json() : { images: {} }))
      .then((data: { images?: Record<string, string | null> }) => {
        for (const slug of missing) cache.set(slug, data.images?.[slug] ?? null);

        if (!cancelled) bump((value) => value + 1);
      })
      .catch(() => {
        for (const slug of missing) cache.set(slug, null);
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  const result: Record<string, string | null> = {};

  for (const slug of key.split(",")) if (slug) result[slug] = cache.get(slug) ?? null;

  return result;
}
