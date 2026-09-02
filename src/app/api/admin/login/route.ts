import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function createSessionToken() {
  const secret =
    process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    return "";
  }

  return crypto
    .createHmac("sha256", secret)
    .update("mypeteme-admin")
    .digest("hex");
}

export async function POST(
  request: NextRequest
) {
  const {
    password,
  } =
    (await request.json()) as {
      password?: string;
    };

  const expectedPassword =
    process.env.ADMIN_PASSWORD;

  if (
    !expectedPassword ||
    password !== expectedPassword
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Senha inválida.",
      },
      {
        status: 401,
      }
    );
  }

  const session =
    createSessionToken();

  if (!session) {
    return NextResponse.json(
      {
        success: false,
        error:
          "ADMIN_SESSION_SECRET não configurado.",
      },
      {
        status: 500,
      }
    );
  }

  const response =
    NextResponse.json({
      success: true,
    });

  response.cookies.set(
    "mypeteme_admin_session",
    session,
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV ===
        "production",
      path: "/",
      maxAge:
        60 * 60 * 12,
    }
  );

  return response;
}
