/**
 * Acesso do lojista SEM senha (Rodada 19c): /b2b/entrar → e-mail ou CNPJ/CPF → se existir cadastro, o link pessoal vai por
 * e-mail para o endereço CADASTRADO (nunca para o que foi digitado). O lojista não tem login: o acesso é só o link pessoal.
 *
 *  - Resposta SEMPRE neutra (existe ou não, limite atingido ou não): não revela cadastro.
 *  - Limite de tentativas: por identificador e por IP, numa janela de 1 hora (hashes em b2b_access_requests, SQL 49b).
 *  - Só e-mail/documento exatos; link só de oferta ativa, vínculo ativo, representante ativo e fora da demonstração.
 */

import { createHash } from "node:crypto";

import { NOT_DEMO_SQL } from "@/lib/b2b/demo";
import { andNotArchived } from "@/lib/b2b/archive";
import { isValidCnpj, isValidCpf } from "@/lib/b2b/vendor-launch";
import type { SqlRunner } from "@/lib/b2b/ownership";

export const ACCESS_NEUTRAL_MESSAGE =
  "Se encontrarmos o seu cadastro, enviaremos o seu link de compra para o e-mail cadastrado. Confira também a caixa de spam. Não recebeu? Fale com o seu representante.";

export const ACCESS_LIMITS = { perIdentifier: 3, perIp: 10, windowMinutes: 60 } as const;

export type Identifier = { kind: "email"; value: string } | { kind: "document"; value: string };

/** E-mail (com @) ou CNPJ/CPF com dígito verificador. Inválido = null (a resposta continua neutra). */
export function parseIdentifier(raw: unknown): Identifier | null {
  const text = String(raw ?? "").trim().slice(0, 254);

  if (!text) return null;

  if (text.includes("@")) {
    const email = text.toLowerCase();

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { kind: "email", value: email } : null;
  }

  const digits = text.replace(/\D/g, "");

  if (digits.length === 14 && isValidCnpj(digits)) return { kind: "document", value: digits };
  if (digits.length === 11 && isValidCpf(digits)) return { kind: "document", value: digits };

  return null;
}

export function hashValue(value: string, secret: string = process.env.ADMIN_SESSION_SECRET ?? "bio-acesso"): string {
  return createHash("sha256").update(`b2b-acesso:${secret}:${value}`).digest("hex");
}

/** true = pode processar; false = limite atingido (a resposta continua neutra, nada é enviado). */
export function withinLimits(counts: { identifier: number; ip: number }): boolean {
  return counts.identifier < ACCESS_LIMITS.perIdentifier && counts.ip < ACCESS_LIMITS.perIp;
}

export type AccessTarget = { clientId: string; clientName: string; email: string; offerId: string };

export async function findAccessTargets(run: SqlRunner, identifier: Identifier): Promise<AccessTarget[]> {
  const notArchived = await andNotArchived(run, "b2b_clients", "c");
  const match = identifier.kind === "email" ? `lower(btrim(c.email)) = $1` : `regexp_replace(coalesce(to_jsonb(c) ->> 'document', ''), '\\D', '', 'g') = $1`;

  const rows = await run(
    `SELECT c.id::text AS client_id, c.display_name, btrim(c.email) AS email, o.id::text AS offer_id
       FROM b2b_clients c
       JOIN b2b_client_relationships rel ON rel.client_id = c.id AND rel.active = true AND rel.unlinked_at IS NULL
       JOIN b2b_responsibles r ON r.id = rel.responsible_id AND r.status = 'active' AND ${NOT_DEMO_SQL("r")}
       JOIN b2b_offers o ON o.client_id = c.id AND o.responsible_id = r.id AND o.status = 'active' AND o.revoked_at IS NULL
                         AND coalesce(to_jsonb(o) ->> 'is_storefront', 'false') <> 'true'
      WHERE c.active = true${notArchived}
        AND ${match}
        AND coalesce(btrim(c.email), '') <> ''
        AND EXISTS (SELECT 1 FROM b2b_offer_links l WHERE l.offer_id = o.id AND l.revoked_at IS NULL)
      ORDER BY o.created_at DESC
      LIMIT 10`,
    [identifier.value]
  );

  // Uma oferta (a mais recente) por cliente.
  const seen = new Set<string>();
  const targets: AccessTarget[] = [];

  for (const row of rows) {
    const clientId = String(row.client_id);
    if (seen.has(clientId)) continue;
    seen.add(clientId);
    targets.push({ clientId, clientName: String(row.display_name ?? ""), email: String(row.email).toLowerCase(), offerId: String(row.offer_id) });
  }

  return targets.slice(0, 3);
}

