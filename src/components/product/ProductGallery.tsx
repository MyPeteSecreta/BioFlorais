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
      <div
        className="
          relative
          aspect-[4/5]
          overflow-hidden
          rounded-[28px]
          bg-transparent
        "
      >
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
      </div>

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
                    alt=""
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




