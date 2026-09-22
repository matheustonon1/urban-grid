import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { apagarLogsDeModeracao, criarCidadaoTeste, criarReclamacaoTeste, limparDadosTeste } from "./helpers";

let usuarioIdParaLimpar: string | undefined;

test.afterAll(async () => {
  // Depois de excluída, a conta troca de e-mail pra "removido-<id>@..." e
  // deixa de bater no filtro por prefixo que limparDadosTeste() usa - sem
  // isso, ela (e a reclamação anonimizada) ficaria órfã pra sempre no banco.
  if (usuarioIdParaLimpar) {
    const filtro = { autorId: usuarioIdParaLimpar };
    await apagarLogsDeModeracao(filtro);
    await prisma.reclamacao.deleteMany({ where: filtro });
    await prisma.user.deleteMany({ where: { id: usuarioIdParaLimpar } });
  }
  await limparDadosTeste();
});

test("excluir conta anonimiza os dados pessoais, mantém a reclamação e encerra a sessão", async ({
  page,
}) => {
  const { usuario, email, senha } = await criarCidadaoTeste();
  usuarioIdParaLimpar = usuario.id;
  const reclamacao = await criarReclamacaoTeste(usuario.id, { status: "PUBLICADA" });

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto("/painel/conta");
  await page.fill("#exclusao-senha", senha);
  await page.click('button:has-text("Excluir minha conta")');

  // signOut({ redirectTo: "/" }) - sai da área logada e derruba a sessão.
  await page.waitForURL(/^http:\/\/localhost:3000\/$/);

  const usuarioFinal = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
  expect(usuarioFinal.email).toBe(`removido-${usuario.id}@urbangrid.local`);
  expect(usuarioFinal.name).toBe("Usuário removido");
  expect(usuarioFinal.senhaHash).toBeNull();
  expect(usuarioFinal.cpfHash).toBeNull();
  expect(usuarioFinal.ativo).toBe(false);

  const reclamacaoFinal = await prisma.reclamacao.findUniqueOrThrow({
    where: { id: reclamacao.id },
  });
  expect(reclamacaoFinal.anonima).toBe(true);
  expect(reclamacaoFinal.status).toBe("PUBLICADA");

  // A reclamação continua acessível publicamente, como registro de
  // interesse público, mesmo com a conta do autor removida.
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await expect(page.getByText(reclamacao.titulo)).toBeVisible();

  // Sessão encerrada de verdade - área logada exige novo login.
  await page.goto("/painel");
  await page.waitForURL(/\/login/);

  // A conta antiga não consegue mais logar (senha zerada).
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await expect(page.getByText("E-mail/CPF ou senha inválidos.")).toBeVisible();
});
