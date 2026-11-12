/**
 * E-MAILS DE ANDAMENTO DO PEDIDO (B2C e B2B), pelo Resend (src/lib/mail.ts). Mestre/Luis, 11/11.
 *
 * Etapas: pedido recebido · pagamento confirmado · em separação · enviado (código e link de rastreio) · entregue · cancelado.
 * B2B no boleto a prazo: "recebido" já traz as parcelas e os vencimentos; depois separação e envio como os demais.
 *
 * Regras:
 *  - Uma vez por etapa (idempotente): o envio é registrado em order_events (evento `email_<etapa>`) ANTES de mandar.
 *  - Só a etapa ATUAL: se o pedido pulou etapas (pago → enviado), vai só o "enviado"; nunca manda uma etapa anterior a outra já
 *    enviada (o cancelado vale sempre, uma vez).
 *  - Falha no e-mail nunca atrapalha o pedido (quem chama usa notifyOrderProgressSafe, em order-emails-server.ts).
 *  - Sem RESEND_API_KEY/MAIL_FROM: não envia e registra "não enviado" no histórico do pedido.
 *  - E-mail transacional: não depende do aceite de marketing. Sem dados sensíveis (sem CPF/CNPJ, endereço completo ou telefone).
 *  - Orçamento, pedido arquivado, sem e-mail válido: nada.
 *
 * PORTAR PARA MY PET / SECRETA: este arquivo só depende de SqlRunner, loadTrackingView/signTrackingToken (order-tracking.ts),
 * resumeUrl (payment-reminder.ts) e da marca em BRAND (logo em texto, cores, nome). Troque BRAND e os caminhos dos links.
 */

import type { SqlRunner } from "@/lib/b2b/ownership";
import { loadTrackingView, signTrackingToken, type TrackingView } from "@/lib/order-tracking";
import { resumeUrl } from "@/lib/payment-reminder";

export const BRAND = {
  name: "Bio Florais",
  green: "#26352c",
  beige: "#f7f2ea",
  line: "#e5dccf",
  muted: "#6b6458",
  trackPath: "/acompanhe",
  trackSearchPath: "/acompanhe-seu-pedido",
  supportPath: "/atendimento",
};

export const ORDER_EMAIL_STAGES = ["received", "paid", "separating", "shipped", "delivered", "cancelled"] as const;
export type OrderEmailStage = (typeof ORDER_EMAIL_STAGES)[number];
export const EMAIL_EVENT_PREFIX = "email_";

