import type { TomEtiqueta } from "@/components/ui/etiqueta";

// Indícios que ajudam o admin a decidir um pedido de acesso como órgão. NÃO são prova:
// quem preenche o formulário escreve o nome do órgão e o e-mail que quiser, e a decisão
// continua sendo humana (confirmar o vínculo no site oficial do órgão ou por telefone). O que
// estes sinais fazem é tirar da frente o que o admin não via - o domínio do e-mail, um órgão
// que já existe com aquele nome, um pedido que já foi rejeitado.

// Sufixos reservados a órgãos de governo no Brasil: o Registro.br só delega domínios sob eles
// a esse tipo de entidade, então um e-mail ali é um indício forte (não conclusivo - a pessoa
// do e-mail pode não ser quem diz ser). Muita prefeitura usa `.com.br` ou `.org.br`; esses
// caem em "domínio próprio" e pedem conferência manual.
const SUFIXOS_INSTITUCIONAIS = [".gov.br", ".leg.br", ".jus.br", ".mp.br", ".def.br", ".mil.br"];

// Provedores de e-mail gratuito: qualquer pessoa abre uma conta com o nome que quiser.
const PROVEDORES_PESSOAIS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "ig.com.br",
  "globo.com",
  "globomail.com",
]);

export type TipoDominio = "institucional" | "pessoal" | "proprio";

export function classificarDominioEmail(email: string): { tipo: TipoDominio; dominio: string } {
  const dominio = email.slice(email.lastIndexOf("@") + 1).trim().toLowerCase();

  if (SUFIXOS_INSTITUCIONAIS.some((sufixo) => dominio.endsWith(sufixo))) {
    return { tipo: "institucional", dominio };
  }
  if (PROVEDORES_PESSOAIS.has(dominio)) {
    return { tipo: "pessoal", dominio };
  }
  return { tipo: "proprio", dominio };
}

export type SinalSolicitacao =
  | { chave: "orgaoJaExiste"; tom: TomEtiqueta; count: number }
  | { chave: "dominioInstitucional"; tom: TomEtiqueta; dominio: string }
  | { chave: "dominioPessoal"; tom: TomEtiqueta; dominio: string }
  | { chave: "dominioProprio"; tom: TomEtiqueta; dominio: string }
  | { chave: "jaRejeitada"; tom: TomEtiqueta; count: number };

// Do que mais pesa para o que menos pesa: um órgão que já existe é o que muda o efeito de
// aprovar (a conta nova passa a falar em nome de um órgão que já tem responsáveis).
export function sinaisDaSolicitacao({
  email,
  responsaveisDoOrgaoExistente,
  rejeicoesAnteriores,
}: {
  email: string;
  // null = não existe órgão com esse nome nessa cidade.
  responsaveisDoOrgaoExistente: number | null;
  rejeicoesAnteriores: number;
}): SinalSolicitacao[] {
  const sinais: SinalSolicitacao[] = [];

  if (responsaveisDoOrgaoExistente !== null) {
    sinais.push({ chave: "orgaoJaExiste", tom: "atencao", count: responsaveisDoOrgaoExistente });
  }

  const { tipo, dominio } = classificarDominioEmail(email);
  if (tipo === "institucional") {
    sinais.push({ chave: "dominioInstitucional", tom: "sucesso", dominio });
  } else if (tipo === "pessoal") {
    sinais.push({ chave: "dominioPessoal", tom: "atencao", dominio });
  } else {
    sinais.push({ chave: "dominioProprio", tom: "neutro", dominio });
  }

  if (rejeicoesAnteriores > 0) {
    sinais.push({ chave: "jaRejeitada", tom: "atencao", count: rejeicoesAnteriores });
  }

  return sinais;
}
