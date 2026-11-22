"use client";

/**
 * Caixa de pagamento Pix (checkout, /pagar e pagamento do lojista usam a MESMA). 22/11: o cliente apontava a câmera do iPhone para o
 * QR e abria uma pesquisa do Google com o texto do Pix: a câmera não paga Pix, só o app do banco lê. Agora:
 *  - no celular o botão grande "Copiar código Pix" vem PRIMEIRO e o QR fica recolhido ("Mostrar QR Code"); no computador o QR aparece;
 *  - texto claro de como pagar pelo QR (app do banco → Pix → Pagar com QR Code) e por copia e cola;
 *  - ao copiar, mensagem de confirmação com o próximo passo (e plano B se o navegador bloquear a cópia);
 *  - o QR é gerado AQUI a partir do mesmo texto do copia e cola (pixQrPayload), nunca de outra fonte.
 */

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

import { QR_OPTIONS } from "@/lib/b2b/qr-options";
import { PIX_COPIED_MESSAGE, PIX_COPY_HELP, PIX_QR_HELP, pixQrPayload } from "@/lib/payments/pix-code";

export default function PixPayBox({ code, fallbackImageUrl = null, testId = "pix-box" }: { code: string; fallbackImageUrl?: string | null; testId?: string }) {
  const payload = pixQrPayload(code);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const area = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(payload, { ...QR_OPTIONS, width: 512 })
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });

    return () => {
      cancelled = true;
    };
  }, [payload]);

  async function copy() {
    setCopyFailed(false);

    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 6000);
    } catch {
      // Plano B (iPhone/navegadores que bloqueiam): seleciona o texto para o cliente copiar com o dedo.
      setCopied(false);
      setCopyFailed(true);
      area.current?.focus();
      area.current?.select();
    }
  }

  const image = qr ?? fallbackImageUrl;
  const qrImage = image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="QR Code Pix" className="mx-auto h-52 w-52 object-contain" data-testid={`${testId}-qr`} />
  ) : null;

  return (
    <div className="space-y-4" data-testid={testId}>
      <button
        type="button"
        onClick={copy}
        className="w-full rounded-full bg-[#46644f] px-5 py-4 text-base font-extrabold text-white shadow-sm transition hover:opacity-90"
        data-testid={`${testId}-copiar`}
      >
        {copied ? "Código Pix copiado ✓" : "Copiar código Pix"}
      </button>

      {copied ? (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900" data-testid={`${testId}-copiado`}>
          {PIX_COPIED_MESSAGE}
        </p>
      ) : null}

      {copyFailed ? (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-950" data-testid={`${testId}-copia-falhou`}>
          Não consegui copiar sozinho. O código abaixo está selecionado: segure o dedo sobre ele e toque em Copiar.
        </p>
      ) : null}

      <p className="text-sm leading-6 text-[#26352c]/80" data-testid={`${testId}-ajuda`}>
        {PIX_COPY_HELP}
      </p>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#26352c]/45">Pix Copia e Cola</p>
        <textarea
          ref={area}
          readOnly
          value={payload}
          aria-label="Pix copia e cola"
          className="mt-2 h-24 w-full rounded-xl border border-[#26352c]/15 bg-white p-3 text-xs leading-5 text-[#26352c]/70"
          data-testid="pix-copia-cola"
        />
      </div>

      {/* Computador: o QR aparece direto. Celular: recolhido (a câmera não paga Pix; o app do banco lê o QR de outro aparelho). */}
      {image ? (
        <>
          <div className="hidden rounded-2xl bg-white p-4 shadow-sm md:block" data-testid={`${testId}-qr-desktop`}>
            {qrImage}
            <p className="mt-3 text-center text-sm leading-6 text-[#26352c]/80">{PIX_QR_HELP}</p>
          </div>

          <details className="rounded-2xl bg-white p-4 shadow-sm md:hidden" data-testid={`${testId}-qr-mobile`}>
            <summary className="cursor-pointer text-sm font-bold text-[#26352c]">Mostrar QR Code (para pagar por outro aparelho)</summary>
            <div className="mt-3">
              {qrImage}
              <p className="mt-3 text-center text-sm leading-6 text-[#26352c]/80">{PIX_QR_HELP}</p>
            </div>
          </details>
        </>
      ) : (
        <p className="text-sm leading-6 text-[#26352c]/80">{PIX_QR_HELP}</p>
      )}
    </div>
  );
}
