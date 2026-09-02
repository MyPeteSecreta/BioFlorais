import {
  NextRequest,
  NextResponse,
} from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  integrationCredentials,
} from "@/lib/db/schema";

const MELHOR_ENVIO_BASE_URL =
  process.env.MELHORENVIO_SANDBOX === "true"
    ? "https://sandbox.melhorenvio.com.br"
    : "https://melhorenvio.com.br";

function getRedirectUri() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(
      /\/$/,
      ""
    );

  if (!siteUrl) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL não configurada."
    );
  }

  return `${siteUrl}/api/shipping/melhorenvio/callback`;
}

type MelhorEnvioTokenResponse = {
  token_type?: string;
  expires_in?: number;
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
  message?: string;
};

export async function GET(
  request: NextRequest
) {
  try {
    const code =
      request.nextUrl.searchParams.get(
        "code"
      );

    const returnedState =
      request.nextUrl.searchParams.get(
        "state"
      );

    if (!code) {
      return NextResponse.json(
        {
          error:
            "O Melhor Envio não retornou o código de autorização.",
        },
        { status: 400 }
      );
    }

    if (
      returnedState !==
      "bioflorais-shipping"
    ) {
      return NextResponse.json(
        {
          error:
            "State inválido no retorno do Melhor Envio.",
        },
        { status: 400 }
      );
    }

    const clientId =
      process.env.MELHORENVIO_CLIENT_ID;

    const clientSecret =
      process.env.MELHORENVIO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          error:
            "Client ID ou Client Secret do Melhor Envio não configurados.",
        },
        { status: 500 }
      );
    }

    const body =
      new URLSearchParams({
        grant_type:
          "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getRedirectUri(),
        code,
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
            process.env.MELHORENVIO_USER_AGENT ??
            "Bio Florais (luiscilento@angelblanc.com)",
        },
        body: body.toString(),
        cache: "no-store",
      }
    );

    const data =
      (await response.json()) as
        MelhorEnvioTokenResponse;

    if (
      !response.ok ||
      !data.access_token ||
      !data.refresh_token
    ) {
      return NextResponse.json(
        {
          error:
            "Não foi possível gerar os tokens do Melhor Envio.",
          details: {
            status: response.status,
            error:
              data.error ?? null,
            description:
              data.error_description ??
              data.message ??
              null,
          },
        },
        { status: 500 }
      );
    }

    const expiresInSeconds =
      data.expires_in ?? 2592000;

    const accessTokenExpiresAt =
      new Date(
        Date.now() +
          expiresInSeconds * 1000
      );

    const existing = await db
      .select({
        id:
          integrationCredentials.id,
      })
      .from(integrationCredentials)
      .where(
        eq(
          integrationCredentials.provider,
          "melhorenvio"
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(
          integrationCredentials
        )
        .set({
          accessToken:
            data.access_token,
          refreshToken:
            data.refresh_token,
          accessTokenExpiresAt,
          updatedAt: new Date(),
        })
        .where(
          eq(
            integrationCredentials.provider,
            "melhorenvio"
          )
        );
    } else {
      await db
        .insert(
          integrationCredentials
        )
        .values({
          provider:
            "melhorenvio",
          accessToken:
            data.access_token,
          refreshToken:
            data.refresh_token,
          accessTokenExpiresAt,
          updatedAt: new Date(),
        });
    }

    return NextResponse.json({
      success: true,
      message:
        "Autorização do Melhor Envio concluída e tokens salvos com sucesso.",
      expiresAt:
        accessTokenExpiresAt.toISOString(),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          "Não foi possível concluir a autorização do Melhor Envio.",
      },
      { status: 500 }
    );
  }
}


