import AdminB2BTabs from "@/components/admin/b2b/AdminB2BTabs";

export const dynamic = "force-dynamic";

export default function AdminB2BPage() {
  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10">
      <h1 className="text-2xl font-extrabold text-[#342737]">B2B</h1>
      <p className="mt-1 text-sm text-[#7b6a77]">
        Vendedores e RCAs, linhas comerciais, promoções e acompanhamento.
      </p>
      <AdminB2BTabs />
    </main>
  );
}
