/**
 * BIO FLORAIS B2B — helpers puros do convite (sem banco, sem env):
 * tipos de responsável, validação de e-mail e montagem do link do
 * WhatsApp. Testados em scripts/b2b-invites.test.mjs.
 */

export const B2B_RESPONSIBLE_TYPES = {
  rca: "RCA",
  clt: "Vendedor",
} as const;

export type B2BResponsibleType = keyof typeof B2B_RESPONSIBLE_TYPES;

export type InvitePurpose = "onboarding" | "password_reset";

export function isB2BResponsibleType(value: unknown): value is B2BResponsibleType {
  return typeof value === "string" && Object.hasOwn(B2B_RESPONSIBLE_TYPES, value);
}

export function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** wa.me com texto pronto; sem telefone válido abre o seletor de contato. */
export function buildWhatsAppUrl(phone: string | null | undefined, text: string) {
  let digits = String(phone ?? "").replace(/\D/g, "");

  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }

  const base = digits.length >= 12 && digits.length <= 13 ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function buildInviteMessage(input: {
  name: string;
  url: string;
  purpose: InvitePurpose;
}) {
  const firstName = input.name.trim().split(/\s+/)[0] || "";
  const greeting = `Olá${firstName ? `, ${firstName}` : ""}!`;

  return input.purpose === "password_reset"
    ? `${greeting} Use este link para definir uma nova senha de acesso à área B2B da Bio Florais (válido por 7 dias): ${input.url}`
    : `${greeting} Você foi convidado(a) para a área B2B da Bio Florais. Faça seu cadastro por este link (válido por 7 dias): ${input.url}`;
}
