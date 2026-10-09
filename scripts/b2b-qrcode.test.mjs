/*
 * QR Code do link da oferta: gerado no navegador (dependência "qrcode"), contém EXATAMENTE a URL
 * do link, sem serviço externo; o botão só existe onde há link ativo e a posse é checada no servidor.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import QRCode from "qrcode";

const { QR_OPTIONS } = await import("../src/lib/b2b/qr-options.ts");
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const URL_OFERTA = "https://www.bioflorais.com.br/b2b/oferta/Zk3-opaco_TOKEN123";

test("o QR contém exatamente a URL opaca do link, nada a mais, com margem branca e alto contraste", async () => {
  const qr = QRCode.create(URL_OFERTA, { errorCorrectionLevel: QR_OPTIONS.errorCorrectionLevel });
  const payload = qr.segments.map((segment) => Buffer.from(segment.data).toString("utf8")).join("");
  assert.equal(payload, URL_OFERTA);
  assert.ok(QR_OPTIONS.margin >= 4, "quiet zone de pelo menos 4 módulos");
  assert.deepEqual([QR_OPTIONS.color.dark, QR_OPTIONS.color.light], ["#000000", "#ffffff"]);

  const dataUrl = await QRCode.toDataURL(URL_OFERTA, QR_OPTIONS);
  assert.match(dataUrl, /^data:image\/png;base64,/);
  assert.notEqual(dataUrl, await QRCode.toDataURL(`${URL_OFERTA}x`, QR_OPTIONS));
});

test("tela do QR: tela cheia branca, logo + 'Olá, <cliente>!', instrução, baixar imagem e fechar; sem serviço externo", () => {
  const modal = read("src/components/b2b/QrCodeModal.tsx");
  assert.ok(modal.includes("fixed inset-0") && modal.includes("bg-white"));
  assert.ok(modal.includes("w-[78vw]"), "no mínimo 70% da largura no celular");
  assert.ok(modal.includes("Bio Florais") && modal.includes("Olá, ${name}!"));
  assert.ok(modal.includes("Aponte a câmera do seu celular para abrir sua loja personalizada."));
  assert.ok(modal.includes("Baixar imagem") && modal.includes("Fechar") && modal.includes("download="));
  assert.ok(!/https?:\/\/(?!www\.w3)/.test(modal.replace(/\/\/ eslint.*/g, "")), "nenhuma URL externa");
  assert.ok(!/fetch\(|navigator\.(mediaDevices|wakeLock|geolocation)/.test(modal), "sem rede e sem permissões");
});

test("botão 'Mostrar QR Code' na revisão (após gerar o link) e na lista de ofertas com link ativo, só para o dono", () => {
  const panel = read("src/components/b2b/LinkSharePanel.tsx");
  assert.ok(panel.includes("Mostrar QR Code") && panel.includes("<QrCodeModal url={url}"));
  const actions = read("src/components/b2b/OfferLinkActions.tsx");
  const afterActive = actions.slice(actions.indexOf("{hasActiveLink && ("));
  assert.ok(afterActive.indexOf("Mostrar QR Code") > 0, "dentro do bloco de link ativo");
  assert.ok(actions.includes("/api/b2b/offers/link?offerId="), "a URL vem da rota que checa a posse");
  assert.ok(actions.includes("setQrUrl(data.url)"));
  assert.ok(read("src/app/b2b/painel/cliente/[clientId]/page.tsx").includes("!offer.revokedAt"), "oferta revogada não mostra");
  const route = read("src/app/api/b2b/offers/link/route.ts");
  assert.ok(route.includes("findOwnedOffer") && route.includes("requireResponsible"));
  assert.ok(read("src/app/b2b/painel/cliente/[clientId]/oferta/revisao/page.tsx").includes("clientName={client.displayName}"));
});
