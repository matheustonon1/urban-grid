import { montarExportacaoDados } from "@/lib/conta/exportarDados";
import { exigirSessao } from "@/lib/seguranca/sessao";

// GET de propósito (é um link de download, não um formulário), mas só
// devolve os dados de quem está logado - o id vem da sessão, nunca da URL.
export async function GET() {
  const session = await exigirSessao();

  const dados = await montarExportacaoDados(session.user.id);
  const dia = dados.geradoEm.toISOString().slice(0, 10);

  return new Response(JSON.stringify(dados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="urban-grid-meus-dados-${dia}.json"`,
      // Dados pessoais: nada de cache compartilhado ou do navegador.
      "Cache-Control": "no-store",
    },
  });
}
