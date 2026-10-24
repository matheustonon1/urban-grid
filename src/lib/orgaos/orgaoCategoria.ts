// Regra única de "o órgão atende esta categoria?", compartilhada entre o
// painel do órgão, a checagem de permissão pra responder e a página de
// detalhe da reclamação - um órgão sem nenhuma categoria atribuída
// atende qualquer uma (comportamento anterior à existência dessa
// atribuição, preservado como padrão).
export function orgaoAtendeCategoria(
  categoriasOrgao: { id: string }[],
  categoriaId: string
): boolean {
  return categoriasOrgao.length === 0 || categoriasOrgao.some((c) => c.id === categoriaId);
}
