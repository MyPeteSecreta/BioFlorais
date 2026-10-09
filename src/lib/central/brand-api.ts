/**
 * LADO DA BIO do contrato Central ⇄ marca (formatos em contract.ts; referência: My Pet).
 * Tudo sobre SqlRunner (roda no Neon e no PGlite dos testes). Convites, andamento e cadastro
 * do vendedor reaproveitam as mesmas regras do admin da Bio.
 */

import { isUuid } from "@/lib/b2b/admin-input";
import { andNotArchived } from "@/lib/b2b/archive";
import { B2B_RESPONSIBLE_TYPES, buildInviteMessage, buildWhatsAppUrl } from "@/lib/b2b/invite-links";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { b2bProductLabel } from "@/lib/b2b/product-label";
import { describeIdentityConflict, findIdentityConflict } from "@/lib/b2b/vendor-identity";
import { RCA_TERMS_VERSION, parseCompleteProfile } from "@/lib/b2b/vendor-profile";
import { applyOrderProgress } from "@/lib/central/order-progress";
import type {
  ApplyProfileRequest,
  ApplyProfileResponse,
  CentralOrder,
  InviteRequest,
  InviteResponse,
  OrdersResponse,
  ProgressRequest,
  ProgressResponse,
  SellerProfileData,
  SellerProfileLookup,
} from "@/lib/central/contract";

export const ORDER_NUMBER_PREFIX = "BIO";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type IssueInviteFn = (input: {
  name: string;
  email: string;
  responsibleType: "rca" | "clt";
}) => Promise<{ inviteId: string; url: string; expiresAt: Date }>;

/* ---------------- convites ---------------- */

