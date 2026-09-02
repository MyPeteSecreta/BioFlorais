import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { melhorEnvioProvider } from "@/lib/shipping/melhorenvio";
import type { ShippingItem } from "@/lib/shipping/types";

type QuoteRequestBody = {
  cepDestino?: string;
  items?: Array<{
    productSlug?: string;
    qty?: number;
  }>;
};

export async function POST(request: NextRequest) {
  try {
    const body =
      (await request.json()) as QuoteRequestBody;

    const cepDestino = String(
      body.cepDestino ?? ""
    ).replace(/\D/g, "");

    if (cepDestino.length !== 8) {
      return NextResponse.json(
        {
          error: "CEP de destino inválido.",
        },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return NextResponse.json(
        {
          error: "O carrinho está vazio.",
        },
        { status: 400 }
      );
    }

    const requestedItems =
      body.items.map((item) => ({
        productSlug:
          String(item.productSlug ?? "").trim(),
        qty: Number(item.qty ?? 0),
      }));

    if (
      requestedItems.some(
        (item) =>
          !item.productSlug ||
          !Number.isInteger(item.qty) ||
          item.qty <= 0
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Há itens inválidos no carrinho.",
        },
        { status: 400 }
      );
    }

    const items: ShippingItem[] = [];

    for (const requested of requestedItems) {
      const rows = await db
        .select({
          slug: products.slug,
          active: products.active,
          weightGrams: products.weightGrams,
          lengthCm: products.lengthCm,
          widthCm: products.widthCm,
          heightCm: products.heightCm,
        })
        .from(products)
        .where(
          eq(
            products.slug,
            requested.productSlug
          )
        )
        .limit(1);

      const product = rows[0];

      if (!product || !product.active) {
        return NextResponse.json(
          {
            error:
              `Produto indisponível: ${requested.productSlug}`,
          },
          { status: 400 }
        );
      }

      if (
        !product.weightGrams ||
        !product.lengthCm ||
        !product.widthCm ||
        !product.heightCm
      ) {
        return NextResponse.json(
          {
            error:
              `Peso ou dimensões não cadastrados para ${product.slug}.`,
          },
          { status: 400 }
        );
      }

      items.push({
        productSlug: product.slug,
        qty: requested.qty,
        weightGrams: product.weightGrams,
        lengthCm: product.lengthCm,
        widthCm: product.widthCm,
        heightCm: product.heightCm,
      });
    }

    const options =
      await melhorEnvioProvider.calculate(
        cepDestino,
        items
      );

    return NextResponse.json({
      success: true,
      options,
    });
  } catch (error) {
    console.error(
      "Erro ao calcular frete pelo Melhor Envio:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível calcular o frete.",
      },
      { status: 500 }
    );
  }
}

