import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { excedeuLimitePorIp } from "@/lib/rateLimitMemoria";

const LIMITE = 20;
const LIMITE_CONSULTAS_POR_IP_MINUTO = 120;

const SELECT = {
  id: true,
  nome: true,
  slug: true,
  estado: { select: { uf: true, nome: true } },
} as const;

const ORDEM = [{ estado: { nome: "asc" } }, { nome: "asc" }] as const;

function formatar(cidade: {
  id: string;
  nome: string;
  slug: string;
  estado: { uf: string; nome: string };
}) {
  return {
    id: cidade.id,
    nome: cidade.nome,
    slug: cidade.slug,
    uf: cidade.estado.uf,
    estadoNome: cidade.estado.nome,
  };
}

export async function GET(request: NextRequest) {
  const termo = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (termo.length < 2 || termo.length > 80) {
    return NextResponse.json([]);
  }

  // Autocomplete dispara uma consulta por tecla (com debounce de 300ms no
  // cliente) - o limite é folgado pra uso normal, mas impede martelar o
  // banco com LIKE '%...%' em loop.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (excedeuLimitePorIp("cidades", ip, LIMITE_CONSULTAS_POR_IP_MINUTO, 60_000)) {
    return NextResponse.json([], { status: 429 });
  }

  const partes = termo.split(/\s+-\s+/);
  const possivelUf = partes.length > 1 ? partes[partes.length - 1].trim() : null;
  const ufExplicita =
    possivelUf && /^[A-Za-z]{2}$/.test(possivelUf)
      ? possivelUf.toUpperCase()
      : null;
  const nomeBusca = ufExplicita ? partes.slice(0, -1).join(" - ").trim() : termo;
  const ufComoTermo = /^[A-Za-z]{2}$/.test(nomeBusca)
    ? nomeBusca.toUpperCase()
    : null;

  // Nome da cidade tem prioridade: quem digita "São Paulo" quer a cidade
  // São Paulo, não a lista alfabética de municípios do estado de São Paulo.
  // Dentro dos resultados, organiza por estado e depois por nome.
  const porNomeDaCidade = await prisma.cidade.findMany({
    where: ufExplicita
      ? { nome: { contains: nomeBusca }, estado: { uf: ufExplicita } }
      : {
          OR: [
            { nome: { contains: nomeBusca } },
            ...(ufComoTermo ? [{ estado: { uf: ufComoTermo } }] : []),
          ],
        },
    orderBy: [...ORDEM],
    take: LIMITE,
    select: SELECT,
  });

  let resultado = porNomeDaCidade;

  // Se sobrar espaço, complementa com cidades do estado cujo nome bate
  // com a busca (ex.: digitar "São Paulo" também pode listar municípios
  // do estado, mas só depois de mostrar a própria cidade).
  if (!ufExplicita && resultado.length < LIMITE) {
    const complemento = await prisma.cidade.findMany({
      where: {
        estado: { nome: { contains: nomeBusca } },
        id: { notIn: resultado.map((cidade) => cidade.id) },
      },
      orderBy: [...ORDEM],
      take: LIMITE - resultado.length,
      select: SELECT,
    });
    resultado = [...resultado, ...complemento];
  }

  return NextResponse.json(resultado.map(formatar));
}
