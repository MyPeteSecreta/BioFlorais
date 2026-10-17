"use client";

/**
 * ADMIN B2B — aba "Displays" (mínimo, Rodada 11): liga/desliga cada display. Composição fixa conforme
 * DISPLAYS_COMPOSICAO.md; a foto é lida de public/b2b/displays/<nome>.webp (sem foto, o card usa a imagem da linha).
 */

import { useCallback, useEffect, useState } from "react";

import { useAdminApi } from "./useAdminApi";

type Row = { key: string; code: string; name: string; lineSlug: string; skus: number; units: number; photo: string | null; enabled: boolean };

export default function DisplaysTab() {
  const api = useAdminApi();
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { ok, data } = await api("/api/admin/b2b/displays");
    if (ok) setRows((data.displays ?? []) as Row[]);
    else setMessage(data.error ?? "Erro ao carregar os displays.");
  }, [api]);

  useEffect(() => {
    // Carga inicial vinda da API: o setState só ocorre depois do fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function toggle(row: Row) {
    const { ok, data } = await api("/api/admin/b2b/displays", { method: "POST", body: { key: row.key, enabled: !row.enabled } });
    setMessage(ok ? `${row.name}: ${row.enabled ? "desligado" : "ligado"}.` : data.error ?? "Erro ao salvar.");
    if (ok) void load();
  }

  return (
    <div className="space-y-4" data-testid="displays-tab">
      <p className="max-w-3xl text-sm text-[#7b6a77]">
        Displays e kits do lojista: o display é <strong>grátis</strong> para quem compra o kit completo (composição fixa; &quot;mais vendidos&quot; =
        ordem dos cards da linha no site). Desligue um display para ele sumir da loja do link, da faixa e do selo &quot;Com display&quot;. No
        mostruário do vendedor, display vazio R$ 3,00 (1 por linha a cada 180 dias) e Kit Provador R$ 2,00 são fixos por enquanto.
      </p>
      {message && <p className="rounded-xl bg-[#f6eef7] p-3 text-sm font-semibold">{message}</p>}
      <ul className="grid gap-3 lg:grid-cols-2">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-3 rounded-2xl border border-[#eadfd9] bg-white p-4">
            <div className="min-w-0">
              <p className="font-extrabold text-[#342737]">{row.name}</p>
              <p className="text-xs text-[#7b6a77]">
                {row.skus} SKUs · {row.units} unidades · {row.code} · {row.photo ? "com foto" : "sem foto (usa a imagem da linha)"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={row.enabled}
              aria-label={`${row.name}: ${row.enabled ? "ligado" : "desligado"}`}
              onClick={() => toggle(row)}
              className={`min-h-[44px] shrink-0 rounded-full px-5 text-sm font-extrabold ${row.enabled ? "bg-emerald-600 text-white" : "bg-stone-200 text-stone-700"}`}
            >
              {row.enabled ? "Ligado" : "Desligado"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
