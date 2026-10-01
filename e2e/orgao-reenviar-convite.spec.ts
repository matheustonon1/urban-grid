import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarAdminTeste, emailTeste, limparDadosTeste } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

test("admin reenvia convite pra órgão que nunca definiu senha", async ({ page }) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const emailOrgao = emailTeste("convite-pendente");

  const orgao = await prisma.orgao.create({
    data: { nome: `Órgão Convite Pendente E2E ${Date.now()}`, cidadeId: cidade.id },
  });
  await prisma.user.create({
    data: {
      name: "Representante Pendente E2E",
      email: emailOrgao,
      papel: "ORGAO",
      orgaoId: orgao.id,
      // senhaHash nulo de propósito - é exatamente o estado "convite
      // nunca aceito" que reenviarConviteOrgao precisa resolver.
      senhaHash: null,
    },
  });

  const { email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();
  await page.goto("/login");
  await page.fill('input[name="identificador"]', emailAdmin);
  await page.fill('input[name="senha"]', senhaAdmin);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto("/orgaos-categorias");
  const cartao = page.locator(`text=${orgao.nome}`).locator("..").locator("..").locator("..");
  await expect(cartao.getByText("Convite pendente")).toBeVisible();

  await cartao.getByRole("button", { name: `Reenviar convite para ${emailOrgao}` }).click();
  await page.waitForTimeout(500);

  const tokenCriado = await prisma.verificationToken.findFirst({
    where: { identifier: emailOrgao },
  });
  expect(tokenCriado).not.toBeNull();
  expect(tokenCriado!.expires.getTime()).toBeGreaterThan(Date.now());

  await prisma.verificationToken.deleteMany({ where: { identifier: emailOrgao } });
  await prisma.user.deleteMany({ where: { email: emailOrgao } });
  await prisma.orgao.delete({ where: { id: orgao.id } });
});
