// Mesma lógica de prisma/seed.ts (script fora da árvore de import de
// src/, por isso não compartilha este arquivo) - usada aqui pra gerar o
// slug de uma Cidade nova na aprovação de solicitação (ver
// aprovarSolicitacaoCidade em app/(admin)/solicitacoes-cidade/actions.ts).
export function slugificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