export type AccessDeps = {
  readLink: (offerId: string, contact: { clientName: string; clientPhone: string | null; responsibleName: string }) => Promise<{ url: string } | null>;
  sendEmail: (input: { to: string; subject: string; text: string; html: string }) => Promise<boolean>;
};

export function buildAccessEmail(links: Array<{ clientName: string; url: string }>): { subject: string; text: string; html: string } {
  const lines = links.map((link) => `${link.clientName ? `${link.clientName}: ` : ""}${link.url}`);
  const text = `Olá!\n\nSegue o seu link pessoal para comprar na Bio Florais com preço de lojista:\n\n${lines.join("\n")}\n\nGuarde este e-mail: é por esse link que você acessa a loja, o seu histórico de pedidos e os seus orçamentos. Não compartilhe o link com terceiros.\n\nSe você não pediu este e-mail, pode ignorá-lo.`;
  const html = `<p>Olá!</p><p>Segue o seu link pessoal para comprar na Bio Florais com preço de lojista:</p><ul>${links
    .map((link) => `<li>${link.clientName ? `${escapeHtml(link.clientName)}: ` : ""}<a href="${escapeHtml(link.url)}">${escapeHtml(link.url)}</a></li>`)
    .join("")}</ul><p>Guarde este e-mail: é por esse link que você acessa a loja, o seu histórico de pedidos e os seus orçamentos. Não compartilhe o link com terceiros.</p><p>Se você não pediu este e-mail, pode ignorá-lo.</p>`;

  return { subject: "Seu link de compra Bio Florais", text, html };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export type AccessOutcome = "invalid" | "limited" | "not_found" | "sent" | "send_failed";

/**
 * Processa o pedido. O RESULTADO é só para teste e log: quem chama responde SEMPRE a mensagem neutra.
 */
export async function requestAccessLink(run: SqlRunner, input: { identifier: unknown; ip: string | null }, deps: AccessDeps): Promise<AccessOutcome> {
  const identifier = parseIdentifier(input.identifier);
  const ipHash = input.ip ? hashValue(input.ip) : null;

  if (!identifier) {
    // Entrada inválida também conta para o IP (impede varredura de valores).
    await record(run, hashValue("invalido"), ipHash, false);

    return "invalid";
  }

  const identifierHash = hashValue(`${identifier.kind}:${identifier.value}`);
  const counts = await countRecent(run, identifierHash, ipHash);

  if (!withinLimits(counts)) return "limited";

  const targets = await findAccessTargets(run, identifier);

  if (targets.length === 0) {
    await record(run, identifierHash, ipHash, false);

    return "not_found";
  }

  // O e-mail vai SÓ para o endereço cadastrado (agrupa por endereço).
  const byEmail = new Map<string, Array<{ clientName: string; url: string }>>();

  for (const target of targets) {
    const link = await deps.readLink(target.offerId, { clientName: target.clientName, clientPhone: null, responsibleName: "Bio Florais" });

    if (!link) continue;

    const list = byEmail.get(target.email) ?? [];
    list.push({ clientName: target.clientName, url: link.url });
    byEmail.set(target.email, list);
  }

  let sent = false;

  for (const [email, links] of byEmail) {
    const message = buildAccessEmail(links);

    if (await deps.sendEmail({ to: email, ...message })) sent = true;
  }

  await record(run, identifierHash, ipHash, sent);

  return sent ? "sent" : byEmail.size === 0 ? "not_found" : "send_failed";
}

async function countRecent(run: SqlRunner, identifierHash: string, ipHash: string | null): Promise<{ identifier: number; ip: number }> {
  try {
    const [row] = await run(
      `SELECT (SELECT count(*) FROM b2b_access_requests WHERE identifier_hash = $1 AND created_at > now() - ($3::int * interval '1 minute'))::int AS by_identifier,
              (SELECT count(*) FROM b2b_access_requests WHERE $2::text IS NOT NULL AND ip_hash = $2 AND created_at > now() - ($3::int * interval '1 minute'))::int AS by_ip`,
      [identifierHash, ipHash, ACCESS_LIMITS.windowMinutes]
    );

    return { identifier: Number(row?.by_identifier ?? 0), ip: Number(row?.by_ip ?? 0) };
  } catch {
    // Sem a tabela (SQL 49b): sem limite persistido (a resposta continua neutra e nada vaza).
    return { identifier: 0, ip: 0 };
  }
}

async function record(run: SqlRunner, identifierHash: string, ipHash: string | null, sent: boolean) {
  try {
    await run(`INSERT INTO b2b_access_requests (identifier_hash, ip_hash, sent) VALUES ($1, $2, $3)`, [identifierHash, ipHash, sent]);
  } catch {
    // sem a tabela: não registra
  }
}
