import type { TomEtiqueta } from "@/components/ui/etiqueta";

import { hostDoLink } from "./linkOficial";

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

export function dominioInstitucional(dominio: string): boolean {
  return SUFIXOS_INSTITUCIONAIS.some((sufixo) => dominio.endsWith(sufixo));
}

export type TipoDominio = "institucional" | "pessoal" | "proprio";

export function classificarDominioEmail(email: string): { tipo: TipoDominio; dominio: string } {
  const dominio = email.slice(email.lastIndexOf("@") + 1).trim().toLowerCase();

  if (dominioInstitucional(dominio)) {
    return { tipo: "institucional", dominio };
  }
  if (PROVEDORES_PESSOAIS.has(dominio)) {
    return { tipo: "pessoal", dominio };
  }
  return { tipo: "proprio", dominio };
}

// O site oficial informado, frente ao e-mail do pedido: um .gov.br é indício forte; o mesmo
// domínio do e-mail mostra coerência (quem escreve do domínio do site); domínios sem relação
// pedem conferência (o e-mail pode ser de um provedor, ou o link de outro órgão).
export type RelacaoLinkEmail = "institucional" | "mesmoDominio" | "outroDominio";

export function relacionarLinkComEmail(
  link: string,
  email: string
): { relacao: RelacaoLinkEmail; dominio: string } {
  const host = hostDoLink(link).replace(/^www\./, "");
  const dominioEmail = classificarDominioEmail(email).dominio.replace(/^www\./, "");

  if (dominioInstitucional(host)) return { relacao: "institucional", dominio: host };
  if (
    host === dominioEmail ||
    host.endsWith(`.${dominioEmail}`) ||
    dominioEmail.endsWith(`.${host}`)
  ) {
    return { relacao: "mesmoDominio", dominio: host };
  }
  return { relacao: "outroDominio", dominio: host };
}

export type SinalSolicitacao =
  | { chave: "orgaoJaExiste"; tom: TomEtiqueta; count: number }
  | { chave: "cnpjEmOutroOrgao"; tom: TomEtiqueta; count: number }
  | { chave: "linkInstitucional"; tom: TomEtiqueta; dominio: string }
  | { chave: "linkMesmoDominio"; tom: TomEtiqueta; dominio: string }
  | { chave: "linkOutroDominio"; tom: TomEtiqueta; dominio: string }
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
  linkOficial = null,
  orgaosComMesmoCnpj = 0,
}: {
  email: string;
  // null = pedido anterior ao campo, sem site para conferir.
  linkOficial?: string | null;
  // Outros órgãos (de qualquer cidade) já cadastrados com o mesmo CNPJ. Não é erro - uma
  // secretaria costuma usar o CNPJ da prefeitura -, mas o admin precisa saber.
  orgaosComMesmoCnpj?: number;
  // null = não existe órgão com esse nome nessa cidade.
  responsaveisDoOrgaoExistente: number | null;
  rejeicoesAnteriores: number;
}): SinalSolicitacao[] {
  const sinais: SinalSolicitacao[] = [];

  if (responsaveisDoOrgaoExistente !== null) {
    sinais.push({ chave: "orgaoJaExiste", tom: "atencao", count: responsaveisDoOrgaoExistente });
  }

  if (orgaosComMesmoCnpj > 0) {
    sinais.push({ chave: "cnpjEmOutroOrgao", tom: "atencao", count: orgaosComMesmoCnpj });
  }

  const { tipo, dominio } = classificarDominioEmail(email);
  if (tipo === "institucional") {
    sinais.push({ chave: "dominioInstitucional", tom: "sucesso", dominio });
  } else if (tipo === "pessoal") {
    sinais.push({ chave: "dominioPessoal", tom: "atencao", dominio });
  } else {
    sinais.push({ chave: "dominioProprio", tom: "neutro", dominio });
  }

  if (linkOficial) {
    const { relacao, dominio: dominioLink } = relacionarLinkComEmail(linkOficial, email);
    if (relacao === "institucional") {
      sinais.push({ chave: "linkInstitucional", tom: "sucesso", dominio: dominioLink });
    } else if (relacao === "mesmoDominio") {
      sinais.push({ chave: "linkMesmoDominio", tom: "neutro", dominio: dominioLink });
    } else {
      sinais.push({ chave: "linkOutroDominio", tom: "atencao", dominio: dominioLink });
    }
  }

  if (rejeicoesAnteriores > 0) {
    sinais.push({ chave: "jaRejeitada", tom: "atencao", count: rejeicoesAnteriores });
  }

  return sinais;
}
