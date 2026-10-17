"use client";

/**
 * Card PRINCIPAL do painel do vendedor: "Montar oferta para um cliente" (a forma que mais vende).
 * Botões grandes (mín. 44 px): escolher um cliente dele ou cadastrar um novo; depois, "Usar uma oferta pronta".
 * Mesmos textos nas 3 marcas.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import NewClientForm from "@/components/b2b/NewClientForm";

export default function OfferForClientCard({ clients }: { clients: Array<{ id: string; displayName: string }> }) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");

  return (
    <section
      className="mt-6 rounded-[28px] bg-[#55245f] p-6 text-white shadow-xl sm:p-8"
      data-testid="card-montar-oferta"
      aria-labelledby="montar-oferta-titulo"
    >
      <h2 id="montar-oferta-titulo" className="font-serif text-3xl font-semibold sm:text-4xl">
        Montar oferta para um cliente
      </h2>
      <p className="mt-3 max-w-2xl text-base text-white/90 sm:text-lg">
        A forma que mais vende. Você escolhe as linhas e a promoção de cada uma, vê sua comissão e envia um link com o nome do
        cliente.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {clients.length > 0 && (
          <div className="flex flex-col gap-2">
            <select
              aria-label="Escolher cliente"
              value={clientId}
              onChange={(event) => {
                const value = event.target.value;
                setClientId(value);
                if (value) router.push(`/b2b/painel/cliente/${value}/oferta`);
              }}
              className="min-h-[56px] w-full rounded-full border-0 bg-white px-5 text-base font-extrabold text-[#55245f]"
            >
              <option value="">Escolher cliente ▾</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.displayName}
                </option>
              ))}
            </select>
          </div>
        )}
        <NewClientForm
          triggerClassName="min-h-[56px] w-full rounded-full border-2 border-white px-6 text-base font-extrabold text-white"
          triggerLabel="+ Cliente novo"
        />
      </div>

      <Link
        href="/b2b/painel/modelos"
        className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-full bg-white/15 px-6 py-3 text-center text-base font-extrabold text-white ring-1 ring-white/50 sm:w-auto sm:inline-flex"
        data-testid="usar-oferta-pronta"
      >
        Usar uma oferta pronta
      </Link>
    </section>
  );
}
