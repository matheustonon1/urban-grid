import { expect, test } from "@playwright/test";

import { criarCidadaoTeste, limparDadosTeste } from "./helpers";
import { prisma } from "@/lib/prisma";
import { criarTokenRedefinicaoSenha, criarTokenVerificacao } from "@/lib/email";

test.afterAll(async () => {
  await limparDadosTeste();
});

test("fluxo completo: solicitar, redefinir e logar com a senha nova", async ({ page }) => {
  const { email, senha } = await criarCidadaoTeste();

  await page.goto("/esqueci-senha");
  await page.fill('input[name="email"]', email);
  await page.click('button:has-text("Enviar link de redefinição")');
  await expect(
    page.getByText("Se existir uma conta com esse e-mail, enviamos um link")
  ).toBeVisible();

  const registro = await prisma.verificationToken.findFirstOrThrow({
    where: { identifier: `redefinir-senha:${email}` },
  });

  await page.goto(`/redefinir-senha/${registro.token}`);
  await expect(page.getByText("Criar nova senha")).toBeVisible();

  const novaSenha = "SenhaNovaForte456";
  await page.fill('input[name="senha"]', novaSenha);
  await page.fill('input[name="confirmarSenha"]', novaSenha);
  await page.click('button:has-text("Redefinir senha e entrar")');

  // Auto-login depois de redefinir (sem 2FA ativo nesse usuário de teste).
  await page.waitForURL(/\/painel$/);

  // Token de uso único - já foi consumido.
  const tokenAinda = await prisma.verificationToken.findUnique({
    where: { token: registro.token },
  });
  expect(tokenAinda).toBeNull();

  // Senha antiga não funciona mais, só a nova.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await expect(page.getByText("E-mail/CPF ou senha inválidos.")).toBeVisible();

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', novaSenha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
});

test("link expirado ou inválido mostra mensagem de erro", async ({ page }) => {
  await page.goto("/redefinir-senha/token-que-nao-existe");
  await expect(page.getByText("Link inválido ou expirado")).toBeVisible();
});

test("token de VERIFICAÇÃO de e-mail não funciona pra redefinir senha", async ({ page }) => {
  const { email } = await criarCidadaoTeste();

  // Token de outro propósito (verificação de e-mail, identifier = email
  // puro, sem o prefixo "redefinir-senha:") - não pode ser aceito aqui.
  const tokenVerificacao = await criarTokenVerificacao(email);

  await page.goto(`/redefinir-senha/${tokenVerificacao}`);
  await expect(page.getByText("Link inválido ou expirado")).toBeVisible();
});

test("conta de órgão sem senha ainda (convite pendente) não pode usar este fluxo", async ({
  page,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const orgao = await prisma.orgao.create({
    data: { nome: `Órgão E2E Reset ${Date.now()}`, cidadeId: cidade.id },
  });
  const emailOrgao = `e2e-teste-orgao-sem-senha-${Date.now()}@example.com`;
  const usuarioOrgao = await prisma.user.create({
    data: {
      name: "Órgão sem senha E2E",
      email: emailOrgao,
      papel: "ORGAO",
      orgaoId: orgao.id,
      emailVerified: new Date(),
      termosAceitosEm: new Date(),
    },
  });

  const token = await criarTokenRedefinicaoSenha(emailOrgao);
  await page.goto(`/redefinir-senha/${token}`);
  await expect(page.getByText("Link inválido ou expirado")).toBeVisible();

  await prisma.user.delete({ where: { id: usuarioOrgao.id } });
  await prisma.orgao.delete({ where: { id: orgao.id } });
});
