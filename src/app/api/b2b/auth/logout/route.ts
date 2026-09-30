import { NextResponse } from "next/server";

import { B2B_SESSION_COOKIE } from "@/lib/b2b/responsible-session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(B2B_SESSION_COOKIE);
  return response;
}
