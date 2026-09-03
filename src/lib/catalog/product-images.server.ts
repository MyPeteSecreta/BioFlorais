import fs from "node:fs";
import path from "node:path";

import type { BioProduct } from "@/lib/catalog/bio-products";

const productPhysicalRoots: Record<string, string> = {
  adulto: "floral-adulto",
  pet: "floral-pet",
  infantil: "floral-infantil",
  baby: "floral-baby",
  kids: "floral-kids",
  teen: "floral-teen",
  "virtudes-divinas": "floral-virtudes",
  cosmeticos: "cosmeticos-humanos",
  "cosmeticos-pet": "cosmeticos-pet",
  "dose-unica": "dose-unica",
  "home-care": "home-care",
};

function normalizePhysicalName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findProductFolder(product: BioProduct) {
  const root =
    product.lineSlug === "pet" &&
    product.category === "Snack Floral"
      ? "snack-flowers"
      : productPhysicalRoots[product.lineSlug];

  if (!root) return null;

  const rootAbsolute = path.join(
    process.cwd(),
    "public",
    "products",
    root
  );

  if (!fs.existsSync(rootAbsolute)) return null;

  const expectedNames = [
    normalizePhysicalName(product.name),
    normalizePhysicalName(
      product.slug
        .replace(/^adulto-floral-em-gotas-/, "")
        .replace(/^pet-floral-em-gotas-/, "")
        .replace(/^pet-snack-floral-/, "")
        .replace(/^baby-floral-em-gotas-/, "")
        .replace(/^kids-floral-em-gotas-/, "")
        .replace(/^teen-floral-em-gotas-/, "")
        .replace(
          /^cosmeticos-(shampoo|condicionador|creme-corpo|creme-maos|sabonete-liquido)-/,
          ""
        )
    ),
  ];

  const categoryFolder =
    product.lineSlug === "cosmeticos"
      ? normalizePhysicalName(product.category)
      : null;

  const categoryAbsolute = categoryFolder
    ? path.join(rootAbsolute, categoryFolder)
    : null;

  const searchRoot =
    categoryAbsolute &&
    fs.existsSync(categoryAbsolute)
      ? categoryAbsolute
      : rootAbsolute;

  const directCandidate = path.join(
    searchRoot,
    expectedNames[0]
  );

  if (fs.existsSync(directCandidate)) {
    return {
      absolute: directCandidate,
      publicBase:
        "/" +
        path
          .relative(
            path.join(process.cwd(), "public"),
            directCandidate
          )
          .replace(/\\/g, "/"),
    };
  }

  function walk(current: string): string[] {
    const entries = fs.readdirSync(current, {
      withFileTypes: true,
    });

    const dirs = entries.filter((entry) =>
      entry.isDirectory()
    );

    if (dirs.length === 0) return [current];

    return dirs.flatMap((entry) =>
      walk(path.join(current, entry.name))
    );
  }

  const matched = walk(searchRoot).find((folder) => {
    const folderName = normalizePhysicalName(
      path.basename(folder)
    );

    return expectedNames.includes(folderName);
  });

  if (!matched) return null;

  const relative = path
    .relative(
      path.join(process.cwd(), "public"),
      matched
    )
    .replace(/\\/g, "/");

  return {
    absolute: matched,
    publicBase: `/${relative}`,
  };
}

export function getProductGallery(product: BioProduct) {
  const folder = findProductFolder(product);

  if (!folder) return [];

  const files = fs
    .readdirSync(folder.absolute, {
      withFileTypes: true,
    })
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.(jpg|jpeg|png|webp|avif)$/i.test(entry.name)
    )
    .map((entry) => entry.name)
    .sort((a, b) => {
      const aNumber = a.match(/^(\d+)/);
      const bNumber = b.match(/^(\d+)/);

      if (aNumber && bNumber) {
        const diff =
          Number(aNumber[1]) - Number(bNumber[1]);

        if (diff !== 0) return diff;
      }

      if (aNumber && !bNumber) return -1;
      if (!aNumber && bNumber) return 1;

      return a.localeCompare(b, "pt-BR", {
        numeric: true,
        sensitivity: "base",
      });
    });

  return files.map(
    (file) => `${folder.publicBase}/${file}`
  );
}

export function getProductMainImage(
  product: BioProduct
) {
  return getProductGallery(product)[0] ?? product.image ?? null;
}

export function imageExists(publicPath: string) {
  const cleanPath = publicPath.replace(/^\//, "");

  return fs.existsSync(
    path.join(
      process.cwd(),
      "public",
      cleanPath
    )
  );
}
