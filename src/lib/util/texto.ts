// versaoPrompt vem em formatos mistos ("3", "v2", "manual"): "v" só quando é número.
export function rotuloVersaoPrompt(versao: string): string {
  return /^\d/.test(versao) ? `v${versao}` : versao;
}

export function iniciaisDoNome(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}
