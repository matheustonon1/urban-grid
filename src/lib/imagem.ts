import sharp, { type OverlayOptions } from "sharp";
import { bmvbhash } from "blockhash-core";
import exifr from "exifr";

const BITS_PHASH = 16; // 16² = 256 bits = 64 caracteres hex, cabe em Midia.phash VARCHAR(64)

export async function calcularPhash(buffer: Buffer): Promise<string> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return bmvbhash({ width: info.width, height: info.height, data }, BITS_PHASH);
}

export function distanciaHamming(hashA: string, hashB: string): number {
  if (hashA.length !== hashB.length) {
    return Number.MAX_SAFE_INTEGER;
  }

  let distancia = 0;
  for (let i = 0; i < hashA.length; i++) {
    const diferenca = parseInt(hashA[i], 16) ^ parseInt(hashB[i], 16);
    distancia += diferenca.toString(2).split("1").length - 1;
  }
  return distancia;
}

export async function extrairExif(
  buffer: Buffer
): Promise<{ capturadaEm: Date | null; exifJson: string | null }> {
  try {
    const dados = await exifr.parse(buffer, { gps: true });
    if (!dados) {
      return { capturadaEm: null, exifJson: null };
    }

    const capturadaEm =
      dados.DateTimeOriginal instanceof Date ? dados.DateTimeOriginal : null;

    return { capturadaEm, exifJson: JSON.stringify(dados) };
  } catch {
    return { capturadaEm: null, exifJson: null };
  }
}

export interface RegiaoNormalizada {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

// Aplica blur em cada região (coordenadas normalizadas 0-1000, convenção
// de detecção de objetos do Gemini) e devolve a imagem final já tratada.
export async function aplicarBlur(
  buffer: Buffer,
  larguraPx: number,
  alturaPx: number,
  regioes: RegiaoNormalizada[]
): Promise<Buffer> {
  const composicoes: OverlayOptions[] = [];

  for (const regiao of regioes) {
    const left = Math.max(0, Math.round((regiao.xmin / 1000) * larguraPx));
    const top = Math.max(0, Math.round((regiao.ymin / 1000) * alturaPx));
    const largura = Math.min(
      larguraPx - left,
      Math.round(((regiao.xmax - regiao.xmin) / 1000) * larguraPx)
    );
    const altura = Math.min(
      alturaPx - top,
      Math.round(((regiao.ymax - regiao.ymin) / 1000) * alturaPx)
    );

    if (largura <= 0 || altura <= 0) continue;

    const recorte = await sharp(buffer)
      .extract({ left, top, width: largura, height: altura })
      .blur(25)
      .toBuffer();

    composicoes.push({ input: recorte, left, top });
  }

  // Quem chama só invoca aplicarBlur() quando regioes.length > 0 (rosto/
  // placa detectado) - se mesmo assim nenhuma composição sobrou (ex.:
  // larguraPx/alturaPx vieram 0 ou undefined da análise da imagem, o que
  // zera a área de recorte de toda região), isso é uma FALHA de desfoque,
  // não "nada pra fazer". Devolver o buffer original aqui fazia o
  // chamador (criarReclamacao) achar que o blur deu certo e publicar a
  // foto crua com rosto/placa visível - lançar aciona o mesmo fallback
  // seguro que uma falha de verdade do sharp já aciona (marca a mídia
  // pra revisão humana e não publica).
  if (composicoes.length === 0) {
    throw new Error(
      "Nenhuma região válida pra desfocar - dimensões da imagem inconsistentes com as regiões detectadas."
    );
  }

  return sharp(buffer).composite(composicoes).toBuffer();
}
