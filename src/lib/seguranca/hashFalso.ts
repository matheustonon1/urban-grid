import bcrypt from "bcryptjs";

// Hash bcrypt (custo 10, igual ao das senhas reais) de uma senha que ninguém
// conhece. Quando o login não acha a conta, comparar contra isto gasta o
// mesmo tempo de uma comparação de verdade - sem isso, "conta inexistente"
// responde em milissegundos e "senha errada" em ~100ms, e dá pra descobrir
// quais e-mails/CPFs têm conta só medindo o tempo de resposta.
const HASH_FALSO = "$2b$10$KhbcMjuPdtNCVzVg4jh.D.5FB0Ja.Gcp5lFT8BRL911C1uzSOFpwG";

export async function gastarTempoDeComparacao(senha: string): Promise<void> {
  await bcrypt.compare(senha, HASH_FALSO);
}
