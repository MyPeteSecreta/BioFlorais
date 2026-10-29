/**
 * Service worker do app "Bio Florais Vendas" (escopo /b2b/). Existe para o navegador oferecer a instalação e para mostrar uma
 * tela simples quando não há internet. NÃO guarda nada em cache: o painel tem dados de clientes e preços, que sempre vêm da rede.
 */

export const dynamic = "force-static";

const OFFLINE_HTML =
  '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem conexão</title></head>' +
  '<body style="margin:0;font-family:system-ui,sans-serif;background:#fffaf6;color:#422347;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px">' +
  '<div><h1 style="color:#55245f;font-size:22px">Sem conexão</h1><p>O painel precisa de internet para mostrar seus clientes e pedidos. Conecte-se e tente de novo.</p>' +
  '<button onclick="location.reload()" style="margin-top:12px;background:#55245f;color:#fff;border:0;border-radius:999px;padding:12px 24px;font-weight:700">Tentar de novo</button></div></body></html>';

const SCRIPT = `
const OFFLINE_HTML = ${JSON.stringify(OFFLINE_HTML)};

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Service-Worker-Allowed": "/b2b/",
    },
  });
}
