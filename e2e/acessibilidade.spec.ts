import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  apagarLogsDeModeracao,
  ativarDoisFatoresTeste,
  confirmarDialogo,
  criarAdminTeste,
  criarCidadaoTeste,
  criarOrgaoNoRanking,
  criarOrgaoTeste,
  criarReclamacaoTeste,
  limparDadosTeste,
} from "./helpers";
import { prisma } from "@/lib/prisma";

// Varredura automática de acessibilidade (axe-core) nas telas principais, nos
// dois temas. Pega o que máquina consegue pegar - contraste, campo sem rótulo,
// landmark duplicado, ARIA inválido - e falha só em violação "serious" ou
// "critical". Não substitui teclado e leitor de tela (skill `acessibilidade`).
//
// reducedMotion: o <Revelar> e o animate-fade-in começam transparentes; com
// movimento reduzido o conteúdo já nasce visível e o axe mede o contraste de
// verdade (e não de um quadro no meio da animação).
test.use({ reducedMotion: "reduce" });

test.afterAll(async () => {
  await limparDadosTeste();
});

const TEMAS = ["light", "dark"] as const;

async function escolherTema(page: Page, tema: (typeof TEMAS)[number]) {
  await page.addInitScript((valor) => {
    try {
      localStorage.setItem("tema", valor);
    } catch {
      // sem localStorage: fica no tema padrão
    }
  }, tema);
}

async function violacoesGraves(page: Page) {
  const resultado = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  return resultado.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      regra: v.id,
      impacto: v.impact,
      ajuda: v.help,
      elementos: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    }));
}

async function entrar(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

const ROTAS_PUBLICAS = [
  "/",
  "/login",
  "/cadastro",
  "/cadastro?tipo=orgao",
  "/esqueci-senha",
  "/cidades/solicitar",
  "/reclamacoes",
  "/transparencia",
  "/termos",
];

for (const tema of TEMAS) {
  for (const rota of ROTAS_PUBLICAS) {
    test(`${rota} não tem violação grave de acessibilidade (${tema})`, async ({ page }) => {
      await escolherTema(page, tema);
      await page.goto(rota, { waitUntil: "networkidle" });

      expect(await violacoesGraves(page)).toEqual([]);
    });
  }

  test(`telas do cidadão logado não têm violação grave (${tema})`, async ({ page }) => {
    const { email, senha } = await criarCidadaoTeste();
    await escolherTema(page, tema);
    await entrar(page, email, senha);

    for (const rota of ["/painel", "/painel/conta", "/reclamacoes/nova"]) {
      await page.goto(rota, { waitUntil: "networkidle" });
      expect(await violacoesGraves(page), rota).toEqual([]);
    }
  });

  // As páginas com ranking de órgãos só têm linhas para medir quando existe um órgão que
  // respondeu: com o banco vazio o contraste dos números do ranking nunca era avaliado.
  test(`home e transparência com órgão no ranking não têm violação grave (${tema})`, async ({
    page,
  }) => {
    const cidade = await prisma.cidade.findFirstOrThrow();
    await criarOrgaoNoRanking(cidade.id);
    await escolherTema(page, tema);

    for (const rota of ["/", "/transparencia"]) {
      await page.goto(rota, { waitUntil: "networkidle" });
      expect(await violacoesGraves(page), rota).toEqual([]);
    }
  });

  // O painel do órgão (cartões com formulário recolhido) e a reclamação vista por quem
  // atende: o formulário de resposta aberto também entra na varredura.
  test(`painel do órgão e reclamação vista pelo órgão não têm violação grave (${tema})`, async ({
    page,
  }) => {
    const cidade = await prisma.cidade.findFirstOrThrow();
    const { usuario: autor } = await criarCidadaoTeste();
    const reclamacao = await criarReclamacaoTeste(autor.id, { cidadeId: cidade.id });
    const { email, senha } = await criarOrgaoTeste(cidade.id);
    await escolherTema(page, tema);
    await entrar(page, email, senha);

    try {
      await page.goto("/orgao", { waitUntil: "networkidle" });
      await page.locator("summary", { hasText: "Responder" }).first().click();
      expect(await violacoesGraves(page), "/orgao").toEqual([]);

      await page.goto(`/reclamacoes/${reclamacao.protocolo}`, { waitUntil: "networkidle" });
      expect(await violacoesGraves(page), "detalhe").toEqual([]);
    } finally {
      await apagarLogsDeModeracao({ id: reclamacao.id });
      await prisma.reclamacao.delete({ where: { id: reclamacao.id } });
    }
  });

  test(`telas de moderação e administração não têm violação grave (${tema})`, async ({ page }) => {
    const { email, senha } = await criarAdminTeste();
    await escolherTema(page, tema);
    await entrar(page, email, senha);

    for (const rota of [
      "/moderacao",
      "/moderacao/estatisticas",
      "/denuncias",
      "/usuarios",
      "/banimentos",
      "/solicitacoes-orgao",
      "/solicitacoes-cidade",
      "/orgaos-categorias",
      "/auditoria",
    ]) {
      await page.goto(rota, { waitUntil: "networkidle" });
      expect(await violacoesGraves(page), rota).toEqual([]);
    }
  });
}

// Diálogo de confirmação (sem 2FA, com os campos de senha e código, e com o erro de senha
// dentro dele) e o aviso flutuante que vem depois: são camadas novas por cima da página
// e precisam passar na varredura com o fundo inerte, nos dois temas.
for (const tema of TEMAS) {
  test(`diálogo de confirmação e aviso flutuante, tema ${tema}`, async ({ page }) => {
    await escolherTema(page, tema);
    const { usuario: admin, email, senha } = await criarAdminTeste();
    const { email: emailAlvo } = await criarCidadaoTeste();
    await entrar(page, email, senha);

    async function abrirDialogoDePapel() {
      await page.goto(`/usuarios?q=${encodeURIComponent(emailAlvo)}`);
      const linha = page.locator("li", { hasText: emailAlvo });
      await linha.locator('select[name="papel"]').selectOption("MODERADOR");
      await linha.getByRole("button", { name: "Salvar" }).click();
      await page.getByRole("dialog").waitFor();
    }

    // Conta sem 2FA: o diálogo troca os campos por um aviso com o caminho para ativá-lo.
    await abrirDialogoDePapel();
    expect(await violacoesGraves(page)).toEqual([]);

    const { codigosBackup } = await ativarDoisFatoresTeste(admin.id);
    await abrirDialogoDePapel();
    expect(await violacoesGraves(page)).toEqual([]);

    await confirmarDialogo(page, "Alterar para Moderador", "senha-errada-123", codigosBackup[0]);
    await page.getByRole("dialog").getByRole("alert").waitFor();
    expect(await violacoesGraves(page)).toEqual([]);

    await confirmarDialogo(page, "Alterar para Moderador", senha, codigosBackup[0]);
    await page.getByText(/alterado para Moderador/).waitFor();
    expect(await violacoesGraves(page)).toEqual([]);
  });
}
