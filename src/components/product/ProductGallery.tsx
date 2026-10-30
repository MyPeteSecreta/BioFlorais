"use client";

import Image from "next/image";
import {
  useEffect,
  useState,
} from "react";

interface Props {
  images: string[];
  productName: string;
}

export default function ProductGallery({
  images,
  productName,
}: Props) {
  const validImages =
    images.filter(Boolean);

  const [
    selected,
    setSelected,
  ] =
    useState(
      validImages[0] ?? ""
    );

  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (!zoom) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoom(false);
    };

    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [zoom]);

  useEffect(() => {
    setSelected(
      validImages[0] ?? ""
    );
  }, [
    validImages.join("|"),
  ]);

  if (!selected) {
    return (
      <div
        className="
          flex
          aspect-[4/5]
          items-center
          justify-center
          rounded-[28px]
          bg-transparent
          p-10
          text-center
        "
      >
        <div>
          <div
            className="
              mx-auto
              mb-4
              h-16
              w-16
              rounded-full
              border
              border-[#d9c7dc]
              bg-white
            "
          />

          <p
            className="
              font-bold
              text-[#846d82]
            "
          >
            Foto oficial em preparação
          </p>

          <p
            className="
              mt-2
              text-sm
              text-[#9a8b98]
            "
          >
            A imagem real será inserida nesta galeria.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setZoom(true)}
        aria-label={`Ampliar foto de ${productName}`}
        data-testid="foto-ampliar"
        className="
          relative
          block
          aspect-square
          w-full
          cursor-zoom-in
          overflow-hidden
          rounded-[24px]
          bg-transparent
          sm:aspect-[4/5]
        "
      >
        <span className="absolute bottom-3 right-3 z-10 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-extrabold text-[#55245f] shadow">Toque para ampliar</span>
        <Image
          src={selected}
          alt={productName}
          fill
          priority
          sizes="
            (max-width: 1024px)
            100vw,
            50vw
          "
          className="
            object-contain
            p-2
          "
        />
      </button>

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ampliada de ${productName}`}
          className="fixed inset-0 z-[120] flex flex-col bg-white"
          data-testid="foto-zoom"
        >
          <button type="button" onClick={() => setZoom(false)} aria-label="Fechar foto" className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[#f6eef7] text-2xl font-black text-[#55245f]">
            ×
          </button>
          <div className="relative min-h-0 flex-1 [touch-action:pinch-zoom]">
            <Image src={selected} alt={productName} fill sizes="100vw" className="object-contain p-3" quality={90} />
          </div>
          <p className="py-3 text-center text-xs text-[#746471]">Use dois dedos para aproximar.</p>
        </div>
      )}

      {validImages.length > 1 && (
        <div
          className="
            mt-4
            flex
            gap-3
            overflow-x-auto
            pb-2
          "
        >
          {validImages.map(
            (
              image,
              index
            ) => {
              const active =
                selected === image;

              return (
                <button
                  key={image}
                  type="button"
                  onClick={() =>
                    setSelected(
                      image
                    )
                  }
                  aria-label={
                    `Ver foto ${index + 1} de ${productName}`
                  }
                  className={`
                    relative
                    h-20
                    w-20
                    shrink-0
                    overflow-hidden
                    rounded-[16px]
                    border
                    bg-white
                    transition
                    ${
                      active
                        ? "border-[#63326d] ring-2 ring-[#63326d]/15"
                        : "border-[#e2d6df] hover:border-[#a98cad]"
                    }
                  `}
                >
                  <Image
                    src={image}
                    alt={`${productName} – foto ${index + 1}`}
                    fill
                    sizes="80px"
                    className="
                      object-contain
                      p-1.5
                    "
                  />
                </button>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}




