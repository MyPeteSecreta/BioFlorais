/**
 * PDF DA OFERTA DO LOJISTA (item 14b da LISTA_UM_A_UM, 11/11): o vendedor/admin gera o link e baixa o PDF da oferta.
 * Visual copiado do padrão aprovado pelo Luis (PROMPTS_B2B/apresentacoes/oferta_popular_pet/montar.js; CSS em offer-pdf-css.ts).
 * Páginas: capa · promoções (preço lojista, com a promoção = preço médio por unidade contando as grátis, sugerido, exemplo e margem)
 * · display (só se alguma linha da oferta tem display) · tabela de TODAS as linhas · condições (parâmetros do sistema) · final.
 * Todos os botões são links para a oferta do cliente. Nunca mais de 2 casas decimais em R$ e %.
 * Função PURA (HTML pronto): a rota /b2b/oferta/[token]/pdf monta os dados da oferta e devolve esta página, que abre a impressão
 * ("Salvar como PDF"). Para portar a My Pet e a Secreta: este arquivo + offer-pdf-css.ts + a rota; mudam marca, textos e dados.
 */

import { OFFER_PDF_CSS } from "@/lib/b2b/offer-pdf-css";

export type OfferPdfPromotion = {
  /** "Compre 2 e leve +2 grátis" / "10% de desconto". */
  buyQuantity: number;
  freeQuantity: number;
  /** Percentual (ex.: 10 = 10%); null = bonificação. */
  percent: number | null;
  usesRemaining: number | null;
  validUntil: Date | null;
  /** "Oferta válida para o Spray para Hálito – Menta" (promoção só em alguns produtos). */
  scopeText: string | null;
  /** Promoção de UM produto: o card usa o nome e a foto dele (como no modelo). */
  productName?: string | null;
  productImage?: string | null;
  /** Preços dos produtos que a promoção cobre (B2B e consumidor), para a conta. */
  b2bMinCents: number;
  consumerMinCents: number | null;
};

export type OfferPdfLine = {
  name: string;
  slug: string;
  /** Caminho público da foto (a mesma do card da oferta). */
  image: string | null;
  productCount: number;
  b2bMinCents: number | null;
  b2bMaxCents: number | null;
  consumerMinCents: number | null;
  consumerMaxCents: number | null;
  promotion: OfferPdfPromotion | null;
  hasDisplay: boolean;
};

export type OfferPdfData = {
  brand: string;
  siteUrl: string;
  offerUrl: string;
  clientName: string;
  sellerName: string;
  lead: string;
  lines: OfferPdfLine[];
  /** Foto de display (opcional) para a página do display. */
  displayPhoto: string | null;
  conditions: { pixPercent: number; cardPercent: number; maxInstallments: number; minInstallmentCents: number; boletoDays: readonly number[]; freeFreightCents: number; minOrderCents: number };
};

/** Texto do WhatsApp/e-mail que vai junto do link (LISTA_UM_A_UM, aprovado pelo Luis). */
export const OFFER_SHARE_TEXT =
  "Veja aqui a oferta especial que elaboramos para você. No link a seguir você faz o seu pedido direto e ainda paga com desconto no Pix e no cartão, ou no boleto em até 3x.";

