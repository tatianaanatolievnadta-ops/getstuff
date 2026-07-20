/**
 * Догрузка фото товаров — перебор всех CDN-хостов WB
 * node scripts/download-images.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets', 'products');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'image/webp,image/*,*/*',
  Referer: 'https://www.wildberries.ru/',
};

const BASKETS = Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, '0'));
const SIZES = ['big', 'c516x688', 'tm'];

function getShard(vol) {
  if (vol <= 143) return '01';
  if (vol <= 287) return '02';
  if (vol <= 431) return '03';
  if (vol <= 575) return '04';
  if (vol <= 719) return '05';
  if (vol <= 863) return '06';
  if (vol <= 1007) return '07';
  if (vol <= 1151) return '08';
  if (vol <= 1295) return '09';
  if (vol <= 1439) return '10';
  if (vol <= 1583) return '11';
  if (vol <= 1727) return '12';
  if (vol <= 1871) return '13';
  if (vol <= 2015) return '14';
  if (vol <= 2159) return '15';
  if (vol <= 2303) return '16';
  if (vol <= 2447) return '17';
  if (vol <= 2591) return '18';
  if (vol <= 2735) return '19';
  if (vol <= 2879) return '20';
  if (vol <= 3023) return '21';
  if (vol <= 3167) return '22';
  if (vol <= 3311) return '23';
  if (vol <= 3455) return '24';
  if (vol <= 3599) return '25';
  if (vol <= 3743) return '26';
  if (vol <= 3887) return '27';
  if (vol <= 4031) return '28';
  return String(Math.min(38, Math.floor(vol / 144) + 1)).padStart(2, '0');
}

function buildUrls(nmId, n) {
  const vol = Math.floor(nmId / 100000);
  const part = Math.floor(nmId / 1000);
  const primary = getShard(vol);
  const hosts = [primary, ...BASKETS.filter((h) => h !== primary)];
  const urls = [];
  for (const host of hosts) {
    for (const size of SIZES) {
      urls.push(`https://basket-${host}.wbbasket.ru/vol${vol}/part${part}/${nmId}/images/${size}/${n}.webp`);
      urls.push(`https://basket-${host}.wbbasket.ru/vol${vol}/part${part}/${nmId}/images/${size}/${n}.jpg`);
    }
  }
  // geobasket fallback
  urls.push(`https://basket-${primary}.wbbasket.ru/vol${vol}/part${part}/${nmId}/images/big/${n}.webp`);
  return urls;
}

async function download(url, dest) {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
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

function loadProducts() {
  const raw = fs.readFileSync(path.join(ROOT, 'js', 'products.data.js'), 'utf8');
  const m = raw.match(/const PRODUCTS_DATA = (.+);/);
  return JSON.parse(m[1]).products;
}

async function downloadProduct(p) {
  const dir = path.join(ASSETS, String(p.wbId));
  const pics = Math.min(p.pics || 3, 3);
  const images = [];

  for (let n = 1; n <= pics; n++) {
    const dest = path.join(dir, `${n}.webp`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 400) {
      images.push(`assets/products/${p.wbId}/${n}.webp`);
      continue;
    }
    const urls = buildUrls(p.wbId, n);
    for (const url of urls) {
      if (await download(url, dest)) {
        images.push(`assets/products/${p.wbId}/${n}.webp`);
        break;
      }
    }
  }
  return images;
}

async function main() {
  const products = loadProducts();
  console.log(`Догрузка фото для ${products.length} товаров...`);
  let ok = 0;

  for (let i = 0; i < products.length; i++) {
    const images = await downloadProduct(products[i]);
    products[i].images = images.length ? images : [`assets/products/${products[i].wbId}/1.webp`];
    if (images.length) ok++;
    if ((i + 1) % 20 === 0 || i === products.length - 1) {
      process.stdout.write(`\r  ${i + 1}/${products.length} | с фото: ${ok}`);
    }
  }

  // Обновить products.data.js
  const raw = fs.readFileSync(path.join(ROOT, 'js', 'products.data.js'), 'utf8');
  const data = JSON.parse(raw.match(/const PRODUCTS_DATA = (.+);/)[1]);
  data.products = products;
  data.syncedAt = new Date().toISOString();
  const content = `/* AUTO-GENERATED — ${data.syncedAt} */\nconst PRODUCTS_DATA = ${JSON.stringify(data)};\n`;
  fs.writeFileSync(path.join(ROOT, 'js', 'products.data.js'), content);

  const withFiles = products.filter((p) => {
    const f = path.join(ASSETS, String(p.wbId), '1.webp');
    return fs.existsSync(f) && fs.statSync(f).size > 400;
  }).length;

  console.log(`\n✓ Товаров с локальным фото: ${withFiles}/${products.length}`);
}

main().catch(console.error);
