"use client";

/**
 * Lembrete da sacola no checkout (src/lib/cart-recovery.ts). 22/11, decisão do Luis: SEM caixa de marcar e SEM frase nova no checkout.
 * Com um e-mail válido no formulário, guarda a sacola (só se o recurso estiver ligado no admin e o SQL 56b aplicado).
 *  - Guarda o mínimo (e-mail, primeiro nome, itens), no máximo 2 e-mails, nunca para quem já comprou, e TODO e-mail tem o link
 *    "Não quero mais receber" (a pessoa sai quando quiser). A Política de Privacidade (seção 9.4) descreve isso.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORM_ID = "bio-checkout-form";

type Item = { productSlug: string; qty: number };

export default function CartReminderOptIn({ items }: { items: Item[] }) {
  const [enabled, setEnabled] = useState(false);
  const lastSent = useRef("");

  useEffect(() => {
    let alive = true;

    fetch("/api/cart/recovery", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { enabled: false }))
      .then((data: { enabled?: boolean }) => {
        if (alive) setEnabled(data.enabled === true);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  const readForm = useCallback(() => {
    const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
    const data = form ? new FormData(form) : null;

    return { email: String(data?.get("email") ?? "").trim(), name: String(data?.get("name") ?? "").trim() };
  }, []);

  const sync = useCallback(() => {
    const { email, name } = readForm();

    if (!EMAIL_RE.test(email) || items.length === 0) return;

    const key = JSON.stringify([email, name.split(/\s+/)[0], items]);
    if (key === lastSent.current) return;
    lastSent.current = key;

    // consent=true: a concordância com os Termos e a Política vem de seguir para finalizar (frase abaixo); o servidor segue
    // exigindo o recurso ligado, o teto de 2 e-mails e a regra de nunca escrever para quem já comprou.
    void fetch("/api/cart/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, items, consent: true }),
      keepalive: true,
    }).catch(() => undefined);
  }, [items, readForm]);

  // Acompanha a sacola e o e-mail (ao sair do campo).
  useEffect(() => {
    if (!enabled) return;

    const timer = window.setTimeout(sync, 800);
    const form = document.getElementById(FORM_ID);
    const onChange = (event: Event) => {
      const name = (event.target as HTMLInputElement | null)?.name;
      if (name === "email" || name === "name") sync();
    };

    form?.addEventListener("change", onChange);

    return () => {
      window.clearTimeout(timer);
      form?.removeEventListener("change", onChange);
    };
  }, [enabled, sync]);

  // Decisão do Luis (22/11): NENHUMA frase nova no checkout. O componente só acompanha a sacola; a menção está na Política (9.4) e em todo e-mail.
  return null;
}
