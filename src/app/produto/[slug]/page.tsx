import fs from "node:fs";
import path from "node:path";

import Image from "next/image";
import AddToCartButton from "@/components/cart/AddToCartButton";
import ProductGallery from "@/components/product/ProductGallery";
import ProductPurchaseActions from "@/components/product/ProductPurchaseActions";
import { getProductEditorialContent } from "@/lib/content/product-content";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  bioProducts,
  formatBRL,
  getProduct,
  type BioProduct,
} from "@/lib/catalog/bio-products";

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

  if (!root) {
    return null;
  }

  const rootAbsolute = path.join(
    process.cwd(),
    "public",
    "products",
    root
  );

  if (!fs.existsSync(rootAbsolute)) {
    return null;
  }

  const expectedNames =
    [
      normalizePhysicalName(
        product.name
      ),

      normalizePhysicalName(
        product.slug
          .replace(
            /^adulto-floral-em-gotas-/,
            ""
          )
          .replace(
            /^pet-floral-em-gotas-/,
            ""
          )
          .replace(
            /^pet-snack-floral-/,
            ""
          )
          .replace(
            /^baby-floral-em-gotas-/,
            ""
          )
          .replace(
            /^kids-floral-em-gotas-/,
            ""
          )
          .replace(
            /^teen-floral-em-gotas-/,
            ""
          )
          .replace(
            /^cosmeticos-(shampoo|condicionador|creme-corpo|creme-maos|sabonete-liquido)-/,
            ""
          )
      ),
    ];

  const categoryFolder =
    product.lineSlug === "cosmeticos" ||
    product.lineSlug === "cosmeticos-pet"
      ? normalizePhysicalName(
          product.category
        )
      : null;

  const categoryAbsolute =
    categoryFolder
      ? path.join(
          rootAbsolute,
          categoryFolder
        )
      : null;

  const searchRoot =
    categoryAbsolute &&
    fs.existsSync(categoryAbsolute)
      ? categoryAbsolute
      : rootAbsolute;

  const expectedName =
    expectedNames[0];

  const directCandidate =
    path.join(
      searchRoot,
      expectedName
    );

  if (fs.existsSync(directCandidate)) {
    return {
      absolute: directCandidate,
      publicBase:
        `/${path
          .relative(
            path.join(
              process.cwd(),
              "public"
            ),
            directCandidate
          )
          .replace(/\\/g, "/")}`,
    };
  }

  function walk(current: string): string[] {
    const entries =
      fs.readdirSync(current, {
        withFileTypes: true,
      });

    const dirs =
      entries.filter(
        (entry) =>
          entry.isDirectory()
      );

    if (dirs.length === 0) {
      return [current];
    }

    return dirs.flatMap(
      (entry) =>
        walk(
          path.join(
            current,
            entry.name
          )
        )
    );
  }

  const leafFolders =
    walk(searchRoot);

  const matched =
    leafFolders.find(
      (folder) => {
        const folderName =
          normalizePhysicalName(
            path.basename(
              folder
            )
          );

        return (
          expectedNames.includes(
            folderName
          )
        );
      }
    );

  if (!matched) {
    return null;
  }

  const relative =
    path
      .relative(
        path.join(
          process.cwd(),
          "public"
        ),
        matched
      )
      .replace(/\\/g, "/");

  return {
    absolute: matched,
    publicBase: `/${relative}`,
  };
}

