/*
 * Catálogo da Meta (Luis, 16/11): toda imagem do meta.csv tem pelo menos 500×500 (as menores usam a versão 800×800 gerada só
 * para o feed em public/feeds/meta/<slug>.jpg); o feed do Google e as fotos do site não mudam.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

import { loadFeedItems } from "../src/lib/feeds/items.server.ts";
import { bioProducts } from "../src/lib/catalog/bio-products.ts";

const localFile = (imageLink) => new URL(`../public${decodeURI(new URL(imageLink).pathname)}`, import.meta.url);

test("meta.csv: todas as imagens existem e têm pelo menos 500×500", async () => {
  const items = loadFeedItems({ forMeta: true });
  assert.ok(items.length >= 200, `itens: ${items.length}`);

  for (const item of items) {
    const file = localFile(item.imageLink);
    assert.ok(existsSync(file), item.imageLink);
    const meta = await sharp(fileURLToPath(file)).metadata();
    assert.ok(meta.width >= 500 && meta.height >= 500, `${item.metaId} ${meta.width}x${meta.height} ${item.imageLink}`);
  }
});

test("versões do feed: 800×800 quadradas, uma por produto existente; o feed do Google segue com as fotos originais", async () => {
  const slugs = new Set(bioProducts.map((product) => product.slug));
  const files = readdirSync(new URL("../public/feeds/meta/", import.meta.url)).filter((name) => name.endsWith(".jpg"));
  assert.ok(files.length >= 60, `arquivos: ${files.length}`);

  for (const name of files) {
    assert.ok(slugs.has(name.replace(/\.jpg$/, "")), `sem produto: ${name}`);
    const meta = await sharp(fileURLToPath(new URL(`../public/feeds/meta/${name}`, import.meta.url))).metadata();
    assert.equal(`${meta.width}x${meta.height}`, "800x800", name);
  }

  const google = loadFeedItems();
  assert.ok(google.every((item) => !item.imageLink.includes("/feeds/meta/")), "Google não usa as versões da Meta");
  const meta = loadFeedItems({ forMeta: true });
  assert.equal(meta.filter((item) => item.imageLink.includes("/feeds/meta/")).length, files.length);
  assert.deepEqual(meta.map((item) => item.metaId), google.map((item) => item.metaId), "mesmos itens nos dois feeds");
});
