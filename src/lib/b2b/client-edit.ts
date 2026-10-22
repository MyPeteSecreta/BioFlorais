/**
 * Edição do cadastro de cliente no admin (Rodada 19b): validação e comparação PURAS (sem banco).
 * Campos: nome/razão social, CNPJ/CPF (dígitos verificadores), e-mail, WhatsApp e endereço. Nunca apaga cadastro.
 */

import { CLIENT_FIELDS, CLIENT_FIELD_LABELS, type ClientField, type ClientValues } from "@/lib/b2b/client-fields";
import { parseDocument } from "@/lib/b2b/vendor-launch";
import { validateComplement } from "@/lib/order-note";

export { CLIENT_FIELDS, CLIENT_FIELD_LABELS, type ClientField, type ClientValues };

/** Coluna de b2b_clients de cada campo. */
export const CLIENT_COLUMNS: Record<ClientField, string> = {
  displayName: "display_name",
  contactName: "contact_name",
  document: "document",
  email: "email",
  phone: "phone",
  postalCode: "postal_code",
  street: "street",
  addressNumber: "address_number",
  addressComplement: "address_complement",
  neighborhood: "neighborhood",
  city: "city",
  state: "state",
};

const text = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

export type ParsedClientEdit = { ok: true; values: ClientValues; changedBy: string } | { ok: false; error: string; field?: ClientField | "changedBy" };

/** Valida o formulário inteiro (o admin envia todos os campos; vazio = limpar, exceto o nome). */
export function parseClientEdit(raw: Record<string, unknown>): ParsedClientEdit {
  const changedBy = text(raw.changedBy).slice(0, 80);

  if (changedBy.length < 2) return { ok: false, error: "Informe o seu nome para registrar quem alterou o cadastro.", field: "changedBy" };

  const displayName = text(raw.displayName);
  if (displayName.length < 2) return { ok: false, error: "Informe o nome / razão social.", field: "displayName" };
  if (displayName.length > 120) return { ok: false, error: "Nome / razão social: máximo de 120 caracteres.", field: "displayName" };

  const contactName = text(raw.contactName).slice(0, 120) || null;

  let document: string | null = null;
  if (digits(raw.document)) {
    const parsed = parseDocument(raw.document);

    if (!parsed.ok) return { ok: false, error: parsed.error, field: "document" };
    document = parsed.digits;
  }

  const email = text(raw.email).toLowerCase();
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) {
    return { ok: false, error: "Informe um e-mail válido.", field: "email" };
  }

  const phone = digits(raw.phone);
  if (phone && (phone.length < 10 || phone.length > 13)) return { ok: false, error: "Informe o WhatsApp com DDD (10 a 13 dígitos).", field: "phone" };

  const postalCode = digits(raw.postalCode);
  if (postalCode && postalCode.length !== 8) return { ok: false, error: "Informe um CEP com 8 dígitos.", field: "postalCode" };

  const state = text(raw.state).toUpperCase();
  if (state && !/^[A-Z]{2}$/.test(state)) return { ok: false, error: "Informe a UF com 2 letras.", field: "state" };

  const complement = validateComplement(raw.addressComplement);
  if (!complement.ok) return { ok: false, error: complement.error, field: "addressComplement" };

  const street = text(raw.street).slice(0, 160) || null;
  const addressNumber = text(raw.addressNumber).slice(0, 20) || null;
  const neighborhood = text(raw.neighborhood).slice(0, 80) || null;
  const city = text(raw.city).slice(0, 80) || null;

  return {
    ok: true,
    changedBy,
    values: {
      displayName,
      contactName,
      document,
      email: email || null,
      phone: phone || null,
      postalCode: postalCode || null,
      street,
      addressNumber,
      addressComplement: complement.value,
      neighborhood,
      city,
      state: state || null,
    },
  };
}

/** Compara o cadastro atual com os valores novos: só o que mudou, com antes e depois. */
export function diffClient(before: Partial<Record<ClientField, string | null>>, after: ClientValues): Partial<Record<ClientField, { before: string | null; after: string | null }>> {
  const changes: Partial<Record<ClientField, { before: string | null; after: string | null }>> = {};

  for (const field of CLIENT_FIELDS) {
    const previous = (before[field] ?? null) === "" ? null : (before[field] ?? null);
    const next = after[field] ?? null;

    if (previous !== next) changes[field] = { before: previous, after: next };
  }

  return changes;
}

/** Texto curto de uma alteração para o histórico: "E-mail: a@x.com → b@x.com". */
export function describeChanges(changes: Partial<Record<ClientField, { before: string | null; after: string | null }>>): string[] {
  return (Object.keys(changes) as ClientField[]).map((field) => {
    const change = changes[field]!;

    return `${CLIENT_FIELD_LABELS[field]}: ${change.before ?? "(vazio)"} → ${change.after ?? "(vazio)"}`;
  });
}
