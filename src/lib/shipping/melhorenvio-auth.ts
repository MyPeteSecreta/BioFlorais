import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { integrationCredentials } from "@/lib/db/schema";

const MELHOR_ENVIO_BASE_URL =
  process.env.MELHORENVIO_SANDBOX === "true"
    ? "https://sandbox.melhorenvio.com.br"
    : "https://melhorenvio.com.br";

type MelhorEnvioTokenResponse = {
  token_type?: string;
  expires_in?: number;
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
  message?: string;
};

async function refreshMelhorEnvioToken(
  refreshToken: string
): Promise<string> {
  const clientId = process.env.MELHORENVIO_CLIENT_ID;
  const clientSecret = process.env.MELHORENVIO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "MELHORENVIO_CLIENT_ID ou MELHORENVIO_CLIENT_SECRET não configurado."
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(
    `${MELHOR_ENVIO_BASE_URL}/oauth/token`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type":
          "application/x-www-form-urlencoded",
        "User-Agent":
          process.env.MELHORENVIO_USER_AGENT ||
          "Bio Florais",
      },
      body: body.toString(),
      cache: "no-store",
    }
  );

  const data =
    (await response.json()) as MelhorEnvioTokenResponse;

  if (
    !response.ok ||
    !data.access_token ||
    !data.refresh_token
  ) {
    throw new Error(
      `Falha ao renovar token do Melhor Envio: ${
        data.error_description ??
        data.message ??
        data.error ??
        response.status
      }`
    );
  }

  const expiresInSeconds =
    data.expires_in ?? 2592000;

  const accessTokenExpiresAt = new Date(
    Date.now() + expiresInSeconds * 1000
  );

  await db
    .update(integrationCredentials)
    .set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      accessTokenExpiresAt,
      updatedAt: new Date(),
    })
    .where(
      eq(
        integrationCredentials.provider,
        "melhorenvio"
      )
    );

  return data.access_token;
}

export async function getValidMelhorEnvioToken(): Promise<string> {
  const rows = await db
    .select()
    .from(integrationCredentials)
    .where(
      eq(
        integrationCredentials.provider,
        "melhorenvio"
      )
    )
    .limit(1);

  const credential = rows[0];

  if (!credential) {
    throw new Error(
      "Credenciais do Melhor Envio não encontradas. Autorize o aplicativo novamente."
    );
  }

  /*
   * Renova 24 horas antes do vencimento.
   * Isso evita que uma compra comece com um token
   * que expire durante o fluxo.
   */
  const refreshBefore = new Date(
    Date.now() + 24 * 60 * 60 * 1000
  );

  if (
    credential.accessTokenExpiresAt >
    refreshBefore
  ) {
    return credential.accessToken;
  }

  return refreshMelhorEnvioToken(
    credential.refreshToken
  );
}

