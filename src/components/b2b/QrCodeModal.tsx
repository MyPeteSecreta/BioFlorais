"use client";

/**
 * QR Code do link da oferta (venda porta a porta): tela cheia, fundo branco, QR grande e de
 * alto contraste para o vendedor virar o celular para o cliente. O QR é gerado AQUI, no
 * navegador, e contém exatamente a URL recebida (nada a mais; o link nunca vai a um serviço externo).
 */

import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { QR_OPTIONS } from "@/lib/b2b/qr-options";

export function buildQrDataUrl(url: string) {
  return QRCode.toDataURL(url, QR_OPTIONS);
}

function fileSafe(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "cliente";
}

export default function QrCodeModal({ url, clientName, onClose }: { url: string; clientName?: string | null; onClose: () => void }) {
  const [image, setImage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    buildQrDataUrl(url)
      .then((data) => {
        if (!cancelled) setImage(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const name = clientName?.trim();

  return (
    <div role="dialog" aria-modal="true" aria-label="QR Code da oferta" className="fixed inset-0 z-[100] flex flex-col items-center overflow-y-auto bg-white px-5 py-6 text-[#26352c]">
      <p className="font-serif text-3xl font-semibold text-[#55245f]">Bio Florais</p>
      <p className="mt-2 text-center text-xl font-extrabold">{name ? `Olá, ${name}!` : "Olá!"}</p>

      <div className="my-5 flex w-full flex-1 items-center justify-center">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="QR Code da sua loja personalizada" data-qr-url={url} className="aspect-square w-[78vw] max-w-[560px] bg-white" />
        ) : (
          <p className="text-sm text-[#6c5b69]">{failed ? "Não foi possível gerar o QR Code. Use o link." : "Gerando o QR Code…"}</p>
        )}
      </div>

      <p className="max-w-sm text-center text-base font-bold">Aponte a câmera do seu celular para abrir sua loja personalizada.</p>

      <div className="mt-6 flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
        {image && (
          <a
            href={image}
            download={`qrcode-bio-florais-${fileSafe(name ?? "cliente")}.png`}
            className="rounded-full border border-[#b9a8b6] px-5 py-2.5 text-center text-xs font-extrabold text-[#6c5b69]"
          >
            Baixar imagem
          </a>
        )}
        <button type="button" onClick={onClose} className="rounded-full border border-[#b9a8b6] px-5 py-2.5 text-xs font-extrabold text-[#6c5b69]">
          Fechar
        </button>
      </div>
    </div>
  );
}
