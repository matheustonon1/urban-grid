import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  apagarLogsDeModeracao,
  criarAdminTeste,
  criarCidadaoTeste,
  criarReclamacaoTeste,
  limparDadosTeste,
} from "./helpers";

let idsParaLimpar: string[] = [];

test.afterAll(async () => {
  await apagarLogsDeModeracao({ id: { in: idsParaLimpar } });
  await prisma.reclamacao.deleteMany({ where: { id: { in: idsParaLimpar } } });
  await limparDadosTeste();
});

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
}

test("'aprovar mesmo assim' e 'confirmar rejeição' no mesmo comentário reprovado ao mesmo tempo não deixam o log inconsistente", async ({
  browser,
}) => {
  const { usuario: autor } = await criarCidadaoTeste();
  const { email, senha } = await criarAdminTeste();

  const reclamacao = await criarReclamacaoTeste(autor.id, { status: "PUBLICADA" });
  idsParaLimpar = [reclamacao.id];

  const textoComentario = `Comentário reprovado de teste ${Date.now()}`;
  const comentario = await prisma.comentario.create({
    data: {
      reclamacaoId: reclamacao.id,
      autorId: autor.id,
      texto: textoComentario,
      statusModeracao: "REPROVADO",
    },
  });
  await prisma.logModeracao.create({
    data: {
      alvoTipo: "COMENTARIO",
      alvoId: comentario.id,
      provedor: "google",
      modelo: "teste",
      versaoPrompt: "teste",
      decisao: "REPROVAR",
      scoreGeral: 0.9,
      justificativa: "Teste",
      resultadoJson: "{}",
      latenciaMs: 0,
    },
  });

  const contexto = await browser.newContext();
  const paginaA = await contexto.newPage();
  const paginaB = await contexto.newPage();
  await login(paginaA, email, senha);

  await paginaA.goto("/moderacao/comentarios");
  await paginaB.goto("/moderacao/comentarios");

  const cartaoA = paginaA.locator(`text=${textoComentario}`).locator("..");
  const cartaoB = paginaB.locator(`text=${textoComentario}`).locator("..");

  // Um moderador clica "aprovar mesmo assim", outro clica "confirmar
  // rejeição" pro mesmo comentário, ao mesmo tempo - as duas ações
  // competem pelo mesmo log pendente (revisadoEm ainda nulo).
  await Promise.all([
    cartaoA.getByRole("button", { name: "Aprovar mesmo assim" }).click(),
    cartaoB.getByRole("button", { name: "Confirmar rejeição" }).click(),
  ]);
  await paginaA.waitForTimeout(1500);

  const comentarioFinal = await prisma.comentario.findUniqueOrThrow({
    where: { id: comentario.id },
  });
  const logFinal = await prisma.logModeracao.findFirstOrThrow({
    where: { alvoTipo: "COMENTARIO", alvoId: comentario.id },
  });

  // O bug corrigido: sem a guarda atômica, as duas ações completavam e o
  // log podia ficar com decisaoFinal "REPROVAR" enquanto o comentário já
  // tinha sido aprovado (ou vice-versa) - aqui os dois têm que bater.
  if (comentarioFinal.statusModeracao === "APROVADO") {
    expect(logFinal.decisaoFinal).toBe("APROVAR");
  } else {
    expect(comentarioFinal.statusModeracao).toBe("REPROVADO");
    expect(logFinal.decisaoFinal).toBe("REPROVAR");
  }
  expect(logFinal.revisadoEm).not.toBeNull();

  await contexto.close();
});
