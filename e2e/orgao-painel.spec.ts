import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  apagarLogsDeModeracao,
  criarCidadaoTeste,
  criarOrgaoTeste,
  criarReclamacaoTeste,
  limparDadosTeste,
  completarDoisFatoresSeSolicitado,
} from "./helpers";

// Painel do órgão e a experiência de quem atende os chamados: o que cada cartão mostra,
// o formulário recolhido, o que o órgão NÃO faz (confirmar reclamação) e o perfil público.

const idsReclamacaoParaLimpar: string[] = [];
const DIA_MS = 86_400_000;
// Os cartões do painel saem do mais antigo para o mais novo e a primeira página tem 20:
// reclamações bem antigas ficam sempre na frente, mesmo com dados de outros testes ou da
// demonstração na mesma cidade.
const DIAS_ANTIGA = 400;

test.afterAll(async () => {
  await apagarLogsDeModeracao({ id: { in: idsReclamacaoParaLimpar } });
  await prisma.reclamacao.deleteMany({ where: { id: { in: idsReclamacaoParaLimpar } } });
  await limparDadosTeste();
});

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await completarDoisFatoresSeSolicitado(page, email);
  await page.waitForURL(/\/(painel|orgao)$/);
}

async function novaReclamacao(autorId: string, cidadeId: string, diasAtras: number, titulo: string) {
  const reclamacao = await criarReclamacaoTeste(autorId, { cidadeId });
  idsReclamacaoParaLimpar.push(reclamacao.id);
  return prisma.reclamacao.update({
    where: { id: reclamacao.id },
    data: { titulo, publicadaEm: new Date(Date.now() - diasAtras * DIA_MS) },
  });
}

test("painel: cada cartão diz há quanto tempo espera, o prazo vencido e abre a reclamação", async ({
  page,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { usuario: autor } = await criarCidadaoTeste();
  const { orgao, usuario: responsavel, email, senha } = await criarOrgaoTeste(cidade.id);

  const semResposta = await novaReclamacao(autor.id, cidade.id, DIAS_ANTIGA, "Poste apagado há semanas");
  const comPrazo = await novaReclamacao(autor.id, cidade.id, DIAS_ANTIGA - 5, "Buraco com prazo vencido");
  await prisma.reclamacao.update({ where: { id: comPrazo.id }, data: { status: "EM_ANDAMENTO" } });
  await prisma.respostaOficial.create({
    data: {
      reclamacaoId: comPrazo.id,
      autorId: responsavel.id,
      orgaoId: orgao.id,
      texto: "Equipe acionada, conserto previsto.",
      novoStatus: "EM_ANDAMENTO",
      prazoEstimado: new Date(Date.now() - 2 * DIA_MS),
    },
  });

  await login(page, email, senha);
  await page.goto("/orgao");

  const cartaoSemResposta = page.locator("article").filter({ hasText: semResposta.titulo });
  await expect(cartaoSemResposta).toContainText("Sem resposta · publicada");
  await expect(cartaoSemResposta).toContainText("Publicada");
  // Mais de duas semanas sem resposta: o rótulo fica vermelho.
  await expect(
    cartaoSemResposta.locator("span", { hasText: "Sem resposta" }).first()
  ).toHaveClass(/bg-danger-soft/);
  await expect(cartaoSemResposta.getByRole("link", { name: semResposta.titulo })).toHaveAttribute(
    "href",
    `/reclamacoes/${semResposta.protocolo}`
  );

  // A que já teve resposta não está mais na fila "sem resposta": vai para "em acompanhamento".
  await expect(page.locator("article").filter({ hasText: comPrazo.titulo })).toHaveCount(0);
  await page.goto(`/orgao?fila=acompanhamento&q=${encodeURIComponent(comPrazo.titulo)}`);
  const cartaoComPrazo = page.locator("article").filter({ hasText: comPrazo.titulo });
  await expect(cartaoComPrazo).toContainText("Em andamento");
  await expect(cartaoComPrazo).toContainText("Última resposta");
  await expect(cartaoComPrazo).toContainText("Prazo vencido em");
});

test("painel: prazo para hoje não aparece como vencido (vence no fim do dia)", async ({ page }) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { usuario: autor } = await criarCidadaoTeste();
  const { orgao, usuario: responsavel, email, senha } = await criarOrgaoTeste(cidade.id);
  const reclamacao = await novaReclamacao(autor.id, cidade.id, DIAS_ANTIGA, `Prazo para hoje ${Date.now()}`);
  await prisma.reclamacao.update({ where: { id: reclamacao.id }, data: { status: "EM_ANDAMENTO" } });
  // O que um <input type="date"> com o dia de hoje grava: a meia-noite UTC de hoje.
  const hoje = new Date(new Date().toISOString().slice(0, 10));
  await prisma.respostaOficial.create({
    data: {
      reclamacaoId: reclamacao.id,
      autorId: responsavel.id,
      orgaoId: orgao.id,
      texto: "Equipe acionada, conclusão prevista para hoje.",
      novoStatus: "EM_ANDAMENTO",
      prazoEstimado: hoje,
    },
  });

  await login(page, email, senha);
  await page.goto(`/orgao?fila=acompanhamento&q=${encodeURIComponent(reclamacao.titulo)}`);
  const cartao = page.locator("article").filter({ hasText: reclamacao.titulo });
  await expect(cartao).toContainText("Prazo:");
  await expect(cartao).not.toContainText("Prazo vencido");
});

