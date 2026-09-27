import { expect, test } from "@playwright/test";

import { criarCidadaoTeste, limparDadosTeste } from "./helpers";
import { prisma } from "@/lib/prisma";

// Conta excluída troca de e-mail pra "removido-<id>@..." (ver excluirConta()
// em painel/conta/actions.ts) e deixa de bater no filtro por prefixo que
// limparDadosTeste() usa - sem isso, ficaria órfã pra sempre no banco.
let usuarioExcluidoId: string | undefined;

test.afterAll(async () => {
  if (usuarioExcluidoId) {
    await prisma.user.deleteMany({ where: { id: usuarioExcluidoId } });
  }
  await limparDadosTeste();
});

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
}

test("redefinir senha por e-mail derruba a sessão antiga que já estava logada", async ({
  browser,
}) => {
  const { email, senha } = await criarCidadaoTeste();

  // Contexto A: sessão antiga, logada antes da redefinição.
  const contextoAntigo = await browser.newContext();
  const paginaAntiga = await contextoAntigo.newPage();
  await login(paginaAntiga, email, senha);
  await paginaAntiga.goto("/painel");
  await expect(paginaAntiga).toHaveURL(/\/painel$/);

  // Contexto B: pede e conclui a redefinição, sem tocar nos cookies do A.
  const contextoNovo = await browser.newContext();
  const paginaNova = await contextoNovo.newPage();
  await paginaNova.goto("/esqueci-senha");
  await paginaNova.fill('input[name="email"]', email);
  await paginaNova.click('button:has-text("Enviar link de redefinição")');
  await expect(
    paginaNova.getByText("Se existir uma conta com esse e-mail, enviamos um link")
  ).toBeVisible();

  const registro = await prisma.verificationToken.findFirstOrThrow({
    where: { identifier: `redefinir-senha:${email}` },
  });
  await paginaNova.goto(`/redefinir-senha/${registro.token}`);
  const novaSenha = "SenhaSessaoNova789";
  await paginaNova.fill('input[name="senha"]', novaSenha);
  await paginaNova.fill('input[name="confirmarSenha"]', novaSenha);
  await paginaNova.click('button:has-text("Redefinir senha e entrar")');
  await paginaNova.waitForURL(/\/painel$/);

  // A sessão antiga (cookie de antes da troca) agora é inválida.
  await paginaAntiga.goto("/painel");
  await expect(paginaAntiga).toHaveURL(/\/login/);

  // Alerta de segurança foi criado.
  const usuario = await prisma.user.findUniqueOrThrow({ where: { email } });
  const alerta = await prisma.notificacao.findFirstOrThrow({
    where: { userId: usuario.id, tipo: "CONTA_SEGURANCA" },
  });
  expect(alerta.titulo).toBe("Sua senha foi alterada");

  await contextoAntigo.close();
  await contextoNovo.close();
});

test("trocar a senha em 'Minha conta' desloga a sessão atual", async ({ page }) => {
  const { email, senha } = await criarCidadaoTeste();
  await login(page, email, senha);

  await page.goto("/painel/conta");
  await page.fill("#senha-atual", senha);
  await page.fill("#senha-nova", "SenhaAutoServico123");
  await page.fill("#senha-confirmar", "SenhaAutoServico123");
  await page.click('button:has-text("Alterar senha")');

  await page.waitForURL(/\/login/);

  // A senha nova já funciona, a antiga não.
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await expect(page.getByText("E-mail/CPF ou senha inválidos.")).toBeVisible();

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', "SenhaAutoServico123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
});

test("banimento aplicado com a sessão já ativa derruba o usuário na próxima requisição", async ({
  page,
}) => {
  const { usuario, email, senha } = await criarCidadaoTeste();
  await login(page, email, senha);
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/painel$/);

  await prisma.user.update({
    where: { id: usuario.id },
    data: { banidoAte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });

  await page.goto("/painel");
  await expect(page).toHaveURL(/\/login/);
});

test("excluir a conta num dispositivo derruba a sessão já aberta em outro", async ({ browser }) => {
  const { usuario, email, senha } = await criarCidadaoTeste();
  usuarioExcluidoId = usuario.id;

  // Contexto A: sessão aberta antes da exclusão (ex.: celular esquecido logado).
  const contextoAntigo = await browser.newContext();
  const paginaAntiga = await contextoAntigo.newPage();
  await login(paginaAntiga, email, senha);
  await paginaAntiga.goto("/painel");
  await expect(paginaAntiga).toHaveURL(/\/painel$/);

  // Contexto B: exclui a conta, sem tocar nos cookies do A.
  const contextoNovo = await browser.newContext();
  const paginaNova = await contextoNovo.newPage();
  await login(paginaNova, email, senha);
  await paginaNova.goto("/painel/conta");
  await paginaNova.fill("#exclusao-senha", senha);
  await paginaNova.click('button:has-text("Excluir minha conta")');
  await paginaNova.waitForURL(/^http:\/\/localhost:3000\/$/);

  const usuarioFinal = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
  expect(usuarioFinal.ativo).toBe(false);

  // callback jwt() de auth.ts derruba o token na próxima leitura de sessão -
  // sem essa checagem de ativo=false, o contexto A continuaria logado até o
  // cookie expirar sozinho, mesmo com a conta já excluída.
  await paginaAntiga.goto("/painel");
  await expect(paginaAntiga).toHaveURL(/\/login/);

  await contextoAntigo.close();
  await contextoNovo.close();
});
