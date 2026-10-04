// Só constantes puras (sem nada de servidor/cliente) - importado tanto
// por reclamacoes/nova/actions.ts (valida de verdade, é o que decide)
// quanto por reclamacoes/nova/form.tsx (avisa a pessoa na hora de
// escolher o arquivo, antes de descobrir só depois de enviar o
// formulário inteiro). Um lugar só pra evitar os dois limites
// desalinharem silenciosamente com o tempo.
export const MAX_IMAGENS = 5;
export const MAX_TAMANHO_BYTES = 5 * 1024 * 1024;
export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
