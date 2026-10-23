"use client";

/**
 * Rodapé do B2B (Rodada 19c): "Já sou cliente" para o lojista recuperar o link pessoal. Só nas páginas públicas do lojista
 * (não aparece no painel do representante, no login nem na própria página /b2b/entrar).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function B2BPublicFooter() {
  const pathname = usePathname() ?? "";

  if (pathname.startsWith("/b2b/painel") || pathname.startsWith("/b2b/login") || pathname.startsWith("/b2b/entrar")) return null;

  return (
    <footer className="border-t border-[#eadfd9] bg-[#fffaf6] px-5 py-6 pb-24 text-center text-xs text-[#6c5b69]" data-testid="rodape-b2b">
      <p>
        Já é cliente?{" "}
        <Link href="/b2b/entrar" className="font-bold text-[#63326d] underline underline-offset-2" data-testid="ja-sou-cliente">
          Já sou cliente
        </Link>{" "}
        — receba o seu link de compra por e-mail.
      </p>
    </footer>
  );
}
