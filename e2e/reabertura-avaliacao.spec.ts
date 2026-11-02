import { expect, test, type Browser, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  apagarLogsDeModeracao,
  criarCidadaoTeste,
  criarOrgaoTeste,
  criarReclamacaoTeste,
  limparDadosTeste,
} from "./helpers";

// "Resolvida" é o órgão que diz; o autor confirma ou contesta. Contestar REABRE a reclamação
// (antes ela ficava resolvida para sempre, com o autor discordando e o órgão sem aviso nem
// como responder), o órgão é avisado e, quando resolve de novo, o autor avalia outra vez.

const idsReclamacaoParaLimpar: string[] = [];

test.afterAll(async () => {
  await apagarLogsDeModeracao({ id: { in: idsReclamacaoParaLimpar } });
  await prisma.reclamacao.deleteMany({ where: { id: { in: idsReclamacaoParaLimpar } } });
  await limparDadosTeste();
});

async function entrarEmContexto(browser: Browser, email: string, senha: string): Promise<Page> {
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(painel|orgao)$/);
  return page;
}

test("contestar reabre a reclamação, avisa o órgão e permite avaliar de novo quando ele resolve outra vez", async ({
  browser,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { usuario: autor, email: emailAutor, senha: senhaAutor } = await criarCidadaoTeste();
  const { orgao, usuario: responsavel, email: emailOrgao, senha: senhaOrgao } =
    await criarOrgaoTeste(cidade.id);

  // Já resolvida pelo órgão, como o autor a encontra.
  const reclamacao = await criarReclamacaoTeste(autor.id, { cidadeId: cidade.id });
  idsReclamacaoParaLimpar.push(reclamacao.id);
  await prisma.reclamacao.update({
    where: { id: reclamacao.id },
    data: { status: "RESOLVIDA", resolvidaEm: new Date(Date.now() - 3_600_000) },
  });
  await prisma.respostaOficial.create({
    data: {
      reclamacaoId: reclamacao.id,
      autorId: responsavel.id,
      orgaoId: orgao.id,
      texto: "Serviço concluído.",
      novoStatus: "RESOLVIDA",
    },
  });

  const paginaAutor = await entrarEmContexto(browser, emailAutor, senhaAutor);
  const paginaOrgao = await entrarEmContexto(browser, emailOrgao, senhaOrgao);

  // 1. O autor contesta, com um comentário.
  await paginaAutor.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await expect(paginaAutor.getByText("O problema foi realmente resolvido?")).toBeVisible();
  await paginaAutor.selectOption('select[name="nota"]', "2");
  await paginaAutor.check('input[name="resolvido"][value="false"]');
  await paginaAutor.fill('textarea[name="comentario"]', "Continua alagando quando chove.");
  await paginaAutor.click('button:has-text("Enviar avaliação")');
  await expect(
    paginaAutor.getByText("Como o problema continua, a reclamação foi reaberta e o órgão foi avisado.")
  ).toBeVisible();

  const reaberta = await prisma.reclamacao.findUniqueOrThrow({ where: { id: reclamacao.id } });
  expect(reaberta.status).toBe("EM_ANDAMENTO");
  expect(reaberta.resolvidaEm).toBeNull();
  const contestacao = await prisma.avaliacao.findUniqueOrThrow({ where: { reclamacaoId: reclamacao.id } });
  expect(contestacao).toMatchObject({ resolvido: false, nota: 2 });

  // 2. O órgão foi avisado, com o que o autor escreveu.
  const aviso = await prisma.notificacao.findFirst({
    where: { userId: responsavel.id, reclamacaoId: reclamacao.id },
  });
  expect(aviso?.titulo).toBe("Reclamação reaberta pelo autor");
  expect(aviso?.mensagem).toContain("Continua alagando quando chove.");

  // 3. Ela voltou para a fila do órgão (já teve resposta e está aberta: "em acompanhamento"),
  //    e ele consegue responder de novo.
  await paginaOrgao.goto(
    `/orgao?fila=acompanhamento&q=${encodeURIComponent(reclamacao.protocolo)}`
  );
  const cartao = paginaOrgao.locator("article").filter({ hasText: reclamacao.titulo });
  await expect(cartao).toHaveCount(1);
  await cartao.getByText("Responder", { exact: true }).click();
  await cartao.locator('textarea[name="texto"]').fill("Refizemos o serviço e o escoamento foi corrigido.");
  await cartao.locator('select[name="novoStatus"]').selectOption("RESOLVIDA");
  await cartao.getByRole("button", { name: "Enviar resposta" }).click();
  await expect(
    paginaOrgao.getByText("Resposta enviada e reclamação marcada como resolvida.")
  ).toBeVisible();

  const resolvidaDeNovo = await prisma.reclamacao.findUniqueOrThrow({ where: { id: reclamacao.id } });
  expect(resolvidaDeNovo.status).toBe("RESOLVIDA");
  expect(resolvidaDeNovo.resolvidaEm).not.toBeNull();

  // 4. O autor avalia outra vez e a nova avaliação SUBSTITUI a contestada.
  await paginaAutor.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await expect(paginaAutor.getByText("O problema foi realmente resolvido?")).toBeVisible();
  await paginaAutor.selectOption('select[name="nota"]', "5");
  await paginaAutor.check('input[name="resolvido"][value="true"]');
  await paginaAutor.click('button:has-text("Enviar avaliação")');
  await expect(paginaAutor.getByText("O problema foi realmente resolvido?")).toHaveCount(0);

  const avaliacoes = await prisma.avaliacao.findMany({ where: { reclamacaoId: reclamacao.id } });
  expect(avaliacoes).toHaveLength(1);
  expect(avaliacoes[0]).toMatchObject({ resolvido: true, nota: 5 });

  // 5. Confirmou: é definitivo, não há mais formulário.
  await paginaAutor.reload();
  await expect(paginaAutor.getByText("O problema foi realmente resolvido?")).toHaveCount(0);
  const final = await prisma.reclamacao.findUniqueOrThrow({ where: { id: reclamacao.id } });
  expect(final.status).toBe("RESOLVIDA");

  await paginaAutor.context().close();
  await paginaOrgao.context().close();
});

test("contestar sem comentário reabre e avisa o órgão com a mensagem padrão", async ({ browser }) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { usuario: autor, email: emailAutor, senha: senhaAutor } = await criarCidadaoTeste();
  const { orgao, usuario: responsavel } = await criarOrgaoTeste(cidade.id);

  const reclamacao = await criarReclamacaoTeste(autor.id, { cidadeId: cidade.id });
  idsReclamacaoParaLimpar.push(reclamacao.id);
  await prisma.reclamacao.update({
    where: { id: reclamacao.id },
    data: { status: "RESOLVIDA", resolvidaEm: new Date() },
  });
  await prisma.respostaOficial.create({
    data: {
      reclamacaoId: reclamacao.id,
      autorId: responsavel.id,
      orgaoId: orgao.id,
      texto: "Resolvido.",
      novoStatus: "RESOLVIDA",
    },
  });

  const pagina = await entrarEmContexto(browser, emailAutor, senhaAutor);
  await pagina.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await pagina.selectOption('select[name="nota"]', "1");
  await pagina.check('input[name="resolvido"][value="false"]');
  await pagina.click('button:has-text("Enviar avaliação")');
  await expect(pagina.getByText("a reclamação foi reaberta")).toBeVisible();

  const aviso = await prisma.notificacao.findFirst({
    where: { userId: responsavel.id, reclamacaoId: reclamacao.id },
  });
  expect(aviso?.mensagem).toContain("respondeu que o problema não foi resolvido");
  expect(aviso?.mensagem).toContain("voltou para Em andamento");

  await pagina.context().close();
});

