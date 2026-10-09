/**
 * Admin B2B → Vendedores: regras puras da tela por pessoa (situação em destaque, texto de acesso e
 * busca). Usadas pela tela (client) e pelos testes.
 */

import { buildWhatsAppUrl } from "@/lib/b2b/invite-links";

/** Endereço público do login do vendedor (o que vai no texto "Copiar acesso"). */
export const B2B_LOGIN_URL = "https://www.bioflorais.com.br/b2b/login";

export type SellerCardRow = {
  kind: "responsible" | "invite";
  name: string;
  email: string;
  /** invite_pending | invite_expired | active | inactive */
  status: string;
  phone: string | null;
  inviteExpiresAt: string | null;
  /** "Cadastro completo" | "Em teste até dd/mm" | "Teste vencido" | null */
  situation?: string | null;
  emailOriginal?: string | null;
};

export type SellerBadge = { text: string; tone: "pending" | "trial" | "complete" | "inactive" | "muted" };

const dayMonth = (iso: string) => {
  const parts = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).formatToParts(new Date(iso));
  return `${parts.find((p) => p.type === "day")?.value}/${parts.find((p) => p.type === "month")?.value}`;
};

/** E-mail liberado pelo admin ("Desativar e liberar e-mail"): a pessoa não tem mais acesso. */
export const isReleasedEmail = (email: string) => email.startsWith("liberado+");

/** Situação em destaque: "Convite pendente (expira dd/mm)", "Cadastrado – em teste até dd/mm", "Cadastro completo", "Inativo". */
export function sellerBadge(row: SellerCardRow): SellerBadge {
  if (row.kind === "invite") {
    if (row.status === "invite_pending") {
      return { text: `Convite pendente${row.inviteExpiresAt ? ` (expira ${dayMonth(row.inviteExpiresAt)})` : ""}`, tone: "pending" };
    }

    return { text: row.status === "invite_revoked" ? "Convite revogado" : "Convite expirado", tone: "muted" };
  }

  if (row.status === "inactive") {
    return { text: isReleasedEmail(row.email) ? "Inativo – e-mail liberado" : "Inativo", tone: "inactive" };
  }

  if (row.situation === "Cadastro completo") return { text: "Cadastro completo", tone: "complete" };
  if (row.situation === "Teste vencido") return { text: "Cadastrado – teste vencido", tone: "inactive" };

  const until = row.situation?.replace(/^Em teste até\s*/i, "");

  return { text: until ? `Cadastrado – em teste até ${until}` : "Cadastrado", tone: "trial" };
}

/** Texto que o admin copia/envia ao vendedor já cadastrado. */
export function accessText(email: string, loginUrl: string = B2B_LOGIN_URL): string {
  return `Entre em ${loginUrl} com o seu e-mail ${email} e a sua senha`;
}

export function accessWhatsAppUrl(row: Pick<SellerCardRow, "email" | "phone">, loginUrl: string = B2B_LOGIN_URL): string {
  return buildWhatsAppUrl(row.phone, accessText(row.email, loginUrl));
}

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Busca por nome ou e-mail (sem diferenciar maiúsculas nem acentos); acha também pelo e-mail original de quem teve o e-mail liberado. */
export function matchesSearch(row: Pick<SellerCardRow, "name" | "email" | "emailOriginal">, query: string): boolean {
  const q = fold(query);

  if (!q) return true;

  return [row.name, row.email, row.emailOriginal ?? ""].some((value) => fold(value).includes(q));
}
