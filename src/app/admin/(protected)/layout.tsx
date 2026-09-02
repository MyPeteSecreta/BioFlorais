import crypto from "node:crypto";

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function createSessionToken() {
  const secret =
    process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    return "";
  }

  return crypto
    .createHmac(
      "sha256",
      secret
    )
    .update(
      "mypeteme-admin"
    )
    .digest(
      "hex"
    );
}

export default async function ProtectedAdminLayout({
  children,
}: {
  children:
    React.ReactNode;
}) {
  const cookieStore =
    await cookies();

  const session =
    cookieStore.get(
      "mypeteme_admin_session"
    )?.value ?? "";

  const expectedSession =
    createSessionToken();

  if (
    !session ||
    !expectedSession ||
    session !==
      expectedSession
  ) {
    redirect(
      "/admin/login"
    );
  }

  const centralOmieUrl =
    process.env
      .CENTRAL_OMIE_URL
      ?.trim();

  return (
    <div className="min-h-screen bg-[#fffdf9]">
      <header className="sticky top-0 z-50 border-b border-[#eadfd9] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-3 lg:px-10">
          <div>
            <p className="text-lg font-extrabold text-[#342737]">
              Administração
            </p>

            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#a0742b]">
              Bio Florais
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/pedidos"
              className="rounded-full border border-[#eadfd9] bg-white px-5 py-2.5 text-sm font-extrabold text-[#342737]"
            >
              Pedidos
            </Link>

            {centralOmieUrl ? (
              <a
                href={
                  centralOmieUrl
                }
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-[#342737] px-5 py-2.5 text-sm font-extrabold text-white"
              >
                Central Omie
              </a>
            ) : (
              <span
                className="rounded-full bg-[#e8e0e5] px-5 py-2.5 text-sm font-extrabold text-[#8f7d8b]"
                title="CENTRAL_OMIE_URL ainda não configurada"
              >
                Central Omie
              </span>
            )}

            <Link
              href="/"
              target="_blank"
              className="rounded-full border border-[#eadfd9] bg-[#fff8f3] px-5 py-2.5 text-sm font-bold text-[#7b5a63]"
            >
              Ver site
            </Link>
          </nav>
        </div>
      </header>

      {children}
    </div>
  );
}
