import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  apagarLogsDeModeracao,
  criarCidadaoTeste,
  criarOrgaoTeste,
  criarReclamacaoTeste,
  limparDadosTeste,
} from "./helpers";

// A resposta oficial é registro público: o órgão corrige o erro de quem acabou de enviar (typo,
// prazo errado) numa janela curta, só na mais recente e antes de o autor avaliar, e a correção
// aparece marcada como editada. Fora disso o caminho é uma nova resposta.

const idsReclamacaoParaLimpar: string[] = [];
const MIN = 60_000;

test.afterAll(async () => {
  await apagarLogsDeModeracao({ id: { in: idsReclamacaoParaLimpar } });
  await prisma.reclamacao.deleteMany({ where: { id: { in: idsReclamacaoParaLimpar } } });
  await limparDadosTeste();
});

async function login(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(painel|orgao)$/);
}

async function cenario() {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { usuario: autor } = await criarCidadaoTeste();
  const org = await criarOrgaoTeste(cidade.id);
  const reclamacao = await criarReclamacaoTeste(autor.id, { cidadeId: cidade.id });
  idsReclamacaoParaLimpar.push(reclamacao.id);
  return { cidade, autor, ...org, reclamacao };
}

function responder(
  dados: { reclamacaoId: string; autorId: string; orgaoId: string },
  minutosAtras: number,
  texto: string
) {
  return prisma.respostaOficial.create({
    data: { ...dados, texto, createdAt: new Date(Date.now() - minutosAtras * MIN) },
  });
}

test("corrige o texto e o prazo dentro da janela, e a resposta aparece como editada", async ({
  page,
}) => {
  const c = await cenario();
  const resposta = await responder(
    { reclamacaoId: c.reclamacao.id, autorId: c.usuario.id, orgaoId: c.orgao.id },
    2,
    "Equipe acionada, conserto previsto."
  );

  await login(page, c.email, c.senha);
  await page.goto(`/reclamacoes/${c.reclamacao.protocolo}`);
  await expect(page.getByText(/Você pode corrigir esta resposta até/)).toBeHidden();

  await page.getByText("Corrigir resposta", { exact: true }).click();
  await expect(page.getByText(/Você pode corrigir esta resposta até \d/)).toBeVisible();
  await page.locator(`#correcao-texto-${resposta.id}`).fill("Equipe acionada; conserto previsto para esta semana.");
  await page.locator(`#correcao-prazo-${resposta.id}`).fill("2030-01-15");
  await page.getByRole("button", { name: "Salvar correção" }).click();

  await expect(page.getByText("Resposta corrigida. Ela aparece marcada como editada.")).toBeVisible();

  const depois = await prisma.respostaOficial.findUniqueOrThrow({ where: { id: resposta.id } });
  expect(depois.texto).toBe("Equipe acionada; conserto previsto para esta semana.");
  expect(depois.prazoEstimado?.toISOString().slice(0, 10)).toBe("2030-01-15");
  expect(depois.editadaEm).not.toBeNull();
  // O que a resposta anunciou não se desfaz por aqui.
  expect(depois.novoStatus).toBeNull();

  // Todo mundo vê a marca: a correção não é silenciosa.
  await page.reload();
  // O texto aparece também dentro do formulário de correção (fechado): só o parágrafo conta.
  await expect(
    page.locator("p", { hasText: "Equipe acionada; conserto previsto para esta semana." })
  ).toBeVisible();
  await expect(page.getByText(/Editada em/)).toBeVisible();
});

test("passada a janela não há botão, e o servidor recusa mesmo com a tela aberta antes", async ({
  page,
}) => {
  const c = await cenario();
  const dados = { reclamacaoId: c.reclamacao.id, autorId: c.usuario.id, orgaoId: c.orgao.id };
  const resposta = await responder(dados, 2, "Texto original da resposta oficial.");

  await login(page, c.email, c.senha);
  await page.goto(`/reclamacoes/${c.reclamacao.protocolo}`);
  await page.getByText("Corrigir resposta", { exact: true }).click();
  await page.locator(`#correcao-texto-${resposta.id}`).fill("Tentativa de reescrever depois do prazo.");

  // Com o formulário já aberto, o tempo passa: só o servidor pode barrar.
  await prisma.respostaOficial.update({
    where: { id: resposta.id },
    data: { createdAt: new Date(Date.now() - 20 * MIN) },
  });
  await page.getByRole("button", { name: "Salvar correção" }).click();
  await expect(page.getByText(/O prazo para corrigir esta resposta acabou/)).toBeVisible();

  const intacta = await prisma.respostaOficial.findUniqueOrThrow({ where: { id: resposta.id } });
  expect(intacta.texto).toBe("Texto original da resposta oficial.");
  expect(intacta.editadaEm).toBeNull();

  // E recarregada, a tela não oferece mais.
  await page.reload();
  await expect(page.getByText("Corrigir resposta", { exact: true })).toHaveCount(0);
});

