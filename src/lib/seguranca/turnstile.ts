export async function verificarTurnstile(
  token: string | null,
  ip: string | null
): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    // Sem chave configurada (ex.: ambiente de dev sem Turnstile ainda) -
    // não bloqueia o cadastro, só deixa de verificar.
    return true;
  }
  if (!token) {
    return false;
  }

  const corpo = new URLSearchParams({ secret: secretKey, response: token });
  if (ip) {
    corpo.set("remoteip", ip);
  }

  try {
    const resposta = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: corpo }
    );
    const dados = await resposta.json();
    return dados.success === true;
  } catch {
    return false;
  }
}
