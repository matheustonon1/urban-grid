import { expect, request, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";
import { cifrarSegredoTotp, gerarSegredoTotp } from "@/lib/seguranca/totp";

import { criarCidadaoTeste, criarReclamacaoTeste, limparDadosTeste } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

async function login(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
}

test("exportação devolve só os dados de quem pediu, sem credenciais", async ({ page }) => {
  const a = await criarCidadaoTeste();
  const b = await criarCidadaoTeste();

  const reclamacaoA = await criarReclamacaoTeste(a.usuario.id);
  const reclamacaoB = await criarReclamacaoTeste(b.usuario.id);

  await prisma.comentario.create({
    data: {
      reclamacaoId: reclamacaoA.id,
      autorId: a.usuario.id,
      texto: "Comentário do usuário A na própria reclamação",
      statusModeracao: "APROVADO",
    },
  });
  await prisma.comentario.create({
    data: {
      reclamacaoId: reclamacaoB.id,
      autorId: b.usuario.id,
      texto: "Comentário exclusivo do usuário B",
      statusModeracao: "APROVADO",
    },
  });
  // A confirma a reclamação de B: aparece nas confirmações de A, mas a
  // reclamação de B em si (título, descrição, autor) não pode vazar.
  await prisma.confirmacao.create({
    data: { userId: a.usuario.id, reclamacaoId: reclamacaoB.id },
  });
  await prisma.notificacao.create({
    data: {
      userId: a.usuario.id,
      tipo: "MUDANCA_STATUS",
      titulo: "Status mudou",
      mensagem: "Notificação de teste do usuário A",
    },
  });
  await login(page, a.email, a.senha);

  // Segredo de 2FA existente, pra provar que não vai pro arquivo. Depois do
  // login de propósito: com 2FA ativo o login passaria a pedir o código.
  const totpSecret = cifrarSegredoTotp(gerarSegredoTotp());
  await prisma.user.update({
    where: { id: a.usuario.id },
    data: { totpSecret, totpConfirmadoEm: new Date(), telefone: "(68) 99999-0000" },
  });

  const resposta = await page.request.get("/painel/conta/exportar");

  expect(resposta.status()).toBe(200);
  expect(resposta.headers()["content-type"]).toContain("application/json");
  expect(resposta.headers()["content-disposition"]).toMatch(
    /^attachment; filename="urban-grid-meus-dados-\d{4}-\d{2}-\d{2}\.json"$/
  );
  expect(resposta.headers()["cache-control"]).toContain("no-store");

  const texto = await resposta.text();
  const dados = JSON.parse(texto);

  expect(dados.conta.email).toBe(a.email);
  expect(dados.conta.telefone).toBe("(68) 99999-0000");
  expect(dados.conta.autenticacaoDuasEtapasAtiva).toBe(true);

  expect(dados.reclamacoes).toHaveLength(1);
  expect(dados.reclamacoes[0].protocolo).toBe(reclamacaoA.protocolo);
  expect(dados.reclamacoes[0].cidade).toMatch(/ - [A-Z]{2}$/);
  expect(dados.comentarios).toHaveLength(1);
  expect(dados.comentarios[0].reclamacaoProtocolo).toBe(reclamacaoA.protocolo);
  expect(dados.confirmacoes).toHaveLength(1);
  expect(dados.confirmacoes[0].reclamacaoProtocolo).toBe(reclamacaoB.protocolo);
  expect(dados.notificacoes).toHaveLength(1);

  // Nada de B (a não ser o protocolo que A mesmo confirmou) e nada de credencial.
  expect(texto).not.toContain(b.email);
  expect(texto).not.toContain("Comentário exclusivo do usuário B");
  const usuarioA = await prisma.user.findUniqueOrThrow({ where: { id: a.usuario.id } });
  expect(texto).not.toContain(usuarioA.senhaHash!);
  expect(texto).not.toContain(usuarioA.cpfHash!);
  expect(texto).not.toContain(totpSecret);
  for (const chave of ["senhaHash", "cpfHash", "totpSecret", "codigoHash", "scoreModeracao", "exifJson"]) {
    expect(texto).not.toContain(`"${chave}"`);
  }
});

test("sem sessão, a exportação manda pro login em vez de devolver dados", async () => {
  const contexto = await request.newContext({ baseURL: "http://localhost:3000" });
  const resposta = await contexto.get("/painel/conta/exportar", { maxRedirects: 0 });

  expect([307, 308]).toContain(resposta.status());
  expect(resposta.headers()["location"]).toContain("/login");
  expect(resposta.headers()["content-disposition"]).toBeUndefined();
  await contexto.dispose();
});

test("o botão em 'Minha conta' baixa o arquivo", async ({ page }) => {
  const { email, senha } = await criarCidadaoTeste();
  await login(page, email, senha);
  await page.goto("/painel/conta");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Baixar meus dados" }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^urban-grid-meus-dados-\d{4}-\d{2}-\d{2}\.json$/);
});
