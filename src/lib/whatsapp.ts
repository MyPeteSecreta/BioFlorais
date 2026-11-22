/**
 * WhatsApp de dúvidas do site B2C da Bio (botão "Tirar dúvida no WhatsApp" no produto e na sacola). Número ÚNICO aqui.
 * Padrão: (21) 3955-3713, o mesmo que o site já usa em Atendimento e Acompanhe. Para trocar sem mexer no código:
 * NEXT_PUBLIC_WHATSAPP_SUPPORT (só dígitos com DDI, ex.: 552139553713) na Vercel + Redeploy.
 */

export const DEFAULT_SUPPORT_WHATSAPP = "552139553713";

export function supportWhatsappDigits(raw: string | null | undefined = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT): string {
  const digits = String(raw ?? "").replace(/\D/g, "");

  return /^55\d{10,11}$/.test(digits) ? digits : DEFAULT_SUPPORT_WHATSAPP;
}

/** Link wa.me com a mensagem pronta (a referência "(ref B-prod)" / "(ref B-cart)" mostra de onde o cliente veio). */
export function whatsappLink(message: string, digits: string = supportWhatsappDigits()): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export const productWhatsappMessage = (productName: string) => `Olá! Tenho uma dúvida sobre o produto ${String(productName).trim()}. (ref B-prod)`;

export const CART_WHATSAPP_MESSAGE = "Olá! Tenho uma dúvida sobre a minha sacola. (ref B-cart)";
