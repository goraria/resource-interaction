import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

it("uses the service/auth URL contract and the matching development port", () => {
  const example = read(".env.example");
  const environment = read("utils/environment.ts");
  const manifest = JSON.parse(read("package.json"));
  expect(example).not.toMatch(/\bVITE_/);
  expect(environment).not.toMatch(/\bVITE_/);
  expect(example).toContain("NITRO_PUBLIC_PORT=5053");
  expect(example).not.toContain("NITRO_PUBLIC_SERVICE_URL=");
  expect(example).not.toMatch(/^(?:NITRO_PORT|PORT)=/m);
  expect(example).toContain("NITRO_PUBLIC_AUTH_URL=https://gorth-auth.vercel.app");
  expect(manifest.scripts.dev).toBe("nitro dev --port 5053 --host 0.0.0.0");
  expect(environment).not.toContain("process.env.NITRO_PUBLIC_SERVICE_URL");
  expect(environment).toMatch(
    /export const authUrl = process\.env\.NITRO_PUBLIC_AUTH_URL/,
  );
  const obsolete = ["SERVER_URL", "SSO_CLIENT_URL", "SSO_SERVER_URL"].map(
    (name) => "NITRO_PUBLIC_" + name,
  );
  for (const name of obsolete) {
    expect(example).not.toContain(name);
    expect(environment).not.toContain(name);
  }
  const declared = new Set(
    [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]),
  );
  for (const [, name] of environment.matchAll(
    /process\.env\.([A-Z][A-Z0-9_]*)/g,
  )) {
    expect(declared.has(name!), name).toBe(true);
  }
});

it("keeps environment reads centralized and removes obsolete URL exports from runtime consumers", () => {
  function check(directory: string) {
    for (const entry of readdirSync(resolve(root, directory), {
      withFileTypes: true,
    })) {
      const path = directory + "/" + entry.name;
      if (entry.isDirectory()) check(path);
      else if (/\.tsx?$/.test(path) && path !== "utils/environment.ts") {
        const source = read(path);
        expect(source, path).not.toMatch(/process\.env/);
        expect(source, path).not.toMatch(
          /\b(?:ssoClientUrl|ssoServerUrl|ssoResourceServerUrl|serverUrl)\b/,
        );
      }
    }
  }
  for (const directory of [
    "app",
    "lib",
    "middlewares",
    "routes",
    "services",
    "utils",
  ])
    check(directory);
  for (const path of ["drizzle.config.ts", "nitro.config.ts"]) {
    expect(read(path), path).not.toMatch(/process\.env/);
  }
});