const RANK: Record<OrderEmailStage, number> = { received: 0, paid: 1, separating: 2, shipped: 3, delivered: 4, cancelled: 9 };
const CANCELLED_STATUSES = ["cancelled", "canceled", "failed", "expired", "refunded", "rejected"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type StageInput = Pick<TrackingView, "status" | "fulfillmentStatus" | "paymentMethod" | "isB2B" | "boleto">;

/** Etapa atual do pedido para o e-mail (ou null: nada a avisar agora). */
export function currentEmailStage(order: StageInput): OrderEmailStage | null {
  const status = String(order.status ?? "");
  const fulfillment = String(order.fulfillmentStatus ?? "");

  if (status === "quote") return null;
  if (CANCELLED_STATUSES.includes(status) || fulfillment === "cancelled") return "cancelled";
  if (fulfillment === "delivered" || fulfillment === "completed") return "delivered";
  if (fulfillment === "shipped") return "shipped";
  if (fulfillment === "separating" || fulfillment === "ready_to_ship") return "separating";
  if (status === "paid" || status === "approved") return "paid";

  if (status === "pending" || status === "checkout_pending") {
    // Boleto a prazo B2B: o "recebido" sai quando as parcelas existem (solicitação do boleto), para mostrar os vencimentos.
    if (order.isB2B && order.paymentMethod === "boleto" && order.boleto.length === 0) return null;

    return "received";
  }

  return null;
}

/** Pode mandar esta etapa, dado o que já foi enviado? (uma vez por etapa; nunca volta para trás; cancelado sempre, uma vez) */
export function shouldSendStage(stage: OrderEmailStage, alreadySent: OrderEmailStage[]): boolean {
  if (alreadySent.includes(stage)) return false;
  if (stage === "cancelled") return true;
  if (alreadySent.includes("cancelled")) return false;

  return !alreadySent.some((sent) => RANK[sent] > RANK[stage]);
}

// ---------------------------------------------------------------------------
// Texto e HTML
// ---------------------------------------------------------------------------

export const brl = (cents: number) =>
  `R$ ${(Math.round(cents) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const firstName = (name: string) => String(name ?? "").trim().split(/\s+/)[0] || "";
const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const brDate = (iso: string | null) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "a definir");

export type OrderEmailContext = {
  name: string;
  trackUrl: string;
  /** Link para concluir o pagamento (B2C pendente). */
  payUrl: string | null;
  supportUrl: string;
};

export type OrderEmail = { subject: string; text: string; html: string };

type Block = { kind: "p"; text: string } | { kind: "items" } | { kind: "totals" } | { kind: "boleto" } | { kind: "button"; label: string; url: string } | { kind: "small"; text: string };

function itemLines(view: TrackingView): string[] {
  return view.items.map((item) => `${item.qty}× ${item.name}${item.bonified ? " (bonificado)" : ""}`);
}

function totalLines(view: TrackingView): string[] {
  return [
    `Subtotal: ${brl(view.subtotalCents)}`,
    ...(view.discountCents > 0 ? [`Descontos: -${brl(view.discountCents)}`] : []),
    `Frete: ${view.shippingCents > 0 ? brl(view.shippingCents) : "grátis"}`,
    `Total: ${brl(view.totalCents)}`,
  ];
}

function boletoLines(view: TrackingView): string[] {
  return view.boleto.map((parcel) => `${parcel.installment}ª parcela: ${brl(parcel.amountCents)} · vence em ${brDate(parcel.dueDate)}`);
}

/** Conteúdo de cada etapa (mesmo texto no e-mail simples e no HTML). */
export function orderEmailBlocks(stage: OrderEmailStage, view: TrackingView, ctx: OrderEmailContext): { subject: string; blocks: Block[] } {
  const number = view.number;
  const boletoB2B = view.isB2B && view.paymentMethod === "boleto";
  const track: Block = { kind: "button", label: "Acompanhar pedido", url: ctx.trackUrl };

  switch (stage) {
    case "received":
      if (boletoB2B) {
        return {
          subject: `Recebemos seu pedido #${number} (boleto a prazo)`,
          blocks: [
            { kind: "p", text: `Recebemos seu pedido #${number}. Obrigado pela compra!` },
            { kind: "items" },
            { kind: "totals" },
            { kind: "p", text: `Pagamento no boleto a prazo, em ${view.boleto.length} parcela(s):` },
            { kind: "boleto" },
            { kind: "p", text: "O pedido já segue para a separação. Avisamos por aqui quando ele for enviado, com o código de rastreio." },
            track,
          ],
        };
      }

      return {
        subject: `Recebemos seu pedido #${number}`,
        blocks: [
          { kind: "p", text: `Recebemos seu pedido #${number}. Obrigado pela compra!` },
          { kind: "items" },
          { kind: "totals" },
          { kind: "p", text: "Assim que o pagamento for confirmado, avisamos por aqui." },
          ...(ctx.payUrl
            ? ([
                { kind: "p", text: "Se você ainda não concluiu o pagamento, é só usar o botão abaixo (se o Pix venceu, a página gera outro)." },
                { kind: "button", label: "Concluir o pagamento", url: ctx.payUrl },
              ] as Block[])
            : []),
          track,
        ],
      };

    case "paid":
      return {
        subject: `Pagamento confirmado · pedido #${number}`,
        blocks: [
          {
            kind: "p",
            text: boletoB2B
              ? `Todas as parcelas do boleto do pedido #${number} foram pagas. Obrigado!`
              : `O pagamento do seu pedido #${number} foi confirmado. Agora ele vai para a separação.`,
          },
          { kind: "items" },
          { kind: "p", text: `Total: ${brl(view.totalCents)}` },
          { kind: "p", text: "Avisamos por aqui quando o pedido for enviado, com o código de rastreio." },
          track,
        ],
      };

    case "separating":
      return {
        subject: `Seu pedido #${number} está em separação`,
        blocks: [
          { kind: "p", text: `Estamos separando os produtos do seu pedido #${number}.` },
          { kind: "p", text: "Avisamos por aqui assim que ele for enviado, com o código de rastreio." },
          track,
        ],
      };

    case "shipped": {
      const shippingInfo = [
        view.carrier ? `Transportadora: ${view.carrier}` : null,
        view.trackingCode ? `Código de rastreio: ${view.trackingCode}` : null,
      ].filter(Boolean) as string[];

      return {
        subject: `Seu pedido #${number} foi enviado`,
        blocks: [
          { kind: "p", text: `Seu pedido #${number} foi enviado.` },
          ...shippingInfo.map((text) => ({ kind: "p", text }) as Block),
          ...(view.trackingUrl ? ([{ kind: "button", label: "Rastrear entrega", url: view.trackingUrl }] as Block[]) : []),
          { kind: "p", text: "O prazo de entrega conta a partir do envio. Você também acompanha tudo pelo link do pedido." },
          track,
        ],
      };
    }

    case "delivered":
      return {
        subject: `Seu pedido #${number} foi entregue`,
        blocks: [
          { kind: "p", text: `O seu pedido #${number} consta como entregue. Obrigado por comprar com a ${BRAND.name}!` },
          { kind: "p", text: `Se algo não chegou como esperado, fale com a gente: ${ctx.supportUrl}` },
          track,
        ],
      };

    case "cancelled":
      return {
        subject: `Pedido #${number} cancelado`,
        blocks: [
          { kind: "p", text: `O seu pedido #${number} foi cancelado.` },
          { kind: "p", text: `Se você não pediu o cancelamento, ou se houve pagamento e quer combinar a devolução, fale com a gente: ${ctx.supportUrl}` },
          track,
        ],
      };
  }
}

