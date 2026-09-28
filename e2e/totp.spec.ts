import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarCidadaoTeste, gerarCodigoTotpAtual, limparDadosTeste } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

test("ativa, exige no login e desativa a autenticação em duas etapas", async ({ page }) => {
  const { email, senha } = await criarCidadaoTeste();

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto("/painel/conta");
  await page.click('button:has-text("Ativar autenticador")');
  await page.waitForSelector("#codigo-totp");

  const usuarioPendente = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { totpSecret: true },
  });
  const codigo = await gerarCodigoTotpAtual(usuarioPendente.totpSecret!);

  await page.fill("#codigo-totp", codigo);
  await page.click('button:has-text("Confirmar")');
  await expect(page.getByText("Autenticação em duas etapas ativada")).toBeVisible();

  // Login volta a pedir senha + código a partir de agora.
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await expect(page.locator('input[name="codigoTotp"]')).toBeVisible();

  const usuarioAtivo = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { totpSecret: true },
  });
  // +30s de propósito - o código de ativação logo acima já consumiu a
  // janela atual (ver comentário em gerarCodigoTotpAtual em helpers.ts).
  const codigoLogin = await gerarCodigoTotpAtual(usuarioAtivo.totpSecret!, {
    segundosNoFuturo: 30,
  });

  await page.fill('input[name="senha"]', senha);
  await page.fill('input[name="codigoTotp"]', codigoLogin);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  // Sair e tentar logar de novo com o MESMO código (reuso) tem que falhar
  // - é a proteção contra replay de codigoTotpValido() em ação de ponta a
  // ponta, não só em unit test com prisma/otplib mockados.
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await expect(page.locator('input[name="codigoTotp"]')).toBeVisible();
  await page.fill('input[name="senha"]', senha);
  await page.fill('input[name="codigoTotp"]', codigoLogin);
  await page.click('button[type="submit"]');
  await expect(page.getByText("E-mail/CPF, senha ou código inválidos.")).toBeVisible();
  await expect(page).not.toHaveURL(/\/painel$/);

  // Desativa - precisa do campo de senha específico dessa seção, não o
  // de "Alterar senha" (os dois formulários usam name="senhaAtual").
  await page.goto("/painel/conta");
  const formDesativar = page.locator('form:has(button:has-text("Desativar autenticador"))');
  await formDesativar.locator('input[name="senhaAtual"]').fill(senha);
  await formDesativar.locator('button:has-text("Desativar autenticador")').click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("button", { name: "Ativar autenticador" })).toBeVisible();

  const usuarioFinal = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { totpConfirmadoEm: true },
  });
  expect(usuarioFinal.totpConfirmadoEm).toBeNull();
});
