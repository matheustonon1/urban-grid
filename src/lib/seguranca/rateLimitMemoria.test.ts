import { describe, expect, it } from "vitest";

import { excedeuLimitePorIp } from "./rateLimitMemoria";

describe("excedeuLimitePorIp", () => {
  it("libera até o limite e bloqueia a partir daí, na mesma janela", () => {
    const ip = "203.0.113.1";
    const escopo = `teste-${Date.now()}`;

    for (let i = 0; i < 3; i++) {
      expect(excedeuLimitePorIp(escopo, ip, 3, 60_000)).toBe(false);
    }
    expect(excedeuLimitePorIp(escopo, ip, 3, 60_000)).toBe(true);
  });

  it("conta cada IP separadamente", () => {
    const escopo = `teste-${Date.now()}`;

    expect(excedeuLimitePorIp(escopo, "203.0.113.10", 1, 60_000)).toBe(false);
    expect(excedeuLimitePorIp(escopo, "203.0.113.10", 1, 60_000)).toBe(true);
    expect(excedeuLimitePorIp(escopo, "203.0.113.11", 1, 60_000)).toBe(false);
  });

  it("sem IP identificável, nunca bloqueia", () => {
    const escopo = `teste-${Date.now()}`;

    for (let i = 0; i < 5; i++) {
      expect(excedeuLimitePorIp(escopo, null, 1, 60_000)).toBe(false);
    }
  });

  it("libera de novo depois que a janela expira", async () => {
    const ip = "203.0.113.20";
    const escopo = `teste-${Date.now()}`;

    expect(excedeuLimitePorIp(escopo, ip, 1, 10)).toBe(false);
    expect(excedeuLimitePorIp(escopo, ip, 1, 10)).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(excedeuLimitePorIp(escopo, ip, 1, 10)).toBe(false);
  });
});
