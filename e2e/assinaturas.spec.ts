import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  apagarLogsDeModeracao,
  criarCidadaoTeste,
  criarReclamacaoTeste,
  limparDadosTeste,
} from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
}

test("acompanhar uma cidade, ver na lista, bloquear duplicata e cancelar", async ({ page }) => {
  const { email, senha } = await criarCidadaoTeste();
  const cidade = await prisma.cidade.findFirstOrThrow({ include: { estado: true } });

  await login(page, email, senha);

  await page.goto(`/cidades/${cidade.slug}`);
  await page.getByRole("button", { name: /Acompanhar esta cidade/ }).click();
  await expect(page.getByText("Você já acompanha esta cidade")).toBeVisible();

  await page.goto("/painel/assinaturas");
  await expect(page.getByText(`${cidade.nome} - ${cidade.estado.uf}`)).toBeVisible();

  // Tentar assinar a mesma cidade (sem categoria) de novo, pelo formulário
  // da própria página de assinaturas, é bloqueado.
  await page
    .getByRole("combobox", { name: "Cidade", exact: true })
    .fill(cidade.nome);
  await page.getByRole("option", { name: new RegExp(cidade.nome) }).first().click();
  await page.getByRole("button", { name: "Assinar" }).click();
  await expect(page.getByText(/já assina/i)).toBeVisible();

  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByText("Você ainda não assina nenhuma cidade.")).toBeVisible();

  // Voltando à cidade, o botão de acompanhar aparece de novo (assinatura
  // foi mesmo removida, não só escondida da lista).
  await page.goto(`/cidades/${cidade.slug}`);
  await expect(page.getByRole("button", { name: /Acompanhar esta cidade/ })).toBeVisible();
});

test("duplo clique/duas abas assinando a mesma cidade ao mesmo tempo não cria duas assinaturas", async ({
  browser,
}) => {
  const { usuario, email, senha } = await criarCidadaoTeste();
  const cidade = await prisma.cidade.findFirstOrThrow();

  // Duas páginas no MESMO contexto (mesma sessão/cookies) simulam duas
  // abas abertas da mesma conta - o cenário real de duplo clique/duas
  // abas que a correção de corrida em criarAssinatura() precisa cobrir.
  const contexto = await browser.newContext();
  const paginaA = await contexto.newPage();
  const paginaB = await contexto.newPage();
  await login(paginaA, email, senha);

  await paginaA.goto(`/cidades/${cidade.slug}`);
  await paginaB.goto(`/cidades/${cidade.slug}`);

  const botaoA = paginaA.getByRole("button", { name: /Acompanhar esta cidade/ });
  const botaoB = paginaB.getByRole("button", { name: /Acompanhar esta cidade/ });
  await expect(botaoA).toBeVisible();
  await expect(botaoB).toBeVisible();

  // Dispara os dois cliques sem esperar um terminar antes do outro - é
  // isso que cria a janela de corrida entre a checagem e o create() no
  // servidor (a correção usa a unique constraint do banco pra fechar essa
  // janela, não uma checagem prévia em código).
  await Promise.all([botaoA.click(), botaoB.click()]);
  await paginaA.waitForTimeout(1500);

  const total = await prisma.assinaturaCidade.count({
    where: { userId: usuario.id, cidadeId: cidade.id, categoriaId: null },
  });
  expect(total).toBe(1);

  await contexto.close();
  await prisma.assinaturaCidade.deleteMany({ where: { userId: usuario.id } });
});

test("cron de resumo semanal exige o segredo certo e processa assinaturas elegíveis", async ({
  request,
}) => {
  const semAutorizacao = await request.get("/api/cron/resumo-semanal");
  expect(semAutorizacao.status()).toBe(401);

  const segredoErrado = await request.get("/api/cron/resumo-semanal", {
    headers: { authorization: "Bearer segredo-errado" },
  });
  expect(segredoErrado.status()).toBe(401);

  const { usuario } = await criarCidadaoTeste();
  const cidade = await prisma.cidade.findFirstOrThrow();

  const assinatura = await prisma.assinaturaCidade.create({
    data: { userId: usuario.id, cidadeId: cidade.id },
  });

  // Reclamação publicada DEPOIS da assinatura - é isto que faz o job achar
  // conteúdo novo pra contar (desde = assinatura.createdAt, quando nunca
  // houve envio ainda). Sem isso o teste só provaria o caminho "sem nada
  // novo", que já não é o mais importante de garantir.
  const reclamacao = await criarReclamacaoTeste(usuario.id, { cidadeId: cidade.id });

  const resposta = await request.get("/api/cron/resumo-semanal", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(resposta.status()).toBe(200);
  const corpo = await resposta.json();
  expect(corpo.processadas).toBeGreaterThanOrEqual(1);
  expect(corpo.comConteudo).toBeGreaterThanOrEqual(1);

  const assinaturaAtualizada = await prisma.assinaturaCidade.findUniqueOrThrow({
    where: { id: assinatura.id },
  });
  expect(assinaturaAtualizada.ultimoEnvioEm).not.toBeNull();

  // Rodar de novo imediatamente não reprocessa a mesma assinatura - ela
  // acabou de ser marcada, e o próximo envio só é elegível em 7 dias.
  const segundaExecucao = await request.get("/api/cron/resumo-semanal", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const corpoSegunda = await segundaExecucao.json();
  expect(corpoSegunda.processadas).toBe(0);

  await apagarLogsDeModeracao({ id: reclamacao.id });
  await prisma.reclamacao.delete({ where: { id: reclamacao.id } });
  await prisma.assinaturaCidade.deleteMany({ where: { userId: usuario.id } });
});
