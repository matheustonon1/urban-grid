import { criarContadorDeFalhas } from "@/lib/contadorFalhas";

// Contador de força bruta na SENHA - separado do de TOTP (lib/totp.ts),
// que só entra em jogo depois que a senha já foi aceita. Sem isto, uma
// conta sem 2FA ativo podia ter a senha testada indefinidamente (o
// bcrypt.compare atrasa cada tentativa, mas não impede um script
// paciente ou distribuído).
const contador = criarContadorDeFalhas({
  campoTentativas: "loginTentativasFalhas",
  campoBloqueio: "loginBloqueadoAte",
  limiteTentativas: 5,
  bloqueioMs: 15 * 60 * 1000,
});

export function usuarioBloqueadoPorLogin(usuario: { loginBloqueadoAte: Date | null }): boolean {
  return contador.estaBloqueado(usuario);
}

export const registrarFalhaLogin = contador.registrarFalha;
export const resetarFalhasLogin = contador.resetarFalhas;
