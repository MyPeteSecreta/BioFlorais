export interface ShippingItem {
  productSlug: string;
  qty: number;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
}

export interface ShippingOption {
  serviceName: string;
  priceCents: number;
  etaDays: number;
}

export interface ShippingProvider {
  calculate(cepDestino: string, items: ShippingItem[]): Promise<ShippingOption[]>;
}

