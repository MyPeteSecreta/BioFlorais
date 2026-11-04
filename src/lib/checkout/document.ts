/**
 * CPF e CNPJ do checkout B2C: dígitos verificadores (mesma conta do B2B em src/lib/b2b/vendor-launch.ts, que fica intocado).
 * Usado no navegador (aviso no campo e antes de enviar) e no servidor (/api/orders/create recusa documento inválido).
 */

export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;

  const check = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

export function isValidCnpj(digits: string): boolean {
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false;

  const check = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
}

/** Mensagem do campo "CPF ou CNPJ"; null = documento válido. */
export function documentError(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");

  if (digits.length === 11) return isValidCpf(digits) ? null : "CPF inválido. Confira os números.";
  if (digits.length === 14) return isValidCnpj(digits) ? null : "CNPJ inválido. Confira os números.";

  return "Informe um CPF (11 números) ou CNPJ (14 números).";
}
