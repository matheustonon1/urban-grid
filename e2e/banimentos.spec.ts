import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarAdminTeste, criarCidadaoTeste, limparDadosTeste } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

test("admin reverte um banimento e a conta volta a logar", async ({ page }) => {
  const { email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();
  const { usuario, email, senha } = await criarCidadaoTeste();

  await prisma.user.update({
    where: { id: usuario.id },
    data: { banidoAte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });

  // Conta banida não consegue logar - confirma o estado inicial antes de
  // reverter, pra não testar um "reverter" que na prática não mudou nada.
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await expect(page.getByText("Esta conta está suspensa.")).toBeVisible();

  await page.fill('input[name="identificador"]', emailAdmin);
  await page.fill('input[name="senha"]', senhaAdmin);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto("/banimentos");
  const cartao = page.locator(`text=${usuario.name}`).locator("..").locator("..");
  await cartao.getByRole("button", { name: "Reverter banimento" }).click();
  await page.waitForTimeout(500);

  const usuarioAtualizado = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
  expect(usuarioAtualizado.banidoAte).toBeNull();

  // Sessão do admin precisa ser encerrada antes de tentar logar como o
  // cidadão - sem isto, o formulário de login nem aparece (redirect pra
  // /painel de quem já está autenticado).
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
});
