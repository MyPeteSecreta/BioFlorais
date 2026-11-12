"use client";

/**
 * Caixa de aceite do carrinho abandonado no checkout (src/lib/cart-recovery.ts). DESMARCADA por padrão (LGPD: consentimento).
 * Só aparece com o recurso ligado no admin e o SQL 56b aplicado. Marcada: grava a sacola com o e-mail do formulário (e o
 * primeiro nome), e atualiza quando a sacola ou o e-mail mudam. Desmarcar apaga na hora. Sem nome: não vai no pedido.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Item = { productSlug: string; qty: number };

export default function CartReminderOptIn({ items }: { items: Item[] }) {
  const [enabled, setEnabled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [needEmail, setNeedEmail] = useState(false);
  const boxRef = useRef<HTMLLabelElement | null>(null);
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
    const form = boxRef.current?.closest("form");
    const data = form ? new FormData(form) : null;

    return { email: String(data?.get("email") ?? "").trim(), name: String(data?.get("name") ?? "").trim() };
  }, []);

  const sync = useCallback(
    (consent: boolean) => {
      const { email, name } = readForm();

      if (!EMAIL_RE.test(email)) {
        setNeedEmail(consent);
        return;
      }

      setNeedEmail(false);
      const key = JSON.stringify([consent, email, name.split(/\s+/)[0], items]);
      if (key === lastSent.current) return;
      lastSent.current = key;

      void fetch("/api/cart/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, items, consent }),
        keepalive: true,
      }).catch(() => undefined);
    },
    [items, readForm]
  );

  // Marcada: acompanha a sacola e o e-mail (ao sair do campo).
  useEffect(() => {
    if (!checked) return;

    const timer = window.setTimeout(() => sync(true), 800);
    const form = boxRef.current?.closest("form");
    const onChange = (event: Event) => {
      const name = (event.target as HTMLInputElement | null)?.name;
      if (name === "email" || name === "name") sync(true);
    };

    form?.addEventListener("change", onChange);

    return () => {
      window.clearTimeout(timer);
      form?.removeEventListener("change", onChange);
    };
  }, [checked, sync]);

  if (!enabled) return null;

  return (
    <label ref={boxRef} className="flex items-start gap-2 text-xs leading-5 text-[#26352c]/70 md:col-span-2" data-testid="lembrete-sacola">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        onChange={(event) => {
          const next = event.target.checked;
          setChecked(next);
          if (!next) sync(false);
        }}
      />
      <span>
        Quero receber um lembrete da minha sacola por e-mail se eu não concluir a compra (no máximo 2 e-mails; dá para sair a qualquer
        momento).
        {needEmail ? <strong className="block text-[#8a5a12]">Preencha o e-mail acima para receber o lembrete.</strong> : null}
      </span>
    </label>
  );
}
