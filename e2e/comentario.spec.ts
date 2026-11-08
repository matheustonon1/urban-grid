import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  aguardarHidratacao,
  criarCidadaoTeste,
  criarReclamacaoTeste,
  limparDadosTeste,
} from "./helpers";

// Comentar pela interface. Nenhum outro spec fazia isso (os de moderação criam o comentário
// direto no banco), e foi assim que o formulário de comentário ficou recusando todo mundo com
// "Invalid input" sem que a suíte notasse.

test.afterAll(async () => {
  await limparDadosTeste();
});

async function entrar(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
}

test("cidadão com e-mail verificado consegue comentar (sem 'Invalid input')", async ({ page }) => {
  const { usuario: autor } = await criarCidadaoTeste();
  const { usuario, email, senha } = await criarCidadaoTeste();
  const reclamacao = await criarReclamacaoTeste(autor.id, { status: "PUBLICADA" });

  await entrar(page, email, senha);
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await aguardarHidratacao(page, "#comentario-novo");

  await page.locator("#comentario-novo").fill("Passo por aqui todo dia e o problema continua.");
  await page.getByRole("button", { name: "Comentar", exact: true }).click();

  // Sem chave do Gemini a moderação reprova (erra para o lado seguro) e o aviso é o de
  // "não foi publicado"; com chave, o de "publicado". Nos dois casos o comentário foi
  // gravado e a pessoa recebeu uma explicação, nunca a validação crua do zod.
  await expect(
    page.getByText(/Comentário publicado\.|Seu comentário não foi publicado/)
  ).toBeVisible();
  await expect(page.getByText("Invalid input")).toHaveCount(0);

  const gravado = await prisma.comentario.findFirst({ where: { autorId: usuario.id } });
  expect(gravado?.texto).toBe("Passo por aqui todo dia e o problema continua.");
  expect(gravado?.paiId).toBeNull();
});

test("sem e-mail verificado, comentar explica o motivo e não grava nada", async ({ page }) => {
  const { usuario: autor } = await criarCidadaoTeste();
  const { usuario, email, senha } = await criarCidadaoTeste({ emailVerificado: false });
  const reclamacao = await criarReclamacaoTeste(autor.id, { status: "PUBLICADA" });

  await entrar(page, email, senha);
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await aguardarHidratacao(page, "#comentario-novo");

  await page.locator("#comentario-novo").fill("Tentando comentar sem ter verificado o e-mail.");
  await page.getByRole("button", { name: "Comentar", exact: true }).click();

  await expect(page).toHaveURL(/erro=email-nao-verificado/);
  await expect(page.getByText(/Verifique seu e-mail antes de comentar, confirmar ou denunciar/)).toBeVisible();
  await expect(page.getByText("Invalid input")).toHaveCount(0);

  expect(await prisma.comentario.count({ where: { autorId: usuario.id } })).toBe(0);
});