function getProductGallery(product: BioProduct) {
  const folder =
    findProductFolder(product);

  if (!folder) {
    return [];
  }

  const files =
    fs.readdirSync(
      folder.absolute,
      {
        withFileTypes: true,
      }
    )
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.(jpg|jpeg|png|webp|avif)$/i.test(
          entry.name
        )
    )
    .map(
      (entry) =>
        entry.name
    )
    .sort(
      (a, b) => {
        const aNumber =
          a.match(/^(\d+)/);

        const bNumber =
          b.match(/^(\d+)/);

        if (aNumber && bNumber) {
          const diff =
            Number(aNumber[1]) -
            Number(bNumber[1]);

          if (diff !== 0) {
            return diff;
          }
        }

        if (aNumber && !bNumber) return -1;
        if (!aNumber && bNumber) return 1;

        return a.localeCompare(
          b,
          "pt-BR",
          {
            numeric: true,
            sensitivity: "base",
          }
        );
      }
    );

  return files.map(
    (file) =>
      `${folder.publicBase}/${file}`
  );
}
function getPetPerfume500Gallery() {
  const folderAbsolute =
    path.join(
      process.cwd(),
      "public",
      "products",
      "cosmeticos-pet",
      "perfume-spray",
      "perfume500"
    );

  if (
    !fs.existsSync(
      folderAbsolute
    )
  ) {
    return [];
  }

  function collect(
    current: string
  ): string[] {
    const entries =
      fs.readdirSync(
        current,
        {
          withFileTypes: true,
        }
      );

    return entries.flatMap(
      (entry) => {
        const absolute =
          path.join(
            current,
            entry.name
          );

        if (
          entry.isDirectory()
        ) {
          return collect(
            absolute
          );
        }

        if (
          entry.isFile() &&
          /\.(jpg|jpeg|png|webp|avif)$/i.test(
            entry.name
          )
        ) {
          return [
            "/" +
            path
              .relative(
                path.join(
                  process.cwd(),
                  "public"
                ),
                absolute
              )
              .replace(
                /\\/g,
                "/"
              ),
          ];
        }

        return [];
      }
    );
  }

  return collect(
    folderAbsolute
  ).sort(
    (a, b) =>
      a.localeCompare(
        b,
        "pt-BR",
        {
          numeric: true,
          sensitivity: "base",
        }
      )
  );
}

function imageExists(
  publicPath: string
) {
  const cleanPath =
    publicPath.replace(
      /^\//,
      ""
    );

  return fs.existsSync(
    path.join(
      process.cwd(),
      "public",
      cleanPath
    )
  );
}

function isPairCategory(
  category: string
) {
  const normalized =
    category
      .trim()
      .toLowerCase();

  return (
    normalized ===
      "shampoo" ||
    normalized ===
      "condicionador"
  );
}

function comboPrice(
  values:
    Array<
      number | null
    >
) {
  if (
    values.some(
      (value) =>
        value === null
    )
  ) {
    return null;
  }

  const total =
    values.reduce<number>(
      (
        sum,
        value
      ) =>
        sum +
        (
          value ??
          0
        ),
      0
    );

  return Math.round(
    total *
    0.9
  );
}

