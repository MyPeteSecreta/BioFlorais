import type { Metadata } from "next";
import type { ReactNode } from "react";

import { B2BCartProvider } from "@/lib/b2b/cart-context";

export const metadata: Metadata = {
  title: "Bio Florais | Área B2B",
  robots: { index: false, follow: false },
};

export default function B2BLayout({ children }: { children: ReactNode }) {
  return <B2BCartProvider>{children}</B2BCartProvider>;
}
