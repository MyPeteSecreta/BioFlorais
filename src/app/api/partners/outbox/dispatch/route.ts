import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  dispatchPartnerOutbox,
} from "@/lib/partners/outbox";

export async function POST(
  request: NextRequest
) {
  const configuredSecret =
    process.env.PARTNER_OUTBOX_DISPATCH_SECRET?.trim();

  const providedSecret =
    request.headers
      .get("x-partner-outbox-secret")
      ?.trim();

  if (
    !configuredSecret ||
    !providedSecret ||
    providedSecret !== configuredSecret
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const result =
      await dispatchPartnerOutbox(10);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Erro ao processar Partner outbox:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Falha ao processar Partner outbox.",
      },
      {
        status: 500,
      }
    );
  }
}
