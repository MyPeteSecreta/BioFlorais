import { NextResponse } from "next/server";

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

export async function GET() {
  try {
    const clientId =
      process.env.MELHORENVIO_CLIENT_ID;

    if (!clientId) {
      return NextResponse.json(
        {
          error:
            "MELHORENVIO_CLIENT_ID não configurado.",
        },
        { status: 500 }
      );
    }

    const params =
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: getRedirectUri(),
        response_type: "code",
        state: "bioflorais-shipping",
        scope: "shipping-calculate",
      });

    const authorizationUrl =
      `${MELHOR_ENVIO_BASE_URL}/oauth/authorize?${params.toString()}`;

    return NextResponse.redirect(
      authorizationUrl
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          "Não foi possível iniciar a autorização do Melhor Envio.",
      },
      { status: 500 }
    );
  }
}


