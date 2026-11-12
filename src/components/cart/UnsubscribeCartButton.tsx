"use client";

import { useState } from "react";

export default function UnsubscribeCartButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function confirm() {
    setState("busy");

    try {
      const response = await fetch("/api/cart/recovery/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      setState(response.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="font-bold text-[#46644f]" data-testid="sacola-saiu">
        Pronto: a sacola foi apagada e você não recebe mais lembretes dela.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={confirm}
        disabled={state === "busy"}
        className="rounded-full bg-[#55245f] px-6 py-3 text-sm font-extrabold text-white disabled:opacity-50"
      >
        {state === "busy" ? "Apagando..." : "Não quero mais receber"}
      </button>
      {state === "error" ? <p className="mt-3 text-red-700" role="status">Não foi possível agora. Tente de novo.</p> : null}
    </div>
  );
}
