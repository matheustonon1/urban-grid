import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";
import { registroDeFalha } from "@/lib/moderacao/falha";

import {
  apagarLogsDeModeracao,
  criarAdminTeste,
  criarCidadaoTeste,
  criarReclamacaoTeste,
  limparDadosTeste,
} from "./helpers";

// Quando a IA não consegue analisar (modelo sobrecarregado, sem rede...), o pipeline grava um
// registro de falha: nota 1, nenhum eixo. A tela já mostrou isso como "Geral 1.00" com a frase
// técnica, e parecia que a IA tinha dado o pior veredito. Aqui o moderador tem que ver que NÃO
// houve análise - e a análise de verdade (controle) continua com as notas.

let idsParaLimpar: string[] = [];

test.afterAll(async () => {
  await apagarLogsDeModeracao({ id: { in: idsParaLimpar } });
  await prisma.reclamacao.deleteMany({ where: { id: { in: idsParaLimpar } } });
  await limparDadosTeste();
});

async function login(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
}

const AVISO = "A análise automática não foi concluída";

function registroDeFalhaDoPipeline() {
  // O mesmo que moderarReclamacao()/moderarComentario() gravam no catch.
  return registroDeFalha(Object.assign(new Error("simulado"), { status: 503 }));
}

async function criarLogComAnalise(alvoId: string) {
  await prisma.logModeracao.create({
    data: {
      alvoTipo: "RECLAMACAO",
      alvoId,
      provedor: "google",
      modelo: "gemini-de-teste",
      versaoPrompt: "v2",
      decisao: "ENCAMINHAR_REVISAO",
      scoreGeral: 0.55,
      scoreOfensivo: 0.1,
      scoreSpam: 0.55,
      scoreDadosPessoais: 0.1,
      scoreForaEscopo: 0.1,
      scoreDesinformacao: 0.1,
      justificativa: "Pode ser propaganda.",
      resultadoJson: "{}",
      latenciaMs: 3000,
    },
  });
}

async function criarLogDeFalha(
  alvoId: string,
  alvoTipo: "RECLAMACAO" | "COMENTARIO",
  decisao: "ENCAMINHAR_REVISAO" | "REPROVAR"
) {
  await prisma.logModeracao.create({
    data: {
      alvoTipo,
      alvoId,
      provedor: "google",
      modelo: "gemini-de-teste",
      versaoPrompt: alvoTipo === "RECLAMACAO" ? "v2" : "v1",
      decisao,
      ...registroDeFalhaDoPipeline(),
      latenciaMs: 16000,
    },
  });
}

test("fila e histórico de reclamações: a falha da IA aparece como 'sem análise', não como nota 1.00", async ({
  page,
}) => {
  const { usuario: autor } = await criarCidadaoTeste();
  const { email, senha } = await criarAdminTeste();

  const comFalha = await criarReclamacaoTeste(autor.id, { status: "AGUARDANDO_REVISAO" });
  const comAnalise = await criarReclamacaoTeste(autor.id, { status: "AGUARDANDO_REVISAO" });
  idsParaLimpar = [comFalha.id, comAnalise.id];
  await criarLogDeFalha(comFalha.id, "RECLAMACAO", "ENCAMINHAR_REVISAO");
  await criarLogComAnalise(comAnalise.id);

  await login(page, email, senha);

  // --- Fila. Dois níveis acima do protocolo é o cartão (ver moderacao/page.tsx).
  await page.goto("/moderacao");
  const cartaoFalha = page.locator(`text=${comFalha.protocolo}`).locator("..").locator("..");
  await expect(cartaoFalha.getByText(AVISO)).toBeVisible();
  await expect(cartaoFalha.getByText("Sem análise automática")).toBeVisible();
  // Nada de barra de notas, de "1.00" nem da frase técnica gravada no registro.
  await expect(cartaoFalha.getByText("Análise da IA")).toHaveCount(0);
  await expect(cartaoFalha.getByText("1.00")).toHaveCount(0);
  await expect(cartaoFalha.getByText(/Falha ao consultar/)).toHaveCount(0);

  // Controle: a análise de verdade continua com as notas e sem o aviso de falha.
  const cartaoAnalise = page.locator(`text=${comAnalise.protocolo}`).locator("..").locator("..");
  await expect(cartaoAnalise.getByText("Análise da IA")).toBeVisible();
  await expect(cartaoAnalise.getByText("0.55").first()).toBeVisible();
  await expect(cartaoAnalise.getByText(AVISO)).toHaveCount(0);

  // --- Histórico (mais recentes primeiro, então os dois estão na 1ª página).
  await page.goto("/moderacao/historico");
  const itemFalha = page.locator("li", { hasText: comFalha.titulo }).filter({
    has: page.getByText("Sem análise automática"),
  });
  await expect(itemFalha.first()).toBeVisible();
  await expect(itemFalha.first().getByText(AVISO)).toBeVisible();
  await expect(itemFalha.first().getByText(/\(IA\)/)).toHaveCount(0);
});

test("fila e histórico de comentários: a falha da IA não aparece como 'Reprovado (IA)'", async ({
  page,
}) => {
  const { usuario: autor } = await criarCidadaoTeste();
  const { email, senha } = await criarAdminTeste();

  const reclamacao = await criarReclamacaoTeste(autor.id);
  idsParaLimpar = [reclamacao.id];
  const texto = `Comentário E2E ocultado por falha da IA ${Date.now()}`;
  const comentario = await prisma.comentario.create({
    data: {
      reclamacaoId: reclamacao.id,
      autorId: autor.id,
      texto,
      statusModeracao: "REPROVADO",
    },
  });
  await criarLogDeFalha(comentario.id, "COMENTARIO", "REPROVAR");

  await login(page, email, senha);

  await page.goto("/moderacao/comentarios");
  const cartao = page.locator("article", { hasText: texto });
  await expect(cartao).toBeVisible();
  await expect(cartao.getByText(AVISO)).toBeVisible();
  await expect(cartao.getByText("Sem análise automática")).toBeVisible();
  await expect(cartao.getByText(/Reprovado \(IA\)/)).toHaveCount(0);
  await expect(cartao.getByText("1.00")).toHaveCount(0);
  // O moderador ainda decide: as ações continuam disponíveis.
  await expect(cartao.getByRole("button", { name: "Aprovar mesmo assim" })).toBeVisible();

  await page.goto("/moderacao/historico/comentarios");
  const item = page.locator("li", { hasText: texto.slice(0, 40) });
  await expect(item.getByText(AVISO)).toBeVisible();
  await expect(item.getByText(/\(IA\)/)).toHaveCount(0);
});
