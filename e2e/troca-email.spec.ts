import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarCidadaoTeste, emailTeste, limparDadosTeste } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

test("fluxo completo de troca de e-mail com confirmação", async ({ page }) => {
  const { usuario, email, senha } = await criarCidadaoTeste();
  const novoEmail = emailTeste("novo-email");

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto("/painel/conta");
  await page.fill("#email-novo", novoEmail);
  await page.fill("#email-senha-atual", senha);
  await page.click('button:has-text("Enviar link de confirmação")');
  await expect(page.getByText(`Enviamos um link de confirmação para ${novoEmail}`)).toBeVisible();

  // Login com o e-mail antigo ainda funciona nesse ponto - troca só vale
  // depois de confirmada pelo link, não no momento do pedido.
  const registro = await prisma.verificationToken.findFirstOrThrow({
    where: { identifier: { contains: `trocar-email:${usuario.id}:` } },
  });
  const token = registro.token;

  await page.goto(`/confirmar-email/${token}`);
  await expect(page.getByRole("heading", { name: "E-mail atualizado!" })).toBeVisible();

  // Sessão antiga tem que cair (senhaAlteradaEm reusado como invalidação
  // de sessão, igual troca de senha) - acessar o painel manda pro login.
  await page.goto("/painel");
  await page.waitForURL(/\/login/);

  // Login com o e-mail ANTIGO não deve mais funcionar.
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await expect(page.getByText("E-mail/CPF ou senha inválidos.")).toBeVisible();

  // Login com o e-mail NOVO deve funcionar.
  await page.goto("/login");
  await page.fill('input[name="identificador"]', novoEmail);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await prisma.user.deleteMany({ where: { id: usuario.id } });
});

test("pede senha atual correta antes de mandar o link de troca", async ({ page }) => {
  const { email, senha } = await criarCidadaoTeste();

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto("/painel/conta");
  await page.fill("#email-novo", emailTeste("novo-email"));
  await page.fill("#email-senha-atual", "SenhaErrada999");
  await page.click('button:has-text("Enviar link de confirmação")');
  await expect(page.getByText("Senha incorreta.")).toBeVisible();
});

test("não permite trocar para um e-mail já usado por outra conta", async ({ page }) => {
  const outraConta = await criarCidadaoTeste();
  const { email, senha } = await criarCidadaoTeste();

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto("/painel/conta");
  await page.fill("#email-novo", outraConta.email);
  await page.fill("#email-senha-atual", senha);
  await page.click('button:has-text("Enviar link de confirmação")');
  await expect(page.getByText("Já existe uma conta com este e-mail.")).toBeVisible();
});
