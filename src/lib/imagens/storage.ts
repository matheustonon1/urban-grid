import { put } from "@vercel/blob";

// nomeArquivo vem de arquivo.name (client-side, no formulário de nova
// reclamação) - controlado por quem faz upload, sem nenhuma sanitização
// antes disto. Sem isto, um nome como "../outra-reclamacao/x.png" ou com
// barras embutidas mudava a estrutura da chave que sai do prefixo
// "reclamacoes/{id}/" esperado. addRandomSuffix já garante unicidade;
// isto é só sobre não deixar o nome do arquivo moldar o caminho no
// object storage.
export function sanitizarNomeArquivo(nomeArquivo: string): string {
  const nomeBase = nomeArquivo.split(/[/\\]/).pop() || "arquivo";
  const seguro = nomeBase.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  return seguro || "arquivo";
}

export async function uploadImagem(
  buffer: Buffer,
  {
    reclamacaoId,
    nomeArquivo,
    mimeType,
  }: { reclamacaoId: string; nomeArquivo: string; mimeType: string }
): Promise<string> {
  const blob = await put(`reclamacoes/${reclamacaoId}/${sanitizarNomeArquivo(nomeArquivo)}`, buffer, {
    access: "public",
    contentType: mimeType,
    addRandomSuffix: true,
  });

  return blob.url;
}
