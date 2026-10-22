---
name: ux-writing
description: Texto de interface do Urban Grid em pt-BR e inglês — tom de voz cívico, mensagens de erro, estados vazios, confirmações, rótulos de botão, e-mails e o vocabulário fixo do produto (reclamação, órgão, protocolo, confirmar). Cobre também a regra de i18n (toda string em `messages/pt-BR.json` e `en.json`, plural ICU) e o acoplamento com os testes E2E. Use ao escrever ou revisar qualquer texto visível, nomear um botão, redigir erro/aviso/e-mail, ou ao adicionar chave em `messages/` — mesmo que o pedido diga só "melhora esse texto".
---

# Texto de interface

Quem usa o Urban Grid está, quase sempre, irritado com um problema real do bairro
ou é um servidor público com a fila cheia. O texto tem que ser **claro, curto e
sem culpa**. Não é marketing.

## Tom

- **Segunda pessoa, direto:** "Descreva o problema", não "O usuário deve descrever".
- **Cívico e sóbrio.** Sem exclamação, sem emoji, sem gíria, sem "Ops!".
- **Frase curta, verbo no começo** do botão e da instrução.
- **Nunca culpe a pessoa.** "Esse e-mail já está em uso" > "Você digitou um e-mail
  inválido". Se o sistema falhou, diga que foi o sistema.
- **Especifique.** "A senha precisa de 8 caracteres ou mais" > "Senha inválida".
- Transparência é o valor central: diga o que acontece depois ("Sua reclamação
  passa por uma checagem automática antes de ser publicada").

## Vocabulário fixo (não troque por sinônimo)

| Use | Não use |
|---|---|
| reclamação | denúncia (denúncia é o ato de reportar *conteúdo*, outra coisa), queixa, ticket |
| órgão (público responsável) | empresa, setor |
| protocolo (`RC-2026-0000002`) | número do chamado, ID |
| "também sofro com isso" / confirmação | curtir, apoiar |
| resposta oficial | comentário do órgão |
| moderação | censura, filtro |
| Resolvida / Em andamento / Publicada… | usar o enum cru |

Status e papéis vêm sempre de `Status.*`, `Papel.*`; categorias de
`lib/reclamacoes/categoriaI18n` (o nome de categoria não é conteúdo bilíngue).

## Receitas

**Erro de campo:** o que está errado + como corrigir, ao lado do campo.
> "Informe um CEP com 8 dígitos."

**Erro de sistema:** o que não funcionou + o que a pessoa pode fazer; sem código nem
stack.
> "Não conseguimos enviar o e-mail agora. Tente de novo em alguns minutos."

**Estado vazio:** o que *seria* mostrado + próximo passo, nunca só "Nenhum resultado".
> "Nenhuma reclamação nesta cidade ainda. Seja a primeira pessoa a registrar um problema."

**Confirmação destrutiva:** nomeie o objeto, a consequência e use verbo específico
no botão. "Excluir minha conta" / "Manter conta" — nunca "Sim" / "Não" / "OK".

**Sucesso:** diga o que mudou, em uma linha, e onde ver.
> "Dados atualizados."

**Carregando:** `Comum.carregando` (anunciado por `role="status"`); evite "Aguarde...".

**Botão primário:** verbo + objeto. "Registrar reclamação", "Criar conta",
"Enviar resposta oficial". Evite "Enviar", "Continuar" soltos quando há algo mais
específico.

**Segurança:** seja tranquilizador e objetivo; diga o que *não* mudou ("sua senha
continua a mesma").

## i18n — regra do projeto

- **Toda** string visível vai em `messages/pt-BR.json` **e** `messages/en.json`, com
  a **mesma chave** nos dois (50 namespaces hoje, por área: `Home`, `Conta`, `Email`…).
  Não deixe uma língua para trás: `src/i18n/mensagens.test.ts` (roda em `npm test`)
  falha se faltar chave em uma das línguas ou se os parâmetros ICU (`{cidade}`,
  `{count, plural…}`) divergirem.
- **Plural com ICU**, nunca `if` no código:
  `"{count, plural, =0 {Nenhuma confirmação} one {# confirmação} other {# confirmações}}"`.
- **Nunca concatene fragmentos** traduzidos (a ordem das palavras muda entre línguas):
  use um parâmetro `{cidade}` ou `t.rich` para trechos com `<strong>`.
- Em componente de servidor `getTranslations("Namespace")`; em cliente
  `useTranslations` (funciona nos dois, sem `"use client"` obrigatório).
- **E-mail** usa o namespace `Email` via `createTranslator` com o idioma gravado em
  `User.idioma` (quem lê pode não ser quem disparou). **Assunto é texto puro**: sem
  HTML, sem `esc()`.
- Texto vindo de usuário (título, motivo) **nunca** é traduzido nem inserido em
  chave — entra como parâmetro e, em HTML, passa por `esc()`.

## Acoplamento com os testes E2E

Spec localiza por texto (`getByRole("link", { name: "Transparência" })`,
`text=…`). **Mudar uma string é mudar o contrato.** Antes de reescrever:

```bash
grep -rn "texto antigo" e2e
```

e atualize o spec no mesmo passo. Não duplique o mesmo rótulo de link em
cabeçalho, rodapé e corpo da página (o `getByRole` quebra por modo estrito).

## Checklist

- [ ] Verbo + objeto no botão; nada de "OK/Sim/Não" soltos
- [ ] Erro diz o que fazer; ninguém é culpado
- [ ] Vocabulário da tabela respeitado
- [ ] Chave nas duas línguas; plural em ICU; nada concatenado
- [ ] `grep` nos specs E2E da string que mudou
- [ ] Texto cabe em 375px (títulos de 6 linhas denunciam frase longa demais)
