import { isIP } from "node:net";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { domainToASCII, pathToFileURL } from "node:url";
import { parse, stringify } from "yaml";
import { ruleKeys, type RuleKey } from "../scripts/rules.js";

export function validRule(key: RuleKey, value: unknown): boolean {
  if (key === "asn") {
    return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 0xffffffff;
  }
  if (typeof value !== "string" || !value.trim() || /[\x00-\x1f\x7f]/.test(value)) return false;
  if (key === "domain" || key === "domainSuffix") {
    const domain = domainToASCII(value.trim()).replace(/\.$/, "");
    return !/[\s/:?#@,\\*]/.test(value) && domain.length > 0 && domain.length <= 253 &&
      domain.split(".").every((label) =>
        label.length <= 63 && /^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?$/i.test(label));
  }
  if (key === "ipCidr" || key === "ipCidr6") {
    const [address = "", prefix, extra] = value.split("/");
    const family = key === "ipCidr" ? 4 : 6;
    return extra === undefined && isIP(address) === family && prefix !== undefined &&
      /^\d+$/.test(prefix) && Number(prefix) <= (family === 4 ? 32 : 128);
  }
  return key === "domainRegex" || !value.includes(",");
}

export async function sanitizeProviders(input: string): Promise<string[]> {
  const writes: Array<[string, string]> = [];
  const removed: string[] = [];
  for (const file of (await readdir(input)).filter((name) => /\.ya?ml$/i.test(name)).sort()) {
    const filePath = path.join(input, file);
    const provider = parse(await readFile(filePath, "utf8"));
    const ruleSets = [provider.rules, ...(provider.groups ?? []).map((group: { rules: unknown }) => group.rules)]
      .filter(Boolean) as Array<Record<string, unknown>>;
    let before = 0;
    let after = 0;
    const start = removed.length;
    for (const rules of ruleSets) {
      for (const key of ruleKeys) {
        const values = rules[key];
        if (values === undefined) continue;
        if (!Array.isArray(values)) throw new Error(`${file}: ${key} must be an array`);
        before += values.length;
        rules[key] = values.filter((value) => {
          if (validRule(key, value)) return true;
          removed.push(`${file}: ${key} ${JSON.stringify(value)}`);
          return false;
        });
        after += (rules[key] as unknown[]).length;
      }
    }
    if (before > 0 && after === 0) throw new Error(`${file}: no valid rules remain; refusing to publish`);
    if (removed.length > start) writes.push([filePath, stringify(provider, { lineWidth: 0, sortMapEntries: false })]);
  }
  // Validate every provider before changing any file.
  for (const [filePath, content] of writes) await writeFile(filePath, content, "utf8");
  return removed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const removed = await sanitizeProviders(process.argv[2] ?? "data/providers");
  for (const entry of removed) console.log(`Filtered invalid rule: ${entry}`);
  console.log(`Filtered ${removed.length} invalid rule(s).`);
}
