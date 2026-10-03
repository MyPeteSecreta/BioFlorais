/**
 * BIO FLORAIS B2B — mensagens de marketing ao lojista (C11): editadas no admin
 * B2B e mostradas só no link do cliente (pop-up no 1º acesso, faixa no topo e
 * botão flutuante). Nunca "frete grátis". SQL puro sobre SqlRunner.
 */

import { isUuid } from "@/lib/b2b/admin-input";
import type { SqlRunner } from "@/lib/b2b/ownership";

export type RetailerMessage = { id: string; title: string; body: string };

export type AdminRetailerMessage = RetailerMessage & { active: boolean; sortOrder: number };

/** "Frete grátis" não pode aparecer (a política é "frete especial B2B"). */
export const FORBIDDEN_FREE_SHIPPING = /frete\s+gr[aá]tis|gr[aá]tis\s+de\s+frete/i;

export function parseMessageInput(
  body: Record<string, unknown>
): { ok: true; value: { title: string; body: string; active: boolean; sortOrder: number } } | { ok: false; error: string } {
  const title = String(body.title ?? "").trim();
  const text = String(body.body ?? "").trim();
  const sortOrder = Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;

  if (!title || title.length > 120) return { ok: false, error: "Informe o título (até 120 caracteres)." };
  if (!text || text.length > 1200) return { ok: false, error: "Informe o texto (até 1200 caracteres)." };

  if (FORBIDDEN_FREE_SHIPPING.test(title) || FORBIDDEN_FREE_SHIPPING.test(text)) {
    return { ok: false, error: "Não use \"frete grátis\": diga \"frete especial B2B\"." };
  }

  return { ok: true, value: { title, body: text, active: body.active !== false, sortOrder } };
}

/** Mensagens ativas, na ordem. Sem a tabela (SQL 22b), devolve vazio: o link funciona sem marketing. */
export async function loadActiveMessages(run: SqlRunner): Promise<RetailerMessage[]> {
  try {
    const rows = await run(
      `SELECT id, title, body FROM b2b_retailer_messages WHERE active ORDER BY sort_order, created_at`
    );

    return rows.map((row) => ({ id: String(row.id), title: String(row.title), body: String(row.body) }));
  } catch (error) {
    console.error("[b2b/retailer-messages] indisponível", error);
    return [];
  }
}

export async function hasSeenPopup(run: SqlRunner, clientId: string): Promise<boolean> {
  if (!isUuid(clientId)) return true;

  try {
    const rows = await run(`SELECT 1 AS x FROM b2b_retailer_popup_views WHERE client_id = $1`, [clientId]);
    return rows.length > 0;
  } catch {
    return true; // sem a tabela, não mostra o pop-up (evita repetir a cada acesso)
  }
}

export async function markPopupSeen(run: SqlRunner, clientId: string, messageId: string | null) {
  if (!isUuid(clientId)) return;

  await run(
    `INSERT INTO b2b_retailer_popup_views (client_id, message_id) VALUES ($1, $2) ON CONFLICT (client_id) DO NOTHING`,
    [clientId, messageId && isUuid(messageId) ? messageId : null]
  );
}

export async function listAdminMessages(run: SqlRunner): Promise<AdminRetailerMessage[]> {
  const rows = await run(`SELECT id, title, body, active, sort_order FROM b2b_retailer_messages ORDER BY sort_order, created_at`);

  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order),
  }));
}
