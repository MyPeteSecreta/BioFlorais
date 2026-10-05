"use client";

/**
 * Cadastro COMPLETO do vendedor/RCA (a qualquer momento, obrigatório depois do teste):
 * CPF/CNPJ, endereço, chave Pix ou dados bancários e aceite do Termo RCA (data/hora, IP e
 * versão gravados no servidor). Ao concluir, o banner de teste some e a comissão é liberada.
 */

import { useEffect, useState, type FormEvent } from "react";

import RcaTermsBox from "@/components/b2b/RcaTermsBox";
import { RCA_TERMS_ACCEPT_LABEL } from "@/lib/b2b/rca-terms";

const input = "w-full rounded-xl border border-[#d9c7dc] bg-white px-3 py-3 text-base outline-none focus:border-[#63326d]";


export default function CompleteProfileForm({
  requiresRcaTerms,
  expired,
  bannerText,
}: {
  requiresRcaTerms: boolean;
  /** Teste vencido: esta é a ÚNICA tela do painel. */
  expired: boolean;
  bannerText: string | null;
}) {
  const [personType, setPersonType] = useState<"pf" | "pj">("pf");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [stateRegistration, setStateRegistration] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [street, setStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [rcaTermsAccepted, setRcaTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const cepDigits = postalCode.replace(/\D/g, "");

  useEffect(() => {
    if (cepDigits.length !== 8) return;
    const controller = new AbortController();

    fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: unknown }) => {
        if (data.erro) return;
        if (data.logradouro) setStreet(data.logradouro);
        if (data.bairro) setNeighborhood(data.bairro);
        if (data.localidade) setCity(data.localidade);
        if (data.uf) setState(data.uf.toUpperCase());
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [cepDigits]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/b2b/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personType, cpf, rg, cnpj, stateRegistration, postalCode, street, addressNumber, addressComplement,
          neighborhood, city, state, pixKey, bankName, bankAgency, bankAccount, rcaTermsAccepted,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "Não foi possível salvar.");
        return;
      }

      setDone(true);
      window.location.href = "/b2b/painel";
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) return <p className="p-6 text-center font-bold">Cadastro completo! Abrindo o painel…</p>;

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="font-serif text-3xl font-semibold text-[#55245f]">Complete seu cadastro</h1>
      {expired ? (
        <p className="mt-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-950">
          Seu período de teste terminou. Complete o cadastro para voltar a usar o painel e receber suas comissões. Os links que você já
          enviou aos clientes continuam funcionando e os pedidos continuam sendo seus.
        </p>
      ) : (
        bannerText && <p className="mt-3 text-sm text-[#6c5b69]">{bannerText}</p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-5">
        <section className="space-y-3 rounded-[20px] border border-[#eadfd9] bg-white p-5">
          <h2 className="font-bold">Documento</h2>
          <div className="flex gap-2">
            {(["pf", "pj"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPersonType(type)}
                className={`rounded-full border px-4 py-2 text-sm font-bold ${personType === type ? "border-[#55245f] bg-[#55245f] text-white" : "border-[#d9c7dc] bg-white text-[#422347]"}`}
              >
                {type === "pf" ? "Pessoa física" : "Pessoa jurídica"}
              </button>
            ))}
          </div>
          {personType === "pf" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={input} inputMode="numeric" placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} required />
              <input className={input} placeholder="RG (opcional)" value={rg} onChange={(e) => setRg(e.target.value)} />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={input} inputMode="numeric" placeholder="CNPJ" value={cnpj} onChange={(e) => setCnpj(e.target.value)} required />
              <input className={input} placeholder="Inscrição estadual (opcional)" value={stateRegistration} onChange={(e) => setStateRegistration(e.target.value)} />
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-[20px] border border-[#eadfd9] bg-white p-5">
          <h2 className="font-bold">Endereço</h2>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr_80px]">
            <input className={input} inputMode="numeric" placeholder="CEP" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} required />
            <input className={input} placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} required />
            <input className={input} placeholder="UF" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} required />
          </div>
          <input className={input} placeholder="Rua" value={street} onChange={(e) => setStreet(e.target.value)} required />
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <input className={input} placeholder="Número" value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} required />
            <input className={input} placeholder="Bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} required />
          </div>
          <input className={input} placeholder="Complemento (opcional)" value={addressComplement} onChange={(e) => setAddressComplement(e.target.value)} />
        </section>

        <section className="space-y-3 rounded-[20px] border border-[#eadfd9] bg-white p-5">
          <h2 className="font-bold">Recebimento das comissões</h2>
          <p className="text-xs text-[#6c5b69]">Informe a chave Pix OU os dados bancários completos.</p>
          <input className={input} placeholder="Chave Pix" value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-3">
            <input className={input} placeholder="Banco" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            <input className={input} placeholder="Agência" value={bankAgency} onChange={(e) => setBankAgency(e.target.value)} />
            <input className={input} placeholder="Conta" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
          </div>
        </section>

        {requiresRcaTerms && (
          <section className="space-y-3 rounded-[20px] border border-[#eadfd9] bg-white p-5">
            <h2 className="font-bold">Termo de adesão do RCA</h2>
            <RcaTermsBox />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={rcaTermsAccepted} onChange={(e) => setRcaTermsAccepted(e.target.checked)} className="mt-1" />
              {RCA_TERMS_ACCEPT_LABEL} (data, hora, IP e versão ficam registrados).
            </label>
          </section>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-900">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting || (requiresRcaTerms && !rcaTermsAccepted)} className="w-full rounded-full bg-[#55245f] py-3.5 text-base font-extrabold text-white disabled:opacity-50">
          {submitting ? "Salvando…" : "Concluir cadastro"}
        </button>
      </form>
    </main>
  );
}
