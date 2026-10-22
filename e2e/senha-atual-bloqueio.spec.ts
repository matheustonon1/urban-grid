import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";
import { cifrarSegredoTotp, gerarSegredoTotp } from "@/lib/seguranca/totp";

import { criarCidadaoTeste, limparDadosTeste } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

async function login(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
}

test("5 senhas erradas numa confirmação bloqueiam a ação, mesmo com a senha certa depois", async ({
  page,
}) => {
  const { usuario, email, senha } = await criarCidadaoTeste();
  await login(page, email, senha);
  await page.goto("/painel/conta");

  const exclusao = page.locator('form:has(button:has-text("Excluir minha conta"))');
  const botao = exclusao.getByRole("button", { name: "Excluir minha conta" });

  // Cada tentativa espera a resposta da ação E o formulário voltar a vazio
  // (o React reseta os campos ao fim da ação). Sem isso, o "Senha incorreta."
  // da tentativa anterior - ainda na tela - não prova que a resposta chegou,
  // e o próximo fill podia cair antes do reset e ser apagado, mandando senha
  // vazia (que não conta como tentativa).
  const campo = exclusao.locator('input[name="senhaAtual"]');
  for (let i = 0; i < 5; i++) {
    await campo.fill("SenhaErrada999");
    await Promise.all([
      page.waitForResponse(
        (resposta) => resposta.request().method() === "POST" && resposta.url().includes("/painel/conta")
      ),
      botao.click(),
    ]);
    await expect(campo).toHaveValue("");
  }
  await expect
    .poll(async () => (await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } })).loginBloqueadoAte)
    .not.toBeNull();

  // Com a senha CERTA, mas já bloqueado: recusa, e a conta continua de pé.
  await exclusao.locator('input[name="senhaAtual"]').fill(senha);
  await botao.click();
  await expect(exclusao.getByText("Muitas tentativas de senha incorretas")).toBeVisible();

  const depois = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
  expect(depois.ativo).toBe(true);
  expect(depois.email).toBe(email);
  expect(depois.loginBloqueadoAte!.getTime()).toBeGreaterThan(Date.now());
});

test("desativar o autenticador sem digitar a senha mostra o aviso certo (não uma chave de tradução)", async ({
  page,
}) => {
  const { usuario, email, senha } = await criarCidadaoTeste();
  await login(page, email, senha);
  // Liga o 2FA depois do login: com ele ativo o login passaria a pedir o código.
  await prisma.user.update({
    where: { id: usuario.id },
    data: { totpSecret: cifrarSegredoTotp(gerarSegredoTotp()), totpConfirmadoEm: new Date() },
  });

  await page.goto("/painel/conta");
  const formulario = page.locator('form:has(button:has-text("Desativar autenticador"))');
  await formulario.getByRole("button", { name: "Desativar autenticador" }).click();

  await expect(formulario.getByText("Informe sua senha atual.")).toBeVisible();
  await expect(formulario.getByText("Totp.erroSenhaAtual")).toHaveCount(0);
});
