import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Mesmo desenho do icon.tsx, só maior (tamanho recomendado pro ícone de
// tela inicial do iOS) - o próprio iOS aplica a máscara arredondada, não
// precisa de border-radius aqui.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          fontFamily: "sans-serif",
          fontWeight: 700,
          fontSize: 110,
          letterSpacing: -4,
        }}
      >
        <span style={{ color: "#ffffff" }}>U</span>
        <span style={{ color: "#1d4ed8" }}>G</span>
      </div>
    ),
    { ...size }
  );
}
