import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const srcRoot = new URL("../src/", import.meta.url);

function withTsExtension(url) {
  const path = fileURLToPath(url);

  if (existsSync(path) && !existsSync(`${path}.ts`)) return url;
  if (existsSync(`${path}.ts`)) return new URL(`${url.href}.ts`);
  if (existsSync(`${path}.tsx`)) return new URL(`${url.href}.tsx`);
  if (existsSync(`${path}/index.ts`)) return new URL(`${url.href}/index.ts`);

  return url;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = withTsExtension(new URL(specifier.slice(2), srcRoot));
    return nextResolve(target.href, context);
  }

  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.endsWith(".ts")
  ) {
    const target = withTsExtension(new URL(specifier, context.parentURL));
    return nextResolve(target.href, context);
  }

  return nextResolve(specifier, context);
}