test("duas contestações ao mesmo tempo reabrem uma vez só e gravam uma avaliação", async ({
  browser,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { usuario: autor, email, senha } = await criarCidadaoTeste();
  const { orgao, usuario: responsavel } = await criarOrgaoTeste(cidade.id);

  const reclamacao = await criarReclamacaoTeste(autor.id, { cidadeId: cidade.id });
  idsReclamacaoParaLimpar.push(reclamacao.id);
  await prisma.reclamacao.update({
    where: { id: reclamacao.id },
    data: { status: "RESOLVIDA", resolvidaEm: new Date() },
  });
  await prisma.respostaOficial.create({
    data: {
      reclamacaoId: reclamacao.id,
      autorId: responsavel.id,
      orgaoId: orgao.id,
      texto: "Resolvido.",
      novoStatus: "RESOLVIDA",
    },
  });

  // Duas abas do mesmo autor, as duas com o formulário aberto.
  const contexto = await browser.newContext();
  const paginaA = await contexto.newPage();
  await paginaA.goto("/login");
  await paginaA.fill('input[name="identificador"]', email);
  await paginaA.fill('input[name="senha"]', senha);
  await paginaA.click('button[type="submit"]');
  await paginaA.waitForURL(/\/painel$/);
  const paginaB = await contexto.newPage();

  for (const pagina of [paginaA, paginaB]) {
    await pagina.goto(`/reclamacoes/${reclamacao.protocolo}`);
    await pagina.selectOption('select[name="nota"]', "1");
    await pagina.check('input[name="resolvido"][value="false"]');
  }
  await Promise.all([
    paginaA.click('button:has-text("Enviar avaliação")'),
    paginaB.click('button:has-text("Enviar avaliação")'),
  ]);
  await paginaA.waitForTimeout(1500);

  expect(await prisma.avaliacao.count({ where: { reclamacaoId: reclamacao.id } })).toBe(1);
  const final = await prisma.reclamacao.findUniqueOrThrow({ where: { id: reclamacao.id } });
  expect(final.status).toBe("EM_ANDAMENTO");
  // Um só aviso ao órgão: a perdedora da corrida não notifica de novo.
  expect(
    await prisma.notificacao.count({ where: { userId: responsavel.id, reclamacaoId: reclamacao.id } })
  ).toBe(1);

  await contexto.close();
});
