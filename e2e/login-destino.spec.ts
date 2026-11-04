import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarCidadaoTeste, criarOrgaoTeste, limparDadosTeste, completarDoisFatoresSeSolicitado } from "./helpers";

// O login leva a pessoa para onde ela pediu (callbackUrl), mas só para um caminho INTERNO: a
// query string é de quem escreveu o link, e uma URL absoluta seria open redirect.

test.afterAll(async () => {
  await limparDadosTeste();
});

async function entrar(page: Page, email: string, senha: string, url = "/login") {
  await page.goto(url);
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await completarDoisFatoresSeSolicitado(page, email);
}

test("o órgão cai direto no painel ao entrar, e o /painel de cidadão manda para ele", async ({
  page,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { email, senha } = await criarOrgaoTeste(cidade.id);

  await entrar(page, email, senha);
  await page.waitForURL(/\/orgao$/);

  await page.goto("/painel");
  await expect(page).toHaveURL(/\/orgao$/);
});

test("o cidadão continua entrando no /painel", async ({ page }) => {
  const { email, senha } = await criarCidadaoTeste();

  await entrar(page, email, senha);
  await page.waitForURL(/\/painel$/);
});

test("quem chegou pedindo uma página volta a ela depois de entrar", async ({ page }) => {
  const { email, senha } = await criarCidadaoTeste();

  await entrar(page, email, senha, `/login?callbackUrl=${encodeURIComponent("/transparencia")}`);
  await page.waitForURL(/\/transparencia$/);
});

test("uma página protegida leva ao login e, depois dele, de volta a ela", async ({ page }) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { email, senha } = await criarOrgaoTeste(cidade.id);

  // O proxy redireciona para /login?callbackUrl=/orgao; antes o login ignorava isso.
  await page.goto("/orgao");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Forgao/);
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await completarDoisFatoresSeSolicitado(page, email);
  await page.waitForURL(/\/orgao$/);
});

test.describe("callbackUrl que não é um caminho interno é ignorado", () => {
  for (const [nome, destino] of [
    ["URL absoluta", "https://golpe.example.com/"],
    ["protocolo relativo", "//golpe.example.com/"],
    ["barra invertida", "/\\golpe.example.com"],
  ] as const) {
    test(nome, async ({ page }) => {
      const { email, senha } = await criarCidadaoTeste();

      await entrar(page, email, senha, `/login?callbackUrl=${encodeURIComponent(destino)}`);
      await page.waitForURL(/\/painel$/);
      expect(new URL(page.url()).hostname).not.toContain("golpe");
    });
  }
});

test("quem já está logado e abre o login vai para o destino pedido, ou para a própria casa", async ({
  page,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { email, senha } = await criarOrgaoTeste(cidade.id);

  await entrar(page, email, senha);
  await page.waitForURL(/\/orgao$/);

  await page.goto("/login");
  await expect(page).toHaveURL(/\/orgao$/);

  await page.goto(`/login?callbackUrl=${encodeURIComponent("/transparencia")}`);
  await expect(page).toHaveURL(/\/transparencia$/);

  // O destino que é o próprio login não pode virar um laço.
  await page.goto(`/login?callbackUrl=${encodeURIComponent("/login")}`);
  await expect(page).toHaveURL(/\/orgao$/);
});
