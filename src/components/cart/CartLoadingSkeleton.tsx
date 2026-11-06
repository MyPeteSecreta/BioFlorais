/**
 * Esqueleto enquanto a sacola é lida do navegador (localStorage). A página chega do servidor sem a sacola: antes disto,
 * o /checkout e o /carrinho mostravam "Sua sacola está vazia" por ~1 s no celular, até o JavaScript carregar (06/11).
 * Nunca mostrar "sacola vazia" antes de terminar de ler a sacola.
 */

const bar = "animate-pulse rounded-2xl bg-[#26352c]/[0.07]";

export default function CartLoadingSkeleton({ variant }: { variant: "checkout" | "cart" }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_380px]" data-testid="sacola-carregando" aria-busy="true">
      <span className="sr-only" role="status">
        Carregando sua sacola...
      </span>

      <div className="space-y-4" aria-hidden="true">
        {variant === "checkout" ? (
          <section className="space-y-4 rounded-[28px] border border-[#26352c]/10 bg-white p-6">
            <div className={`${bar} h-5 w-40`} />
            <div className={`${bar} h-12`} />
            <div className={`${bar} h-12`} />
            <div className={`${bar} h-12`} />
            <div className={`${bar} mt-6 h-5 w-48`} />
            <div className={`${bar} h-12`} />
            <div className={`${bar} h-12`} />
          </section>
        ) : (
          [0, 1].map((key) => (
            <section key={key} className="flex gap-4 rounded-[28px] border border-[#26352c]/10 bg-white p-5">
              <div className={`${bar} h-20 w-20 shrink-0`} />
              <div className="flex-1 space-y-3">
                <div className={`${bar} h-4 w-3/4`} />
                <div className={`${bar} h-4 w-1/3`} />
                <div className={`${bar} h-9 w-28`} />
              </div>
            </section>
          ))
        )}
      </div>

      <aside className="h-fit space-y-3 rounded-[28px] border border-[#26352c]/10 bg-white p-6" aria-hidden="true">
        <div className={`${bar} h-5 w-32`} />
        <div className={`${bar} h-4`} />
        <div className={`${bar} h-4`} />
        <div className={`${bar} h-4 w-2/3`} />
        <div className={`${bar} mt-4 h-12 rounded-full`} />
      </aside>
    </div>
  );
}
