import type { AbstractIntlMessages } from "next-intl";

// O que vai para o NAVEGADOR no NextIntlClientProvider do layout raiz.
//
// Antes o layout entregava o catálogo inteiro (messages/pt-BR.json, ~90 KB), serializado no HTML de
// TODA página, para só um punhado de componentes de cliente que usam `useTranslations`. Os Server
// Components traduzem no servidor (`getTranslations`) e não precisam disso no navegador.
//
// Esta lista tem os namespaces que algum componente de cliente (um arquivo "use client" ou o que ele
// importa) pode pedir. Falta de um namespace aqui não quebra o build: o componente mostraria a chave
// crua ("Login.titulo") no navegador. Por isso `mensagensDoCliente.test.ts` segue as importações de
// cada rota e FALHA quando um namespace usado no cliente não está listado (e quando a lista guarda um
// que ninguém mais usa). Ao criar um componente de cliente com `useTranslations("Novo")`, rode
// `npm test` e acrescente "Novo" aqui.
export const NAMESPACES_DO_CLIENTE = [
  "Acao",
  "AdminNav",
  "Assinaturas",
  "Cadastro",
  "CidadeDetalhe",
  "Conta",
  "DefinirSenhaOrgao",
  "EsqueciSenha",
  "ErrorBoundary",
  "Footer",
  "Header",
  "Idioma",
  "Login",
  "NovaReclamacao",
  "Notificacoes",
  "OrgaosCategorias",
  "RedefinirSenha",
  "Reclamacoes",
  "SolicitacoesOrgao",
  "SolicitarCidade",
  "Termos",
  "TermosModal",
  "ThemeToggle",
  "Totp",
  "UserMenu",
] as const;

export function selecionarMensagens(
  mensagens: AbstractIntlMessages,
  namespaces: readonly string[] = NAMESPACES_DO_CLIENTE
): AbstractIntlMessages {
  const escolhidas: AbstractIntlMessages = {};
  for (const namespace of namespaces) {
    if (namespace in mensagens) escolhidas[namespace] = mensagens[namespace];
  }
  return escolhidas;
}
