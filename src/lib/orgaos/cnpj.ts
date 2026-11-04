// CNPJ do órgão. Desde julho de 2026 a Receita Federal emite CNPJ ALFANUMÉRICO: as 12 primeiras
// posições (raiz + ordem) aceitam letras maiúsculas além de dígitos; os 2 dígitos verificadores
// continuam numéricos. O cálculo é o de sempre (módulo 11, pesos de 2 a 9 da direita para a
// esquerda), com o valor do caractere igual ao código ASCII menos 48 - os dígitos valem 0 a 9
// como antes e as letras, 17 (A) a 42 (Z) -, então os CNPJs numéricos existentes continuam
// válidos pela mesma conta.

const PESOS_PRIMEIRO_DIGITO = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO_DIGITO = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

// Tira a máscara (pontos, barra, hífen, espaços) e padroniza as letras em maiúsculas.
export function normalizarCnpj(valor: string): string {
  return valor.replace(/[.\-/\s]/g, "").toUpperCase();
}

function digitoVerificador(base: string, pesos: number[]): number {
  const soma = [...base].reduce(
    (total, caractere, indice) => total + (caractere.charCodeAt(0) - 48) * pesos[indice],
    0
  );
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(valor: string): boolean {
  const cnpj = normalizarCnpj(valor);

  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return false;
  // 00000000000000, 11111111111111...: passam na conta e não são CNPJ.
  if (/^(.)\1{13}$/.test(cnpj)) return false;

  const base = cnpj.slice(0, 12);
  const primeiro = digitoVerificador(base, PESOS_PRIMEIRO_DIGITO);
  const segundo = digitoVerificador(`${base}${primeiro}`, PESOS_SEGUNDO_DIGITO);

  return cnpj.slice(12) === `${primeiro}${segundo}`;
}

// XX.XXX.XXX/XXXX-XX, para exibir. Recebe o valor já normalizado (14 caracteres).
export function formatarCnpj(cnpj: string): string {
  if (cnpj.length !== 14) return cnpj;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}