export default async function ProductPage({
  params,
}: {
  params:
    Promise<{
      slug: string;
    }>;
}) {
  const {
    slug,
  } =
    await params;

  if (
    slug.startsWith("cosmeticos-pet-") &&
    slug.endsWith("-5l")
  ) {
    redirect(
      `/produto/${slug.slice(0, -3)}`
    );
  }

  if (
    slug.startsWith(
      "cosmeticos-pet-perfume-spray-"
    ) &&
    slug.endsWith("-500ml")
  ) {
    redirect(
      `/produto/${slug.slice(0, -6)}`
    );
  }

  const product =
    getProduct(slug);

  if (!product) {
    notFound();
  }

  const isPair =
    isPairCategory(
      product.category
    );

  const hasPet5lMatrix =
    isPair &&
    product.lineSlug === "cosmeticos-pet";

  const isPetPerfume =
    product.lineSlug ===
      "cosmeticos-pet" &&
    product.category ===
      "Perfume Spray" &&
    !product.slug.endsWith(
      "-500ml"
    );

  const perfume500 =
    isPetPerfume
      ? bioProducts.find(
          (candidate) =>
            candidate.slug ===
            `${product.slug}-500ml`
        )
      : undefined;

  const pairProducts =
    isPair
      ? bioProducts.filter(
          (candidate) =>
            candidate.lineSlug ===
              product.lineSlug &&
            candidate.name ===
              product.name &&
            isPairCategory(
              candidate.category
            )
        )
      : [
          product,
        ];

  const shampoo500 =
    pairProducts.find(
      (item) =>
        item.category
          .toLowerCase() ===
          "shampoo" &&
        !item.slug.endsWith("-5l")
    );

  const conditioner500 =
    pairProducts.find(
      (item) =>
        item.category
          .toLowerCase() ===
          "condicionador" &&
        !item.slug.endsWith("-5l")
    );

  const shampoo5l =
    pairProducts.find(
      (item) =>
        item.category
          .toLowerCase() ===
          "shampoo" &&
        item.slug.endsWith("-5l")
    );

  const conditioner5l =
    pairProducts.find(
      (item) =>
        item.category
          .toLowerCase() ===
          "condicionador" &&
        item.slug.endsWith("-5l")
    );

  const kitPrice500 =
    shampoo500 &&
    conditioner500
      ? comboPrice([
          shampoo500.priceCents,
          conditioner500.priceCents,
        ])
      : null;

  const kitPrice5l =
    shampoo5l &&
    conditioner5l
      ? comboPrice([
          shampoo5l.priceCents,
          conditioner5l.priceCents,
        ])
      : null;

  const galleryProduct =
    shampoo500 ??
    product;

  const baseGallery =
    getProductGallery(
      galleryProduct
    );

  const gallery =
    isPetPerfume
      ? Array.from(
          new Set([
            ...baseGallery,
            ...getPetPerfume500Gallery(),
          ])
        )
      : baseGallery;

  const mainImage =
    gallery[0] ??
    shampoo500?.image ??
    product.image;

  const hasImage =
    Boolean(mainImage) &&
    imageExists(mainImage);

  const editorial =
    getProductEditorialContent(
      product.slug
    );

  const related =
    bioProducts
      .filter(
        (candidate) =>
          candidate.lineSlug ===
            product.lineSlug &&
          candidate.name !==
            product.name
      )
      .slice(
        0,
        4
      );

  return (
    <main
      className="
        min-h-screen
        bg-[#fffdf9]
        text-[#2f2231]
      "
    >
      <header
        className="
          border-b
          border-[#eadfd9]
          bg-white
        "
      >
        <div
          className="
            mx-auto
            flex
            max-w-[1440px]
            items-center
            justify-between
            px-5
            py-5
            lg:px-10
          "
        >
          <Link
            href="/"
            className="
              font-serif
              text-2xl
              font-semibold
              text-[#55245f]
            "
          >
            Bio Florais
          </Link>

          <Link
            href={
              `/linha/${product.lineSlug}`
            }
            className="
              text-sm
              font-bold
              text-[#63326d]
            "
          >
            Voltar para {
              product.line
            }
          </Link>
        </div>
      </header>

      <section
        className="
          mx-auto
          grid
          max-w-[1280px]
          gap-8
          px-5
          py-8
          lg:grid-cols-2
          lg:px-10
          lg:py-10
        "
      >
        <ProductGallery
          images={
            gallery.length > 0
              ? gallery
              : hasImage && mainImage
                ? [mainImage]
                : []
          }
          productName={
            product.name
          }
        />

        <div
          className="
            flex
            flex-col
            justify-center
          "
        >
          <p
            className="
              text-xs
              font-extrabold
              uppercase
              tracking-[0.2em]
              text-[#a0742b]
            "
          >
            {
              product.line
            }
          </p>

          <h1
            className="
              mt-4
              font-serif
              text-5xl
              font-semibold
              leading-[1.02]
              tracking-[-0.04em]
              text-[#422347]
              lg:text-6xl
            "
          >
            {
              product.name
            }
          </h1>

          {!isPair && (
            <>
              {
                product.content &&
                (
                  <p
                    className="
                      mt-4
                      text-lg
                      text-[#746471]
                    "
                  >
                    {
                      product.content
                    }
                  </p>
                )
              }

              <p
                className="
                  mt-7
                  text-4xl
                  font-extrabold
                  text-[#55245f]
                "
              >
                {
                  formatBRL(
                    product.priceCents
                  )
                }
              </p>
            </>
          )}



          {hasPet5lMatrix ? (
            <div className="mt-7">
              <div
                className="
                  overflow-hidden
                  rounded-[24px]
                  border
                  border-[#ddcfda]
                  bg-white
                "
              >
                <div
                  className="
                    grid
                    grid-cols-[1.15fr_1fr_1fr]
                    border-b
                    border-[#eadfd9]
                    bg-[#faf6ee]
                  "
                >
                  <div className="p-4">
                    <p
                      className="
                        text-xs
                        font-extrabold
                        uppercase
                        tracking-[0.14em]
                        text-[#8d7789]
                      "
                    >
                      Produto
                    </p>
                  </div>

                  <div
                    className="
                      border-l
                      border-[#eadfd9]
                      p-4
                      text-center
                    "
                  >
                    <p
                      className="
                        text-sm
                        font-extrabold
                        uppercase
                        tracking-[0.12em]
                        text-[#55245f]
                      "
                    >
                      500 ml
                    </p>
                  </div>

                  <div
                    className="
                      border-l
                      border-[#eadfd9]
                      bg-[#fff8e8]
                      p-4
                      text-center
                    "
                  >
                    <p
                      className="
                        text-sm
                        font-extrabold
                        uppercase
                        tracking-[0.12em]
                        text-[#9b6c24]
                      "
                    >
                      5 L
                    </p>
                  </div>
                </div>

                {/* SHAMPOO */}
                <div
                  className="
                    grid
                    grid-cols-[1.15fr_1fr_1fr]
                    border-b
                    border-[#eadfd9]
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      p-4
                    "
                  >
                    <p
                      className="
                        font-extrabold
                        text-[#422347]
                      "
                    >
                      Shampoo
                    </p>
                  </div>

                  <div
                    className="
                      flex
                      flex-col
                      items-center
                      justify-center
                      gap-3
                      border-l
                      border-[#eadfd9]
                      p-4
                    "
                  >
                    {shampoo500 ? (
                      <>
                        <p
                          className="
                            text-xl
                            font-extrabold
                            text-[#55245f]
                          "
                        >
                          {formatBRL(
                            shampoo500.priceCents
                          )}
                        </p>

                        <AddToCartButton
                          mode="product"
                          product={{
                            productSlug:
                              shampoo500.slug,
                            name:
                              shampoo500.name,
                            image:
                              shampoo500.image ??
                              null,
                          }}
                          className="
                            rounded-full
                            bg-[#63326d]
                            px-5
                            py-2.5
                            text-sm
                            font-extrabold
                            text-white
                          "
                        >
                          Escolher
                        </AddToCartButton>
                      </>
                    ) : (
                      <p className="text-sm text-[#9b8c98]">
                        Indisponível
                      </p>
                    )}
                  </div>

                  <div
                    className="
                      flex
                      flex-col
                      items-center
                      justify-center
                      gap-3
                      border-l
                      border-[#eadfd9]
                      bg-[#fffdf8]
                      p-4
                    "
                  >
                    {shampoo5l ? (
                      <>
                        <p
                          className="
                            text-xl
                            font-extrabold
                            text-[#55245f]
                          "
                        >
                          {formatBRL(
                            shampoo5l.priceCents
                          )}
                        </p>

                        <AddToCartButton
                          mode="product"
                          product={{
                            productSlug:
                              shampoo5l.slug,
                            name:
                              shampoo5l.name,
                            image:
                              shampoo5l.image ??
                              null,
                          }}
                          className="
                            rounded-full
                            bg-[#63326d]
                            px-5
                            py-2.5
                            text-sm
                            font-extrabold
                            text-white
                          "
                        >
                          Escolher
                        </AddToCartButton>
                      </>
                    ) : (
                      <p className="text-sm text-[#9b8c98]">
                        Indisponível
                      </p>
                    )}
                  </div>
                </div>

                {/* CONDICIONADOR */}
                <div
                  className="
                    grid
                    grid-cols-[1.15fr_1fr_1fr]
                    border-b
                    border-[#eadfd9]
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      p-4
                    "
                  >
                    <p
                      className="
                        font-extrabold
                        text-[#422347]
                      "
                    >
                      Condicionador
                    </p>
                  </div>

                  <div
                    className="
                      flex
                      flex-col
                      items-center
                      justify-center
                      gap-3
                      border-l
                      border-[#eadfd9]
                      p-4
                    "
                  >
                    {conditioner500 ? (
                      <>
                        <p
                          className="
                            text-xl
                            font-extrabold
                            text-[#55245f]
                          "
                        >
                          {formatBRL(
                            conditioner500.priceCents
                          )}
                        </p>

                        <AddToCartButton
                          mode="product"
                          product={{
                            productSlug:
                              conditioner500.slug,
                            name:
                              conditioner500.name,
                            image:
                              conditioner500.image ??
                              null,
                          }}
                          className="
                            rounded-full
                            bg-[#63326d]
                            px-5
                            py-2.5
                            text-sm
                            font-extrabold
                            text-white
                          "
                        >
                          Escolher
                        </AddToCartButton>
                      </>
                    ) : (
                      <p className="text-sm text-[#9b8c98]">
                        Indisponível
                      </p>
                    )}
                  </div>

                  <div
                    className="
                      flex
                      flex-col
                      items-center
                      justify-center
                      gap-3
                      border-l
                      border-[#eadfd9]
                      bg-[#fffdf8]
                      p-4
                    "
                  >
                    {conditioner5l ? (
                      <>
                        <p
                          className="
                            text-xl
                            font-extrabold
                            text-[#55245f]
                          "
                        >
                          {formatBRL(
                            conditioner5l.priceCents
                          )}
                        </p>

                        <AddToCartButton
                          mode="product"
                          product={{
                            productSlug:
                              conditioner5l.slug,
                            name:
                              conditioner5l.name,
                            image:
                              conditioner5l.image ??
                              null,
                          }}
                          className="
                            rounded-full
                            bg-[#63326d]
                            px-5
                            py-2.5
                            text-sm
                            font-extrabold
                            text-white
                          "
                        >
                          Escolher
                        </AddToCartButton>
                      </>
                    ) : (
                      <p className="text-sm text-[#9b8c98]">
                        Indisponível
                      </p>
                    )}
                  </div>
                </div>

                {/* COMBO */}
                <div
                  className="
                    grid
                    grid-cols-[1.15fr_1fr_1fr]
                    bg-[#fff8e8]
                  "
                >
                  <div
                    className="
                      flex
                      flex-col
                      justify-center
                      p-4
                    "
                  >
                    <p
                      className="
                        font-extrabold
                        text-[#422347]
                      "
                    >
                      Combo
                    </p>

                    <p
                      className="
                        mt-1
                        text-xs
                        font-bold
                        text-[#9b6c24]
                      "
                    >
                      Shampoo + Condicionador
                    </p>

                    <p
                      className="
                        mt-1
                        text-xs
                        font-extrabold
                        uppercase
                        tracking-[0.08em]
                        text-[#9b6c24]
                      "
                    >
                      10% de desconto
                    </p>
                  </div>

                  <div
                    className="
                      flex
                      flex-col
                      items-center
                      justify-center
                      gap-3
                      border-l
                      border-[#dec68f]
                      p-4
                    "
                  >
                    {shampoo500 &&
                    conditioner500 ? (
                      <>
                        <p
                          className="
                            text-xl
                            font-extrabold
                            text-[#55245f]
                          "
                        >
                          {formatBRL(
                            kitPrice500
                          )}
                        </p>

                        <AddToCartButton
                          mode="combo"
                          shampoo={{
                            productSlug:
                              shampoo500.slug,
                            name:
                              shampoo500.name,
                            image:
                              shampoo500.image ??
                              null,
                          }}
                          conditioner={{
                            productSlug:
                              conditioner500.slug,
                            name:
                              conditioner500.name,
                            image:
                              conditioner500.image ??
                              null,
                          }}
                          className="
                            rounded-full
                            bg-[#63326d]
                            px-5
                            py-2.5
                            text-sm
                            font-extrabold
                            text-white
                          "
                        >
                          Escolher
                        </AddToCartButton>
                      </>
                    ) : (
                      <p className="text-sm text-[#9b8c98]">
                        Indisponível
                      </p>
                    )}
                  </div>

                  <div
                    className="
                      flex
                      flex-col
                      items-center
                      justify-center
                      gap-3
                      border-l
                      border-[#dec68f]
                      p-4
                    "
                  >
                    {shampoo5l &&
                    conditioner5l ? (
                      <>
                        <p
                          className="
                            text-xl
                            font-extrabold
                            text-[#55245f]
                          "
                        >
                          {formatBRL(
                            kitPrice5l
                          )}
                        </p>

                        <AddToCartButton
                          mode="combo"
                          shampoo={{
                            productSlug:
                              shampoo5l.slug,
                            name:
                              shampoo5l.name,
                            image:
                              shampoo5l.image ??
                              null,
                          }}
                          conditioner={{
                            productSlug:
                              conditioner5l.slug,
                            name:
                              conditioner5l.name,
                            image:
                              conditioner5l.image ??
                              null,
                          }}
                          className="
                            rounded-full
                            bg-[#63326d]
                            px-5
                            py-2.5
                            text-sm
                            font-extrabold
                            text-white
                          "
                        >
                          Escolher
                        </AddToCartButton>
                      </>
                    ) : (
                      <p className="text-sm text-[#9b8c98]">
                        Indisponível
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : isPetPerfume &&
            perfume500 ? (
            <div
              className="
                mt-7
                grid
                gap-4
                sm:grid-cols-2
              "
            >
              <div
                className="
                  rounded-[22px]
                  border
                  border-[#ddcfda]
                  bg-white
                  p-5
                "
              >
                <p
                  className="
                    text-xs
                    font-extrabold
                    uppercase
                    tracking-[0.14em]
                    text-[#a0742b]
                  "
                >
                  Perfume 120 ml
                </p>

                <p
                  className="
                    mt-3
                    text-3xl
                    font-extrabold
                    text-[#55245f]
                  "
                >
                  {formatBRL(
                    product.priceCents
                  )}
                </p>

                <AddToCartButton
                  mode="product"
                  product={{
                    productSlug:
                      product.slug,
                    name:
                      product.name,
                    image:
                      mainImage ||
                      product.image ||
                      null,
                  }}
                  className="
                    mt-5
                    w-full
                    rounded-full
                    bg-[#63326d]
                    px-5
                    py-3
                    text-sm
                    font-extrabold
                    text-white
                  "
                >
                  Escolher
                </AddToCartButton>
              </div>

              <div
                className="
                  rounded-[22px]
                  border
                  border-[#c99c45]
                  bg-[#fff8e8]
                  p-5
                "
              >
                <p
                  className="
                    text-xs
                    font-extrabold
                    uppercase
                    tracking-[0.14em]
                    text-[#9b6c24]
                  "
                >
                  Perfume 500 ml
                </p>

                <p
                  className="
                    mt-3
                    text-3xl
                    font-extrabold
                    text-[#55245f]
                  "
                >
                  {formatBRL(
                    perfume500.priceCents
                  )}
                </p>

                <AddToCartButton
                  mode="product"
                  product={{
                    productSlug:
                      perfume500.slug,
                    name:
                      perfume500.name,
                    image:
                      perfume500.image ??
                      null,
                  }}
                  className="
                    mt-5
                    w-full
                    rounded-full
                    bg-[#63326d]
                    px-5
                    py-3
                    text-sm
                    font-extrabold
                    text-white
                  "
                >
                  Escolher
                </AddToCartButton>
              </div>
            </div>
          ) : (
            <ProductPurchaseActions
              product={{
                productSlug:
                  product.slug,
                name:
                  product.name,
                image:
                  mainImage ||
                  product.image ||
                  null,
              }}
            />
          )}
        </div>
      </section>
      <section
        className="
          mx-auto
          max-w-[1280px]
          px-5
          pb-9
          lg:px-10
          lg:pb-10
        "
      >
        <div
          className="
            mt-8
            overflow-hidden
            rounded-[28px]
            border
            border-[#eadfd9]
            bg-white
          "
        >
          <div
            className="
              border-b
              border-[#eee4de]
              px-6
              py-6
            "
          >
            <p
              className="
                text-xs
                font-extrabold
                uppercase
                tracking-[0.18em]
                text-[#a0742b]
              "
            >
              Saiba mais
            </p>

            <h2
              className="
                mt-1
                font-serif
                text-3xl
                font-semibold
                text-[#422347]
              "
            >
              Informações do produto
            </h2>
          </div>

          {editorial ? (
            <div
              className="
                divide-y
                divide-[#eee4de]
              "
            >
              <section
                className="
                  px-6
                  py-6
                "
              >
                <h3
                  className="
                    text-lg
                    font-extrabold
                    text-[#422347]
                  "
                >
                  Sobre
                </h3>

                <p
                  className="
                    mt-3
                    leading-7
                    text-[#756674]
                  "
                >
                  {editorial.about}
                </p>
              </section>

              {editorial.indication && (
                <section
                  className="
                    px-6
                    py-4
                  "
                >
                  <h3
                    className="
                      text-lg
                      font-extrabold
                      text-[#422347]
                    "
                  >
                    Indicação
                  </h3>

                  <p
                    className="
                      mt-3
                      leading-7
                      text-[#756674]
                    "
                  >
                    {editorial.indication}
                  </p>
                </section>
              )}

              {editorial.howToUse && (
                <section
                  className="
                    px-6
                    py-4
                  "
                >
                  <h3
                    className="
                      text-lg
                      font-extrabold
                      text-[#422347]
                    "
                  >
                    Como usar
                  </h3>

                  <p
                    className="
                      mt-3
                      leading-7
                      text-[#756674]
                    "
                  >
                    {editorial.howToUse}
                  </p>
                </section>
              )}

              {editorial.ingredients && (
                <section
                  className="
                    px-6
                    py-4
                  "
                >
                  <h3
                    className="
                      text-lg
                      font-extrabold
                      text-[#422347]
                    "
                  >
                    Ingredientes
                  </h3>

                  <p
                    className="
                      mt-3
                      text-sm
                      leading-6
                      text-[#756674]
                    "
                  >
                    {editorial.ingredients}
                  </p>
                </section>
              )}

              {editorial.importantNote && (
                <section
                  className="
                    bg-[#faf6ee]
                    px-6
                    py-4
                  "
                >
                  <h3
                    className="
                      text-base
                      font-extrabold
                      text-[#422347]
                    "
                  >
                    Importante
                  </h3>

                  <p
                    className="
                      mt-2
                      text-sm
                      leading-6
                      text-[#756674]
                    "
                  >
                    {editorial.importantNote}
                  </p>
                </section>
              )}
            </div>
          ) : (
            <div
              className="
                px-6
                py-7
              "
            >
              <p
                className="
                  leading-7
                  text-[#756674]
                "
              >
                Estamos preparando as informações completas desta versão.
              </p>
            </div>
          )}
        </div>
      </section>


      {related.length >
        0 && (
        <section
          className="
            border-t
            border-[#eadfd9]
            bg-[#faf5ef]
            px-5
            py-14
            lg:px-10
          "
        >
          <div
            className="
              mx-auto
              max-w-[1280px]
            "
          >
            <p
              className="
                text-xs
                font-extrabold
                uppercase
                tracking-[0.2em]
                text-[#a0742b]
              "
            >
              Você também pode gostar
            </p>

            <h2
              className="
                mt-3
                font-serif
                text-4xl
                font-semibold
                text-[#422347]
              "
            >
              Complete seu cuidado.
            </h2>

            <div
              className="
                mt-7
                grid
                gap-5
                sm:grid-cols-2
                lg:grid-cols-4
              "
            >
              {related.map(
                (
                  item
                ) => {
                  const relatedGallery =
                    getProductGallery(
                      item
                    );

                  const relatedImage =
                    relatedGallery[0] ??
                    item.image;

                  const hasRelatedImage =
                    Boolean(
                      relatedImage
                    ) &&
                    imageExists(
                      relatedImage
                    );

                  return (
                    <Link
                      key={
                        item.slug
                      }
                      href={
                        `/produto/${item.slug}`
                      }
                      className="
                        overflow-hidden
                        rounded-[20px]
                        border
                        border-[#eadfd9]
                        bg-white
                      "
                    >
                      <div
                        className="
                          relative
                          aspect-[4/5]
                          overflow-hidden
                          rounded-t-[20px]
                          bg-transparent
                        "
                      >
                        {hasRelatedImage ? (
                          <Image
                            src={
                              relatedImage
                            }
                            alt={
                              item.name
                            }
                            fill
                            sizes="
                              (max-width: 640px)
                              50vw,
                              25vw
                            "
                            className="
                              object-cover
                            "
                          />
                        ) : (
                          <div
                            className="
                              flex
                              h-full
                              items-center
                              justify-center
                              text-xs
                              font-bold
                              text-[#a08c9e]
                            "
                          >
                            Foto em preparação
                          </div>
                        )}
                      </div>

                      <div
                        className="
                          p-4
                        "
                      >
                        <p
                          className="
                            font-bold
                            text-[#422347]
                          "
                        >
                          {
                            item.name
                          }
                        </p>

                        <p
                          className="
                            mt-2
                            text-sm
                            font-extrabold
                            text-[#63326d]
                          "
                        >
                          {
                            formatBRL(
                              item.priceCents
                            )
                          }
                        </p>
                      </div>
                    </Link>
                  );
                }
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}









