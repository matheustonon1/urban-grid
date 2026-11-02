import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarAdminTeste, criarCidadaoTeste, limparDadosTeste, PREFIXO_TESTE } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

async function entrarComoModerador(page: Page) {
  const admin = await criarAdminTeste();
  await page.goto("/login");
  await page.fill('input[name="identificador"]', admin.email);
  await page.fill('input[name="senha"]', admin.senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(painel|orgao)$/);
  return admin;
}

// O banco de testes é o mesmo do desenvolvimento e já tem análises de verdade:
// por isso os testes comparam o número antes e depois de semear, nunca um valor
// absoluto.
async function totalDeAnalises(page: Page, dias: string) {
  await page.goto(`/moderacao/estatisticas?dias=${dias}`);
  const valor = page.locator("dl dt", { hasText: /^Análises$/ }).locator("xpath=following-sibling::dd/span").first();
  // Período sem nenhuma análise mostra o estado vazio, sem os números.
  if ((await valor.count()) === 0) return 0;
  return Number(((await valor.textContent()) ?? "0").replace(/\D/g, ""));
}

const DIA = 86_400_000;

test("o total do período e o de 'Tudo' contam as análises semeadas, e a de 40 dias atrás só entra em 'Tudo'", async ({
  page,
}) => {
  const admin = await entrarComoModerador(page);
  const cidadao = await criarCidadaoTeste();
  const cidade = await prisma.cidade.findFirstOrThrow({ select: { id: true } });
  const categoria = await prisma.categoria.findFirstOrThrow({ where: { ativa: true }, select: { id: true } });

  const antes30 = await totalDeAnalises(page, "30");
  const antes7 = await totalDeAnalises(page, "7");
  const antesTodos = await totalDeAnalises(page, "todos");

  const reclamacao = await prisma.reclamacao.create({
    data: {
      protocolo: `${PREFIXO_TESTE}-estat-${Date.now()}`,
      titulo: "Buraco na Rua das Acácias para as estatísticas",
      descricao: "Buraco grande no meio da via, já causou dano em vários veículos.",
      autorId: cidadao.usuario.id,
      cidadeId: cidade.id,
      categoriaId: categoria.id,
      endereco: "Rua das Acácias, 12",
      cep: "69900-000",
      status: "PUBLICADA",
    },
  });
  const analise = (diasAtras: number, extra: object = {}) => ({
    alvoTipo: "RECLAMACAO" as const,
    alvoId: reclamacao.id,
    provedor: "google",
    modelo: "gemini-3.6-flash",
    versaoPrompt: "v2-e2e",
    decisao: "APROVAR" as const,
    scoreGeral: 0.1,
    scoreOfensivo: 0.1,
    scoreSpam: 0.1,
    scoreDadosPessoais: 0.1,
    scoreForaEscopo: 0.1,
    scoreDesinformacao: 0.1,
    resultadoJson: "{}",
    createdAt: new Date(Date.now() - diasAtras * DIA),
    ...extra,
  });
  await prisma.logModeracao.createMany({
    data: [
      analise(1),
      analise(2, { decisao: "ENCAMINHAR_REVISAO", scoreGeral: 0.55, scoreSpam: 0.55 }),
      analise(3, {
        decisao: "REPROVAR",
        scoreGeral: 0.9,
        scoreOfensivo: 0.9,
        revisadoPorId: admin.usuario.id,
        decisaoFinal: "REPROVAR",
        revisadoEm: new Date(),
      }),
      analise(20),
      analise(40), // fora de 30 dias
    ],
  });

  expect(await totalDeAnalises(page, "7")).toBe(antes7 + 3); // 1, 2 e 3 dias atrás
  expect(await totalDeAnalises(page, "30")).toBe(antes30 + 4); // + a de 20 dias
  expect(await totalDeAnalises(page, "todos")).toBe(antesTodos + 5); // + a de 40 dias

  // A versão do prompt semeada aparece na tabela de versões, com as 5 análises
  // (só "Tudo" as enxerga todas).
  const linha = page.locator("tr", { hasText: "v2-e2e" });
  await expect(linha).toHaveCount(1);
  await expect(linha.getByRole("cell").nth(2)).toHaveText("5");
});

test("o período vem da URL e o seletor marca o ativo; período desconhecido cai em 30 dias", async ({
  page,
}) => {
  await entrarComoModerador(page);

  await page.goto("/moderacao/estatisticas?dias=7");
  const seletor = page.getByRole("navigation", { name: "Período" });
  await expect(seletor.getByRole("link", { name: "7 dias" })).toHaveAttribute("aria-current", "true");
  await expect(seletor.getByRole("link", { name: "30 dias" })).not.toHaveAttribute("aria-current", "true");

  await seletor.getByRole("link", { name: "90 dias" }).click();
  await expect(page).toHaveURL(/dias=90/);
  await expect(seletor.getByRole("link", { name: "90 dias" })).toHaveAttribute("aria-current", "true");

  await page.goto("/moderacao/estatisticas?dias=banana");
  await expect(seletor.getByRole("link", { name: "30 dias" })).toHaveAttribute("aria-current", "true");
});

test("cada gráfico tem a versão em tabela", async ({ page }) => {
  await entrarComoModerador(page);
  await page.goto("/moderacao/estatisticas?dias=todos");

  const volume = page.locator('section[aria-labelledby="volume-titulo"]');
  // Sem análises no banco não há gráfico: o teste só vale com dados.
  test.skip((await volume.count()) === 0, "banco sem análises de moderação");

  await volume.getByText("Ver como tabela").click();
  await expect(volume.getByRole("table")).toBeVisible();
  await expect(volume.getByRole("columnheader", { name: "Total" })).toBeVisible();
});
