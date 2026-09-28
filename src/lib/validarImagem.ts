import sharp from "sharp";

export const FORMATOS_IMAGEM_ACEITOS = ["jpeg", "png", "webp"] as const;
export type FormatoImagemAceito = (typeof FORMATOS_IMAGEM_ACEITOS)[number];

// Detecta o formato de verdade pelo conteúdo do arquivo (sharp lê os magic
// bytes) - nunca pelo Content-Type que o cliente declarou (File.type),
// que é só um metadado do navegador e totalmente falsificável. Retorna
// null se o buffer não for uma imagem válida ou não for um dos formatos
// aceitos (ex.: SVG, GIF, TIFF, ou um formato aceito mas corrompido).
export async function formatoImagemReal(buffer: Buffer): Promise<FormatoImagemAceito | null> {
  try {
    const { format } = await sharp(buffer).metadata();
    return (FORMATOS_IMAGEM_ACEITOS as readonly string[]).includes(format ?? "")
      ? (format as FormatoImagemAceito)
      : null;
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
