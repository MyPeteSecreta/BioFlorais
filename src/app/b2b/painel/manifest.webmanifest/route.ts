/**
 * Manifesto do app "Bio Florais Vendas" (painel do vendedor instalável no celular). Público (o navegador busca sem cookie).
 * Escopo /b2b/ para o login e os links de oferta abrirem dentro do app, sem a barra do navegador; abre em /b2b/painel.
 */

export const dynamic = "force-static";

export function GET() {
  const manifest = {
    id: "/b2b/painel",
    name: "Bio Florais Vendas",
    short_name: "Bio Vendas",
    description: "Painel do vendedor Bio Florais: clientes, ofertas, pedidos e materiais de venda.",
    lang: "pt-BR",
    start_url: "/b2b/painel",
    scope: "/b2b/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fffaf6",
    theme_color: "#55245f",
    icons: [
      { src: "/b2b/app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/b2b/app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/b2b/app/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
