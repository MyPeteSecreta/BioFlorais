"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/b2b/auth/logout", { method: "POST" });
        router.replace("/b2b/login");
      }}
      className="font-bold text-[#63326d] underline underline-offset-4"
    >
      Sair
    </button>
  );
}
