import type { Idioma } from "@/i18n/config";

// Nome de categoria é dado de cadastro (Categoria.nome), não conteúdo
// i18n do sistema de mensagens - por isso não vive em messages/*.json com
// o resto das traduções da UI, e sim aqui, indexado pelo slug (estável,
// diferente do nome exibido) num mapa à parte. Usado hoje só no e-mail de
// resumo semanal (src/lib/resumoSemanal.ts) - o nome de categoria exibido
// nas páginas do site (lista de reclamações, painel de órgão etc.) ainda
// não passa por isso, e continua sempre em português; estender pra lá é
// só questão de chamar esta função nesses lugares também.
const NOMES_EN: Record<string, string> = {
  "iluminacao-publica": "Public lighting",
  "buracos-e-pavimentacao": "Potholes and paving",
  "coleta-de-lixo": "Garbage collection",
  "saneamento-e-esgoto": "Sanitation and sewage",
  "sinalizacao-de-transito": "Traffic signage",
  "pracas-e-areas-verdes": "Parks and green areas",
  "poluicao-sonora": "Noise pollution",
  "poluicao-e-queimadas": "Pollution and burning",
  "transporte-publico": "Public transportation",
  "obras-irregulares": "Irregular construction",
  "animais-e-zoonoses": "Animals and zoonoses",
  "seguranca-publica": "Public safety",
  acessibilidade: "Accessibility",
  "saude-publica": "Public health",
  outros: "Other",
};

// Sem tradução cadastrada pro slug (categoria nova, criada depois desta
// lista) - volta pro nome original em vez de quebrar ou mostrar "undefined".
export function nomeCategoriaTraduzido(
  slug: string,
  nomeOriginal: string,
  locale: Idioma
): string {
  if (locale === "en") {
    return NOMES_EN[slug] ?? nomeOriginal;
  }
  return nomeOriginal;
}
