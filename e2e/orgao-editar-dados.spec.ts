import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarAdminTeste, criarOrgaoTeste, limparDadosTeste } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

test("admin edita nome, sigla e e-mail de um órgão já aprovado", async ({ page }) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { orgao } = await criarOrgaoTeste(cidade.id);
  const { email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();

  await page.goto("/login");
  await page.fill('input[name="identificador"]', emailAdmin);
  await page.fill('input[name="senha"]', senhaAdmin);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto("/orgaos-categorias");
  const cartao = page.locator(`text=${orgao.nome}`).locator("..").locator("..").locator("..");
  await cartao.getByText("Editar dados").click();

  const novoNome = `${orgao.nome} (corrigido)`;
  await cartao.locator('input[name="nome"]').fill(novoNome);
  await cartao.locator('input[name="sigla"]').fill("NOVA");
  await cartao.locator('input[name="email"]').fill("novo-email@example.com");
  await cartao.getByRole("button", { name: "Salvar dados" }).click();
  await page.waitForTimeout(500);

  const orgaoAtualizado = await prisma.orgao.findUniqueOrThrow({ where: { id: orgao.id } });
  expect(orgaoAtualizado.nome).toBe(novoNome);
  expect(orgaoAtualizado.sigla).toBe("NOVA");
  expect(orgaoAtualizado.email).toBe("novo-email@example.com");
});
