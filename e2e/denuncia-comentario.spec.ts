import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  apagarLogsDeModeracao,
  criarAdminTeste,
  criarCidadaoTeste,
  criarReclamacaoTeste,
  limparDadosTeste,
} from "./helpers";

const idsReclamacaoParaLimpar: string[] = [];

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
  await page.waitForURL(/\/painel$/);
}

// Comentário criado direto via Prisma (não pelo formulário real) - mesmo
// truque de moderacao-comentario-corrida.spec.ts, pra não depender da
// moderação de IA de verdade só pra ter um comentário aprovado no ar.
async function criarComentarioAprovado(reclamacaoId: string, autorId: string, texto: string) {
  return prisma.comentario.create({
    data: { reclamacaoId, autorId, texto, statusModeracao: "APROVADO" },
  });
}

test("denunciar um comentário e marcar procedente remove o comentário e avisa o autor", async ({
  page,
}) => {
  const { usuario: autorReclamacao } = await criarCidadaoTeste();
  const { usuario: autorComentario } = await criarCidadaoTeste();
  const { email: emailDenunciante, senha: senhaDenunciante } = await criarCidadaoTeste();
  const { email: emailModerador, senha: senhaModerador } = await criarAdminTeste();

  const reclamacao = await criarReclamacaoTeste(autorReclamacao.id, { status: "PUBLICADA" });
  idsReclamacaoParaLimpar.push(reclamacao.id);

  const textoComentario = `Comentário denunciável de teste ${Date.now()}`;
  const comentario = await criarComentarioAprovado(reclamacao.id, autorComentario.id, textoComentario);

  await login(page, emailDenunciante, senhaDenunciante);
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);

  const cartaoComentario = page.locator(`text=${textoComentario}`).locator("..");
  await cartaoComentario.getByText("Denunciar").click();
  await cartaoComentario.locator('select[name="motivo"]').selectOption("OFENSIVO");
  await cartaoComentario.locator('input[name="declaracaoVeracidade"]').check();
  await cartaoComentario.getByRole("button", { name: "Enviar denúncia" }).click();
  await page.waitForTimeout(500);

  const denuncia = await prisma.denuncia.findFirstOrThrow({
    where: { alvoTipo: "COMENTARIO", alvoId: comentario.id },
  });
  expect(denuncia.status).toBe("ABERTA");

  await page.context().clearCookies();
  await login(page, emailModerador, senhaModerador);
  await page.goto("/denuncias");

  const cartaoDenuncia = page.locator(`text=${textoComentario}`).locator("..");
  await cartaoDenuncia.getByRole("button", { name: "Procedente (remover comentário)" }).click();
  // Espera o card sumir da fila (só lista status ABERTA) em vez de um
  // tempo fixo - sob carga (suíte inteira rodando), o server action podia
  // não ter terminado ainda nos 500ms, e a asserção no banco corria antes
  // da mutação de verdade acontecer.
  await expect(page.getByText(textoComentario)).toHaveCount(0);

  const [comentarioFinal, denunciaFinal, notificacaoAutor] = await Promise.all([
    prisma.comentario.findUniqueOrThrow({ where: { id: comentario.id } }),
    prisma.denuncia.findUniqueOrThrow({ where: { id: denuncia.id } }),
    prisma.notificacao.findFirst({ where: { userId: autorComentario.id, tipo: "MUDANCA_STATUS" } }),
  ]);
  expect(comentarioFinal.statusModeracao).toBe("REPROVADO");
  expect(denunciaFinal.status).toBe("PROCEDENTE");
  expect(notificacaoAutor).not.toBeNull();

  // Comentário reprovado não aparece mais pra um visitante comum.
  await page.context().clearCookies();
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await expect(page.getByText(textoComentario)).toHaveCount(0);
});

test("banir autor a partir de uma denúncia de comentário reprova o comentário e bane a conta", async ({
  page,
}) => {
  const { usuario: autorReclamacao } = await criarCidadaoTeste();
  const { usuario: autorComentario } = await criarCidadaoTeste();
  const { email: emailDenunciante, senha: senhaDenunciante } = await criarCidadaoTeste();
  const { email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();

  const reclamacao = await criarReclamacaoTeste(autorReclamacao.id, { status: "PUBLICADA" });
  idsReclamacaoParaLimpar.push(reclamacao.id);

  const textoComentario = `Comentário pra banir de teste ${Date.now()}`;
  const comentario = await criarComentarioAprovado(reclamacao.id, autorComentario.id, textoComentario);

  await login(page, emailDenunciante, senhaDenunciante);
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  const cartaoComentario = page.locator(`text=${textoComentario}`).locator("..");
  await cartaoComentario.getByText("Denunciar").click();
  await cartaoComentario.locator('select[name="motivo"]').selectOption("OFENSIVO");
  await cartaoComentario.locator('input[name="declaracaoVeracidade"]').check();
  await cartaoComentario.getByRole("button", { name: "Enviar denúncia" }).click();
  await page.waitForTimeout(500);

  await page.context().clearCookies();
  await login(page, emailAdmin, senhaAdmin);
  await page.goto("/denuncias");

  const cartaoDenuncia = page.locator(`text=${textoComentario}`).locator("..");
  await cartaoDenuncia.getByRole("button", { name: "Banir autor" }).click();
  // Mesmo motivo do wait equivalente no teste anterior - espera o efeito
  // de verdade (card sai da fila) em vez de confiar num tempo fixo.
  await expect(page.getByText(textoComentario)).toHaveCount(0);

  const [comentarioFinal, autorFinal] = await Promise.all([
    prisma.comentario.findUniqueOrThrow({ where: { id: comentario.id } }),
    prisma.user.findUniqueOrThrow({ where: { id: autorComentario.id } }),
  ]);
  expect(comentarioFinal.statusModeracao).toBe("REPROVADO");
  expect(autorFinal.banidoAte).not.toBeNull();
  expect(autorFinal.banidoAte!.getTime()).toBeGreaterThan(Date.now());
});
