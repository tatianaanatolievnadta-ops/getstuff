/**
 * Минимальная догрузка фото локально
 * Цель: чтобы у каждого товара в assets/ был хотя бы 1 файл (prefer webp).
 *
 * Запуск: node scripts/download-images-1.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets', 'products');
const DATA_PATH = path.join(ROOT, 'js', 'products.data.js');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'image/webp,image/*,*/*',
  Referer: 'https://www.wildberries.ru/',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadProducts() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const m = raw.match(/const PRODUCTS_DATA = (.+);/);
  if (!m) throw new Error('Не найден PRODUCTS_DATA в products.data.js');
  return JSON.parse(m[1]).products || [];
}

function shardForVol(vol) {
  // Практически: WB корзины имеют разные шардирования.
  // Для скорости/надёжности попробуем несколько хостов в цикле ниже.
  return String((vol % 10) + 1).padStart(2, '0');
}

function buildCandidates(nmId) {
  const vol = Math.floor(nmId / 100000);
  const part = Math.floor(nmId / 1000);
  const primary = shardForVol(vol);
  const hosts = Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, '0'));
  const orderedHosts = [primary, ...hosts.filter((h) => h !== primary)];

  const formats = [
    { type: 'webp', dir: 'big' },
    { type: 'webp', dir: 'c516x688' },
    { type: 'jpg', dir: 'big' },
  ];

  const urls = [];
  for (const host of orderedHosts) {
    for (const f of formats) {
      urls.push(
        `https://basket-${host}.wbbasket.ru/vol${vol}/part${part}/${nmId}/images/${f.dir}/1.${f.type}`
      );
    }
  }
  return urls;
}

async function tryDownload(url, dest) {
  try {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 400) return true;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(9000) });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 400) return false;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const products = loadProducts();
  console.log(`Минимальная догрузка фото: ${products.length} товаров`);

  let ok = 0;
  let checked = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const nmId = p.wbId;
    const dir = path.join(ASSETS, String(nmId));

    // prefer webp
    const destWebp = path.join(dir, '1.webp');
    const destJpg = path.join(dir, '1.jpg');

    checked++;
    if ((fs.existsSync(destWebp) && fs.statSync(destWebp).size > 400) || (fs.existsSync(destJpg) && fs.statSync(destJpg).size > 400)) {
      ok++;
      if (i % 25 === 24) process.stdout.write(`\r  ${checked}/${products.length} уже есть: ${ok}`);
      continue;
    }

    const urls = buildCandidates(nmId);
    let downloaded = false;

    for (const url of urls) {
      // Если URL заканчивается на jpg — сохраняем jpg, иначе webp.
      const isJpg = url.includes('/1.jpg') || url.endsWith('.jpg');
      const dest = isJpg ? destJpg : destWebp;
      // Ставим небольшой бэк-офф, чтобы не триггерить 429.
      if (await tryDownload(url, dest)) {
        downloaded = true;
        break;
      }
      await sleep(120);
    }

    if (downloaded) ok++;
    if (i % 10 === 9) {
      process.stdout.write(`\r  ${checked}/${products.length} уже/скачано: ${ok}`);
    }

    // дополнительная пауза
    await sleep(60);
  }

  console.log(`\nГотово. Товаров с хотя бы 1 фото: ${ok}/${products.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

