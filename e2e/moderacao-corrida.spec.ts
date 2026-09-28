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

test("aprovar e rejeitar a mesma reclamação ao mesmo tempo não deixa os dois efeitos acontecerem", async ({
  browser,
}) => {
  const { usuario: autor } = await criarCidadaoTeste();
  const { email, senha } = await criarAdminTeste();

  const reclamacao = await criarReclamacaoTeste(autor.id, { status: "AGUARDANDO_REVISAO" });
  idsParaLimpar = [reclamacao.id];

  // Duas páginas na MESMA sessão de moderador (duas abas do mesmo admin,
  // ou dois moderadores - o efeito de corrida é o mesmo).
  const contexto = await browser.newContext();
  const paginaA = await contexto.newPage();
  const paginaB = await contexto.newPage();
  await login(paginaA, email, senha);

  await paginaA.goto("/moderacao");
  await paginaB.goto("/moderacao");

  const cartaoA = paginaA.locator(`text=${reclamacao.protocolo}`).locator("..");
  const cartaoB = paginaB.locator(`text=${reclamacao.protocolo}`).locator("..");
  await cartaoB.locator('textarea[name="motivo"]').fill("Motivo de teste com mais de dez letras");

  // Dispara os dois cliques sem esperar um terminar antes do outro - é
  // isso que cria a janela de corrida entre o findUnique() e o update()
  // no servidor. A correção usa updateMany com o status na condição, não
  // uma checagem prévia em código, pra fechar essa janela de verdade.
  await Promise.all([
    cartaoA.getByRole("button", { name: "Aprovar" }).click(),
    cartaoB.getByRole("button", { name: "Rejeitar" }).click(),
  ]);
  await paginaA.waitForTimeout(1500);

  const reclamacaoFinal = await prisma.reclamacao.findUniqueOrThrow({
    where: { id: reclamacao.id },
  });
  // Só uma das duas decisões pode ter vencido - nunca as duas, e nunca
  // nenhuma (continuar em AGUARDANDO_REVISAO seria só a outra ação tendo
  // sido descartada sem a primeira ter aplicado, o que também seria bug).
  expect(["PUBLICADA", "REJEITADA"]).toContain(reclamacaoFinal.status);

  const notificacoes = await prisma.notificacao.findMany({
    where: { userId: autor.id, reclamacaoId: reclamacao.id },
  });
  // O bug corrigido: o autor recebia as duas notificações (publicada E
  // rejeitada) porque as duas ações completavam sem se bloquearem.
  expect(notificacoes).toHaveLength(1);
  expect(notificacoes[0].tipo).toBe(
    reclamacaoFinal.status === "PUBLICADA" ? "RECLAMACAO_PUBLICADA" : "RECLAMACAO_REJEITADA"
  );

  await contexto.close();
});