test("painel: duas filas, com contagem, e a busca por título ou protocolo filtra as duas", async ({
  page,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { usuario: autor } = await criarCidadaoTeste();
  const { orgao, usuario: responsavel, email, senha } = await criarOrgaoTeste(cidade.id);
  const sufixo = Date.now();

  const aberta = await novaReclamacao(autor.id, cidade.id, DIAS_ANTIGA, `Fila sem resposta ${sufixo}`);
  const respondida = await novaReclamacao(
    autor.id,
    cidade.id,
    DIAS_ANTIGA,
    `Fila acompanhamento ${sufixo}`
  );
  await prisma.reclamacao.update({ where: { id: respondida.id }, data: { status: "EM_ANDAMENTO" } });
  await prisma.respostaOficial.create({
    data: {
      reclamacaoId: respondida.id,
      autorId: responsavel.id,
      orgaoId: orgao.id,
      texto: "Equipe acionada.",
      novoStatus: "EM_ANDAMENTO",
    },
  });

  await login(page, email, senha);

  // Buscar pelo protocolo traz uma só; a contagem de cada aba respeita a busca.
  await page.goto(`/orgao?q=${encodeURIComponent(aberta.protocolo)}`);
  const filas = page.getByRole("navigation", { name: "Filas de reclamações" });
  await expect(filas.getByRole("link", { name: /Sem resposta/ })).toContainText("1");
  await expect(filas.getByRole("link", { name: /Em acompanhamento/ })).toContainText("0");
  await expect(page.locator("article").filter({ hasText: aberta.titulo })).toHaveCount(1);
  await expect(page.locator("article").filter({ hasText: respondida.titulo })).toHaveCount(0);

  // A outra fila, mantendo a busca por parte do título.
  await page.goto(`/orgao?fila=acompanhamento&q=${encodeURIComponent(`acompanhamento ${sufixo}`)}`);
  await expect(page.locator("article").filter({ hasText: respondida.titulo })).toHaveCount(1);
  await expect(filas.getByRole("link", { name: /Em acompanhamento/ })).toHaveAttribute(
    "aria-current",
    "true"
  );

  // Sem nenhum resultado, o painel diz que os filtros não acharam nada e oferece limpar.
  await page.goto(`/orgao?q=${encodeURIComponent(`nada-assim-${sufixo}`)}`);
  await expect(page.getByText("Nenhuma reclamação com esses filtros.")).toBeVisible();
  await page.getByRole("link", { name: "Limpar filtros" }).click();
  await expect(page).toHaveURL(/\/orgao$/);
});

test("painel: a reclamação aberta por uma conta do próprio órgão não entra na fila dele", async ({
  page,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { orgao, email, senha } = await criarOrgaoTeste(cidade.id);
  // Outra conta do mesmo órgão abriu uma reclamação (acontecia antes de a regra existir).
  const colega = await prisma.user.create({
    data: {
      name: "Colega do órgão E2E",
      email: `e2e-teste-colega-${Date.now()}@example.com`,
      papel: "ORGAO",
      orgaoId: orgao.id,
      emailVerified: new Date(),
      termosAceitosEm: new Date(),
    },
  });
  const propria = await novaReclamacao(colega.id, cidade.id, DIAS_ANTIGA, `Aberta pelo órgão ${Date.now()}`);

  await login(page, email, senha);
  await page.goto(`/orgao?q=${encodeURIComponent(propria.protocolo)}`);
  await expect(page.locator("article").filter({ hasText: propria.titulo })).toHaveCount(0);
});

test("painel: o formulário vem recolhido, abre em 'Responder' e a resposta volta com aviso", async ({
  page,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { usuario: autor } = await criarCidadaoTeste();
  const { email, senha } = await criarOrgaoTeste(cidade.id);
  const reclamacao = await novaReclamacao(autor.id, cidade.id, DIAS_ANTIGA - 100, "Lixo acumulado na praça");

  await login(page, email, senha);
  await page.goto("/orgao");
  const cartao = page.locator("article").filter({ hasText: reclamacao.titulo });

  await expect(cartao.locator('textarea[name="texto"]')).toBeHidden();
  await cartao.getByText("Responder", { exact: true }).click();
  await cartao.locator('textarea[name="texto"]').fill("Coleta reprogramada para amanhã cedo.");
  await cartao.getByRole("button", { name: "Enviar resposta" }).click();

  await expect(page.getByText("Resposta oficial enviada. O autor foi avisado.")).toBeVisible();
  const respostas = await prisma.respostaOficial.count({ where: { reclamacaoId: reclamacao.id } });
  expect(respostas).toBe(1);
  // Depois de enviar, o formulário se recolhe e o campo volta vazio.
  await expect(cartao.locator('textarea[name="texto"]')).toBeHidden();
});

test("detalhe: conta de órgão não vê 'Também sofro com isso'; o cidadão continua vendo", async ({
  page,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { usuario: autor } = await criarCidadaoTeste();
  const { email: emailOrgao, senha: senhaOrgao } = await criarOrgaoTeste(cidade.id);
  const { email: emailCidadao, senha: senhaCidadao } = await criarCidadaoTeste();
  const reclamacao = await novaReclamacao(autor.id, cidade.id, 3, "Calçada quebrada na escola");

  await login(page, emailOrgao, senhaOrgao);
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await expect(page.getByText("Responder como órgão")).toBeVisible();
  await expect(page.getByRole("button", { name: "Também sofro com isso" })).toHaveCount(0);

  // Sai da página antes de limpar os cookies (prefetch em voo reemite o cookie).
  await page.goto("about:blank");
  await page.context().clearCookies();
  await login(page, emailCidadao, senhaCidadao);
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await expect(page.getByRole("button", { name: "Também sofro com isso" })).toBeVisible();
});

test("perfil público: uma reclamação respondida duas vezes aparece uma vez só", async ({ page }) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { usuario: autor } = await criarCidadaoTeste();
  const { orgao, usuario: responsavel } = await criarOrgaoTeste(cidade.id);
  const reclamacao = await novaReclamacao(autor.id, cidade.id, 9, "Árvore com risco de queda");

  for (const [i, texto] of ["Equipe agendada.", "Árvore podada."].entries()) {
    await prisma.respostaOficial.create({
      data: {
        reclamacaoId: reclamacao.id,
        autorId: responsavel.id,
        orgaoId: orgao.id,
        texto,
        createdAt: new Date(Date.now() - (2 - i) * DIA_MS),
      },
    });
  }

  await page.goto(`/orgaos/${orgao.id}`);
  const itens = page.locator("li").filter({ hasText: reclamacao.titulo });
  await expect(itens).toHaveCount(1);
  // A que aparece é a resposta mais recente.
  await expect(itens).toContainText("Árvore podada.");
});
