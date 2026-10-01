"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type Props = {
  token: string;
  purpose: "onboarding" | "password_reset";
  name: string;
  email: string;
  requiresRcaTerms: boolean;
  expiresAt: string;
};

const input =
  "w-full rounded-xl border border-[#d9c7dc] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#63326d]";

/*
 * Resumo do termo de adesão do RCA. TEXTO PROVISÓRIO: substituir pelo
 * termo oficial revisado pelo jurídico antes de publicar (ver ENTREGA).
 */
const RCA_TERMS = [
  "Atuo como Representante Comercial Autônomo (RCA), sem vínculo empregatício com a Bio Florais.",
  "Vou oferecer os produtos somente pelas ofertas e preços gerados na área B2B, sem alterar condições comerciais por conta própria.",
  "As comissões seguem as regras comerciais vigentes informadas pela Bio Florais e são pagas na chave Pix/conta cadastrada.",
  "Mantenho em sigilo os dados de clientes, preços e condições a que eu tiver acesso.",
  "Meu acesso é pessoal e intransferível e pode ser desativado pela Bio Florais a qualquer momento.",
];

export default function InviteForm({
  token,
  purpose,
  name: invitedName,
  email,
  requiresRcaTerms,
  expiresAt,
}: Props) {
  const [name, setName] = useState(invitedName);
  const [phone, setPhone] = useState("");
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
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [rcaTermsAccepted, setRcaTermsAccepted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ login: string | null; purpose: string } | null>(null);

  const cepDigits = postalCode.replace(/\D/g, "");

  useEffect(() => {
    if (purpose !== "onboarding" || cepDigits.length !== 8) return;

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
  }, [cepDigits, purpose]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/b2b/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          passwordConfirmation,
          ...(purpose === "onboarding"
            ? {
                login,
                name,
                phone,
                personType,
                cpf,
                rg,
                cnpj,
                stateRegistration,
                postalCode,
                street,
                addressNumber,
                addressComplement,
                neighborhood,
                city,
                state,
                pixKey,
                bankName,
                bankAgency,
                bankAccount,
                rcaTermsAccepted,
              }
            : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Não foi possível concluir.");
        return;
      }

      setDone({ login: data.login ?? null, purpose: data.purpose });
    } catch {
      setError("Não foi possível concluir. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="mt-8 rounded-[20px] border border-[#eadfd9] bg-white p-6">
        {done.purpose === "password_reset" ? (
          <>
            <h2 className="text-lg font-bold">Senha definida</h2>
            <p className="mt-2 text-sm">
              Entre com o login <strong>{done.login}</strong> e a nova senha.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold">Cadastro concluído</h2>
            <p className="mt-2 text-sm">
              Seu login é <strong>{done.login}</strong>. Você já pode entrar na área B2B.
            </p>
          </>
        )}
        <Link
          href="/b2b/login"
          className="mt-4 inline-block rounded-full bg-[#55245f] px-5 py-2.5 text-sm font-extrabold text-white"
        >
          Ir para o login
        </Link>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      {purpose === "onboarding" && (
        <>
          <section className="space-y-3 rounded-[20px] border border-[#eadfd9] bg-white p-5">
            <h2 className="font-bold">Seus dados</h2>
            <input className={`${input} bg-[#f7f2f5]`} value={email} readOnly aria-label="E-mail" />
            <input className={input} placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={input} inputMode="tel" placeholder="Celular com DDD (WhatsApp)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div className="flex gap-2">
              {(["pf", "pj"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPersonType(type)}
                  className={`rounded-full border px-4 py-2 text-sm font-bold ${
                    personType === type ? "border-[#55245f] bg-[#55245f] text-white" : "border-[#d9c7dc] bg-white"
                  }`}
                >
                  {type === "pf" ? "Pessoa física" : "Pessoa jurídica"}
                </button>
              ))}
            </div>
            {personType === "pf" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={input} inputMode="numeric" placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} />
                <input className={input} placeholder="RG" value={rg} onChange={(e) => setRg(e.target.value)} />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={input} inputMode="numeric" placeholder="CNPJ" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
                <input className={input} placeholder="Inscrição estadual" value={stateRegistration} onChange={(e) => setStateRegistration(e.target.value)} />
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-[20px] border border-[#eadfd9] bg-white p-5">
            <h2 className="font-bold">Endereço</h2>
            <div className="grid gap-3 sm:grid-cols-[160px_1fr_80px]">
              <input className={input} inputMode="numeric" placeholder="CEP" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              <input className={input} placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
              <input className={input} placeholder="UF" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} />
            </div>
            <input className={input} placeholder="Rua" value={street} onChange={(e) => setStreet(e.target.value)} />
            <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
              <input className={input} placeholder="Número" value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} />
              <input className={input} placeholder="Bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
            </div>
            <input className={input} placeholder="Complemento (opcional)" value={addressComplement} onChange={(e) => setAddressComplement(e.target.value)} />
          </section>

          <section className="space-y-3 rounded-[20px] border border-[#eadfd9] bg-white p-5">
            <h2 className="font-bold">Recebimento das comissões</h2>
            <input className={input} placeholder="Chave Pix" value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
            <div className="grid gap-3 sm:grid-cols-3">
              <input className={input} placeholder="Banco (opcional)" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              <input className={input} placeholder="Agência (opcional)" value={bankAgency} onChange={(e) => setBankAgency(e.target.value)} />
              <input className={input} placeholder="Conta (opcional)" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
            </div>
          </section>
        </>
      )}

      <section className="space-y-3 rounded-[20px] border border-[#eadfd9] bg-white p-5">
        <h2 className="font-bold">Acesso</h2>
        {purpose === "onboarding" && (
          <>
            <input
              className={input}
              autoComplete="username"
              placeholder="Login (ex.: maria.silva)"
              value={login}
              onChange={(e) => setLogin(e.target.value.toLowerCase().replace(/\s/g, ""))}
            />
            <p className="text-xs text-[#8a7886]">Letras minúsculas, números, ponto, hífen ou _ (3 a 40).</p>
          </>
        )}
        <input className={input} type="password" autoComplete="new-password" placeholder="Senha (mínimo 8 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className={input} type="password" autoComplete="new-password" placeholder="Repita a senha" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} />
      </section>

      {purpose === "onboarding" && requiresRcaTerms && (
        <section className="space-y-3 rounded-[20px] border border-[#eadfd9] bg-white p-5">
          <h2 className="font-bold">Termo de adesão do RCA</h2>
          <ul className="max-h-48 list-disc space-y-1 overflow-y-auto rounded-xl bg-[#fbf5f1] p-4 pl-8 text-sm">
            {RCA_TERMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={rcaTermsAccepted} onChange={(e) => setRcaTermsAccepted(e.target.checked)} className="mt-1" />
            Li e aceito o termo de adesão do Representante Comercial Autônomo.
          </label>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || (purpose === "onboarding" && requiresRcaTerms && !rcaTermsAccepted)}
        className="w-full rounded-full bg-[#55245f] py-3 text-sm font-extrabold text-white disabled:opacity-50"
      >
        {submitting ? "Enviando…" : purpose === "onboarding" ? "Concluir cadastro" : "Salvar nova senha"}
      </button>

      <p className="text-center text-xs text-[#8a7886]">
        Link válido até {new Date(expiresAt).toLocaleString("pt-BR")}.
      </p>
    </form>
  );
}
