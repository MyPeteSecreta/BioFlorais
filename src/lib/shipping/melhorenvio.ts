import { getValidMelhorEnvioToken } from "./melhorenvio-auth";
import type {
  ShippingItem,
  ShippingOption,
  ShippingProvider,
} from "./types";

const MELHOR_ENVIO_BASE_URL = "https://melhorenvio.com.br";

type MelhorEnvioQuote = {
  id?: number;
  name?: string;
  price?: string;
  custom_price?: string;
  delivery_time?: number;
  custom_delivery_time?: number;
  error?: string;
  company?: {
    name?: string;
  };
};



function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export const melhorEnvioProvider: ShippingProvider = {
  async calculate(
    cepDestino: string,
    items: ShippingItem[]
  ): Promise<ShippingOption[]> {
    const cepOrigem = onlyDigits(
      process.env.MELHORENVIO_CEP_ORIGEM ?? ""
    );

    const destino = onlyDigits(cepDestino);

    if (cepOrigem.length !== 8) {
      throw new Error(
        "CEP de origem do Melhor Envio não configurado corretamente."
      );
    }

    if (destino.length !== 8) {
      throw new Error(
        "CEP de destino inválido."
      );
    }

    if (items.length === 0) {
      throw new Error(
        "Nenhum item informado para cálculo de frete."
      );
    }

    const products = items.map((item) => {
const lengthCm = item.lengthCm ?? null;

      const widthCm = item.widthCm ?? null;

      const heightCm = item.heightCm ?? null;

      const weightGrams =
        item.weightGrams ??
        null;

      if (
        !lengthCm ||
        !widthCm ||
        !heightCm ||
        !weightGrams
      ) {
        throw new Error(
          `Produto sem peso ou dimensões completas: ${item.productSlug}`
        );
      }

      return {
        id: item.productSlug,
        width: widthCm,
        height: heightCm,
        length: lengthCm,
        weight: weightGrams / 1000,
        quantity: Math.max(1, item.qty),
      };
    });

    const token =
      await getValidMelhorEnvioToken();

    const response = await fetch(
      `${MELHOR_ENVIO_BASE_URL}/api/v2/me/shipment/calculate`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent":
            process.env.MELHORENVIO_USER_AGENT ||
            "Bio Florais",
        },
        body: JSON.stringify({
          from: {
            postal_code: cepOrigem,
          },
          to: {
            postal_code: destino,
          },
          products,
        }),
        cache: "no-store",
      }
    );

    const data =
      (await response.json()) as MelhorEnvioQuote[];

    if (!response.ok) {
  if (response.status === 422) {
    throw new Error(
      "CEP inválido. Confira o número informado e tente novamente."
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "Não foi possível consultar o frete neste momento. Tente novamente em instantes."
    );
  }

  throw new Error(
    "Não foi possível calcular o frete. Tente novamente em instantes."
  );
}

    return data
      .filter(
        (option) =>
          !option.error &&
          option.name &&
          (option.custom_price ||
            option.price)
      )
      .map((option) => ({
        serviceName:
          option.company?.name
            ? `${option.company.name} — ${option.name}`
            : option.name ?? "Frete",

        priceCents: Math.round(
          Number(
            option.custom_price ??
              option.price ??
              "0"
          ) * 100
        ),

        etaDays:
          option.custom_delivery_time ??
          option.delivery_time ??
          0,
      }))
      .sort(
        (a, b) =>
          a.priceCents - b.priceCents
      );
  },
};

