"use server";

import { redirect } from "next/navigation";
import sharp from "sharp";
import { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { finalizarPublicacaoAprovada, moderarReclamacao } from "@/lib/moderacao";
import { gerarProtocolo } from "@/lib/protocolo";
import { uploadImagem } from "@/lib/storage";
import { aplicarBlur, calcularPhash, distanciaHamming, extrairExif } from "@/lib/imagem";

import { criarNovaReclamacaoSchema, type NovaReclamacaoFormState } from "./definitions";

const MAX_IMAGENS = 5;
const MAX_TAMANHO_BYTES = 5 * 1024 * 1024;
const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
const DISTANCIA_REPOSTAGEM = 8;
const LIMITE_RECLAMACOES_DIA = 5;
const JANELA_REPOSTAGEM_DIAS = 180;

export async function criarReclamacao(
  _state: NovaReclamacaoFormState,
  formData: FormData
): Promise<NovaReclamacaoFormState> {
  const t = await getTranslations("NovaReclamacao");
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const validado = criarNovaReclamacaoSchema(t).safeParse({
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao"),
    categoriaId: formData.get("categoriaId") ?? "",
    cidadeId: formData.get("cidadeId") ?? "",
    endereco: formData.get("endereco"),
    bairro: formData.get("bairro"),
    referencia: formData.get("referencia"),
    cep: formData.get("cep"),
    declaracaoVeracidade: formData.get("declaracaoVeracidade"),
  });

  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  const reclamacoesHoje = await prisma.reclamacao.count({
    where: { autorId: session.user.id, createdAt: { gte: inicioDoDia } },
  });
  if (reclamacoesHoje >= LIMITE_RECLAMACOES_DIA) {
    return { mensagem: t("erroLimiteDiario") };
  }

  const arquivos = formData
    .getAll("imagens")
    .filter((valor): valor is File => valor instanceof File && valor.size > 0);

  if (arquivos.length > MAX_IMAGENS) {
    return { mensagem: t("erroMaxImagens", { max: MAX_IMAGENS }) };
  }
  for (const arquivo of arquivos) {
    if (!TIPOS_ACEITOS.includes(arquivo.type)) {
      return { mensagem: t("erroTipoImagem") };
    }
    if (arquivo.size > MAX_TAMANHO_BYTES) {
      return { mensagem: t("erroTamanhoImagem") };
    }

    // arquivo.type vem do cliente e é falsificável - o formato real é o
    // que o sharp detecta pelo conteúdo. Sem isso, um SVG/GIF/TIFF (que o
    // sharp também sabe ler) passaria como "image/png" e iria pro storage
    // público com um tipo que não é o real.
    try {
      const formato = (await sharp(Buffer.from(await arquivo.arrayBuffer())).metadata()).format;
      if (formato !== "jpeg" && formato !== "png" && formato !== "webp") {
        return { mensagem: t("erroTipoImagem") };
      }
    } catch {
      return { mensagem: t("erroTipoImagem") };
    }
  }

  const { titulo, descricao, categoriaId, cidadeId, endereco, bairro, referencia, cep } =
    validado.data;

  const bairroRegistro = await prisma.bairro.upsert({
    where: { cidadeId_nome: { cidadeId, nome: bairro } },
    update: {},
    create: { cidadeId, nome: bairro },
  });

  // Retry curto em caso de colisão de protocolo (duas reclamações criadas
  // no mesmo instante) - gerarProtocolo() não é atômico, então uma corrida
  // rara ainda é possível mesmo com o número baseado no maior existente.
  let reclamacao;
  for (let tentativa = 1; ; tentativa++) {
    const protocolo = await gerarProtocolo();
    try {
      reclamacao = await prisma.reclamacao.create({
        data: {
          protocolo,
          titulo,
          descricao,
          autorId: session.user.id,
          categoriaId,
          cidadeId,
          bairroId: bairroRegistro.id,
          endereco,
          referencia: referencia || null,
          cep,
        },
      });
      break;
    } catch (erro) {
      const colisaoDeProtocolo =
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === "P2002" &&
        (Array.isArray(erro.meta?.target)
          ? erro.meta.target.includes("protocolo")
          : typeof erro.meta?.target === "string" &&
            erro.meta.target.toLowerCase().includes("protocolo"));

      if (!colisaoDeProtocolo || tentativa >= 3) {
        throw erro;
      }
    }
  }

  const midiasCriadas: {
    id: string;
    buffer: Buffer;
    larguraPx: number;
    alturaPx: number;
  }[] = [];

  let possivelReposicao = false;

  // Processamento de imagem (upload, phash, EXIF) isolado da moderação: se
  // uma foto falhar ao subir, a reclamação ainda precisa ser moderada pelo
  // texto - não pode ficar travada em EM_MODERACAO só por causa da imagem.
  try {
    // Janela de tempo limitada, não o histórico inteiro - sem isso, o
    // custo desta consulta (e da comparação em memória logo abaixo)
    // cresce sem limite conforme o app acumula mídia ao longo dos anos.
    const phashesExistentes =
      arquivos.length > 0
        ? (
            await prisma.midia.findMany({
              where: {
                reclamacaoId: { not: reclamacao.id },
                phash: { not: null },
                createdAt: { gte: new Date(Date.now() - JANELA_REPOSTAGEM_DIAS * 86_400_000) },
              },
              select: { phash: true },
              orderBy: { createdAt: "desc" },
            })
          ).map((midia) => midia.phash!)
        : [];

    for (const [ordem, arquivo] of arquivos.entries()) {
      const buffer = Buffer.from(await arquivo.arrayBuffer());
      const metadados = await sharp(buffer).metadata();
      const [phash, exif] = await Promise.all([
        calcularPhash(buffer),
        extrairExif(buffer),
      ]);

      if (
        phashesExistentes.some(
          (phashExistente) => distanciaHamming(phash, phashExistente) <= DISTANCIA_REPOSTAGEM
        )
      ) {
        possivelReposicao = true;
      }

      const url = await uploadImagem(buffer, {
        reclamacaoId: reclamacao.id,
        nomeArquivo: arquivo.name,
        mimeType: arquivo.type,
      });

      const midia = await prisma.midia.create({
        data: {
          reclamacaoId: reclamacao.id,
          url,
          tipo: "IMAGEM",
          nomeArquivo: arquivo.name,
          mimeType: arquivo.type,
          tamanhoBytes: arquivo.size,
          larguraPx: metadados.width,
          alturaPx: metadados.height,
          phash,
          exifJson: exif.exifJson,
          capturadaEm: exif.capturadaEm,
          ordem,
        },
      });

      midiasCriadas.push({
        id: midia.id,
        buffer,
        larguraPx: metadados.width ?? 0,
        alturaPx: metadados.height ?? 0,
      });
    }
  } catch (erro) {
    console.error("Falha ao processar imagens da reclamação:", erro);
  }

  let decisaoModeracao: Awaited<ReturnType<typeof moderarReclamacao>>["decisao"] | null = null;
  let regioesSensiveis: Awaited<ReturnType<typeof moderarReclamacao>>["regioesSensiveis"] = [];
  try {
    const resultado = await moderarReclamacao(
      reclamacao.id,
      midiasCriadas.map((midia, indice) => ({
        buffer: midia.buffer,
        mimeType: arquivos[indice].type,
      })),
      { possivelReposicao }
    );
    decisaoModeracao = resultado.decisao;
    regioesSensiveis = resultado.regioesSensiveis;
  } catch (erro) {
    console.error("Falha na moderação automática:", erro);
  }

  const regioesPorMidia = new Map<number, typeof regioesSensiveis>();
  for (const regiao of regioesSensiveis) {
    const lista = regioesPorMidia.get(regiao.midiaIndice) ?? [];
    lista.push(regiao);
    regioesPorMidia.set(regiao.midiaIndice, lista);
  }

  // Se o blur falhar numa imagem que tinha rosto/placa detectado, a
  // reclamação NUNCA pode ficar publicada com a foto original exposta -
  // força revisão humana em vez de confiar na decisão automática.
  let falhaAoBorrar = false;
  for (const [indice, midia] of midiasCriadas.entries()) {
    const regioes = regioesPorMidia.get(indice);
    if (!regioes || regioes.length === 0) continue;

    try {
      const bufferTratado = await aplicarBlur(
        midia.buffer,
        midia.larguraPx,
        midia.alturaPx,
        regioes
      );
      const urlTratada = await uploadImagem(bufferTratado, {
        reclamacaoId: reclamacao.id,
        nomeArquivo: `tratada-${arquivos[indice].name}`,
        mimeType: arquivos[indice].type,
      });

      await prisma.midia.update({
        where: { id: midia.id },
        data: { urlTratada },
      });
    } catch (erro) {
      console.error("Falha ao aplicar desfoque na imagem:", erro);
      falhaAoBorrar = true;
      await prisma.midia.update({
        where: { id: midia.id },
        data: { statusModeracao: "REVISAO_HUMANA" },
      });
    }
  }

  if (falhaAoBorrar) {
    await prisma.reclamacao.update({
      where: { id: reclamacao.id },
      data: { status: "AGUARDANDO_REVISAO" },
    });
  } else if (decisaoModeracao === "APROVAR" && regioesSensiveis.length > 0) {
    // moderarReclamacao() adiou a publicação por ter mídia sensível - só
    // agora, com o desfoque confirmado em todas elas, publica de verdade.
    await finalizarPublicacaoAprovada(reclamacao.id);
  }

  redirect(`/reclamacoes/${reclamacao.protocolo}`);
}
