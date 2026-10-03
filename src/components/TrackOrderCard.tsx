"use client";

/**
 * "Acompanhar meu pedido" (tela de pedido criado/pago): link assinado direto,
 * copiar e enviar para o próprio WhatsApp (wa.me sem número fixo).
 * Componente NOVO e aditivo: não altera o fluxo de pagamento.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import TrackShare from "@/components/TrackShare";

export default function TrackOrderCard({ orderId }: { orderId: string }) {
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    fetch(`/api/orders/track-link?orderId=${encodeURIComponent(orderId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (alive && data?.path) setPath(data.path);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, [orderId]);

  return (
    <div className="mt-6 rounded-2xl border border-[#55245f]/20 bg-[#f6eef7] p-5 text-[#422347]">
      <p className="font-extrabold">Acompanhe seu pedido</p>
      <p className="mt-1 text-sm">Guarde este link: nele você vê o pagamento, a separação, o envio e o rastreio.</p>
      {path ? (
        <div className="mt-3 space-y-3">
          <Link href={path} className="inline-block rounded-full bg-[#55245f] px-5 py-2.5 text-sm font-extrabold text-white">
            Acompanhar meu pedido
          </Link>
          <TrackShare path={path} number={orderId.slice(0, 8).toUpperCase()} />
        </div>
      ) : (
        <Link href="/acompanhe-seu-pedido" className="mt-3 inline-block text-sm font-bold underline">
          Acompanhe seu pedido
        </Link>
      )}
    </div>
  );
}
