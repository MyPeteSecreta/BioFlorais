/**
 * Envio de e-mail transacional (Rodada 19c) pela API HTTP do Resend, sem dependência nova.
 * Variáveis: RESEND_API_KEY e MAIL_FROM (ex.: "Bio Florais <pedidos@bioflorais.com.br>", domínio verificado no Resend).
 * Sem as variáveis nada é enviado (retorna false e registra no log): quem chama trata isso sem quebrar a tela.
 * RESPOSTA DO CLIENTE (item 43, 18/11): o remetente pedidos@… não tem caixa, então TODO e-mail vai com reply_to = SAC
 * (sac@angelblanc.com, o mesmo das páginas de privacidade). MAIL_REPLY_TO (opcional) troca esse endereço. Igual à My Pet (af301cb)
 * e à Secreta (204a2fc).
 */

export const SAC_EMAIL = "sac@angelblanc.com";

export type MailInput = { to: string; subject: string; text: string; html?: string };

const REPLY_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Para onde vai a resposta do cliente: MAIL_REPLY_TO (se for um e-mail válido) ou o SAC. */
export function mailReplyTo(env: Record<string, string | undefined> = process.env): string {
  const configured = env.MAIL_REPLY_TO?.trim() ?? "";

  return REPLY_RE.test(configured) ? configured : SAC_EMAIL;
}

export function mailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.MAIL_FROM?.trim());
}

export async function sendEmail(input: MailInput, fetchImpl: typeof fetch = fetch, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  if (!mailConfigured(env)) {
    console.error("[mail] RESEND_API_KEY/MAIL_FROM não configurados: e-mail não enviado.");

    return false;
  }

  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [input.to],
        reply_to: mailReplyTo(env),
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
    });

    if (!response.ok) {
      console.error("[mail] falha no envio", response.status);

      return false;
    }

    return true;
  } catch (error) {
    console.error("[mail] erro no envio", error);

    return false;
  }
}
