// Ponto de entrada do e-mail transacional. O resto do app importa SÓ daqui
// ("@/lib/email"); cada módulo tem uma responsabilidade:
//
//   tokens.ts     tokens de verificação, redefinição de senha e troca de e-mail
//   templates.ts  conteúdo de cada e-mail (assunto + HTML + texto), sem enviar
//   layout.ts     moldura visual única (HTML de tabelas, modo escuro, texto puro)
//   envios.ts     uma função de envio por situação do produto
//   transporte.ts entrega pelo Resend (ou log, sem chave) e o resultado do envio
//   html.ts       esc(), versão em texto e assunto seguro
//   tradutor.ts   mensagens do namespace "Email" no idioma do destinatário
//   previa.ts     gera o HTML de todos os e-mails em .email-previa/ (npm run email:previa)

export { esc } from "./html";
export {
  apagarTokensPendentes,
  criarTokenRedefinicaoSenha,
  criarTokenTrocaEmail,
  criarTokenVerificacao,
  dadosDoTokenTrocaEmail,
  emailDoTokenRedefinicao,
} from "./tokens";
export type { EmailMontado, ResultadoEnvio } from "./transporte";
export {
  enviarEmailAcessoOrgao,
  enviarEmailCidadeAprovada,
  enviarEmailConfirmarTrocaEmail,
  enviarEmailNotificacao,
  enviarEmailRedefinicaoSenha,
  enviarEmailResumoSemanal,
  enviarEmailSenhaAlterada,
  enviarEmailSolicitacaoCidadeRejeitada,
  enviarEmailSolicitacaoRejeitada,
  enviarEmailTrocaEmailSolicitada,
  enviarEmailVerificacao,
} from "./envios";
