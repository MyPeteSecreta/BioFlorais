/*
 * CONTRATO CENTRAL ⇄ MARCA (server-to-server). A Central (admin da My Pet)
 * chama a rota interna de cada marca; a marca responde com os mesmos formatos.
 *
 * Autenticação: header `x-central-secret: <CENTRAL_API_SECRET>` (mesmo valor na
 * Vercel das 3 marcas). Sem a variável configurada na marca, a rota responde 503.
 * Todas as rotas respondem JSON; erro = { ok:false, error, code? } com status HTTP.
 *
 *   POST /api/central/invites                  cria o convite de vendedor/RCA
 *   GET  /api/central/orders?stage=separation  pedidos pagos a separar
 *   GET  /api/central/orders?stage=tracking    pedidos separados, sem rastreio
 *   GET  /api/central/orders?stage=shipped     pedidos enviados (para marcar entregue)
 *   POST /api/central/orders/{id}/progress     muda o andamento do pedido
 *   GET  /api/central/sellers/profile?email=   cadastro completo do vendedor (V4)
 *   POST /api/central/sellers/profile          replica o cadastro completo (V4)
 */
export const CENTRAL_SECRET_HEADER = "x-central-secret";

export type SellerType = "RCA" | "VENDEDOR";

export type InviteRequest = {
  name: string;
  email: string;
  /** Só dígitos (ex.: 11912345678) ou null. */
  phone: string | null;
  type: SellerType;
  /** Quem gerou na Central (histórico da marca). */
  requestedBy?: string;
};

export type InviteResponse =
  | { ok: true; link: string; whatsappUrl: string | null; expiresAt: string; inviteId: string }
  | { ok: false; error: string; code?: "EMAIL_IN_USE" | "INVITE_PENDING" | "INVALID" };

export type OrderItemLine = {
  /** Nome completo: "<Tipo> <Nome> · <Linha> · <volume>". */
  name: string;
  paidQty: number;
  bonusQty: number;
  /** Total físico (pagas + bonificadas). */
  qty: number;
};

export type CentralOrder = {
  id: string;
  /** Número de exibição (ex.: BIO-1359F0ED). */
  number: string;
  customerName: string;
  city: string | null;
  state: string | null;
  createdAt: string;
  /** paid_to_prepare | separating | ready_to_ship */
  fulfillment: string;
  b2b: boolean;
  items: OrderItemLine[];
  carrier?: string | null;
};

export type OrdersResponse = { ok: true; orders: CentralOrder[] } | { ok: false; error: string };

export type ProgressAction = "separating" | "separated" | "shipped" | "delivered";

export type ProgressRequest = {
  action: ProgressAction;
  /** Nome de quem fez, na Central (vai para o histórico do pedido). */
  actor: string;
  carrier?: string | null;
  trackingCode?: string | null;
  trackingUrl?: string | null;
};

export type ProgressResponse = { ok: true; fulfillmentStatus: string } | { ok: false; error: string };

/* V4: dados do cadastro completo do vendedor (iguais nas 3 marcas). */
export type SellerProfileData = {
  personType: "pf" | "pj";
  cpf: string | null;
  rg: string | null;
  cnpj: string | null;
  stateRegistration: string | null;
  pixKey: string | null;
  bankName: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  postalCode: string | null;
  street: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
};

export type SellerTermsAcceptance = {
  acceptedAt: string;
  ip: string | null;
  version: string;
};

export type SellerProfileLookup =
  | { ok: true; found: false }
  | {
      ok: true;
      found: true;
      /** Só vale replicar/usar se o cadastro estiver COMPLETO. */
      complete: boolean;
      name: string;
      profile: SellerProfileData;
      terms: SellerTermsAcceptance | null;
    };

export type ApplyProfileRequest = {
  email: string;
  profile: SellerProfileData;
  terms: SellerTermsAcceptance | null;
};

export type ApplyProfileResponse =
  | { ok: true; applied: boolean; reason?: "NO_SELLER" | "ALREADY_COMPLETE" | "TERMS_REQUIRED" }
  | { ok: false; error: string };