const r2 = (value: number) => Math.round(value * 100) / 100;
export const brl = (cents: number) =>
  `R$ ${r2(cents / 100)
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
const pct = (value: number) => `${String(r2(value)).replace(".", ",")}%`;
const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const range = (min: number | null, max: number | null) => (min === null ? "—" : max !== null && max !== min ? `${brl(min)} a ${brl(max)}` : brl(min));

export function promotionRule(promotion: Pick<OfferPdfPromotion, "buyQuantity" | "freeQuantity" | "percent">): string {
  if (promotion.percent !== null) return `${pct(promotion.percent)} de desconto`;

  return `Compre ${promotion.buyQuantity} e leve +${promotion.freeQuantity} grátis`;
}

/** Preço médio por unidade com a promoção (as grátis entram na conta), em centavos. */
export function promotionUnitCents(promotion: Pick<OfferPdfPromotion, "buyQuantity" | "freeQuantity" | "percent">, b2bCents: number): number {
  if (promotion.percent !== null) return Math.round(b2bCents * (1 - promotion.percent / 100));

  const take = promotion.buyQuantity + promotion.freeQuantity;

  return take > 0 ? Math.round((b2bCents * promotion.buyQuantity) / take) : b2bCents;
}

function promotionExample(promotion: OfferPdfPromotion): string {
  if (promotion.percent !== null) {
    const units = 12;
    const saved = units * (promotion.b2bMinCents - promotionUnitCents(promotion, promotion.b2bMinCents));
    return `Em ${units} unidades, ${brl(saved)} de economia`;
  }

  return `Pague ${promotion.buyQuantity * 3} e leve ${(promotion.buyQuantity + promotion.freeQuantity) * 3}`;
}

function promotionNote(line: OfferPdfLine): string {
  const promotion = line.promotion!;
  const parts = [`${line.productCount} ${line.productCount === 1 ? "produto" : "produtos"}`];

  if (promotion.productName) parts[0] = line.name;
  else if (promotion.scopeText) parts.push(`Oferta válida para ${promotion.scopeText}`);
  if (promotion.usesRemaining !== null) parts.push(`vale nas suas próximas ${promotion.usesRemaining} ${promotion.usesRemaining === 1 ? "compra" : "compras"}`);
  else if (promotion.validUntil) parts.push(`válida até ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(promotion.validUntil)}`);

  return parts.join(" · ");
}

const image = (data: OfferPdfData, path: string | null) => (path ? (path.startsWith("http") ? path : `${data.siteUrl.replace(/\/+$/, "")}${path}`) : null);

export function buildOfferPdfHtml(data: OfferPdfData, options: { autoPrint?: boolean } = {}): string {
  const promos = data.lines.filter((line) => line.promotion);
  const displays = data.lines.filter((line) => line.hasDisplay);
  const cols = promos.length > 3 ? 3 : Math.max(1, promos.length);
  const button = (text = "Fazer meu pedido agora", href = data.offerUrl) => `<a class="btn" href="${esc(href)}">${esc(text)} →</a>`;
  let page = 1;
  const footer = () => `<div class="rodape"><span>Oferta ${esc(data.brand)} · ${esc(data.clientName)}</span><span>${page++}</span></div>`;
  const mosaic = data.lines
    .map((line) => image(data, line.image))
    .filter((src): src is string => Boolean(src))
    .slice(0, 4);
  const c = data.conditions;

  const promoCards = promos
    .map((line) => {
      const promotion = line.promotion!;
      const unit = promotionUnitCents(promotion, promotion.b2bMinCents);
      const consumer = promotion.consumerMinCents;
      const src = image(data, promotion.productImage ?? line.image);
      const title = promotion.productName ?? line.name;

      return `<div class="promo">${src ? `<img src="${esc(src)}" alt="">` : ""}<div class="in">
    <span class="regra">${esc(promotionRule(promotion))}</span><h3>${esc(title)}</h3><div class="obs">${esc(promotionNote(line))}</div>
    <div class="pp"><div><small>Preço lojista</small><b>${brl(promotion.b2bMinCents)}</b><small>por unidade</small></div>
    <div class="pr"><small>Com a promoção</small><b>${brl(unit)}</b><small>por unidade</small></div>
    <div><small>Sugerido ao consumidor</small><b>${consumer ? brl(consumer) : "—"}</b><small>por unidade</small></div></div>
    <div class="ex">Exemplo: ${esc(promotionExample(promotion))}.${consumer ? ` Vendendo a ${brl(consumer)}, cada unidade rende ${brl(consumer - unit)} de margem.` : ""}</div>
  </div></div>`;
    })
    .join("");

  const rows = data.lines
    .map((line) => {
      const promo = line.promotion && line.b2bMinCents !== null ? `${brl(promotionUnitCents(line.promotion, line.promotion.b2bMinCents))} · ${esc(promotionRule(line.promotion))}` : "—";
      return `<tr><td><b>${esc(line.name)}</b><br><span>${line.productCount} ${line.productCount === 1 ? "produto" : "produtos"}</span></td><td class="n">${range(line.b2bMinCents, line.b2bMaxCents)}</td><td class="n ${line.promotion ? "pr" : ""}">${promo}</td><td class="n">${range(line.consumerMinCents, line.consumerMaxCents)}</td></tr>`;
    })
    .join("");

  const displayPage = () =>
    displays.length
    ? `
<section class="pg">
  <div class="kick">Destaque no balcão</div>
  <h2>Kit com display</h2>
  <div class="disp">${image(data, data.displayPhoto) ? `<img src="${esc(image(data, data.displayPhoto)!)}" alt="">` : ""}
    <div><p class="lead" style="margin-bottom:3mm">O display vai de brinde no kit e ajuda o produto a vender sozinho no balcão. Linhas desta oferta com display: ${esc(displays.map((line) => line.name).join(", "))}.</p>
    <div style="margin-top:4mm">${button("Quero o kit com display", `${data.offerUrl}/linha/${encodeURIComponent(displays[0].slug)}`)}</div></div>
  </div>
  ${footer()}
