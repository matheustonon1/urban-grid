import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// A marca do cabeçalho (quatro quarteirões separados por ruas) sobre o fundo
// escuro da identidade - o fundo sólido garante leitura em aba clara e escura.
// Cores: giz, azul claro, azul claro e amarelo de obra (ver globals.css).
export default function Icon() {
  const quarteirao = (cor: string) => (
    <div style={{ width: 11, height: 11, borderRadius: 2, background: cor }} />
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
          gap: 2,
          background: "#0e1520",
          borderRadius: 7,
        }}
      >
        <div style={{ display: "flex", gap: 2 }}>
          {quarteirao("#f2f4f7")}
          {quarteirao("#7ea6ff")}
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {quarteirao("#7ea6ff")}
          {quarteirao("#ffc20e")}
        </div>
      </div>
    ),
    { ...size }
  );
}
