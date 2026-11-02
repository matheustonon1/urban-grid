---
name: acessibilidade
description: Acessibilidade (WCAG 2.2 AA) no Urban Grid — contraste dos tokens, foco visível, teclado em menus e pop-ups, formulários com rótulo e erro anunciado, landmarks e "pular para o conteúdo", movimento reduzido, alvo de toque, e como verificar (varredura axe no Playwright). Use ao criar ou revisar qualquer tela, componente interativo ou formulário, ao escolher cor, ou quando o usuário falar em acessibilidade, leitor de tela, teclado, contraste — mesmo que o pedido seja só "revisa essa tela".
---

# Acessibilidade

Serviço público: tem que funcionar com teclado, leitor de tela, zoom de 200% e telas
pequenas. Aqui ela é **parte do design**, não etapa final — a maior parte já vem dos
tokens e dos componentes base; sua tarefa é não quebrar isso.

## O que já vem pronto (não reinvente)

- **Contraste.** `ink` (~16:1), `ink-2` (~11:1) e `ink-muted` (5,3–7,2:1) passam AA
  sobre `paper`, `surface` e `sunken` nos dois temas; `brand` sobre branco ≈ 7:1;
  `on-brand` sobre `brand` idem. **`ink-faint` (3,1–3,8:1) é só decoração** (ícone, divisor, índice) — nunca texto que
  precisa ser lido. Cor de estado sempre em par `*-soft` + `*-ink`.
- **Foco.** `globals.css` dá `outline: 2px solid brand` a todo `a, button, input, select,
  textarea, summary, [tabindex]` em `:focus-visible`. Não use `outline-none` sem
  substituto visível; `focus:ring-2` dos campos já acompanha.
- **Estado nunca só por cor.** `Etiqueta` (quadradinho + texto), `Aviso` (ícone + texto),
  `MensagemErro` (ícone + texto), aba ativa (`aria-current` + barra), etapa atual
  (`aria-current="step"`).
- **"Pular para o conteúdo"** é o primeiro item focável (`layout.tsx`); o alvo é
  `#conteudo`.
- **Navegação**: `<nav aria-label>` no cabeçalho e no rodapé; página atual com
  `aria-current="page"` (`LinkNav`, `AdminNav`).
- **Movimento**: `animate-*` desligam em `prefers-reduced-motion`; `Revelar` e o `ping`
  usam `motion-reduce:`.

## Regras ao construir

**Documento**
- Uma `<h1>` por página, níveis sem pular. Landmarks: `<header>`, `<nav>`, **um**
  `<main>` por página, `<footer>`. O esqueleto de `loading.tsx` é `<div role="status">`,
  nunca `<main>` (dois `main` na troca de rota).
- `lang` do `<html>` vem do idioma ativo; trecho em outra língua leva `lang`.

**Formulário** (`components/formulario/campo.tsx`)
- Todo campo com `<label htmlFor>` visível — placeholder não é rótulo.
- Erro: `aria-invalid` + `aria-describedby={descritoPor(id, erro, dica)}` e
  `MensagemErro` (`role="alert"`). Erro geral em `<Aviso tom="erro">` (também
  `role="alert"`).
- `autoComplete` correto (`username`, `current-password`, `new-password`, `email`,
  `name`, `one-time-code`); `inputMode` para número/CPF.
- Checkbox de aceite: `<label>` envolvendo o texto; link dentro do rótulo (termos) é
  ok.

**Interativos**
- Menu/pop-up (`UserMenu`, `SeletorIdioma`, notificações): botão com `aria-expanded`,
  fecha ao clicar fora (`useFecharAoInteragirFora`) e com **Esc**; itens são `<a>`/
  `<button>` focáveis em ordem. Combobox (`cidade-combobox`) segue o padrão ARIA
  (`role=combobox`, `aria-activedescendant`, setas, Enter, Esc).
- Botão só-ícone leva `aria-label` traduzido; ícone decorativo leva `aria-hidden`.
- Alvo de toque ≥ 40 px na altura (botões do sistema têm `py-2.5`). Controles do
  cabeçalho no celular são `p-1.5` de propósito (cabem no 375 px) — não encolha mais.
- Link com texto que faz sentido sozinho ("Ver todas as reclamações"), nunca "clique
  aqui".

**Conteúdo**
- Imagem de conteúdo: `alt` descritivo; decorativa: `alt=""`. Foto de reclamação
  enviada por usuário na lista é miniatura decorativa (`alt=""`), no detalhe descreve.
- Data/hora em `<time dateTime>`; protocolo em mono com `title`/`aria-label` quando
  abreviado.
- Tabela de dado: `<th scope>`; gráfico tem tabela equivalente ("Ver como tabela" nas
  estatísticas).

## Como verificar

1. **Teclado**: percorra a tela só com Tab/Shift+Tab/Enter/Esc/setas. O foco sempre
   visível? Ordem lógica? Nada preso?
2. **Zoom 200%** e **375 px**: sem rolagem horizontal, sem texto cortado.
3. **Leitor de tela** (NVDA/VoiceOver) nos fluxos críticos: login, nova reclamação.
4. **Automático**: a varredura `@axe-core/playwright` em `e2e/acessibilidade.spec.ts`
   (rotas públicas, claro e escuro) acusa violação *serious/critical* — contraste,
   rótulo ausente, landmark duplicado. Rode `npx playwright test e2e/acessibilidade.spec.ts`.
5. **Contraste de cor nova**: calcule antes de criar o token (≥ 4,5:1 texto, ≥ 3:1
   componente/ícone) nos dois temas.

Automático acha ~30–40% dos problemas. Os outros passos não são opcionais.

## Checklist

- [ ] Rótulo visível em todo campo; erro anunciado e ligado ao campo
- [ ] Foco visível e ordem lógica; menus fecham com Esc
- [ ] Nenhum estado só por cor; texto ≥ 4,5:1 (nunca `ink-faint`)
- [ ] Um `<h1>`, um `<main>`, landmarks rotulados
- [ ] Botão só-ícone com `aria-label`; ícone decorativo com `aria-hidden`
- [ ] `prefers-reduced-motion` respeitado
- [ ] Varredura axe sem *serious/critical*
