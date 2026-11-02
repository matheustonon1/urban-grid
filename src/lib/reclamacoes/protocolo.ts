import { prisma } from "@/lib/prisma";

export function prefixoProtocolo(ano: number): string {
  return `UG-${ano}-`;
}

// Baseado no maior número já existente, não na contagem de linhas - uma
// reclamação apagada (ex.: dado de teste) deixa um "buraco" na sequência,
// e contar linhas geraria um número que já existe.
export function proximoProtocolo(prefixo: string, ultimoProtocolo: string | null): string {
  const ultimoNumero = ultimoProtocolo
    ? parseInt(ultimoProtocolo.slice(prefixo.length), 10)
    : 0;
  const sequencial = String(ultimoNumero + 1).padStart(7, "0");
  return `${prefixo}${sequencial}`;
}

export async function gerarProtocolo(): Promise<string> {
  const prefixo = prefixoProtocolo(new Date().getFullYear());

  const ultima = await prisma.reclamacao.findFirst({
    where: { protocolo: { startsWith: prefixo } },
    orderBy: { protocolo: "desc" },
    select: { protocolo: true },
  });

  return proximoProtocolo(prefixo, ultima?.protocolo ?? null);
}
