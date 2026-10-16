import Link from "next/link";

import { demoCtaUrl } from "@/lib/b2b/demo";

export const dynamic = "force-dynamic";

export default async function DemoInvalidPage({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const { motivo } = await searchParams;

  return (
    <main className="mx-auto max-w-xl px-5 py-16 text-center text-[#422347]">
      <h1 className="font-serif text-3xl font-semibold text-[#55245f]">
        {motivo === "limite" ? "Muitas demonstrações agora" : "Link de demonstração inválido ou expirado"}
      </h1>
      <p className="mt-3 text-[#6c5b69]">
        {motivo === "limite"
          ? "Foram criadas demonstrações demais a partir desta rede. Tente novamente em uma hora."
          : "Este link não está mais disponível. Peça um novo link ou fale com a equipe comercial."}
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
