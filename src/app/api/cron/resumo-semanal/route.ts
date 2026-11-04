import { NextRequest, NextResponse } from "next/server";

import { enviarResumosDeOrgaosPendentes } from "@/lib/notificacoes/resumoOrgao";
import { enviarResumosSemanaisPendentes } from "@/lib/notificacoes/resumoSemanal";

// Roda a etapa e devolve o resultado ou o erro, sem lançar: uma etapa falhar não pode impedir a
// outra de rodar.
async function tentar<T>(nome: string, etapa: () => Promise<T>) {
  try {
    return { ok: true as const, valor: await etapa() };
  } catch (erro) {
    console.error(`Falha no resumo semanal (${nome}):`, erro);
    return { ok: false as const };
  }
}

// Vercel Cron manda "Authorization: Bearer $CRON_SECRET" automaticamente
// quando essa env var está configurada no projeto (ver vercel.json) - sem
// essa checagem, qualquer um que descobrisse a URL podia disparar envios
// em massa pra base de usuários à vontade.
//
// Uma execução, dois resumos: o dos assinantes de cidade (resultado na raiz, como sempre foi) e
// o da fila de cada conta de órgão (`orgaos`). Em sequência, não em paralelo: os dois mandam
// e-mail pelo mesmo provedor, que limita as requisições por segundo.
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  const autorizacao = request.headers.get("authorization");

  if (!segredo || autorizacao !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const assinaturas = await tentar("assinaturas", enviarResumosSemanaisPendentes);
  const orgaos = await tentar("órgãos", enviarResumosDeOrgaosPendentes);

  return NextResponse.json(
    {
      ...(assinaturas.ok ? assinaturas.valor : { erro: "falhou" }),
      orgaos: orgaos.ok ? orgaos.valor : { erro: "falhou" },
    },
    // 500 quando algo falhou, para o painel da Vercel mostrar a execução como erro.
    { status: assinaturas.ok && orgaos.ok ? 200 : 500 }
  );
}
