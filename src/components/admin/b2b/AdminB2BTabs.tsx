"use client";

import { useState } from "react";

import BoletosTab from "./BoletosTab";
import CommissionsTab from "./CommissionsTab";
import GroupsTab from "./GroupsTab";
import PromotionsTab from "./PromotionsTab";
import ResponsiblesTab from "./ResponsiblesTab";
import TrackingTab from "./TrackingTab";

const TABS = [
  { id: "responsibles", label: "Vendedores / RCAs" },
  { id: "groups", label: "Linhas comerciais" },
  { id: "promotions", label: "Promoções" },
  { id: "tracking", label: "Acompanhamento" },
  { id: "boletos", label: "Boletos a receber" },
  { id: "commissions", label: "Comissões" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AdminB2BTabs() {
  const [tab, setTab] = useState<TabId>("responsibles");

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
        {tab === "groups" && <GroupsTab />}
        {tab === "promotions" && <PromotionsTab />}
        {tab === "tracking" && <TrackingTab />}
        {tab === "boletos" && <BoletosTab />}
        {tab === "commissions" && <CommissionsTab />}
      </div>
    </div>
  );
}
