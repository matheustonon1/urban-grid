import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Mesmo desenho do icon.tsx, só maior (tamanho recomendado pro ícone de
// tela inicial do iOS) - o próprio iOS aplica a máscara arredondada, não
// precisa de border-radius no fundo.
export default function AppleIcon() {
  const quarteirao = (cor: string) => (
    <div style={{ width: 62, height: 62, borderRadius: 10, background: cor }} />
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
          background: "#0e1520",
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          {quarteirao("#f2f4f7")}
          {quarteirao("#7ea6ff")}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {quarteirao("#7ea6ff")}
          {quarteirao("#ffc20e")}
        </div>
      </div>
    ),
    { ...size }
  );
}
