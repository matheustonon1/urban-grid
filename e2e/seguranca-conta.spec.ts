import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";
import {
  cifrarSegredoTotp,
  consumirCodigoBackup,
  gerarCodigosBackup,
  gerarSegredoTotp,
  prepararCodigosBackup,
  QUANTIDADE_CODIGOS_BACKUP,
} from "@/lib/totp";

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

// Liga o 2FA direto no banco (com a sessão já aberta) em vez de passar pela
// tela de configuração - o que se testa aqui é o gerenciamento dos códigos
// de backup, e totp.spec.ts já cobre a ativação de ponta a ponta.
async function ativarTotpComCodigos(
  userId: string,
  { disponiveis, gastos }: { disponiveis: string[]; gastos: string[] }
) {
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: cifrarSegredoTotp(gerarSegredoTotp()), totpConfirmadoEm: new Date() },
  });
  await prisma.totpBackupCode.createMany({
    data: [
      ...(await prepararCodigosBackup(userId, disponiveis)),
      ...(await prepararCodigosBackup(userId, gastos)).map((codigo) => ({
        ...codigo,
        usadoEm: new Date(),
      })),
    ],
  });
}

test("resumo de segurança avisa e-mail não verificado e reenvia o link", async ({ page }) => {
  const { usuario, email, senha } = await criarCidadaoTeste({ emailVerificado: false });
  await login(page, email, senha);

  await page.goto("/painel/conta");
  const resumo = page.locator("section", { hasText: "Segurança da conta" });
  await expect(resumo.getByText("Não verificado")).toBeVisible();
  await expect(resumo.getByText("Desativada")).toBeVisible();

  await resumo.getByRole("button", { name: "Reenviar e-mail de verificação" }).click();
  await expect(resumo.getByText(`Enviamos um novo link de verificação para ${email}.`)).toBeVisible();

  const token = await prisma.verificationToken.findFirst({ where: { identifier: email } });
  expect(token).not.toBeNull();

  // Quando o e-mail já está verificado, o botão some e o status muda.
  await prisma.user.update({ where: { id: usuario.id }, data: { emailVerified: new Date() } });
  await page.reload();
  await expect(resumo.getByText("Verificado", { exact: true })).toBeVisible();
  await expect(resumo.getByRole("button", { name: "Reenviar e-mail de verificação" })).toHaveCount(0);
});

test("encerrar sessões derruba os outros dispositivos e a sessão atual, mas permite entrar de novo", async ({
  browser,
}) => {
  const { email, senha } = await criarCidadaoTeste();

  const contextoA = await browser.newContext();
  const paginaA = await contextoA.newPage();
  await login(paginaA, email, senha);
  await paginaA.goto("/painel");
  await expect(paginaA).toHaveURL(/\/painel$/);

  const contextoB = await browser.newContext();
  const paginaB = await contextoB.newPage();
  await login(paginaB, email, senha);
  await paginaB.goto("/painel/conta");
  await paginaB.getByRole("button", { name: "Encerrar sessões em todos os dispositivos" }).click();
  await paginaB.waitForURL(/\/login/);

  // O dispositivo A não fez nada - só deixou de valer na próxima leitura.
  await paginaA.goto("/painel");
  await expect(paginaA).toHaveURL(/\/login/);

  // A conta continua utilizável: um login novo depois do encerramento funciona.
  await login(paginaA, email, senha);

  await contextoA.close();
  await contextoB.close();
});

test("gerar novos códigos de backup descarta os antigos e exige a senha", async ({ page }) => {
  const { usuario, email, senha } = await criarCidadaoTeste();
  await login(page, email, senha);

  // 8 códigos, 7 já gastos: sobra 1, então o aviso de "poucos códigos" aparece.
  const [antigoDisponivel, ...antigosGastos] = gerarCodigosBackup();
  expect(antigosGastos).toHaveLength(QUANTIDADE_CODIGOS_BACKUP - 1);
  await ativarTotpComCodigos(usuario.id, {
    disponiveis: [antigoDisponivel],
    gastos: antigosGastos,
  });

  await page.goto("/painel/conta");
  await expect(page.getByText("1 de 8 códigos de backup ainda disponíveis.")).toBeVisible();
  await expect(page.getByText("Restam poucos códigos.")).toBeVisible();

  const formulario = page.locator('form:has(button:has-text("Gerar novos códigos"))');

  // Senha errada não mexe em nada.
  await formulario.locator('input[name="senhaAtual"]').fill("SenhaErrada999");
  await formulario.getByRole("button", { name: "Gerar novos códigos" }).click();
  await expect(formulario.getByText("Senha incorreta.")).toBeVisible();
  expect(await prisma.totpBackupCode.count({ where: { userId: usuario.id, usadoEm: null } })).toBe(1);

  // Senha certa gera um lote novo inteiro e mostra os códigos.
  await formulario.locator('input[name="senhaAtual"]').fill(senha);
  await formulario.getByRole("button", { name: "Gerar novos códigos" }).click();
  await expect(
    page.getByText("Guarde estes códigos em um lugar seguro. Eles só aparecem agora")
  ).toBeVisible();

  const exibidos = await page.locator("ul.grid li").allTextContents();
  expect(exibidos).toHaveLength(QUANTIDADE_CODIGOS_BACKUP);

  expect(await prisma.totpBackupCode.count({ where: { userId: usuario.id } })).toBe(
    QUANTIDADE_CODIGOS_BACKUP
  );
  expect(await prisma.totpBackupCode.count({ where: { userId: usuario.id, usadoEm: null } })).toBe(
    QUANTIDADE_CODIGOS_BACKUP
  );

  // Os códigos mostrados são os que valem de verdade; o antigo, que ainda
  // estava disponível, morreu junto com o lote anterior.
  expect(await consumirCodigoBackup(usuario.id, antigoDisponivel)).toBe(false);
  expect(await consumirCodigoBackup(usuario.id, exibidos[0])).toBe(true);
  expect(await consumirCodigoBackup(usuario.id, exibidos[0])).toBe(false);
});
