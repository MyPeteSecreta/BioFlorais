/*
 * HARNESS LOCAL (só desenvolvimento): carregado com NODE_OPTIONS=--require. Redireciona o fetch do driver do Neon para o
 * proxy local (PGlite) e responde Melhor Envio, ViaCEP e Resend com dados de teste (o "e-mail" vai para HARNESS_MAIL_LOG).
 * Nada sai da máquina.
 */

const fs = require("node:fs");
const realFetch = globalThis.fetch;
const proxy = process.env.HARNESS_SQL_URL || "http://127.0.0.1:5999/sql";

globalThis.fetch = async function patchedFetch(input, init) {
  const url = typeof input === "string" ? input : input && input.url ? input.url : String(input);

  if (/^https:\/\/[^/]+\/sql$/.test(url)) return realFetch(proxy, init);

  if (url.includes("melhorenvio.com.br/api/v2/me/shipment/calculate")) {
    return new Response(
      JSON.stringify([
        { id: 1, name: "PAC", price: "45.00", delivery_time: 6, company: { name: "Correios" } },
        { id: 2, name: "SEDEX", price: "62.50", delivery_time: 2, company: { name: "Correios" } },
      ]),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (url.includes("viacep.com.br/ws/")) {
    return new Response(JSON.stringify({ cep: "01310-100", logradouro: "Avenida Paulista", bairro: "Bela Vista", localidade: "São Paulo", uf: "SP" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.includes("api.mercadopago.com/v1/orders")) {
    // Registra o valor enviado ao Mercado Pago (conferência do Pix com desconto) e devolve um Pix de teste.
    if (process.env.HARNESS_MP_LOG) fs.appendFileSync(process.env.HARNESS_MP_LOG, `${init && init.body ? init.body : ""}
`);

    return new Response(
      JSON.stringify({
        id: "ORD-harness-1",
        status: "action_required",
        transactions: { payments: [{ id: "PAY-harness-1", status: "action_required", payment_method: { id: "pix", type: "bank_transfer", qr_code: "00020126HARNESS", qr_code_base64: "", ticket_url: "https://example.test/pix" } }] },
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  }

  if (url.includes("api.resend.com/emails")) {
    if (process.env.HARNESS_MAIL_LOG) fs.appendFileSync(process.env.HARNESS_MAIL_LOG, `${init && init.body ? init.body : ""}\n`);

    return new Response(JSON.stringify({ id: "harness-email" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  return realFetch(input, init);
};
