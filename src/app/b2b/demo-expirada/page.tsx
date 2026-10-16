import Link from "next/link";

import { demoCtaUrl } from "@/lib/b2b/demo";

export const dynamic = "force-dynamic";

export default function DemoExpiredPage() {
  return (
    <main className="mx-auto max-w-xl px-5 py-16 text-center text-[#422347]">
      <h1 className="font-serif text-3xl font-semibold text-[#55245f]">Sua demonstração terminou</h1>
      <p className="mt-3 text-[#6c5b69]">
        Os dados de teste ficam disponíveis por 24 horas e depois são apagados. Abra o link da campanha de novo para começar outra
        demonstração, ou fale com a equipe para ser representante.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a href={demoCtaUrl(process.env.B2B_DEMO_CTA_URL)} className="rounded-full bg-[#55245f] px-6 py-3 text-sm font-extrabold text-white">
          Quero ser representante
        </a>
        <Link href="/b2b/login" className="rounded-full border border-[#d9c7dc] px-6 py-3 text-sm font-extrabold text-[#63326d]">
          Entrar na área do representante
        </Link>
      </div>
    </main>
  );
}
