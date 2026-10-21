import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";
import {
  criarTokenRedefinicaoSenha,
  criarTokenTrocaEmail,
  criarTokenVerificacao,
} from "@/lib/email";
import { cifrarSegredoTotp, gerarCodigosBackup, gerarSegredoTotp, prepararCodigosBackup } from "@/lib/totp";

import { criarCidadaoTeste, emailTeste, limparDadosTeste } from "./helpers";

// Conta excluída troca de e-mail pra "removido-<id>@..." e deixa de bater
// no filtro por prefixo de limparDadosTeste() - apaga por id.
const idsExcluidos: string[] = [];

test.afterAll(async () => {
  if (idsExcluidos.length > 0) {
    await prisma.verificationToken.deleteMany({
      where: { OR: idsExcluidos.map((id) => ({ identifier: { contains: id } })) },
    });
    await prisma.user.deleteMany({ where: { id: { in: idsExcluidos } } });
  }
  await limparDadosTeste();
});

async function login(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
}

test("excluir a conta apaga o 2FA, as notificações e os links pendentes - não só anonimiza o perfil", async ({
  page,
}) => {
  const { usuario, email, senha } = await criarCidadaoTeste();
  idsExcluidos.push(usuario.id);
  await login(page, email, senha);

  // Tudo que a exclusão promete não deixar pra trás. O 2FA entra depois do
  // login (com ele ativo, o login pediria o código).
  await prisma.user.update({
    where: { id: usuario.id },
    data: { totpSecret: cifrarSegredoTotp(gerarSegredoTotp()), totpConfirmadoEm: new Date() },
  });
  await prisma.totpBackupCode.createMany({
    data: await prepararCodigosBackup(usuario.id, gerarCodigosBackup()),
  });
  await prisma.notificacao.create({
    data: {
      userId: usuario.id,
      tipo: "MUDANCA_STATUS",
      titulo: "Sua reclamação mudou de status",
      mensagem: "Poste apagado na Rua das Flores, 120 - em análise.",
    },
  });
  await criarTokenVerificacao(email);
  await criarTokenRedefinicaoSenha(email);
  await criarTokenTrocaEmail(usuario.id, emailTeste("novo"));
  const tokensAntes = await prisma.verificationToken.count({
    where: { identifier: { contains: usuario.id } },
  });
  const tokensDoEmail = await prisma.verificationToken.count({
    where: { identifier: { contains: email } },
  });
  expect(tokensAntes + tokensDoEmail).toBeGreaterThanOrEqual(3);

  await page.goto("/painel/conta");
  await page.fill("#exclusao-senha", senha);
  await page.click('button:has-text("Excluir minha conta")');
  await page.waitForURL(/^http:\/\/localhost:3000\/$/);

  const depois = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
  expect(depois.ativo).toBe(false);
  expect(depois.totpSecret).toBeNull();
  expect(depois.totpConfirmadoEm).toBeNull();
  expect(await prisma.totpBackupCode.count({ where: { userId: usuario.id } })).toBe(0);
  expect(await prisma.notificacao.count({ where: { userId: usuario.id } })).toBe(0);
  expect(
    await prisma.verificationToken.count({
      where: { OR: [{ identifier: { contains: usuario.id } }, { identifier: { contains: email } }] },
    })
  ).toBe(0);
});

test("um link de troca de e-mail que sobrou não grava e-mail novo numa conta já excluída", async ({
  page,
}) => {
  const { usuario } = await criarCidadaoTeste();
  idsExcluidos.push(usuario.id);
  const emailRemovido = `removido-${usuario.id}@urbangrid.local`;
  await prisma.user.update({
    where: { id: usuario.id },
    data: { ativo: false, senhaHash: null, email: emailRemovido, name: "Usuário removido" },
  });

  // Token criado DEPOIS da exclusão (ou que escapou da limpeza): a página
  // tem que recusar por conta própria, sem depender de ninguém tê-lo apagado.
  const novoEmail = emailTeste("morto");
  const token = await criarTokenTrocaEmail(usuario.id, novoEmail);
  await page.goto(`/confirmar-email/${token}`);

  await expect(page.getByText("Link inválido ou expirado").first()).toBeVisible();
  const depois = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
  expect(depois.email).toBe(emailRemovido);
  expect(depois.emailVerified).not.toBeNull(); // inalterado pelo link: veio do helper de teste
  expect(await prisma.user.count({ where: { email: novoEmail } })).toBe(0);
});

test("conta inativa não autentica nem com a senha certa", async ({ page }) => {
  const { usuario, email, senha } = await criarCidadaoTeste();
  await prisma.user.update({ where: { id: usuario.id }, data: { ativo: false } });

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');

  await expect(page.getByText(/inválidos/)).toBeVisible();
  await expect(page).not.toHaveURL(/\/painel$/);
});
