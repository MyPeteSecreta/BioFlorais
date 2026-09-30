import { Suspense } from "react";

import B2BCartContent from "./B2BCartContent";

export default function B2BCartPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#fffaf6]" />}>
      <B2BCartContent />
    </Suspense>
  );
}
