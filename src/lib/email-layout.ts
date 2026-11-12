/**
 * Moldura simples dos e-mails da Bio (mesmo visual dos e-mails de andamento do pedido, src/lib/order-emails.ts): texto puro + HTML
 * leve (fundo bege, "Bio Florais" em texto no topo, botão verde). Usado pelos e-mails de recuperação, boleto e avaliação.
 * Para portar: troque BRAND em order-emails.ts.
 */

import { BRAND } from "@/lib/order-emails";

export type EmailPart =
  | { p: string }
  | { lines: string[] }
  | { code: string }
  | { button: string; url: string }
  | { small: string };

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderSimpleEmail(input: { greeting: string; parts: EmailPart[]; footer: string }): { text: string; html: string } {
  const text: string[] = [input.greeting, ""];
  const html: string[] = [];

  for (const part of input.parts) {
    if ("p" in part) {
      text.push(part.p, "");
      html.push(`<p style="margin:0 0 14px">${esc(part.p)}</p>`);
    } else if ("lines" in part) {
      text.push(...part.lines, "");
      html.push(`<p style="margin:0 0 14px">${part.lines.map(esc).join("<br>")}</p>`);
    } else if ("code" in part) {
      text.push(part.code, "");
      html.push(
        `<p style="margin:0 0 16px"><span style="display:inline-block;border:2px dashed ${BRAND.green};border-radius:12px;padding:10px 18px;font-size:20px;font-weight:bold;letter-spacing:2px">${esc(part.code)}</span></p>`
      );
    } else if ("button" in part) {
      text.push(`${part.button}: ${part.url}`, "");
      html.push(
        `<p style="margin:6px 0 18px"><a href="${esc(part.url)}" style="display:inline-block;background:${BRAND.green};color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">${esc(part.button)}</a></p>`
      );
    } else {
      text.push(part.small, "");
      html.push(`<p style="margin:0 0 14px;font-size:12px;color:${BRAND.muted}">${esc(part.small)}</p>`);
    }
  }

  text.push(BRAND.name, input.footer);

  const cell = `font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:${BRAND.green}`;

  return {
    text: text.join("\n"),
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:${BRAND.beige}">
<table role="presentation" width="100%" style="background:${BRAND.beige};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid ${BRAND.line};border-radius:16px">
<tr><td style="padding:22px 24px;border-bottom:1px solid ${BRAND.line};font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:bold;color:${BRAND.green}">${esc(BRAND.name)}</td></tr>
<tr><td style="padding:22px 24px;${cell}"><p style="margin:0 0 14px">${esc(input.greeting)}</p>${html.join("")}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid ${BRAND.line};font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${BRAND.muted}">${esc(input.footer)}</td></tr>
</table></td></tr></table></body></html>`,
  };
}

export const brlCents = (cents: number) =>
  `R$ ${(Math.round(cents) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const firstNameOf = (name: string) => String(name ?? "").trim().split(/\s+/)[0] || "";

/** "AAAA-MM-DD" → "DD/MM/AAAA". */
export const brDateIso = (iso: string | null | undefined) =>
  iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";
