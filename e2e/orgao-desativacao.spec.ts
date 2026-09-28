import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  criarAdminTeste,
  criarCidadaoTeste,
  criarOrgaoTeste,
  criarReclamacaoTeste,
  limparDadosTeste,
} from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
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
  await page.waitForTimeout(500);

  const orgaoDesativado = await prisma.orgao.findUniqueOrThrow({ where: { id: orgao.id } });
  expect(orgaoDesativado.ativo).toBe(false);

  await page.context().clearCookies();
  await login(page, emailOrgao, senhaOrgao);
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  // A própria UI já esconde o formulário pra um órgão inativo (ver
  // `podeResponder` em page.tsx) - defesa em profundidade com o guard
  // equivalente em responderReclamacao() do lado do servidor. A prova
  // aqui é dupla: o formulário nem aparece, e nenhuma resposta existe.
  await expect(page.getByText("Responder como órgão")).toHaveCount(0);

  const respostasComOrgaoInativo = await prisma.respostaOficial.count({
    where: { reclamacaoId: reclamacao.id },
  });
  expect(respostasComOrgaoInativo).toBe(0);

  await page.context().clearCookies();
  await login(page, emailAdmin, senhaAdmin);
  await page.goto("/orgaos-categorias");
  const cartaoOrgaoInativo = page.locator(`text=${orgao.nome}`).locator("..").locator("..");
  await cartaoOrgaoInativo.getByRole("button", { name: "Reativar" }).click();
  await page.waitForTimeout(500);

  const orgaoReativado = await prisma.orgao.findUniqueOrThrow({ where: { id: orgao.id } });
  expect(orgaoReativado.ativo).toBe(true);

  await page.context().clearCookies();
  await login(page, emailOrgao, senhaOrgao);
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await page.fill('textarea[name="texto"]', "Resposta depois de reativar o órgão.");
  await page.click('button:has-text("Enviar resposta")');
  await page.waitForTimeout(500);

  const respostasFinais = await prisma.respostaOficial.count({
    where: { reclamacaoId: reclamacao.id },
  });
  expect(respostasFinais).toBe(1);
});