/* Cria o convite como o admin da Bio faria (mesma checagem de e-mail: só vendedor existente ocupa). */
export async function createBrandInvite(run: SqlRunner, issue: IssueInviteFn, input: Partial<InviteRequest>): Promise<InviteResponse> {
  const name = String(input.name ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const phone = String(input.phone ?? "").replace(/\D/g, "") || null;
  const responsibleType = input.type === "RCA" ? "rca" : input.type === "VENDEDOR" ? "clt" : null;

  if (name.length < 2) return { ok: false, error: "Informe o nome.", code: "INVALID" };
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return { ok: false, error: "Informe um e-mail válido.", code: "INVALID" };
  if (!responsibleType || !(responsibleType in B2B_RESPONSIBLE_TYPES)) return { ok: false, error: "Tipo inválido (RCA ou VENDEDOR).", code: "INVALID" };
  if (phone && (phone.length < 10 || phone.length > 13)) return { ok: false, error: "WhatsApp inválido.", code: "INVALID" };

  const conflict = await findIdentityConflict(run, { email });

  if (conflict) return { ok: false, error: describeIdentityConflict(conflict), code: "EMAIL_IN_USE" };

  // Como no admin: um convite novo revoga os pendentes do mesmo e-mail.
  const issued = await issue({ name, email, responsibleType });

  return {
    ok: true,
    link: issued.url,
    whatsappUrl: phone ? buildWhatsAppUrl(phone, buildInviteMessage({ name, url: issued.url, purpose: "onboarding" })) : null,
    expiresAt: issued.expiresAt.toISOString(),
    inviteId: issued.inviteId,
  };
}

/* ---------------- pedidos ---------------- */

export type OrderStage = "separation" | "tracking" | "shipped";

export async function listBrandOrders(run: SqlRunner, stage: OrderStage): Promise<OrdersResponse> {
  const stageFilter =
    stage === "separation"
      ? `o.fulfillment_status IN ('paid_to_prepare', 'separating')`
      : stage === "shipped"
        ? `o.fulfillment_status = 'shipped'`
        : `o.fulfillment_status = 'ready_to_ship' AND COALESCE(btrim(o.tracking_code), '') = ''`;
  const notArchived = await andNotArchived(run, "orders", "o");

  const rows = await run(
    `SELECT o.id, o.fulfillment_status, o.b2b_offer_id, o.shipping_service_name,
            to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS') || 'Z' AS created_at,
            c.name AS customer_name, a.city, a.state
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN addresses a ON a.id = o.shipping_address_id
      WHERE o.status IN ('paid', 'approved')${notArchived}
        AND ${stageFilter}
      ORDER BY o.created_at ASC
      LIMIT 300`
  );

  const ids = rows.map((row) => String(row.id));
  const byOrder = new Map<string, CentralOrder["items"]>();

  if (ids.length > 0) {
    const items = await run(
      `SELECT i.order_id, p.slug, p.name, p.category, p.line_slug, to_jsonb(i) ->> 'product_name_snapshot' AS snapshot,
              coalesce(sum(i.qty) FILTER (WHERE i.unit_price_cents > 0), 0)::int AS paid_qty,
              coalesce(sum(i.qty) FILTER (WHERE i.unit_price_cents = 0), 0)::int AS bonus_qty
         FROM order_items i LEFT JOIN products p ON p.id = i.product_id
        WHERE i.order_id = ANY($1::uuid[])
        GROUP BY i.order_id, i.product_id, p.slug, p.name, p.category, p.line_slug, to_jsonb(i) ->> 'product_name_snapshot'
        ORDER BY p.name`,
      [ids]
    );

    for (const item of items) {
      const paidQty = Number(item.paid_qty ?? 0);
      const bonusQty = Number(item.bonus_qty ?? 0);
      const list = byOrder.get(String(item.order_id)) ?? [];

      list.push({
        name: item.snapshot
          ? String(item.snapshot)
          : b2bProductLabel({
              slug: String(item.slug ?? ""),
              name: String(item.name ?? "Produto"),
              category: (item.category as string | null) ?? null,
              lineSlug: (item.line_slug as string | null) ?? null,
            }).full,
        paidQty,
        bonusQty,
        qty: paidQty + bonusQty,
      });
      byOrder.set(String(item.order_id), list);
    }
  }

  const orders: CentralOrder[] = rows.map((row) => ({
    id: String(row.id),
    number: `${ORDER_NUMBER_PREFIX}-${String(row.id).slice(0, 8).toUpperCase()}`,
    customerName: row.customer_name ? String(row.customer_name) : "Cliente",
    city: row.city ? String(row.city) : null,
    state: row.state ? String(row.state) : null,
    createdAt: String(row.created_at),
    fulfillment: String(row.fulfillment_status),
    b2b: row.b2b_offer_id !== null && row.b2b_offer_id !== undefined,
    items: byOrder.get(String(row.id)) ?? [],
    carrier: row.shipping_service_name ? String(row.shipping_service_name) : null,
  }));

  return { ok: true, orders };
}

export async function applyBrandProgress(
  run: SqlRunner,
  orderId: string,
  input: Partial<ProgressRequest>
): Promise<ProgressResponse & { status?: number }> {
  const action = input.action;

  if (action !== "separating" && action !== "separated" && action !== "shipped" && action !== "delivered") {
    return { ok: false, error: "Ação inválida.", status: 400 };
  }

  const actor = String(input.actor ?? "").trim().slice(0, 80) || "Central";

  const result = await applyOrderProgress(run, {
    orderId,
    action,
    actor: `Central · ${actor}`,
    carrier: input.carrier ?? null,
    trackingCode: input.trackingCode ?? null,
    trackingUrl: input.trackingUrl ?? null,
  });

  return result.ok ? { ok: true, fulfillmentStatus: result.fulfillmentStatus } : { ok: false, error: result.error, status: result.status };
}

/* ---------------- V4: cadastro completo do vendedor ---------------- */

const textOrNull = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

export async function lookupSellerProfile(run: SqlRunner, emailInput: string): Promise<SellerProfileLookup> {
  const email = emailInput.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) return { ok: true, found: false };

  const notArchived = await andNotArchived(run, "b2b_responsibles", "r");
  const [row] = await run(
    `SELECT r.name, r.profile_completed_at, r.person_type, r.cpf, r.rg, r.cnpj, r.state_registration, r.pix_key, r.bank_name,
            r.bank_agency, r.bank_account, r.postal_code, r.street, r.address_number, r.address_complement, r.neighborhood,
            r.city, r.state,
            to_char(r.rca_terms_accepted_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS terms_at,
            r.rca_terms_accepted_ip AS terms_ip, r.rca_terms_version AS terms_version
       FROM b2b_responsibles r WHERE lower(r.email) = $1${notArchived} ORDER BY r.created_at ASC LIMIT 1`,
    [email]
  );

  if (!row) return { ok: true, found: false };

  const profile: SellerProfileData = {
    personType: row.person_type === "pj" ? "pj" : "pf",
    cpf: textOrNull(row.cpf),
    rg: textOrNull(row.rg),
    cnpj: textOrNull(row.cnpj),
    stateRegistration: textOrNull(row.state_registration),
    pixKey: textOrNull(row.pix_key),
    bankName: textOrNull(row.bank_name),
    bankAgency: textOrNull(row.bank_agency),
    bankAccount: textOrNull(row.bank_account),
    postalCode: textOrNull(row.postal_code),
    street: textOrNull(row.street),
    addressNumber: textOrNull(row.address_number),
    addressComplement: textOrNull(row.address_complement),
    neighborhood: textOrNull(row.neighborhood),
    city: textOrNull(row.city),
    state: textOrNull(row.state),
  };

  return {
    ok: true,
    found: true,
    complete: row.profile_completed_at !== null && row.profile_completed_at !== undefined,
    name: String(row.name),
    profile,
    terms: row.terms_at
      ? { acceptedAt: String(row.terms_at), ip: textOrNull(row.terms_ip), version: textOrNull(row.terms_version) ?? "" }
      : null,
  };
}

