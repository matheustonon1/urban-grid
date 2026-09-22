import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// "UG" (Urban Grid) no lugar do favicon genérico do Next.js - mesma
// paleta do logo no cabeçalho (fundo escuro, "U" neutro/branco, "G" na
// cor primária do tema, igual ao "Grid" azul em "Urban Grid").
export default function Icon() {
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
          fontSize: 20,
          letterSpacing: -1,
        }}
      >
        <span style={{ color: "#ffffff" }}>U</span>
        <span style={{ color: "#1d4ed8" }}>G</span>
      </div>
    ),
    { ...size }
  );
}
