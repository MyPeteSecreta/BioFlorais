"use client";

/**
 * Pix do LINK DE PAGAMENTO B2B (/b2b/pagar, item 42). Gera (ou reaproveita) o Pix pela mesma rota do checkout B2B
 * (/api/b2b/payments/mercadopago/pix ou lunium, conforme NEXT_PUBLIC_PIX_PROVIDER), que só aceita pedido pendente em Pix com o token
 * da oferta e, se o Pix anterior venceu, cria outro. Mostra QR + copia e cola e confere o pagamento a cada 5 s.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type Pix = { qrCode: string; qrImageUrl: string | null };

export default function B2BPixPayment({ orderId, b2bToken, onPaid }: { orderId: string; b2bToken: string; onPaid: () => void }) {
  const [pix, setPix] = useState<Pix | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const onPaidRef = useRef(onPaid);

  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  const generate = useCallback(async () => {
    setBusy(true);
    setError("");

    try {
      const route = process.env.NEXT_PUBLIC_PIX_PROVIDER === "lunium" ? "/api/b2b/payments/lunium/pix" : "/api/b2b/payments/mercadopago/pix";
      const response = await fetch(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, b2bToken }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; pix?: Pix };

      if (!response.ok || !data?.pix?.qrCode) {
        setError(data?.error ?? "Não foi possível gerar o Pix.");
        return;
      }

      setPix({ qrCode: data.pix.qrCode, qrImageUrl: data.pix.qrImageUrl ?? null });
      setCopied(false);
    } catch {
      setError("Não foi possível gerar o Pix. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }, [orderId, b2bToken]);

  useEffect(() => {
    // Gera ao abrir o link (efeito único; a rota reaproveita o Pix ainda válido).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void generate();
  }, [generate]);

  useEffect(() => {
    if (!pix) return;

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}/status`, { cache: "no-store" });
        const data = (await response.json()) as { paid?: boolean };

        if (data?.paid) onPaidRef.current();
      } catch {
        // tenta de novo no próximo ciclo
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [pix, orderId]);

  return (
    <div className="rounded-2xl border border-[#eadfd9] bg-white p-5 text-center" data-testid="pix-link-pagamento">
      {busy && !pix ? <p className="text-sm text-[#8a7886]">Gerando o Pix…</p> : null}
      {error ? (
        <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {pix ? (
        <>
          <p className="text-sm font-bold">Pague com Pix: aponte a câmera para o QR Code ou use o copia e cola.</p>
          {pix.qrImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pix.qrImageUrl} alt="QR Code Pix" className="mx-auto mt-4 h-56 w-56" />
          ) : null}
          <textarea readOnly value={pix.qrCode} className="mt-4 h-24 w-full rounded-xl border border-[#eadfd9] p-3 text-xs" aria-label="Pix copia e cola" />
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(pix.qrCode);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
            className="mt-3 w-full rounded-full bg-[#55245f] py-3 text-sm font-extrabold text-white"
          >
            {copied ? "Código copiado" : "Copiar código Pix"}
          </button>
          <p className="mt-3 text-xs text-[#8a7886]">Assim que o pagamento cair, esta tela confirma sozinha. O Pix vale 30 minutos.</p>
          <button type="button" onClick={() => void generate()} disabled={busy} className="mt-2 text-xs font-bold text-[#55245f] underline disabled:opacity-50">
            {busy ? "Gerando…" : "O Pix venceu? Gerar um novo"}
          </button>
        </>
      ) : null}
    </div>
  );
}