</section>`
    : "";

  const boletoDays = c.boletoDays.join("/");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Oferta ${esc(data.brand)} · ${esc(data.clientName)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${OFFER_PDF_CSS}</style>
<style>.promos{grid-template-columns:repeat(${cols},1fr)!important;gap:4mm!important}
.promo img{height:${promos.length > 3 ? 20 : 50}mm!important;object-fit:contain!important;background:#fff}
.promo .in{padding:${promos.length > 3 ? "2.5mm 4mm" : "4mm 5mm"}!important}.promo h3{font-size:${promos.length > 3 ? 13 : 17}pt!important}
.pp div{min-height:${promos.length > 3 ? 14 : 19}mm!important}.pp b{font-size:11pt!important}.pp .pr b{font-size:12pt!important}
.ex{font-size:7.6pt!important;margin-top:1.5mm!important}.pp{margin-top:2mm!important}.mos img{aspect-ratio:16/9;object-fit:contain;background:#fff}td{padding:1.6mm 3mm}
@media screen{body{background:#ddd}.pg{margin:6mm auto;box-shadow:0 1mm 4mm #0003}}</style></head><body>

<section class="pg capa">
  <div>
    <div class="kick">Oferta exclusiva · ${esc(data.brand)}</div>
    <h1>Uma oferta especial para<br><span style="color:var(--ouro)">${esc(data.clientName)}</span></h1>
    <span class="selo">Promoções escolhidas para a sua loja</span>
    <p class="lead">${esc(data.lead)} Toque no botão para ver os produtos e fazer o seu pedido.</p>
    ${button()}
  </div>
  <div class="mos">${mosaic.map((src) => `<img src="${esc(src)}" alt="">`).join("")}</div>
  <div class="rodape"><span>${esc(data.brand)} · atendimento: ${esc(data.sellerName)}</span><span>${page++}</span></div>
</section>
${
  promos.length
    ? `
<section class="pg">
  <div class="kick">Suas promoções</div>
  <h2>O que preparamos para você</h2>
  <div class="promos">${promoCards}</div>
  <p class="nota">A promoção vale por produto. "Com a promoção" é o preço médio por unidade, já contando as grátis.</p>
  ${footer()}
</section>`
    : ""
}${displayPage()}

<section class="pg">
  <div class="kick">Tabela de preços</div>
  <h2>Todas as linhas da sua oferta</h2>
  <table><thead><tr><th>Linha</th><th>Preço lojista</th><th>Com a promoção<br><small>preço médio por unidade</small></th><th>Sugerido ao consumidor</th></tr></thead><tbody>
  ${rows}
  </tbody></table>
  <p class="nota">Preços por unidade. Nas faixas, o menor e o maior preço da linha.</p>
  ${footer()}
</section>

<section class="pg">
  <div class="kick">Condições do pedido</div>
  <h2>Como comprar</h2>
  <div class="cond">
    <div class="box v"><div class="big">${pct(c.pixPercent)}</div><p><b>de desconto no Pix</b>, depois das promoções.</p></div>
    <div class="box"><div class="big">${c.maxInstallments}x</div><p><b>Cartão em até ${c.maxInstallments}x</b> com ${pct(c.cardPercent)} de desconto. Parcela mínima de ${brl(c.minInstallmentCents)}.</p></div>
    <div class="box o"><div class="big">${boletoDays}</div><p><b>Boleto (só CNPJ)</b> em até ${c.boletoDays.length}x. Parcela mínima de ${brl(c.minInstallmentCents)}.</p></div>
    <div class="box a"><div class="big">${brl(c.freeFreightCents).replace(",00", "")}</div><p><b>Frete grátis</b> a partir de ${brl(c.freeFreightCents)} na opção econômica. Pedido mínimo de ${brl(c.minOrderCents)}.</p></div>
  </div>
  <p class="lead">No link você escolhe os produtos, vê o total com as promoções já aplicadas e acompanha os seus pedidos.</p>
  ${button()}
  ${footer()}
</section>

<section class="pg fim">
  <div class="kick" style="color:#f1d48a">${esc(data.brand)} · oferta para ${esc(data.clientName)}</div>
  <h1>Sua oferta está pronta. É só tocar e fazer o pedido.</h1>
  <p>Dúvidas ou um pedido maior? Fale com o seu representante: para clientes especiais, estamos abertos a negociações especiais.</p>
  <div>${button("Abrir a minha oferta")}</div>
</section>
${options.autoPrint ? `<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},600)})</script>` : ""}
</body></html>`;
}
