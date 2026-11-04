import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  criarCidadaoTeste,
  criarOrgaoTeste,
  criarReclamacaoTeste,
  gerarCodigoTotpAtual,
  limparDadosTeste,
} from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

// Entra com a senha de uma conta de órgão SEM 2FA (como ela chega da aprovação do pedido de acesso).
async function entrarSemDoisFatores(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
}

const AVISO_OBRIGATORIO = "A autenticação em duas etapas é obrigatória para contas de órgão.";

test("conta de órgão sem 2FA é levada a ativar: não vê o painel nem o formulário de resposta", async ({
  page,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { usuario: autor } = await criarCidadaoTeste();
  const reclamacao = await criarReclamacaoTeste(autor.id, { cidadeId: cidade.id });
  const { email, senha } = await criarOrgaoTeste(cidade.id, { doisFatores: false });

  await entrarSemDoisFatores(page, email, senha);

  // O login leva o órgão ao painel, e o painel o manda para onde o 2FA se ativa.
  await expect(page).toHaveURL(/\/painel\/conta/);
  await expect(page.getByText(AVISO_OBRIGATORIO)).toBeVisible();

  // Digitar a URL do painel não contorna: volta para a ativação.
  await page.goto("/orgao");
  await expect(page).toHaveURL(/\/painel\/conta/);

  // Na reclamação o formulário some e o motivo aparece, com o caminho para ativar.
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await expect(
    page.getByText("Para enviar uma resposta oficial, ative a autenticação em duas etapas")
  ).toBeVisible();
  await expect(page.locator("#resposta-texto")).toHaveCount(0);
  await page.getByRole("link", { name: "Ativar autenticação em duas etapas" }).click();
  await expect(page).toHaveURL(/\/painel\/conta/);
});

test("ativar o 2FA pela tela libera o painel na mesma sessão, e a conta de órgão não o desativa", async ({
  page,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { email, senha } = await criarOrgaoTeste(cidade.id, { doisFatores: false });

  await entrarSemDoisFatores(page, email, senha);
  await expect(page).toHaveURL(/\/painel\/conta/);

  await page.click('button:has-text("Ativar autenticador")');
  await page.waitForSelector("#codigo-totp");

  const pendente = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { totpSecret: true },
  });
  await page.fill("#codigo-totp", await gerarCodigoTotpAtual(pendente.totpSecret!));
  await page.click('button:has-text("Confirmar")');
  await expect(page.getByText("Autenticação em duas etapas ativada")).toBeVisible();

  // Sem novo login: a próxima leitura da sessão já vê o segundo fator, e o painel abre.
  await page.goto("/orgao");
  await expect(page).toHaveURL(/\/orgao$/);

  // De volta à conta: o aviso saiu e não há como desativar.
  await page.goto("/painel/conta");
  await expect(page.getByText(AVISO_OBRIGATORIO)).toHaveCount(0);
  await expect(page.getByText("não pode ser desativada")).toBeVisible();
  await expect(page.getByRole("button", { name: "Desativar autenticador" })).toHaveCount(0);
});
