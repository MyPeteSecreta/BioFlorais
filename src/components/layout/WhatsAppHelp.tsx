/** Botão "Tirar dúvida no WhatsApp" (produto e sacola). O número e a mensagem vêm de src/lib/whatsapp.ts. */

import { whatsappLink } from "@/lib/whatsapp";

export default function WhatsAppHelp({ message, testId, className = "" }: { message: string; testId: string; className?: string }) {
  return (
    <a
      href={whatsappLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testId}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-[#25d366] bg-white px-5 py-3 text-sm font-extrabold text-[#128c4a] transition hover:bg-[#f0fff6] ${className}`}
    >
      <span aria-hidden="true">💬</span> Tirar dúvida no WhatsApp
    </a>
  );
}
