import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { aplicarBlur, distanciaHamming } from "./imagem";

async function gerarImagemTeste(largura: number, altura: number): Promise<Buffer> {
  return sharp({
    create: { width: largura, height: altura, channels: 3, background: { r: 200, g: 50, b: 50 } },
  })
    .png()
    .toBuffer();
}

describe("distanciaHamming", () => {
  it("é zero para hashes idênticos", () => {
    expect(distanciaHamming("ff00", "ff00")).toBe(0);
  });

  it("conta os bits diferentes corretamente", () => {
    // 0xf = 1111, 0x0 = 0000 -> 4 bits diferentes
    expect(distanciaHamming("f", "0")).toBe(4);
    // 0xf = 1111, 0x7 = 0111 -> 1 bit diferente
    expect(distanciaHamming("f", "7")).toBe(1);
  });

  it("retorna um valor grande quando os hashes têm tamanhos diferentes", () => {
    expect(distanciaHamming("ff", "ffff")).toBeGreaterThan(1000);
  });
});

describe("aplicarBlur", () => {
  it("desfoca de verdade quando as dimensões e a região são válidas", async () => {
    const original = await gerarImagemTeste(200, 200);
    const tratada = await aplicarBlur(original, 200, 200, [
      { ymin: 0, xmin: 0, ymax: 500, xmax: 500 },
    ]);

    expect(Buffer.compare(tratada, original)).not.toBe(0);
  });

  // Cenário do bug corrigido: aplicarBlur() era chamado só quando havia
  // região detectada (regioes.length > 0), então "nenhuma composição
  // sobrou" só acontece quando largura/altura da imagem estão erradas
  // (ex.: vieram 0 de uma análise que falhou) - antes disso devolvia o
  // buffer ORIGINAL sem erro nenhum, e quem chamou achava que o desfoque
  // tinha dado certo e publicava a foto com rosto/placa exposto.
  it("lança em vez de devolver o buffer original quando larguraPx/alturaPx zeram a área de toda região", async () => {
    const original = await gerarImagemTeste(200, 200);

    await expect(
      aplicarBlur(original, 0, 0, [{ ymin: 0, xmin: 0, ymax: 500, xmax: 500 }])
    ).rejects.toThrow();
  });
});
