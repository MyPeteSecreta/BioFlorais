"use client";

import { useState } from "react";

import BoletosTab from "./BoletosTab";
import CommissionsTab from "./CommissionsTab";
import GroupsTab from "./GroupsTab";
import MessagesTab from "./MessagesTab";
import PromotionsTab from "./PromotionsTab";
import ResponsiblesTab from "./ResponsiblesTab";
import TestDataTab from "./TestDataTab";
import TrackingTab from "./TrackingTab";

const TABS = [
  { id: "responsibles", label: "Vendedores / RCAs" },
  { id: "groups", label: "Linhas comerciais" },
  { id: "promotions", label: "Promoções" },
  { id: "tracking", label: "Acompanhamento" },
  { id: "boletos", label: "Boletos a receber" },
  { id: "commissions", label: "Comissões" },
  { id: "messages", label: "Mensagens ao lojista" },
  { id: "testdata", label: "Dados de teste" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** `initialTab` vem de ?aba=boletos (a Central de pedidos abre o admin direto na aba). */
export default function AdminB2BTabs({ initialTab }: { initialTab?: string }) {
  const start = TABS.find((item) => item.id === initialTab)?.id ?? "responsibles";
  const [tab, setTab] = useState<TabId>(start);

  return (
    <div className="mt-6">
      <div role="tablist" className="flex flex-wrap gap-2 border-b border-[#eadfd9] pb-3">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-extrabold ${
              tab === item.id
                ? "bg-[#342737] text-white"
                : "border border-[#eadfd9] bg-white text-[#342737]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "responsibles" && <ResponsiblesTab />}
        {tab === "testdata" && <TestDataTab />}
        {tab === "groups" && <GroupsTab />}
        {tab === "promotions" && <PromotionsTab />}
        {tab === "tracking" && <TrackingTab />}
        {tab === "boletos" && <BoletosTab />}
        {tab === "commissions" && <CommissionsTab />}
        {tab === "messages" && <MessagesTab />}
      </div>
    </div>
  );
}
