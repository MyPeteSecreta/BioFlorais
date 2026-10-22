/** Campos do cadastro de cliente (sem dependência de servidor: usado pela tela do admin e pelo servidor). */

export const CLIENT_FIELDS = [
  "displayName",
  "contactName",
  "document",
  "email",
  "phone",
  "postalCode",
  "street",
  "addressNumber",
  "addressComplement",
  "neighborhood",
  "city",
  "state",
] as const;

export type ClientField = (typeof CLIENT_FIELDS)[number];
export type ClientValues = Record<ClientField, string | null>;

/** Rótulos para o histórico e as mensagens. */
export const CLIENT_FIELD_LABELS: Record<ClientField, string> = {
  displayName: "Nome / razão social",
  contactName: "Contato",
  document: "CNPJ/CPF",
  email: "E-mail",
  phone: "WhatsApp",
  postalCode: "CEP",
  street: "Rua",
  addressNumber: "Número",
  addressComplement: "Complemento",
  neighborhood: "Bairro",
  city: "Cidade",
  state: "UF",
};
