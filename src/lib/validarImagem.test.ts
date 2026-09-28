import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { analisarImagemReal, mimeTypeDoFormato } from "./validarImagem";

async function gerarImagem(
  formato: "jpeg" | "png" | "webp",
  largura = 2,
  altura = 2
): Promise<Buffer> {
  const imagem = sharp({
    create: { width: largura, height: altura, channels: 3, background: { r: 255, g: 0, b: 0 } },
  });
  return formato === "jpeg" ? imagem.jpeg().toBuffer() : imagem[formato]().toBuffer();
}

describe("analisarImagemReal", () => {
  it("detecta jpeg e as dimensões pelo conteúdo", async () => {
    const analise = await analisarImagemReal(await gerarImagem("jpeg", 10, 20));
    expect(analise).toEqual({ formato: "jpeg", largura: 10, altura: 20 });
  });

  it("detecta png pelo conteúdo", async () => {
    expect((await analisarImagemReal(await gerarImagem("png")))?.formato).toBe("png");
  });

  it("detecta webp pelo conteúdo", async () => {
    expect((await analisarImagemReal(await gerarImagem("webp")))?.formato).toBe("webp");
  });

  it("retorna null pra bytes que não são imagem nenhuma", async () => {
    expect(await analisarImagemReal(Buffer.from("isto não é uma imagem"))).toBeNull();
  });

  // Este é o cenário do bug corrigido: o navegador manda um File.type que
  // não bate com o conteúdo real - a função nunca recebe nem olha pra esse
  // valor, então não tem como ser enganada por ele. Quem chama (nova/
  // actions.ts) usa só o retorno daqui pra decidir o Content-Type salvo,
  // nunca arquivo.type.
  it("um JPEG de verdade continua detectado como jpeg mesmo que o chamador tenha recebido um File.type mentiroso", async () => {
    const analise = await analisarImagemReal(await gerarImagem("jpeg"));
    expect(analise?.formato).toBe("jpeg");
    expect(mimeTypeDoFormato(analise!.formato)).toBe("image/jpeg");
    expect(mimeTypeDoFormato(analise!.formato)).not.toBe("image/webp");
  });
});

describe("mimeTypeDoFormato", () => {
  it("monta o Content-Type a partir do formato detectado", () => {
    expect(mimeTypeDoFormato("jpeg")).toBe("image/jpeg");
    expect(mimeTypeDoFormato("png")).toBe("image/png");
    expect(mimeTypeDoFormato("webp")).toBe("image/webp");
  });
});
