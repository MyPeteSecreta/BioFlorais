import fs from "node:fs";
import path from "node:path";

import Image from "next/image";
import AddToCartButton from "@/components/cart/AddToCartButton";
import ProductGallery from "@/components/product/ProductGallery";
import ProductPurchaseActions from "@/components/product/ProductPurchaseActions";
import { getProductEditorialContent } from "@/lib/content/product-content";
import Link from "next/link";
import { notFound } from "next/navigation";

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
    product.lineSlug === "cosmeticos"
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

  const product =
    getProduct(slug);

  if (!product) {
    notFound();
  }

  const isPair =
    isPairCategory(
      product.category
    );

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

  const shampoo =
    pairProducts.find(
      (item) =>
        item.category
          .toLowerCase() ===
        "shampoo"
    );

  const conditioner =
    pairProducts.find(
      (item) =>
        item.category
          .toLowerCase() ===
        "condicionador"
    );

  const kitPrice =
    shampoo &&
    conditioner
      ? comboPrice([
          shampoo.priceCents,
          conditioner.priceCents,
        ])
      : null;

  const galleryProduct =
    shampoo ??
    product;

  const gallery =
    getProductGallery(
      galleryProduct
    );

  const mainImage =
    gallery[0] ??
    shampoo?.image ??
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



          {isPair ? (
            <div
              className="
                mt-7
                grid
                gap-4
              "
            >
              {shampoo && (
                <div
                  className="
                    rounded-[22px]
                    border
                    border-[#ddcfda]
                    bg-white
                    p-5
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      gap-4
                    "
                  >
                    <div>
                      <p
                        className="
                          text-xs
                          font-extrabold
                          uppercase
                          tracking-[0.14em]
                          text-[#a0742b]
                        "
                      >
                        Shampoo
                      </p>

                      <p
                        className="
                          mt-2
                          text-2xl
                          font-extrabold
                          text-[#55245f]
                        "
                      >
                        {
                          formatBRL(
                            shampoo.priceCents
                          )
                        }
                      </p>
                    </div>

                    <AddToCartButton
                      mode="product"
                      product={{
                        productSlug:
                          shampoo.slug,
                        name:
                          shampoo.name,
                        image:
                          shampoo.image ?? null,
                      }}
                      className="
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
              )}

              {conditioner && (
                <div
                  className="
                    rounded-[22px]
                    border
                    border-[#ddcfda]
                    bg-white
                    p-5
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      gap-4
                    "
                  >
                    <div>
                      <p
                        className="
                          text-xs
                          font-extrabold
                          uppercase
                          tracking-[0.14em]
                          text-[#a0742b]
                        "
                      >
                        Condicionador
                      </p>

                      <p
                        className="
                          mt-2
                          text-2xl
                          font-extrabold
                          text-[#55245f]
                        "
                      >
                        {
                          formatBRL(
                            conditioner.priceCents
                          )
                        }
                      </p>
                    </div>

                    <AddToCartButton
                      mode="product"
                      product={{
                        productSlug:
                          conditioner.slug,
                        name:
                          conditioner.name,
                        image:
                          conditioner.image ?? null,
                      }}
                      className="
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
              )}

              {shampoo &&
                conditioner && (
                  <div
                    className="
                      rounded-[24px]
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
                        tracking-[0.16em]
                        text-[#9b6c24]
                      "
                    >
                      Combo da versão
                    </p>

                    <div
                      className="
                        mt-2
                        flex
                        items-end
                        justify-between
                        gap-5
                      "
                    >
                      <div>
                        <p
                          className="
                            text-xl
                            font-extrabold
                            text-[#422347]
                          "
                        >
                          Shampoo +
                          Condicionador
                        </p>

                        <p
                          className="
                            mt-1
                            text-sm
                            font-bold
                            text-[#9b6c24]
                          "
                        >
                          10% de desconto
                        </p>

                        <p
                          className="
                            mt-3
                            text-3xl
                            font-extrabold
                            text-[#55245f]
                          "
                        >
                          {
                            formatBRL(
                              kitPrice
                            )
                          }
                        </p>
                      </div>

                      <AddToCartButton
                        mode="combo"
                        shampoo={{
                          productSlug:
                            shampoo.slug,
                          name:
                            shampoo.name,
                          image:
                            shampoo.image ?? null,
                        }}
                        conditioner={{
                          productSlug:
                            conditioner.slug,
                          name:
                            conditioner.name,
                          image:
                            conditioner.image ?? null,
                        }}
                        className="
                          rounded-full
                          bg-[#63326d]
                          px-6
                          py-3
                          text-sm
                          font-extrabold
                          text-white
                        "
                      >
                        Quero o combo
                      </AddToCartButton>
                    </div>
                  </div>
                )}
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









