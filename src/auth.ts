import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { buscarUsuarioPorIdentificador } from "@/lib/identificador";
import {
  registrarFalhaLogin,
  resetarFalhasLogin,
  usuarioBloqueadoPorLogin,
} from "@/lib/loginSeguranca";
import {
  codigoTotpValido,
  consumirCodigoBackup,
  decifrarSegredoTotp,
  registrarFalhaTotp,
  resetarFalhasTotp,
  usuarioBloqueadoPorTotp,
} from "@/lib/totp";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        identificador: {},
        senha: {},
        codigoTotp: {},
      },
      async authorize(credentials) {
        const identificador = credentials?.identificador;
        const senha = credentials?.senha;

        if (typeof identificador !== "string" || typeof senha !== "string") {
          return null;
        }

        const usuario = await buscarUsuarioPorIdentificador(identificador);

        if (!usuario?.senhaHash) {
          return null;
        }

        // Defesa em profundidade - o caminho normal (login/actions.ts) já
        // barra conta banida antes de chegar aqui, com mensagem própria.
        if (usuario.banidoAte && usuario.banidoAte > new Date()) {
          return null;
        }

        if (usuarioBloqueadoPorLogin(usuario)) {
          return null;
        }

        const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
        if (!senhaValida) {
          await registrarFalhaLogin(usuario.id);
          return null;
        }
        await resetarFalhasLogin(usuario.id);

        if (usuario.totpConfirmadoEm) {
          if (await usuarioBloqueadoPorTotp(usuario)) {
            return null;
          }

          const codigo = credentials?.codigoTotp;
          const segredo = decifrarSegredoTotp(usuario.totpSecret!);
          const valido =
            typeof codigo === "string" &&
            codigo.length > 0 &&
            ((await codigoTotpValido(segredo, codigo)) ||
              (await consumirCodigoBackup(usuario.id, codigo)));

          if (!valido) {
            await registrarFalhaTotp(usuario.id);
            return null;
          }

          await resetarFalhasTotp(usuario.id);
        }

        return {
          id: usuario.id,
          name: usuario.name,
          email: usuario.email,
          papel: usuario.papel,
          orgaoId: usuario.orgaoId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.papel = (user as { papel: typeof token.papel }).papel;
        token.orgaoId = (user as { orgaoId: string | null }).orgaoId;
        token.sessaoEmitidaEm = Date.now();
        return token;
      }

      // Chamado a cada leitura da sessão, não só no login - sessão JWT é
      // stateless por padrão (não revalida contra o banco a cada
      // requisição), então esta é a única forma de derrubar uma sessão já
      // emitida sem trocar toda a estratégia pra "database". Cobre dois
      // casos: senha trocada depois deste token ter sido emitido (alguém
      // pode ter comprometido a sessão antiga) e banimento aplicado
      // enquanto a sessão já estava ativa (antes, só o login novo era
      // barrado - uma sessão já aberta continuava valendo até expirar).
      if (token.sub) {
        const usuario = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { senhaAlteradaEm: true, banidoAte: true },
        });

        if (!usuario) {
          return null;
        }
        if (usuario.banidoAte && usuario.banidoAte > new Date()) {
          return null;
        }
        if (
          usuario.senhaAlteradaEm &&
          (!token.sessaoEmitidaEm || usuario.senhaAlteradaEm.getTime() > token.sessaoEmitidaEm)
        ) {
          return null;
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.papel = token.papel ?? session.user.papel;
        session.user.orgaoId = token.orgaoId ?? null;
      }
      return session;
    },
  },
});
