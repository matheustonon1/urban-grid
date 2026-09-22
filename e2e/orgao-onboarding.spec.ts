import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarAdminTeste, emailTeste, limparDadosTeste } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

test("solicita acesso como órgão, admin aprova, define senha e loga", async ({ page }) => {
  const { email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();
  const emailOrgao = emailTeste("solicitacao-orgao");
  const cidade = await prisma.cidade.findFirstOrThrow();

  await page.goto("/cadastro?tipo=orgao");
  await page.fill('input[name="nomeOrgao"]', `Secretaria E2E ${Date.now()}`);
  const cidadeInput = page.locator('main input[placeholder^="Cidade"]');
  await cidadeInput.fill(cidade.nome.slice(0, 5));
  await page.locator('main button[role="option"]').first().click();
  await page.fill('input[name="nomeResponsavel"]', "Responsável E2E");
  await page.fill('input[name="email"]', emailOrgao);
  await page.check('input[name="aceitaTermos"]');
  await page.click('button:has-text("Enviar solicitação")');
  await expect(page.getByRole("heading", { name: "Solicitação enviada!" })).toBeVisible();

  await page.goto("/login");
  await page.fill('input[name="identificador"]', emailAdmin);
  await page.fill('input[name="senha"]', senhaAdmin);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto("/solicitacoes-orgao");
  await expect(page.getByText(emailOrgao)).toBeVisible();
  await page.click('button:has-text("Aprovar")');

  await expect
    .poll(async () => {
      const solicitacao = await prisma.solicitacaoOrgao.findFirstOrThrow({
        where: { email: emailOrgao },
      });
      return solicitacao.status;
    })
    .toBe("APROVADA");

  // O e-mail de acesso pode falhar de enviar de verdade (endereço de
  // teste sem domínio verificado no Resend) - o token já foi criado
  // antes da tentativa de envio, então buscamos ele direto no banco,
  // como um teste automatizado tem que fazer (não há inbox pra ler).
  const registro = await prisma.verificationToken.findFirstOrThrow({
    where: { identifier: emailOrgao },
    orderBy: { expires: "desc" },
  });

  await page.context().clearCookies();
  await page.goto(`/orgao/definir-senha/${registro.token}`);
  await expect(page.getByText("Bem-vindo(a)")).toBeVisible();

  const senha = "SenhaForte123";
  await page.fill('input[name="senha"]', senha);
  await page.fill('input[name="confirmarSenha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/orgao$/);

  const usuarioOrgao = await prisma.user.findUniqueOrThrow({ where: { email: emailOrgao } });
  expect(usuarioOrgao.papel).toBe("ORGAO");
  expect(usuarioOrgao.senhaHash).not.toBeNull();
});
