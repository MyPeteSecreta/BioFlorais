import Link from "next/link";
import type { ReactNode } from "react";

import { requireResponsiblePage } from "@/lib/b2b/current-responsible";
import LogoutButton from "@/components/b2b/LogoutButton";

export const dynamic = "force-dynamic";

/** Área do vendedor: exige sessão B2B ativa em todas as páginas. */
export default async function B2BPanelLayout({ children }: { children: ReactNode }) {
  const responsible = await requireResponsiblePage();

  return (
    <div className="min-h-screen bg-[#fffaf6] text-[#422347]">
      <header className="border-b border-[#eadfd9] bg-white">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-5 py-4 lg:px-10">
          <Link href="/b2b/painel" className="leading-tight">
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#9b6c24]">
              Bio Florais · Área comercial B2B
            </span>
            <span className="block text-lg font-extrabold text-[#55245f]">Meus clientes</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/b2b/painel" className="font-bold text-[#63326d] underline underline-offset-4">
              Clientes
            </Link>
            <Link href="/b2b/painel/comissoes" className="font-bold text-[#63326d] underline underline-offset-4">
              Minhas comissões
            </Link>
            <span className="font-semibold">{responsible.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
