"use client";

/**
 * Sessão expirada (cookie de 12h) no admin e no painel do vendedor B2B: as rotas respondem 401 e as
 * telas mostravam só "Não autorizado.". Este guarda observa as chamadas da própria área, avisa
 * "Sua sessão expirou. Entre de novo." com link para o login e leva para lá sozinho.
 */

import { useEffect, useState } from "react";

import { isSessionApiCall, SESSION_EXPIRED_MESSAGE } from "@/lib/session-expired";

const REDIRECT_AFTER_MS = 4000;

export default function SessionExpiredGuard({ scope, loginHref }: { scope: "admin" | "b2b"; loginHref: string }) {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const original = window.fetch;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await original(...args);

      try {
        const input = args[0];
        const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const url = new URL(raw, window.location.origin);

        if (response.status === 401 && url.origin === window.location.origin && isSessionApiCall(scope, url.pathname)) {
          setExpired(true);
        }
      } catch {
        // Nunca atrapalha a chamada original.
      }

      return response;
    };

    return () => {
      window.fetch = original;
    };
  }, [scope]);

  useEffect(() => {
    if (!expired) return;

    const timer = window.setTimeout(() => {
      window.location.href = loginHref;
    }, REDIRECT_AFTER_MS);

    return () => window.clearTimeout(timer);
  }, [expired, loginHref]);

  if (!expired) return null;

  return (
    <div role="alert" className="fixed inset-x-0 top-0 z-[100] bg-[#8f2727] px-5 py-3 text-center text-sm font-extrabold text-white shadow-lg">
      {SESSION_EXPIRED_MESSAGE}{" "}
      <a href={loginHref} className="underline underline-offset-4">
        Entrar de novo
      </a>
    </div>
  );
}
