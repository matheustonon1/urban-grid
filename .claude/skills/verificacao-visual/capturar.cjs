// Tira screenshots de página inteira de rotas do Urban Grid, em claro/escuro/mobile,
// e avisa quando há rolagem horizontal (o bug visual mais comum em 375px).
//
//   node .claude/skills/verificacao-visual/capturar.cjs <rótulo> [rotas] [modos]
//
//   rótulo  nome da pasta de saída: .capturas/<rótulo>/ (ignorada pelo git)
//   rotas   lista separada por vírgula; use "home" para "/" (o Git Bash converte
//           um "/" solto em caminho do Windows). Padrão: home,/login,/cadastro,
//           /reclamacoes,/transparencia
//   modos   claro, escuro, mobile, mobile-escuro (padrão: claro,escuro,mobile)
//
// Variáveis de ambiente:
//   BASE_URL  padrão http://localhost:3000
//   CRED      "email:senha" para entrar antes de capturar (rotas logadas)
//   SELETOR   CSS de um elemento: captura só ele em vez da página inteira
//
// Rode da raiz do projeto: o Playwright vem do node_modules dele.
const fs = require("fs");
const path = require("path");

const raiz = process.cwd();
const { chromium } = require(path.join(raiz, "node_modules", "playwright"));

const base = process.env.BASE_URL ?? "http://localhost:3000";
const rotulo = process.argv[2] ?? "agora";
const rotas = (process.argv[3] ?? "home,/login,/cadastro,/reclamacoes,/transparencia")
  .split(",")
  .map((r) => (r === "home" ? "/" : r));
const modos = (process.argv[4] ?? "claro,escuro,mobile").split(",");
const saida = path.join(raiz, ".capturas", rotulo);
fs.mkdirSync(saida, { recursive: true });

const nomeArquivo = (rota) =>
  rota === "/"
    ? "home"
    : rota
        .replace(/^(file|https?):\/*/, "")
        .replace(/^\//, "")
        .replace(/[/?=&:\\]/g, "_")
        .slice(-60);

(async () => {
  const navegador = await chromium.launch();

  for (const modo of modos) {
    const mobile = modo.startsWith("mobile");
    const escuro = modo.endsWith("escuro");
    const contexto = await navegador.newContext({
      viewport: mobile ? { width: 375, height: 800 } : { width: 1366, height: 850 },
      // Sem transições no meio do caminho: screenshot tirado durante uma animação
      // de 0,35 s dá falso alarme.
      reducedMotion: "reduce",
    });
    await contexto.addInitScript((tema) => {
      try {
        localStorage.setItem("tema", tema);
      } catch {}
    }, escuro ? "dark" : "light");

    if (process.env.CRED) {
      const [email, ...resto] = process.env.CRED.split(":");
      const pagina = await contexto.newPage();
      await pagina.goto(`${base}/login`);
      await pagina.fill('input[name="identificador"]', email);
      await pagina.fill('input[name="senha"]', resto.join(":"));
      await pagina.click('button[type="submit"]');
      await pagina
        .waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 })
        .catch(() => {});
      await pagina.close();
    }

    for (const rota of rotas) {
      const pagina = await contexto.newPage();
      try {
        await pagina.goto(/^(file|https?):/.test(rota) ? rota : base + rota, {
          waitUntil: "networkidle",
          timeout: 60000,
        });
        // <Revelar> só mostra o bloco quando ele entra na tela: rola a página toda.
        await pagina.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 500) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 60));
          }
          window.scrollTo(0, 0);
        });
        await pagina.waitForTimeout(500);

        const excesso = await pagina.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        const arquivo = path.join(saida, `${nomeArquivo(rota)}.${modo}.png`);
        if (process.env.SELETOR) {
          await pagina.locator(process.env.SELETOR).first().screenshot({ path: arquivo });
        } else {
          await pagina.screenshot({ path: arquivo, fullPage: true });
        }
        console.log(`${modo.padEnd(13)} ${rota.padEnd(28)} ${excesso > 0 ? `ROLAGEM HORIZONTAL +${excesso}px` : "ok"}`);
      } catch (erro) {
        console.log(`${modo.padEnd(13)} ${rota.padEnd(28)} ERRO ${String(erro).slice(0, 100)}`);
      }
      await pagina.close();
    }
    await contexto.close();
  }
  await navegador.close();
})();
