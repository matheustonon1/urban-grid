import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  confirmarDialogo,
  criarAdminTeste,
  criarCidadaoTeste,
  criarOrgaoTeste,
  criarReclamacaoTeste,
  limparDadosTeste,
} from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

// Num build de produção, os <Link> da página pré-buscam rotas e a resposta de um prefetch ainda
// em voo reemite o cookie de sessão DEPOIS do clearCookies() (no `npm run dev` não há prefetch):
// o /login então redireciona por a sessão "voltar" e o formulário nunca aparece. Sair da página
// antes cancela esses pedidos. O painel do órgão, cheio de links, tornou isso frequente.
async function sairDaSessao(page: import("@playwright/test").Page) {
  await page.goto("about:blank");
  await page.context().clearCookies();
}

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  // A conta de órgão entra em /orgao; as demais em /painel.
  await page.waitForURL(/\/(painel|orgao)$/);
}

test("desativar um órgão bloqueia resposta oficial, reativar libera de novo", async ({ page }) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { orgao, email: emailOrgao, senha: senhaOrgao } = await criarOrgaoTeste(cidade.id);
  const { usuario: autor } = await criarCidadaoTeste();
  const reclamacao = await criarReclamacaoTeste(autor.id, { cidadeId: cidade.id });
  const { email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();

  await login(page, emailAdmin, senhaAdmin);
  await page.goto("/orgaos-categorias");
  const cartaoOrgao = page.locator(`text=${orgao.nome}`).locator("..").locator("..");
  await cartaoOrgao.getByRole("button", { name: "Desativar" }).click();
  await confirmarDialogo(page, "Desativar órgão");
  await expect(page.getByText(/foi desativado/)).toBeVisible();

  const orgaoDesativado = await prisma.orgao.findUniqueOrThrow({ where: { id: orgao.id } });
  expect(orgaoDesativado.ativo).toBe(false);

  await sairDaSessao(page);
  await login(page, emailOrgao, senhaOrgao);
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  // A própria UI já esconde o formulário pra um órgão inativo (ver
  // `podeResponder` em page.tsx) - defesa em profundidade com o guard
  // equivalente em responderReclamacao() do lado do servidor. A prova
  // aqui é dupla: o formulário nem aparece, e nenhuma resposta existe.
  await expect(page.getByText("Responder como órgão")).toHaveCount(0);
  // E a tela diz por quê, em vez de o formulário simplesmente sumir.
  await expect(page.getByText(/Seu órgão está desativado|O seu órgão está desativado/)).toBeVisible();

  // No painel, o órgão vê a fila mas não tem como responder: aviso no topo e nenhum "Responder".
  await page.goto("/orgao");
  await expect(page.getByText(/Seu órgão está desativado/)).toBeVisible();
  await expect(page.getByText("Responder", { exact: true })).toHaveCount(0);

  const respostasComOrgaoInativo = await prisma.respostaOficial.count({
    where: { reclamacaoId: reclamacao.id },
  });
  expect(respostasComOrgaoInativo).toBe(0);

  await sairDaSessao(page);
  await login(page, emailAdmin, senhaAdmin);
  await page.goto("/orgaos-categorias");
  const cartaoOrgaoInativo = page.locator(`text=${orgao.nome}`).locator("..").locator("..");
  await cartaoOrgaoInativo.getByRole("button", { name: "Reativar" }).click();
  // Espera o retorno da ação (não um tempo fixo): sair da página com a ação ainda
  // em voo deixa a resposta reemitir o cookie de sessão depois do clearCookies.
  await expect(page.getByText(/foi reativado/)).toBeVisible();

  const orgaoReativado = await prisma.orgao.findUniqueOrThrow({ where: { id: orgao.id } });
  expect(orgaoReativado.ativo).toBe(true);

  await sairDaSessao(page);
  await login(page, emailOrgao, senhaOrgao);
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await page.fill('textarea[name="texto"]', "Resposta depois de reativar o órgão.");
  await page.click('button:has-text("Enviar resposta")');
  await expect(page.getByText("Resposta oficial enviada. O autor foi avisado.")).toBeVisible();

  const respostasFinais = await prisma.respostaOficial.count({
    where: { reclamacaoId: reclamacao.id },
  });
  expect(respostasFinais).toBe(1);
});
