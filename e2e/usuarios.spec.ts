import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarAdminTeste, criarCidadaoTeste, limparDadosTeste } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

// Num build de produção, os <Link> da página pré-buscam rotas e a resposta de um
// prefetch ainda em voo reemite o cookie de sessão DEPOIS do clearCookies() (no
// `npm run dev` não há prefetch). Sair da página antes cancela esses pedidos.
async function sairDaSessao(page: import("@playwright/test").Page) {
  await page.goto("about:blank");
  await page.context().clearCookies();
}

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
}

test("admin promove cidadão a moderador e depois rebaixa de volta", async ({ page }) => {
  const { email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();
  const { usuario, email, senha } = await criarCidadaoTeste();

  await login(page, emailAdmin, senhaAdmin);
  await page.goto(`/usuarios?q=${encodeURIComponent(email)}`);

  const cartao = page.locator(`text=${email}`).locator("..").locator("..");
  await cartao.locator('select[name="papel"]').selectOption("MODERADOR");
  await cartao.getByRole("button", { name: "Salvar" }).click();
  await page.waitForTimeout(500);

  const usuarioPromovido = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
  expect(usuarioPromovido.papel).toBe("MODERADOR");

  // Confirma que o papel novo realmente destranca a área de moderador,
  // não só que o campo mudou no banco.
  await sairDaSessao(page);
  await login(page, email, senha);
  await page.goto("/moderacao");
  await expect(page).toHaveURL(/\/moderacao$/);

  await sairDaSessao(page);
  await login(page, emailAdmin, senhaAdmin);
  await page.goto(`/usuarios?q=${encodeURIComponent(email)}`);
  const cartaoDeNovo = page.locator(`text=${email}`).locator("..").locator("..");
  await cartaoDeNovo.locator('select[name="papel"]').selectOption("CIDADAO");
  await cartaoDeNovo.getByRole("button", { name: "Salvar" }).click();
  await page.waitForTimeout(500);

  const usuarioRebaixado = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
  expect(usuarioRebaixado.papel).toBe("CIDADAO");
});

test("admin não consegue alterar o próprio papel pela tela", async ({ page }) => {
  const { usuario, email, senha } = await criarAdminTeste();

  await login(page, email, senha);
  await page.goto(`/usuarios?q=${encodeURIComponent(email)}`);
  await expect(page.getByText("Você não pode alterar seu próprio papel")).toBeVisible();

  const papelAntes = usuario.papel;
  const usuarioDepois = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
  expect(usuarioDepois.papel).toBe(papelAntes);
});
