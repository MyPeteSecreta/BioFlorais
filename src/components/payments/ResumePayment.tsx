"use client";

/**
 * Retomar o pagamento de um pedido B2C ainda não pago (link do e-mail "Seu pedido está separado"): mostra o Pix ainda válido ou gera um
 * novo (o mesmo endpoint do checkout, que cobra o total do pedido gravado no servidor). Quando o pagamento é confirmado, leva ao
 * acompanhamento. Cartão recusado: sugere o Pix.
 */

import { useEffect, useRef, useState } from "react";

type Props = {
  orderId: string;
  trackPath: string;
  initialPixCode: string | null;
  cardIssue: boolean;
  totalLabel: string;
};

export default function ResumePayment({ orderId, trackPath, initialPixCode, cardIssue, totalLabel }: Props) {
  const [pixCode, setPixCode] = useState<string | null>(initialPixCode);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const done = useRef(false);

  // Quando o pagamento cair, segue para o acompanhamento (consulta a cada 4 s por até 35 min).
  useEffect(() => {
    if (!pixCode) return;

    const startedAt = Date.now();
    const timer = window.setInterval(async () => {
      if (done.current || Date.now() - startedAt > 35 * 60 * 1000) {
        window.clearInterval(timer);
        return;
      }

      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));

        if (data?.paid) {
          done.current = true;
          window.location.href = trackPath;
        }
      } catch {
        // falha temporária: tenta na próxima
      }
    }, 4000);

    return () => window.clearInterval(timer);
  }, [pixCode, orderId, trackPath]);

  async function generate() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/payments/mercadopago/pix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.pix?.qrCode) {
        setError(data?.error ?? "Não foi possível gerar o Pix agora. Tente de novo em instantes.");
        return;
      }

      setPixCode(String(data.pix.qrCode));
      setQrBase64(data.pix.qrCodeBase64 ? String(data.pix.qrCodeBase64) : null);
    } catch {
      setError("Sem conexão. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!pixCode) return;

    try {
      await navigator.clipboard.writeText(pixCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-[#eadfd9] bg-white p-5" data-testid="retomar-pagamento">
      {cardIssue && (
        <p className="mb-4 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-950" data-testid="sugestao-pix">
          O pagamento no cartão não foi concluído. O Pix costuma ser aprovado na hora: gere o código abaixo.
        </p>
      )}

      <h2 className="text-lg font-extrabold text-[#55245f]">Pagar com Pix · {totalLabel}</h2>

      {pixCode ? (
        <div className="mt-3">
          {qrBase64 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/png;base64,${qrBase64}`} alt="QR Code do Pix" className="mx-auto h-48 w-48 rounded-xl border border-[#eadfd9] bg-white p-2" />
          )}
          <p className="mt-3 text-sm text-[#6c5b69]">Pix copia e cola (vale por 30 minutos):</p>
          <textarea readOnly value={pixCode} aria-label="Pix copia e cola" className="mt-2 h-24 w-full rounded-xl border border-[#d9c7dc] bg-[#fffaf6] p-3 text-xs" data-testid="pix-copia-cola" />
          <button type="button" onClick={copy} className="mt-3 w-full rounded-full bg-[#55245f] px-6 py-3.5 text-sm font-extrabold text-white" data-testid="copiar-pix">
            {copied ? "Código copiado ✓" : "Copiar código Pix"}
          </button>
          <p className="mt-3 text-center text-xs text-[#6c5b69]">Assim que o pagamento for confirmado, esta página leva ao acompanhamento do pedido.</p>
          <button type="button" onClick={generate} disabled={busy} className="mt-3 w-full text-center text-xs font-bold text-[#63326d] underline disabled:opacity-60">
            O código venceu? Gerar outro Pix
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-[#6c5b69]">Gere um Pix novo para este pedido. O valor é o mesmo do pedido.</p>
          <button type="button" onClick={generate} disabled={busy} className="mt-3 w-full rounded-full bg-[#55245f] px-6 py-3.5 text-sm font-extrabold text-white disabled:opacity-60" data-testid="gerar-pix">
            {busy ? "Gerando…" : "Gerar Pix"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-bold text-red-700" data-testid="erro-pix">
          {error}
        </p>
      )}
    </section>
  );
}
