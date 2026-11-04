import { describe, expect, it } from "vitest";

import { configDoAdapter } from "./bancoDeDados";

describe("configDoAdapter", () => {
  it("lê host, porta, usuário, senha e banco da URL", () => {
    expect(configDoAdapter("mysql://root:root@127.0.0.1:3307/reclame_cidade")).toMatchObject({
      host: "127.0.0.1",
      port: 3307,
      user: "root",
      password: "root",
      database: "reclame_cidade",
    });
  });

  it("porta 3306 quando a URL não diz", () => {
    expect(configDoAdapter("mysql://u:p@localhost/db").port).toBe(3306);
  });

  it("decodifica usuário e senha com caracteres especiais (a URL os escapa)", () => {
    const config = configDoAdapter("mysql://app%2Fuser:p%40ss%3Aword%23@host:4000/db");
    expect(config.user).toBe("app/user");
    expect(config.password).toBe("p@ss:word#");
  });

  it("sem parâmetros: sem TLS, 5 conexões e 10 s para conectar", () => {
    const config = configDoAdapter("mysql://u:p@localhost:3306/db");
    expect(config.ssl).toBeUndefined();
    expect(config.connectionLimit).toBe(5);
    expect(config.connectTimeout).toBe(10_000);
  });

  it("sslaccept=strict (a URL do TiDB Cloud) liga o TLS validando o certificado", () => {
    expect(
      configDoAdapter("mysql://u:p@gateway01.tidbcloud.com:4000/db?sslaccept=strict").ssl
    ).toEqual({ rejectUnauthorized: true });
  });

  it("sslaccept=accept_invalid_certs liga o TLS sem validar o certificado", () => {
    expect(configDoAdapter("mysql://u:p@h:3306/db?sslaccept=accept_invalid_certs").ssl).toEqual({
      rejectUnauthorized: false,
    });
  });

  it("ssl=true e sslmode=require também ligam o TLS validando", () => {
    expect(configDoAdapter("mysql://u:p@h:3306/db?ssl=true").ssl).toEqual({
      rejectUnauthorized: true,
    });
    expect(configDoAdapter("mysql://u:p@h:3306/db?sslmode=require").ssl).toEqual({
      rejectUnauthorized: true,
    });
  });

  it("connection_limit e connect_timeout (nomes do Prisma) valem; lixo cai no padrão", () => {
    const config = configDoAdapter("mysql://u:p@h:3306/db?connection_limit=2&connect_timeout=30");
    expect(config.connectionLimit).toBe(2);
    expect(config.connectTimeout).toBe(30_000);

    const ruim = configDoAdapter("mysql://u:p@h:3306/db?connection_limit=abc&connect_timeout=-1");
    expect(ruim.connectionLimit).toBe(5);
    expect(ruim.connectTimeout).toBe(10_000);
  });

  it("allowPublicKeyRetrieval só entra quando pedido", () => {
    expect(configDoAdapter("mysql://u:p@h/db").allowPublicKeyRetrieval).toBeUndefined();
    expect(configDoAdapter("mysql://u:p@h/db?allowPublicKeyRetrieval=true").allowPublicKeyRetrieval).toBe(
      true
    );
  });
});
