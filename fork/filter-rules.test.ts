import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeProviders, validRule } from "./filter-rules.js";

describe("fork rule filter", () => {
  it("rejects URLs, paths, empty domains and malformed addresses", () => {
    for (const value of ["//github.com/aprilnea/reverse-engineering-claude-code-antspace", "https://example.com", "example.com/path", "example.com:443", "", "bad domain", "a..com", "-bad.com", "*.example.com", "example.com#comment", "example.com,Proxy"]) {
      expect(validRule("domainSuffix", value), value).toBe(false);
    }
    expect(validRule("ipCidr", "999.1.1.1/32")).toBe(false);
    expect(validRule("ipCidr", "1.2.3.4/33")).toBe(false);
    expect(validRule("ipCidr6", "2001:db8::/129")).toBe(false);
    expect(validRule("asn", 4294967296)).toBe(false);
  });

  it("preserves valid domains, IDNs, regexes, processes and both IP families", () => {
    for (const value of ["claude.ai", "_service.example.com", "localhost", "例子.中国", "EXAMPLE.COM."]) {
      expect(validRule("domainSuffix", value), value).toBe(true);
    }
    expect(validRule("domainRegex", "^api[0-9]{1,3}\\.example\\.com$")).toBe(true);
    expect(validRule("processName", "Claude Helper.exe")).toBe(true);
    expect(validRule("ipCidr", "160.79.104.0/21")).toBe(true);
    expect(validRule("ipCidr6", "2607:6bc0::/32")).toBe(true);
    expect(validRule("asn", 399358)).toBe(true);
  });

  it("filters provider groups before all formats are generated", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ai-filter-"));
    try {
      const file = path.join(dir, "anthropic.yaml");
      await writeFile(file, `provider: anthropic\ngroups:\n  - name: Core\n    rules:\n      domainSuffix: [claude.ai, '//github.com/aprilnea/repo']\n      ipCidr6: ['2607:6bc0::/32']\n`);
      const removed = await sanitizeProviders(dir);
      expect(removed).toHaveLength(1);
      const output = await readFile(file, "utf8");
      expect(output).toContain("claude.ai");
      expect(output).toContain("2607:6bc0::/32");
      expect(output).not.toContain("//github.com");
      expect(await sanitizeProviders(dir)).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not overwrite files if filtering would empty a provider", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ai-filter-"));
    try {
      const file = path.join(dir, "broken.yaml");
      const original = `provider: broken\nrules:\n  domainSuffix: ['https://example.com/path']\n`;
      await writeFile(file, original);
      await expect(sanitizeProviders(dir)).rejects.toThrow("no valid rules");
      expect(await readFile(file, "utf8")).toBe(original);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
