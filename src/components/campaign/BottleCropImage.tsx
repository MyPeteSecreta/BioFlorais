/**
 * Recorte do frasco por CSS (sem arquivo novo): as fotos do Adulto são cenas com molduras e frases; aqui só o frasco aparece,
 * com as bordas suavizadas por máscara. `crop` = fração visível da largura/altura da foto, centro do frasco e topo do recorte.
 */

import Image from "next/image";

import { ADULT_PHOTO, cropGeometry, type BottleCrop } from "@/lib/campaign/gpt-pages";

export default function BottleCropImage({ src, alt, crop }: { src: string; alt: string; crop: BottleCrop }) {
  const geometry = cropGeometry(crop);

  return (
    <div
      className="relative mx-auto w-full overflow-hidden bg-[#f6efe6]"
      style={{
        aspectRatio: geometry.aspect,
        WebkitMaskImage: "linear-gradient(90deg, transparent 0, #000 14%, #000 86%, transparent 100%)",
        maskImage: "linear-gradient(90deg, transparent 0, #000 14%, #000 86%, transparent 100%)",
      }}
    >
      <Image
        src={src}
        alt={alt}
        width={ADULT_PHOTO.width}
        height={ADULT_PHOTO.height}
        sizes="(max-width: 640px) 100vw, 480px"
        className="absolute max-w-none"
        style={{ width: `${geometry.widthPercent}%`, height: "auto", left: `${geometry.leftPercent}%`, top: `${geometry.topPercent}%` }}
      />
    </div>
  );
}
