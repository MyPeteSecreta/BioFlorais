import Image from "next/image";
import Link from "next/link";

/**
 * Card de linha da página do link do cliente. Mesmo visual do
 * VisualLineCard da Home do B2C (aspect 16/9, mesma arte), reproduzido aqui
 * para não alterar a Home. Destaque = moldura azul + selo da promoção.
 */
export default function B2BLineCard({
  href,
  name,
  image,
  highlight = false,
  badge,
  caption,
}: {
  href: string;
  name: string;
  image: string | null;
  highlight?: boolean;
  badge?: string | null;
  caption?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={`Abrir linha ${name}`}
      className={[
        "group relative block overflow-hidden rounded-[26px] border bg-white shadow-sm transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(61,35,65,0.15)]",
        highlight ? "border-blue-500 ring-[5px] ring-blue-500 ring-offset-2 ring-offset-[#fffaf6]" : "border-[#eadfda]",
      ].join(" ")}
    >
      {badge && (
        <span className="absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)] rounded-full bg-blue-600 px-4 py-2 text-xs font-extrabold leading-snug text-white shadow-lg">
          {badge}
        </span>
      )}

      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#fffaf6]">
        {image ? (
          <Image
            src={image}
            alt={`Bio Florais ${name}`}
            fill
            sizes="(max-width: 900px) 100vw, 50vw"
            className="object-contain bg-[#fffaf6] transition duration-500 ease-out group-hover:scale-[1.012]"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <strong className="font-serif text-3xl text-[#55245f]">{name}</strong>
          </div>
        )}
      </div>

      {caption && <p className="px-4 py-3 text-center text-xs font-semibold text-[#746471]">{caption}</p>}
    </Link>
  );
}
