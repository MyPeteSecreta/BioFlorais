/** "Instale no seu celular": o painel do vendedor como app (Android e iPhone). */

import InstallApp from "@/components/b2b/InstallApp";
import { requireResponsiblePage } from "@/lib/b2b/current-responsible";

export const dynamic = "force-dynamic";

export default async function InstallPage() {
  await requireResponsiblePage();

  return (
    <main className="mx-auto max-w-[1000px] px-5 py-10 lg:px-10" data-testid="pagina-instalar">
      <h1 className="font-serif text-3xl font-semibold text-[#55245f] sm:text-4xl">Instale no seu celular</h1>
      <p className="mt-2 max-w-[700px] text-sm leading-6 text-[#746471]">
        Deixe o painel <strong>Bio Florais Vendas</strong> na tela do celular, como um app: um toque e você está nos seus clientes, ofertas, pedidos e
        materiais de venda.
      </p>
      <InstallApp />
    </main>
  );
}
