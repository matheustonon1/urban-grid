import sharp from "sharp";

export const FORMATOS_IMAGEM_ACEITOS = ["jpeg", "png", "webp"] as const;
export type FormatoImagemAceito = (typeof FORMATOS_IMAGEM_ACEITOS)[number];

export interface ImagemAnalisada {
  formato: FormatoImagemAceito;
  largura?: number;
  altura?: number;
}

// Decodifica o arquivo uma vez só e detecta o formato de verdade pelo
// conteúdo (sharp lê os magic bytes) - nunca pelo Content-Type que o
// cliente declarou (File.type), que é só um metadado do navegador e
// totalmente falsificável. Retorna null se o buffer não for uma imagem
// válida ou não for um dos formatos aceitos (ex.: SVG, GIF, TIFF, ou um
// formato aceito mas corrompido).
//
// Quem chama guarda o retorno (formato + largura/altura) em vez de rodar
// isto de novo mais adiante só pra reobter as mesmas informações - sharp
// decodificar a imagem inteira não é grátis, e o buffer já foi lido aqui.
export async function analisarImagemReal(buffer: Buffer): Promise<ImagemAnalisada | null> {
  try {
    const { format, width, height } = await sharp(buffer).metadata();
    if (!format || !(FORMATOS_IMAGEM_ACEITOS as readonly string[]).includes(format)) {
      return null;
    }
    return { formato: format as FormatoImagemAceito, largura: width, altura: height };
  } catch {
    return null;
  }
}

// Content-Type de verdade a gravar/servir (Midia.mimeType, Content-Type do
// Blob público) - construído a partir do formato detectado no conteúdo,
// nunca do File.type do upload. Sem isso, a validação acima não tinha
// efeito nenhum no que realmente fica servido: um JPEG de verdade com
// File.type adulterado pra "image/webp" ainda saía do storage como webp.
export function mimeTypeDoFormato(formato: FormatoImagemAceito): string {
  return `image/${formato}`;
}
