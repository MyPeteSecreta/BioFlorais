"use client";

/** Admin do pedido B2B (item 42): mostra o link de pagamento (Pix ou cartão) e copia o link ou o texto pronto para o WhatsApp. */

import { useState } from "react";

export default function PayLinkButton({ url, message, phone }: { url: string; message: string; phone: string | null }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState("");

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied("");
    }
  }

  const digits = String(phone ?? "").replace(/\D/g, "");
  const whatsapp = digits ? `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}?text=${encodeURIComponent(message)}` : null;

  return (
    <div className="rounded-2xl border border-[#eadfd9] bg-white p-4" data-testid="link-pagamento-admin">
      <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-full bg-[#342737] px-5 py-2.5 text-sm font-extrabold text-white">
        Gerar / copiar link de pagamento
      </button>

      {open && (
        <div className="mt-3 space-y-2 text-sm">
          <p className="break-all text-xs text-[#6c5b69]">{url}</p>
          <textarea readOnly value={message} className="h-28 w-full rounded-xl border border-[#eadfd9] p-2 text-xs" aria-label="Texto para o WhatsApp" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => copy(url, "link")} className="rounded-full border-2 border-[#342737] px-4 py-2 text-xs font-extrabold">
              {copied === "link" ? "Link copiado" : "Copiar link"}
            </button>
            <button type="button" onClick={() => copy(message, "texto")} className="rounded-full border-2 border-[#342737] px-4 py-2 text-xs font-extrabold">
              {copied === "texto" ? "Texto copiado" : "Copiar texto para WhatsApp"}
            </button>
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noreferrer" className="rounded-full bg-[#25d366] px-4 py-2 text-xs font-extrabold text-white">
                Abrir no WhatsApp
              </a>
            ) : null}
          </div>
          <p className="text-xs text-[#6c5b69]">No Pix, se o código vencer, o próprio link gera um Pix novo. O link usa o acesso da oferta do cliente.</p>
        </div>
      )}
    </div>
  );
}
