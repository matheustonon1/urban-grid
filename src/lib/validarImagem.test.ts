import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { formatoImagemReal, mimeTypeDoFormato } from "./validarImagem";

async function gerarImagem(formato: "jpeg" | "png" | "webp"): Promise<Buffer> {
  const imagem = sharp({
    create: { width: 2, height: 2, channels: 3, background: { r: 255, g: 0, b: 0 } },
  });
  return formato === "jpeg" ? imagem.jpeg().toBuffer() : imagem[formato]().toBuffer();
}

describe("formatoImagemReal", () => {
  it("detecta jpeg pelo conteúdo", async () => {
    expect(await formatoImagemReal(await gerarImagem("jpeg"))).toBe("jpeg");
  });

  it("detecta png pelo conteúdo", async () => {
    expect(await formatoImagemReal(await gerarImagem("png"))).toBe("png");
  });

  it("detecta webp pelo conteúdo", async () => {
    expect(await formatoImagemReal(await gerarImagem("webp"))).toBe("webp");
  });

  it("retorna null pra bytes que não são imagem nenhuma", async () => {
    expect(await formatoImagemReal(Buffer.from("isto não é uma imagem"))).toBeNull();
  });

  // Este é o cenário do bug corrigido: o navegador manda um File.type que
  // não bate com o conteúdo real - a função nunca recebe nem olha pra esse
  // valor, então não tem como ser enganada por ele. Quem chama (nova/
  // actions.ts) usa só o retorno daqui pra decidir o Content-Type salvo,
  // nunca arquivo.type.
  it("um JPEG de verdade continua detectado como jpeg mesmo que o chamador tenha recebido um File.type mentiroso", async () => {
    const bufferJpegReal = await gerarImagem("jpeg");
    const formato = await formatoImagemReal(bufferJpegReal);
    expect(formato).toBe("jpeg");
    expect(mimeTypeDoFormato(formato!)).toBe("image/jpeg");
    expect(mimeTypeDoFormato(formato!)).not.toBe("image/webp");
  });
});

describe("mimeTypeDoFormato", () => {
  it("monta o Content-Type a partir do formato detectado", () => {
    expect(mimeTypeDoFormato("jpeg")).toBe("image/jpeg");
    expect(mimeTypeDoFormato("png")).toBe("image/png");
    expect(mimeTypeDoFormato("webp")).toBe("image/webp");
  });
});
