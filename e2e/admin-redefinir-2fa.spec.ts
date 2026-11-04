import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  ativarDoisFatoresTeste,
  confirmarDialogo,
  criarAdminTeste,
  criarOrgaoTeste,
  limparDadosTeste,
} from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

async function entrar(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
}

// A conta de órgão perdeu o aplicativo e os códigos de backup: sem esta ação ela ficava presa, porque
// o 2FA é obrigatório para o papel e não se desativa em "Minha conta".
test("admin redefine o 2FA da conta de órgão: senha errada recusa; a certa apaga, avisa, audita e a conta volta a entrar só com a senha", async ({
  page,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { orgao, usuario: contaOrgao, email: emailOrgao, senha: senhaOrgao } =
    await criarOrgaoTeste(cidade.id);
  const { usuario: admin, email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();

  // Antes: a conta tem o segundo fator e códigos de backup.
  const antes = await prisma.user.findUniqueOrThrow({ where: { id: contaOrgao.id } });
  expect(antes.totpConfirmadoEm).not.toBeNull();
  expect(await prisma.totpBackupCode.count({ where: { userId: contaOrgao.id } })).toBeGreaterThan(0);

  await entrar(page, emailAdmin, senhaAdmin);
  await page.waitForURL(/\/painel$/);
  const { codigosBackup } = await ativarDoisFatoresTeste(admin.id);

  await page.goto("/orgaos-categorias");
  const cartao = page.locator("article").filter({ hasText: orgao.nome });
  await expect(cartao.getByText(emailOrgao, { exact: true })).toBeVisible();

  // Senha errada: fica no diálogo e não muda nada.
  await cartao.getByRole("button", { name: `Redefinir 2FA de ${emailOrgao}` }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toContainText(`Redefinir o segundo fator de ${emailOrgao}?`);
  await expect(dialogo).toContainText("Todas as sessões abertas dessa conta são encerradas.");
  await confirmarDialogo(page, "Redefinir segundo fator", "senha-errada-123", codigosBackup[0]);
  await expect(dialogo.getByRole("alert")).toContainText("Senha incorreta");
  await expect(dialogo).toBeVisible();
  const intacta = await prisma.user.findUniqueOrThrow({ where: { id: contaOrgao.id } });
  expect(intacta.totpConfirmadoEm).not.toBeNull();
  expect(intacta.totpSecret).not.toBeNull();

  // Senha certa (o código de backup não foi gasto pela tentativa anterior): conclui.
  await confirmarDialogo(page, "Redefinir segundo fator", senhaAdmin, codigosBackup[0]);
  // Sem provedor de e-mail (CI) o aviso por e-mail é "simulado" e a tela avisa que pode não ter
  // saído; com provedor é a confirmação limpa. Nos dois casos a redefinição valeu.
  await expect(page.getByText(new RegExp(`Segundo fator de ${emailOrgao} redefinido`))).toBeVisible();
  await expect(dialogo).toBeHidden();

  const depois = await prisma.user.findUniqueOrThrow({ where: { id: contaOrgao.id } });
  expect(depois.totpConfirmadoEm).toBeNull();
  expect(depois.totpSecret).toBeNull();
  expect(depois.totpTentativasFalhas).toBe(0);
  // Encerra as sessões abertas da conta (ver senhaAlteradaEm em auth.ts).
  expect(depois.senhaAlteradaEm).not.toBeNull();
  expect(await prisma.totpBackupCode.count({ where: { userId: contaOrgao.id } })).toBe(0);

  // Quem tem o 2FA ativo some da lista: não há mais o que redefinir.
  await expect(cartao.getByRole("button", { name: `Redefinir 2FA de ${emailOrgao}` })).toHaveCount(0);

  // Registro de quem fez; a senha errada não gerou nada.
  const registros = await prisma.registroAuditoria.findMany({ where: { alvoUserId: contaOrgao.id } });
  expect(registros).toHaveLength(1);
  expect(registros[0]).toMatchObject({ acao: "DOIS_FATORES_REDEFINIDO", atorId: admin.id });

  // A conta afetada recebe o aviso no sininho.
  const aviso = await prisma.notificacao.findFirst({
    where: { userId: contaOrgao.id, tipo: "CONTA_SEGURANCA" },
  });
  expect(aviso?.titulo).toBe("O segundo fator da sua conta foi redefinido");

  // A tela de auditoria mostra a ação.
  await page.goto("/auditoria");
  await expect(page.getByText("Segundo fator redefinido").first()).toBeVisible();

  // A conta de órgão entra só com a senha (o formulário não pede o código) e é levada a ativar o 2FA de novo.
  await page.goto("about:blank");
  await page.context().clearCookies();
  await entrar(page, emailOrgao, senhaOrgao);
  await expect(page).toHaveURL(/\/painel\/conta/);
  await expect(
    page.getByText("A autenticação em duas etapas é obrigatória para contas de órgão.")
  ).toBeVisible();
  await page.goto("/orgao");
  await expect(page).toHaveURL(/\/painel\/conta/);
});

test("a tela não oferece redefinir para conta que não tem segundo fator", async ({ page }) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { orgao, email: emailOrgao } = await criarOrgaoTeste(cidade.id, { doisFatores: false });
  const { email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();

  await entrar(page, emailAdmin, senhaAdmin);
  await page.waitForURL(/\/painel$/);
  await page.goto("/orgaos-categorias");

  const cartao = page.locator("article").filter({ hasText: orgao.nome });
  await expect(cartao).toBeVisible();
  await expect(cartao.getByRole("button", { name: /Redefinir 2FA/ })).toHaveCount(0);
  await expect(cartao.getByText(emailOrgao, { exact: true })).toHaveCount(0);
});
