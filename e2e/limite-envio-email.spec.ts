import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarCidadaoTeste, emailTeste, limparDadosTeste, PREFIXO_TESTE } from "./helpers";

test.afterAll(async () => {
  // Tokens de troca de e-mail carregam o e-mail novo no identifier (com o
  // prefixo de teste) e não são cobertos por limparDadosTeste().
  await prisma.verificationToken.deleteMany({ where: { identifier: { contains: PREFIXO_TESTE } } });
  await limparDadosTeste();
});

async function login(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
}

test("reenviar o e-mail de verificação tem limite (3 a cada 10 min)", async ({ page }) => {
  const { email, senha } = await criarCidadaoTeste({ emailVerificado: false });
  await login(page, email, senha);
  await page.goto("/painel/conta");

  const botao = page.getByRole("button", { name: "Reenviar e-mail de verificação" });
  for (let i = 0; i < 3; i++) {
    await botao.click();
    await expect(page.getByText(`Enviamos um novo link de verificação para ${email}.`)).toBeVisible();
  }

  await botao.click();
  await expect(page.getByText("Você pediu muitos e-mails em pouco tempo")).toBeVisible();
});

test("pedir a troca de e-mail tem limite (5 por hora)", async ({ page }) => {
  const { email, senha } = await criarCidadaoTeste();
  await login(page, email, senha);
  await page.goto("/painel/conta");

  const formulario = page.locator('form:has(#email-novo)');
  for (let i = 0; i < 5; i++) {
    const novo = emailTeste(`novo${i}`);
    await formulario.locator("#email-novo").fill(novo);
    await formulario.locator("#email-senha-atual").fill(senha);
    await formulario.getByRole("button", { name: "Enviar link de confirmação" }).click();
    await expect(formulario.getByText(`Enviamos um link de confirmação para ${novo}.`)).toBeVisible();
  }

  await formulario.locator("#email-novo").fill(emailTeste("excedente"));
  await formulario.locator("#email-senha-atual").fill(senha);
  await formulario.getByRole("button", { name: "Enviar link de confirmação" }).click();
  await expect(formulario.getByText("Você pediu muitos e-mails em pouco tempo")).toBeVisible();
});
