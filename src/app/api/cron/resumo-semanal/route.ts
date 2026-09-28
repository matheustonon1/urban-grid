import { NextRequest, NextResponse } from "next/server";

import { enviarResumosSemanaisPendentes } from "@/lib/resumoSemanal";

// Vercel Cron manda "Authorization: Bearer $CRON_SECRET" automaticamente
// quando essa env var está configurada no projeto (ver vercel.json) - sem
// essa checagem, qualquer um que descobrisse a URL podia disparar envios
// em massa pra base de usuários à vontade.
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  const autorizacao = request.headers.get("authorization");

  if (!segredo || autorizacao !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const resultado = await enviarResumosSemanaisPendentes();
  return NextResponse.json(resultado);
}
