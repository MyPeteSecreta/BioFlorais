// OAuth do Melhor Envio: sessão do admin + state aleatório em cookie.
// Chama as rotas REAIS (sem rede: o callback para antes da troca do code
// porque MELHORENVIO_CLIENT_SECRET não está definido no teste).
// Rodar: npm test
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

process.env.ADMIN_SESSION_SECRET = "segredo-de-teste";
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test_placeholder";
process.env.NEXT_PUBLIC_SITE_URL = "https://loja.exemplo.test";
process.env.MELHORENVIO_CLIENT_ID = "client-id-teste";
delete process.env.MELHORENVIO_CLIENT_SECRET;

const { NextRequest } = await import("next/server.js");
const authorize = await import("../src/app/api/shipping/melhorenvio/authorize/route.ts");
const callback = await import("../src/app/api/shipping/melhorenvio/callback/route.ts");
const stateLib = await import("../src/lib/shipping/melhorenvio-oauth-state.ts");

const adminCookie = `mypeteme_admin_session=${createHmac("sha256", "segredo-de-teste").update("mypeteme-admin").digest("hex")}`;

function request(path, cookie) {
  return new NextRequest(`https://loja.exemplo.test${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

function stateCookieFrom(response) {
  const header = response.headers.get("set-cookie") ?? "";
  return header.match(/bioflorais_me_oauth_state=([^;]*)/)?.[1] ?? null;
}

test("authorize sem sessão do admin: 401, sem redirecionar", async () => {
  const response = await authorize.GET(request("/api/shipping/melhorenvio/authorize"));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("location"), null);
});

test("authorize com admin: state aleatório na URL e no cookie httpOnly do callback", async () => {
  const first = await authorize.GET(request("/api/shipping/melhorenvio/authorize", adminCookie));
  const second = await authorize.GET(request("/api/shipping/melhorenvio/authorize", adminCookie));

  assert.equal(first.status, 307);
  const location = new URL(first.headers.get("location"));
  const state = location.searchParams.get("state");

  assert.notEqual(state, "bioflorais-shipping");
  assert.equal(Buffer.from(state, "base64url").length, 32);
  assert.equal(stateCookieFrom(first), state);

  const setCookie = first.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Path=\/api\/shipping\/melhorenvio\/callback/i);
  assert.match(setCookie, /SameSite=lax/i);

  // Cada início de fluxo gera um state diferente.
  assert.notEqual(new URL(second.headers.get("location")).searchParams.get("state"), state);
});

test("callback sem sessão do admin: 401 (não grava credencial)", async () => {
  const response = await callback.GET(
    request("/api/shipping/melhorenvio/callback?code=abc&state=x", "bioflorais_me_oauth_state=x")
  );
  assert.equal(response.status, 401);
});

test("callback com state antigo fixo, diferente do cookie ou sem cookie: 400", async () => {
  const valid = stateLib.createMelhorEnvioOAuthState();

  for (const [state, cookieState] of [
    ["bioflorais-shipping", valid],
    [stateLib.createMelhorEnvioOAuthState(), valid],
    [valid, null],
  ]) {
    const cookie = cookieState ? `${adminCookie}; bioflorais_me_oauth_state=${cookieState}` : adminCookie;
    const response = await callback.GET(
      request(`/api/shipping/melhorenvio/callback?code=abc&state=${state}`, cookie)
    );

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /State inválido/);
    // Cookie de uso único é apagado.
    assert.match(response.headers.get("set-cookie") ?? "", /bioflorais_me_oauth_state=;.*Max-Age=0/i);
  }
});

test("callback com admin e state igual ao do cookie passa da checagem", async () => {
  const state = stateLib.createMelhorEnvioOAuthState();
  const response = await callback.GET(
    request(
      `/api/shipping/melhorenvio/callback?code=abc&state=${state}`,
      `${adminCookie}; bioflorais_me_oauth_state=${state}`
    )
  );

  // Para no passo seguinte (secret ausente no teste) — prova que o state foi aceito.
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /Client Secret/);
});

test("helper: compara em tempo constante e exige state forte", () => {
  const state = stateLib.createMelhorEnvioOAuthState();
  assert.equal(stateLib.isValidMelhorEnvioOAuthState(state, state), true);
  assert.equal(stateLib.isValidMelhorEnvioOAuthState("curto", "curto"), false);
  assert.equal(stateLib.isValidMelhorEnvioOAuthState(state, null), false);
  assert.equal(stateLib.isValidMelhorEnvioOAuthState(undefined, state), false);
});
