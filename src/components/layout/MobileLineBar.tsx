import Link from "next/link";

const lines = [
  {
    "name": "Adulto",
    "href": "/linha/adulto"
  },
  {
    "name": "Pet",
    "href": "/linha/pet"
  },
  {
    "name": "Infantil",
    "href": "/linha/infantil"
  },
  {
    "name": "Baby",
    "href": "/linha/baby"
  },
  {
    "name": "Kids",
    "href": "/linha/kids"
  },
  {
    "name": "Teen",
    "href": "/linha/teen"
  },
  {
    "name": "Dose Unica",
    "href": "/linha/dose-unica"
  },
  {
    "name": "Virtudes",
    "href": "/linha/virtudes-divinas"
  },
  {
    "name": "Cosmeticos",
    "href": "/linha/cosmeticos"
  },
  {
    "name": "Cosmeticos Pet",
    "href": "/linha/cosmeticos-pet"
  },
  {
    "name": "Home Care",
    "href": "/linha/home-care"
  }
];

export default function MobileLineBar() {
  return (
    <nav
      aria-label="Linhas Bio Florais"
      className="
        fixed
        inset-x-0
        bottom-0
        z-[60]
        border-t
        border-[#eadfd9]
        bg-[#fffaf6]/95
        px-2
        pb-[max(6px,env(safe-area-inset-bottom))]
        pt-1.5
        shadow-[0_-5px_20px_rgba(66,35,71,0.08)]
        backdrop-blur
        md:hidden
      "
    >
      <div
        className="
          flex
          items-center
          gap-1.5
          overflow-x-auto
          overscroll-x-contain
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        {lines.map((line) => (
          <Link
            key={line.href}
            href={line.href}
            className="
              shrink-0
              rounded-full
              border
              border-[#e4d6df]
              bg-white
              px-3
              py-1.5
              text-[10px]
              font-bold
              leading-none
              text-[#63326d]
              shadow-sm
              transition
              active:scale-95
            "
          >
            {line.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
