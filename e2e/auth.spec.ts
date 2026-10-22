import { expect, test } from "@playwright/test";

import { emailTeste, gerarCpfValido, limparDadosTeste } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

test.describe("cadastro e login", () => {
  test("cadastro cria conta e loga automaticamente", async ({ page }) => {
    const email = emailTeste("cadastro");

    await page.goto("/cadastro");
    await page.fill('input[name="nome"]', "Usuário E2E");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="cpf"]', gerarCpfValido());
    await page.fill('input[name="senha"]', "SenhaForte123");
    await page.fill('input[name="confirmarSenha"]', "SenhaForte123");
    await page.check('input[name="aceitaTermos"]');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/painel$/);
  });

  test("login com senha errada mostra erro genérico (sem revelar se a conta existe)", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.fill('input[name="identificador"]', emailTeste("inexistente"));
    await page.fill('input[name="senha"]', "qualquercoisa");
    await page.click('button[type="submit"]');

    await expect(page.getByText("E-mail/CPF ou senha inválidos.")).toBeVisible();
  });

  test("bloqueia login por 5 tentativas de senha erradas, mesmo com a senha certa na 6ª", async ({
    page,
  }) => {
    const email = emailTeste("lockout");
    const senha = "SenhaForte123";

    await page.goto("/cadastro");
    await page.fill('input[name="nome"]', "Usuário Lockout");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="cpf"]', gerarCpfValido());
    await page.fill('input[name="senha"]', senha);
    await page.fill('input[name="confirmarSenha"]', senha);
    await page.check('input[name="aceitaTermos"]');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/painel$/);

    // O cadastro loga automaticamente - sem isto, /login redireciona
    // direto pro painel (usuário já autenticado) e o formulário de login
    // usado no loop abaixo nunca chega a aparecer.
    await page.context().clearCookies();

    for (let tentativa = 1; tentativa <= 5; tentativa++) {
      await page.goto("/login");
      await page.fill('input[name="identificador"]', email);
      await page.fill('input[name="senha"]', "senhaErrada");
      await page.click('button[type="submit"]');
      await expect(page.getByText("E-mail/CPF ou senha inválidos.")).toBeVisible();
    }

    await page.goto("/login");
    await page.fill('input[name="identificador"]', email);
    await page.fill('input[name="senha"]', senha);
    await page.click('button[type="submit"]');

    await expect(
      page.getByText("Muitas tentativas de login incorretas. Aguarde alguns minutos e tente novamente.")
    ).toBeVisible();
  });
});
