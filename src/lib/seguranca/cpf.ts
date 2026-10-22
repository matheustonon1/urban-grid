import { createHmac } from "crypto";

export function normalizarCpf(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function validarCpf(valor: string): boolean {
  const cpf = normalizarCpf(valor);

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const digitos = cpf.split("").map(Number);

  function digitoVerificador(quantidade: number): number {
    const soma = digitos
      .slice(0, quantidade)
      .reduce((acc, digito, indice) => acc + digito * (quantidade + 1 - indice), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  }

  return (
    digitoVerificador(9) === digitos[9] && digitoVerificador(10) === digitos[10]
  );
}

export function formatarCpf(valor: string): string {
  const cpf = normalizarCpf(valor);
  if (cpf.length !== 11) return valor;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

export function hashCpf(valor: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET!)
    .update(normalizarCpf(valor))
    .digest("hex");
}