export function buildOrderEmail(stage: OrderEmailStage, view: TrackingView, ctx: OrderEmailContext): OrderEmail {
  const { subject, blocks } = orderEmailBlocks(stage, view, ctx);
  // B2C: primeiro nome; B2B: o nome da loja inteiro ("Olá, Gral Animal.").
  const who = view.isB2B ? String(ctx.name ?? "").trim() : firstName(ctx.name);
  const greeting = who ? `Olá, ${who}.` : "Olá.";
  const footer = `Este e-mail é sobre o seu pedido na ${BRAND.name}. Pedido #${view.number}.`;

  const textParts: string[] = [greeting, ""];
  for (const block of blocks) {
    if (block.kind === "p" || block.kind === "small") textParts.push(block.text, "");
    if (block.kind === "items") textParts.push(...itemLines(view), "");
    if (block.kind === "totals") textParts.push(...totalLines(view), "");
    if (block.kind === "boleto") textParts.push(...boletoLines(view), "");
    if (block.kind === "button") textParts.push(`${block.label}: ${block.url}`, "");
  }
  textParts.push(BRAND.name, footer);
  const text = textParts.join("\n");

  const cell = `font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:${BRAND.green}`;
  const htmlBlocks = blocks
    .map((block) => {
      if (block.kind === "p") return `<p style="margin:0 0 14px">${esc(block.text)}</p>`;
      if (block.kind === "small") return `<p style="margin:0 0 14px;font-size:12px;color:${BRAND.muted}">${esc(block.text)}</p>`;
      if (block.kind === "items")
        return `<table role="presentation" width="100%" style="margin:0 0 14px;border-collapse:collapse">${itemLines(view)
          .map((line) => `<tr><td style="padding:6px 0;border-bottom:1px solid ${BRAND.line}">${esc(line)}</td></tr>`)
          .join("")}</table>`;
      if (block.kind === "totals")
        return `<p style="margin:0 0 14px">${totalLines(view)
          .map((line, index, all) => (index === all.length - 1 ? `<strong>${esc(line)}</strong>` : esc(line)))
          .join("<br>")}</p>`;
      if (block.kind === "boleto") return `<p style="margin:0 0 14px">${boletoLines(view).map(esc).join("<br>")}</p>`;
      return `<p style="margin:6px 0 18px"><a href="${esc(block.url)}" style="display:inline-block;background:${BRAND.green};color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">${esc(block.label)}</a></p>`;
    })
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:${BRAND.beige}">
<table role="presentation" width="100%" style="background:${BRAND.beige};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid ${BRAND.line};border-radius:16px">
<tr><td style="padding:22px 24px;border-bottom:1px solid ${BRAND.line};font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:bold;color:${BRAND.green}">${esc(BRAND.name)}</td></tr>
<tr><td style="padding:22px 24px;${cell}"><p style="margin:0 0 14px">${esc(greeting)}</p>${htmlBlocks}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid ${BRAND.line};font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${BRAND.muted}">${esc(footer)}</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Envio idempotente
// ---------------------------------------------------------------------------

export type NotifyDeps = {
  send: (mail: { to: string; subject: string; text: string; html: string }) => Promise<boolean>;
  configured: boolean;
  siteUrl: string;
  now?: Date;
};

export type NotifyResult =
  | { sent: true; stage: OrderEmailStage }
  | { sent: false; stage: OrderEmailStage | null; reason: "no_order" | "no_stage" | "no_email" | "already_sent" | "not_configured" | "send_failed" };

async function sentStages(run: SqlRunner, orderId: string): Promise<OrderEmailStage[]> {
  const rows = await run(`SELECT event FROM order_events WHERE order_id = $1 AND event LIKE 'email\\_%'`, [orderId]);

  return rows
    .map((row) => String(row.event).slice(EMAIL_EVENT_PREFIX.length))
    .filter((stage): stage is OrderEmailStage => (ORDER_EMAIL_STAGES as readonly string[]).includes(stage));
}

/** Reserva a etapa (registra antes de mandar). Só quem inseriu manda. */
async function claimStage(run: SqlRunner, orderId: string, stage: OrderEmailStage, note: string): Promise<boolean> {
  const rows = await run(
    `INSERT INTO order_events (order_id, event, note, created_by)
     SELECT $1, $2, $3, 'e-mail'
      WHERE NOT EXISTS (SELECT 1 FROM order_events WHERE order_id = $1 AND event = $2)
     RETURNING id`,
    [orderId, `${EMAIL_EVENT_PREFIX}${stage}`, note]
  );

  return rows.length > 0;
}

async function markStage(run: SqlRunner, orderId: string, stage: OrderEmailStage, note: string) {
  await run(`UPDATE order_events SET note = $3 WHERE order_id = $1 AND event = $2`, [orderId, `${EMAIL_EVENT_PREFIX}${stage}`, note]);
}

/** Lê o pedido, decide a etapa e manda (uma vez). Lança erro só em falha de banco: use notifyOrderProgressSafe nas rotas. */
export async function notifyOrderProgress(run: SqlRunner, orderId: string, deps: NotifyDeps): Promise<NotifyResult> {
  const view = await loadTrackingView(run, orderId, deps.now ?? new Date());

  if (!view) return { sent: false, stage: null, reason: "no_order" };

  const stage = currentEmailStage(view);

  if (!stage) return { sent: false, stage: null, reason: "no_stage" };

  if (!shouldSendStage(stage, await sentStages(run, orderId))) return { sent: false, stage, reason: "already_sent" };

  const [customer] = await run(`SELECT c.email, c.name FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`, [orderId]);
  const email = String(customer?.email ?? "").trim();

  if (!EMAIL_RE.test(email)) return { sent: false, stage, reason: "no_email" };

  if (!deps.configured) {
    await claimStage(run, orderId, stage, "não enviado: e-mail não configurado (RESEND_API_KEY/MAIL_FROM)");

    return { sent: false, stage, reason: "not_configured" };
  }

  if (!(await claimStage(run, orderId, stage, "enviando"))) return { sent: false, stage, reason: "already_sent" };

  const site = deps.siteUrl.replace(/\/$/, "");
  const token = signTrackingToken(orderId);
  const ctx: OrderEmailContext = {
    name: String(customer?.name ?? ""),
    trackUrl: token ? `${site}${BRAND.trackPath}/${token}` : `${site}${BRAND.trackSearchPath}`,
    payUrl: !view.isB2B && stage === "received" ? resumeUrl(site, orderId) : null,
    supportUrl: `${site}${BRAND.supportPath}`,
  };

  const ok = await deps.send({ to: email, ...buildOrderEmail(stage, view, ctx) }).catch(() => false);

  await markStage(run, orderId, stage, ok ? "enviado" : "não enviado: falha no envio").catch(() => undefined);

  return ok ? { sent: true, stage } : { sent: false, stage, reason: "send_failed" };
}