/*
 * Replica o cadastro COMPLETO feito em outra marca para o vendedor ATIVO desta marca (mesmo e-mail).
 * Só preenche quem ainda NÃO completou; nunca sobrescreve. O aceite do termo (RCA) é gravado com a
 * data/IP/versão do aceite original. Mesma validação do cadastro completo da Bio.
 */
export async function applyReplicatedProfile(run: SqlRunner, input: Partial<ApplyProfileRequest>): Promise<ApplyProfileResponse> {
  const email = String(input.email ?? "").trim().toLowerCase();
  const profile = input.profile;

  if (!EMAIL_PATTERN.test(email) || !profile || typeof profile !== "object") return { ok: false, error: "Dados inválidos." };

  const notArchived = await andNotArchived(run, "b2b_responsibles", "r");
  const [seller] = await run(
    `SELECT r.id, r.type, r.status, r.profile_completed_at FROM b2b_responsibles r WHERE lower(r.email) = $1${notArchived} ORDER BY r.created_at ASC LIMIT 1`,
    [email]
  );

  if (!seller || seller.status !== "active" || !isUuid(String(seller.id))) return { ok: true, applied: false, reason: "NO_SELLER" };
  if (seller.profile_completed_at) return { ok: true, applied: false, reason: "ALREADY_COMPLETE" };

  const isRca = seller.type === "rca";
  const terms = input.terms ?? null;

  if (isRca && !terms) return { ok: true, applied: false, reason: "TERMS_REQUIRED" };

  const parsed = parseCompleteProfile({ ...profile, rcaTermsAccepted: true }, String(seller.type));

  if (!parsed.ok) return { ok: false, error: parsed.error };

  const value = parsed.value;
  const now = new Date();
  const acceptedAt = terms ? new Date(terms.acceptedAt) : now;

  await run(
    `UPDATE b2b_responsibles SET
        person_type = $2, cpf = $3, rg = $4, cnpj = $5, state_registration = $6, postal_code = $7, street = $8,
        address_number = $9, address_complement = $10, neighborhood = $11, city = $12, state = $13,
        pix_key = $14, bank_name = $15, bank_agency = $16, bank_account = $17,
        rca_terms_accepted_at = $18, rca_terms_accepted_ip = $19, rca_terms_version = $20,
        profile_completed_at = $21, onboarding_completed_at = $21, updated_at = $21
      WHERE id = $1 AND profile_completed_at IS NULL`,
    [
      seller.id,
      value.personType,
      value.cpf,
      value.rg,
      value.cnpj,
      value.stateRegistration,
      value.postalCode,
      value.street,
      value.addressNumber,
      value.addressComplement,
      value.neighborhood,
      value.city,
      value.state,
      value.pixKey,
      value.bankName,
      value.bankAgency,
      value.bankAccount,
      isRca ? (Number.isNaN(acceptedAt.getTime()) ? now : acceptedAt).toISOString() : null,
      isRca ? terms?.ip ?? null : null,
      isRca ? terms?.version || RCA_TERMS_VERSION : null,
      now.toISOString(),
    ]
  );

  return { ok: true, applied: true };
}
