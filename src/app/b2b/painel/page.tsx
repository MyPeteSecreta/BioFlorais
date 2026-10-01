"use client";

/**
 * BIO FLORAIS B2B — painel do representante: cadastrar cliente, criar
 * oferta (linhas + promoções) e gerar/revogar o link público.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Client = { id: string; displayName: string; contactName: string | null; email: string | null };
type Group = { id: string; slug: string; name: string };
type Promotion = { id: string; name: string; buyQuantity: number | null; freeQuantity: number | null };
type Interest = {
  clientId: string;
  clientName: string;
  lineId: string;
  lineName: string;
  views: number;
  lastViewedAt: string;
};

type Offer = {
  id: string;
  clientName: string;
  status: string;
  revokedAt: string | null;
  groups: string[];
  hasActiveLink: boolean;
};

const box = "rounded-[20px] border border-[#eadfd9] bg-white p-5";
const input = "w-full rounded-xl border border-[#d9c7dc] px-3 py-2.5 text-sm";

export default function B2BPanelPage() {
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);

  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  const [offerClientId, setOfferClientId] = useState("");
  const [offerGroupIds, setOfferGroupIds] = useState<string[]>([]);
  const [offerPromotionIds, setOfferPromotionIds] = useState<string[]>([]);

  const [links, setLinks] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const [clientsRes, groupsRes, promotionsRes, offersRes, interestsRes] = await Promise.all([
      fetch("/api/b2b/clients", { cache: "no-store" }),
      fetch("/api/b2b/commercial-groups", { cache: "no-store" }),
      fetch("/api/b2b/promotions", { cache: "no-store" }),
      fetch("/api/b2b/offers/mine", { cache: "no-store" }),
      fetch("/api/b2b/line-views/mine", { cache: "no-store" }),
    ]);

    if (clientsRes.status === 401) {
      router.replace("/b2b/login");
      return;
    }

    if (clientsRes.ok) setClients((await clientsRes.json()).clients ?? []);
    if (groupsRes.ok) setGroups((await groupsRes.json()).commercialGroups ?? []);
    if (promotionsRes.ok) setPromotions((await promotionsRes.json()).promotions ?? []);
    if (offersRes.ok) setOffers((await offersRes.json()).offers ?? []);
    if (interestsRes.ok) setInterests((await interestsRes.json()).interests ?? []);
  }, [router]);

  useEffect(() => {
    // Carga inicial vinda da API: o setState só ocorre depois do fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function post(url: string, body: unknown, method = "POST") {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, data };
  }

  async function createClient() {
    if (!clientName.trim()) return;
    const { ok, data } = await post("/api/b2b/clients", {
      displayName: clientName,
      contactName: clientContact,
      email: clientEmail,
      phone: clientPhone,
    });
    setMessage(ok ? "Cliente cadastrado." : data.error ?? "Erro ao cadastrar cliente.");
    if (ok) {
      setClientName("");
      setClientContact("");
      setClientEmail("");
      setClientPhone("");
      setOfferClientId(data.clientId);
      void refresh();
    }
  }

  async function createOffer() {
    const { ok, data } = await post("/api/b2b/offers", {
      clientId: offerClientId,
      commercialGroupIds: offerGroupIds,
      promotionIds: offerPromotionIds,
    });
    setMessage(ok ? "Oferta criada. Gere o link na lista abaixo." : data.error ?? "Erro ao criar oferta.");
    if (ok) {
      setOfferGroupIds([]);
      setOfferPromotionIds([]);
      void refresh();
    }
  }

  async function generateLink(offerId: string) {
    const { ok, data } = await post("/api/b2b/offers/link", { offerId });
    if (ok) {
      setLinks((current) => ({ ...current, [offerId]: `${window.location.origin}${data.path}` }));
      setMessage("Link gerado. Ele só aparece agora — copie e envie ao cliente.");
      void refresh();
    } else {
      setMessage(data.error ?? "Erro ao gerar link.");
    }
  }

  async function revokeLink(offerId: string) {
    const { ok, data } = await post("/api/b2b/offers/link", { offerId }, "DELETE");
    if (ok) {
      setLinks((current) => {
        const next = { ...current };
        delete next[offerId];
        return next;
      });
      setMessage("Link revogado.");
      void refresh();
    } else {
      setMessage(data.error ?? "Erro ao revogar link.");
    }
  }

  async function logout() {
    await fetch("/api/b2b/auth/logout", { method: "POST" });
    router.replace("/b2b/login");
  }

  function toggle(list: string[], id: string) {
    return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
  }

  return (
    <main className="min-h-screen bg-[#fffaf6] px-5 py-10 text-[#422347]">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-semibold text-[#55245f]">Painel B2B</h1>
          <button type="button" onClick={logout} className="text-sm font-bold text-[#63326d] underline">
            Sair
          </button>
        </div>

        {message && <p className="rounded-xl bg-[#f6eef7] p-3 text-sm font-semibold">{message}</p>}

        <section className={box}>
          <h2 className="mb-3 font-bold">Novo cliente</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={input} placeholder="Nome / razão social" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            <input className={input} placeholder="Contato" value={clientContact} onChange={(e) => setClientContact(e.target.value)} />
            <input className={input} placeholder="E-mail" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
            <input className={input} placeholder="Telefone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
          </div>
          <button type="button" onClick={createClient} className="mt-3 rounded-full bg-[#55245f] px-5 py-2 text-sm font-extrabold text-white">
            Cadastrar cliente
          </button>
        </section>

        <section className={box}>
          <h2 className="mb-3 font-bold">Nova oferta</h2>
          <select className={input} value={offerClientId} onChange={(e) => setOfferClientId(e.target.value)}>
            <option value="">Selecione o cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.displayName}</option>
            ))}
          </select>

          <p className="mb-2 mt-4 text-sm font-bold">Linhas liberadas</p>
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <label key={group.id} className="flex items-center gap-2 rounded-full border border-[#d9c7dc] px-3 py-1.5 text-sm">
                <input type="checkbox" checked={offerGroupIds.includes(group.id)} onChange={() => setOfferGroupIds((list) => toggle(list, group.id))} />
                {group.name}
              </label>
            ))}
          </div>

          {promotions.length > 0 && (
            <>
              <p className="mb-2 mt-4 text-sm font-bold">Promoções (opcional)</p>
              <div className="flex flex-wrap gap-2">
                {promotions.map((promotion) => (
                  <label key={promotion.id} className="flex items-center gap-2 rounded-full border border-[#d9c7dc] px-3 py-1.5 text-sm">
                    <input type="checkbox" checked={offerPromotionIds.includes(promotion.id)} onChange={() => setOfferPromotionIds((list) => toggle(list, promotion.id))} />
                    {promotion.name}
                    {promotion.buyQuantity && promotion.freeQuantity
                      ? ` (compre ${promotion.buyQuantity}, leve +${promotion.freeQuantity})`
                      : ""}
                  </label>
                ))}
              </div>
            </>
          )}

          <button
            type="button"
            disabled={!offerClientId || offerGroupIds.length === 0}
            onClick={createOffer}
            className="mt-4 rounded-full bg-[#55245f] px-5 py-2 text-sm font-extrabold text-white disabled:opacity-50"
          >
            Criar oferta
          </button>
        </section>

        {interests.length > 0 && (
          <section className={box}>
            <h2 className="mb-1 font-bold">Interesses dos clientes</h2>
            <p className="mb-3 text-xs text-[#8a7886]">
              Linhas que o cliente abriu pelo link e que não estavam na oferta. Boa hora para mandar
              uma nova oferta incluindo a linha.
            </p>
            <ul className="space-y-2 text-sm">
              {interests.map((interest) => (
                <li
                  key={`${interest.clientId}-${interest.lineId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#eadfd9] p-3"
                >
                  <span>
                    <strong>{interest.clientName}</strong> visualizou a linha{" "}
                    <strong>{interest.lineName}</strong> (fora da oferta)
                    {interest.views > 1 ? ` · ${interest.views} vezes` : ""}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-[#8a7886]">
                    {new Date(interest.lastViewedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    <button
                      type="button"
                      onClick={() => {
                        setOfferClientId(interest.clientId);
                        setOfferGroupIds((list) => (list.includes(interest.lineId) ? list : [...list, interest.lineId]));
                        setMessage(`Nova oferta para ${interest.clientName} pré-preenchida com a linha ${interest.lineName}.`);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="rounded-full bg-[#55245f] px-3 py-1 text-xs font-extrabold text-white"
                    >
                      Montar nova oferta
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={box}>
          <h2 className="mb-3 font-bold">Minhas ofertas</h2>
          {offers.length === 0 && <p className="text-sm text-[#8a7886]">Nenhuma oferta ainda.</p>}
          <ul className="space-y-3">
            {offers.map((offer) => (
              <li key={offer.id} className="rounded-xl border border-[#eadfd9] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{offer.clientName}</p>
                    <p className="text-xs text-[#8a7886]">
                      {offer.groups.join(", ") || "sem linhas"} · {offer.revokedAt ? "revogada" : offer.status}
                      {offer.hasActiveLink ? " · link ativo" : ""}
                    </p>
                  </div>
                  {!offer.revokedAt && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => generateLink(offer.id)} className="rounded-full bg-[#55245f] px-3 py-1.5 text-xs font-extrabold text-white">
                        {offer.hasActiveLink ? "Gerar novo link" : "Gerar link"}
                      </button>
                      {offer.hasActiveLink && (
                        <button type="button" onClick={() => revokeLink(offer.id)} className="rounded-full border border-[#a33] px-3 py-1.5 text-xs font-extrabold text-[#a33]">
                          Revogar
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {links[offer.id] && (
                  <input readOnly value={links[offer.id]} onFocus={(e) => e.target.select()} className={`${input} mt-2 text-xs`} />
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