test("só a mais recente se corrige; uma resposta nova depois da tela aberta também barra", async ({
  page,
}) => {
  const c = await cenario();
  const dados = { reclamacaoId: c.reclamacao.id, autorId: c.usuario.id, orgaoId: c.orgao.id };
  const antiga = await responder(dados, 10, "Primeira resposta, a mais antiga.");

  await login(page, c.email, c.senha);
  await page.goto(`/reclamacoes/${c.reclamacao.protocolo}`);
  await page.getByText("Corrigir resposta", { exact: true }).click();
  await page.locator(`#correcao-texto-${antiga.id}`).fill("Mudando a primeira resposta depois da segunda.");

  // Sai outra resposta enquanto a tela está aberta: a anterior já não é a corrigível.
  await responder(dados, 1, "Segunda resposta, a mais recente.");
  await page.getByRole("button", { name: "Salvar correção" }).click();
  await expect(page.getByText(/Já existe uma resposta mais recente|A resposta mudou enquanto você corrigia/)).toBeVisible();
  expect((await prisma.respostaOficial.findUniqueOrThrow({ where: { id: antiga.id } })).editadaEm).toBeNull();

  // Recarregada, com as duas, só uma tem o botão: a mais recente.
  await page.reload();
  await expect(page.getByText("Corrigir resposta", { exact: true })).toHaveCount(1);
  const artigoRecente = page.locator("article").filter({ hasText: "Segunda resposta, a mais recente." });
  await expect(artigoRecente.getByText("Corrigir resposta", { exact: true })).toBeVisible();
});

test("outro órgão e o cidadão não veem o botão de corrigir", async ({ page }) => {
  const c = await cenario();
  await responder(
    { reclamacaoId: c.reclamacao.id, autorId: c.usuario.id, orgaoId: c.orgao.id },
    2,
    "Resposta do órgão dono."
  );
  const cidade = await prisma.cidade.findFirstOrThrow();
  const outro = await criarOrgaoTeste(cidade.id);

  await login(page, outro.email, outro.senha);
  await page.goto(`/reclamacoes/${c.reclamacao.protocolo}`);
  await expect(page.getByText("Resposta do órgão dono.")).toBeVisible();
  await expect(page.getByText("Corrigir resposta", { exact: true })).toHaveCount(0);

  await page.goto("about:blank");
  await page.context().clearCookies();
  const { email, senha } = await criarCidadaoTeste();
  await login(page, email, senha);
  await page.goto(`/reclamacoes/${c.reclamacao.protocolo}`);
  await expect(page.getByText("Resposta do órgão dono.")).toBeVisible();
  await expect(page.getByText("Corrigir resposta", { exact: true })).toHaveCount(0);
});

test("depois que o autor avalia a resolução, a resposta que a anunciou não se corrige mais", async ({
  page,
}) => {
  const c = await cenario();
  const resposta = await responder(
    { reclamacaoId: c.reclamacao.id, autorId: c.usuario.id, orgaoId: c.orgao.id },
    5,
    "Serviço concluído."
  );
  await prisma.respostaOficial.update({ where: { id: resposta.id }, data: { novoStatus: "RESOLVIDA" } });
  await prisma.reclamacao.update({
    where: { id: c.reclamacao.id },
    data: { status: "RESOLVIDA", resolvidaEm: new Date(Date.now() - 5 * MIN) },
  });

  await login(page, c.email, c.senha);
  await page.goto(`/reclamacoes/${c.reclamacao.protocolo}`);
  // Ainda sem avaliação: pode corrigir.
  await expect(page.getByText("Corrigir resposta", { exact: true })).toBeVisible();

  await prisma.avaliacao.create({
    data: { reclamacaoId: c.reclamacao.id, autorId: c.autor.id, nota: 5, resolvido: true },
  });
  await page.reload();
  await expect(page.getByText("Corrigir resposta", { exact: true })).toHaveCount(0);
});
