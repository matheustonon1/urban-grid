// A partir desta data, confirmar ("também sofro com isso") e denunciar
// passam a exigir e-mail verificado. Contas criadas antes disso ficam
// isentas — não é razoável exigir verificação retroativa de quem já
// usava a plataforma.
const DATA_EXIGENCIA_EMAIL = new Date("2026-09-10T00:00:00Z");

export function precisaVerificarEmail(usuario: {
  createdAt: Date;
  emailVerified: Date | null;
}): boolean {
  return usuario.createdAt >= DATA_EXIGENCIA_EMAIL && !usuario.emailVerified;
}

// Quem acabou de se cadastrar entra direto no painel. Se o e-mail de verificação não saiu, o painel
// recebe este parâmetro e explica (a conta já existe; basta tentar o reenvio daqui a pouco).
export const PARAM_EMAIL_NAO_ENVIADO = "nao-enviado";

export function destinoPosCadastro(envio: { status: "enviado" | "simulado" | "falhou" }): string {
  return envio.status === "falhou" ? `/painel?email=${PARAM_EMAIL_NAO_ENVIADO}` : "/painel";
}

// Escopo do limite de reenvio do e-mail de verificação (ver
// seguranca/rateLimitMemoria.ts). Compartilhado entre o botão do painel e o de "Minha
// conta" pra um não ser caminho de burla do outro; fica aqui porque um
// arquivo "use server" só pode exportar funções.
export const ESCOPO_REENVIO_VERIFICACAO = "reenvio-verificacao";
