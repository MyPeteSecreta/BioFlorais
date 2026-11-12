/*
 * Gera as PRÉVIAS dos e-mails da rodada 2 (Luis aprova os textos antes do push) com os textos do próprio código.
 * Uso: node --import ./scripts/register-ts-paths.mjs scripts/gerar-previas-emails-rodada2.mjs [pasta]
 * Padrão: C:\Users\User\anuncios-angelblanc\previews_emails_bio. Dados de exemplo marcados [TESTE]; nada é enviado.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const out = process.argv[2] || "C:\\Users\\User\\anuncios-angelblanc\\previews_emails_bio";
mkdirSync(out, { recursive: true });

const { buildReminderEmail } = await import("../src/lib/payment-reminder.ts");
const { buildRecoveryEmail } = await import("../src/lib/recovery-offer.ts");
const { buildDueEmail } = await import("../src/lib/boleto-due-reminder.ts");
const { buildReviewEmail } = await import("../src/lib/review-request.ts");
const { buildCartReminderEmail, buildCartOfferEmail } = await import("../src/lib/cart-recovery.ts");

const SITE = "https://www.bioflorais.com.br";
const ORDER = "5f3a9c21-0000-4000-8000-000000000001";
const items = [
  { name: "Sono", qty: 2 },
  { name: "Sensação de Ansiedade", qty: 1 },
];
const cartItems = items.map((item, i) => ({ productSlug: i ? "adulto-floral-em-gotas-sensacao-de-ansiedade" : "adulto-floral-em-gotas-sono", ...item }));
const expiresAt = new Date("2026-11-16T15:00:00Z");

const mails = [
  ["8_pedido_nao_pago_lembrete_2h", "Pedido não pago · lembrete 2 h depois (sem desconto)", buildReminderEmail({ orderId: ORDER, status: "pending", email: "x", name: "Maria Silva [TESTE]", totalCents: 10770, lastMethod: "pix", lastPaymentStatus: "pending", items }, `${SITE}/pagar/TOKEN-EXEMPLO`)],
  ["9_pedido_nao_pago_oferta_2_dias", "Pedido não pago · 2 dias depois, cupom de 10% (só com a oferta ligada no admin)", buildRecoveryEmail({ orderId: ORDER, name: "Maria Silva [TESTE]", items }, { code: "VOLTA-K7M2QX", percent: 10, expiresAt, resumeUrl: `${SITE}/retomar/TOKEN-EXEMPLO` })],
  ["10_carrinho_abandonado_lembrete_2h", "Carrinho abandonado · 2 h depois (só para quem marcou a caixa no checkout)", buildCartReminderEmail({ firstName: "Maria", items: cartItems }, { resumeUrl: `${SITE}/sacola/TOKEN-EXEMPLO`, unsubscribeUrl: `${SITE}/sacola/sair/TOKEN-EXEMPLO` })],
  ["11_carrinho_abandonado_oferta_2_dias", "Carrinho abandonado · 2 dias depois, cupom de 10% (só com a oferta ligada)", buildCartOfferEmail({ firstName: "Maria", items: cartItems }, { code: "VOLTA-P4R8TZ", percent: 10, expiresAt, resumeUrl: `${SITE}/sacola/TOKEN-EXEMPLO`, unsubscribeUrl: `${SITE}/sacola/sair/TOKEN-EXEMPLO` })],
  ["12_boleto_b2b_vence_em_3_dias", "Boleto B2B · 3 dias antes do vencimento (cada parcela)", buildDueEmail({ orderId: ORDER, installment: 1, installments: 3, amountCents: 50000, dueDate: "2026-11-27" }, "3d", { name: "Loja Exemplo [TESTE]", trackUrl: `${SITE}/acompanhe/TOKEN-EXEMPLO`, supportUrl: `${SITE}/atendimento` })],
  ["13_boleto_b2b_vence_hoje", "Boleto B2B · no dia do vencimento", buildDueEmail({ orderId: ORDER, installment: 1, installments: 3, amountCents: 50000, dueDate: "2026-11-27" }, "0d", { name: "Loja Exemplo [TESTE]", trackUrl: `${SITE}/acompanhe/TOKEN-EXEMPLO`, supportUrl: `${SITE}/atendimento` })],
  ["14_avaliacao_7_dias", "Pedido de avaliação · 7 dias depois de entregue (só com o link configurado no admin)", buildReviewEmail({ orderId: ORDER, name: "Maria Silva [TESTE]" }, { reviewUrl: "https://g.page/r/EXEMPLO/review", supportUrl: `${SITE}/atendimento` })],
];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const rows = [];

for (const [file, label, mail] of mails) {
  writeFileSync(path.join(out, `${file}.html`), mail.html, "utf8");
  writeFileSync(path.join(out, `${file}.txt`), `Assunto: ${mail.subject}\n\n${mail.text}\n`, "utf8");
  rows.push(`<li><a href="${file}.html">${esc(label)}</a><br><small>Assunto: <b>${esc(mail.subject)}</b> · <a href="${file}.txt">texto puro</a></small></li>`);
}

writeFileSync(
  path.join(out, "RODADA_2_INDICE.html"),
  `<!doctype html><meta charset="utf-8"><title>Prévias rodada 2 · Bio Florais</title><body style="font-family:Arial;max-width:760px;margin:24px auto;line-height:1.6">
<h1>E-mails da rodada 2 · Bio Florais (para o Luis aprovar os textos)</h1>
<p>Dados de exemplo [TESTE]. Nenhum e-mail foi enviado. Os de 1 a 7 (rodada 1) estão na mesma pasta.</p><ol start="8">${rows.join("\n")}</ol></body>`,
  "utf8"
);

console.log(`ok: ${mails.length} prévias em ${out}`);
