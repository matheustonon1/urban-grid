// Retorno padrão das Server Actions que o usuário dispara por um botão. Antes,
// moderação e administração devolviam `void`: o item mudava (ou não) sem nenhuma
// palavra na tela, e uma falha - "outra pessoa já decidiu", "esse nome já
// existe" - era indistinguível de um clique que não pegou.
//
// O texto vem sempre pronto do servidor (getTranslations, idioma da pessoa) e a
// tela só o exibe: `FormularioAcao` (components/ui) o mostra como aviso flutuante
// que sobrevive à revalidação da página - o cartão que gerou a ação costuma
// sumir da lista logo depois.

export type TomRetorno = "sucesso" | "erro" | "atencao" | "info";

export interface ResultadoAcao {
  tipo: TomRetorno;
  mensagem: string;
  // Erro que se corrige sem sair do diálogo de confirmação (senha incorreta):
  // o diálogo continua aberto e mostra a mensagem dentro dele, em vez de virar
  // um aviso flutuante atrás do fundo escurecido.
  manterDialogo?: boolean;
}

export const sucesso = (mensagem: string): ResultadoAcao => ({ tipo: "sucesso", mensagem });
export const falha = (mensagem: string): ResultadoAcao => ({ tipo: "erro", mensagem });
export const atencao = (mensagem: string): ResultadoAcao => ({ tipo: "atencao", mensagem });
export const informacao = (mensagem: string): ResultadoAcao => ({ tipo: "info", mensagem });
export const falhaNoDialogo = (mensagem: string): ResultadoAcao => ({
  tipo: "erro",
  mensagem,
  manterDialogo: true,
});
