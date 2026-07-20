/**
 * Обновление цен с Wildberries
 * node scripts/update-prices.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DEST = -1257786;
const BATCH = 50;
const DELAY = 500;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadProducts() {
  const raw = fs.readFileSync(path.join(ROOT, 'js', 'products.data.js'), 'utf8');
  return JSON.parse(raw.match(/const PRODUCTS_DATA = (.+);/)[1]);
}

async function fetchPrices(ids) {
  const nm = ids.join(';');
  const url = `https://card.wb.ru/cards/v2/detail?appType=1&curr=rub&dest=${DEST}&nm=${nm}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const map = new Map();
  for (const p of data?.data?.products || []) {
    const sz = p.sizes?.[0]?.price || {};
    const price = Math.round((sz.product || 0) / 100);
    const basic = Math.round((sz.basic || 0) / 100);
    map.set(p.id, {
      price: price || basic,
      oldPrice: basic > price ? basic : null,
      rating: p.reviewRating || 0,
      reviews: p.feedbacks || 0,
      inStock: (p.totalQuantity || 0) > 0,
    });
  }
  return map;
}

async function main() {
  const data = loadProducts();
  const ids = data.products.map((p) => p.wbId);
  console.log(`Обновление цен для ${ids.length} товаров...`);

  let updated = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    try {
      await sleep(DELAY);
      const prices = await fetchPrices(batch);
      for (const p of data.products) {
        const pr = prices.get(p.wbId);
        if (pr) {
          p.price = pr.price;
          p.oldPrice = pr.oldPrice;
          p.rating = Math.round(pr.rating * 10) / 10;
          p.reviews = pr.reviews;
          p.inStock = pr.inStock;
          updated++;
        }
      }
      process.stdout.write(`\r  ${Math.min(i + BATCH, ids.length)}/${ids.length}`);
    } catch (e) {
      console.log(`\n  Батч ${i}: ${e.message}`);
    }
  }

  data.syncedAt = new Date().toISOString();
  data.pricesUpdatedAt = data.syncedAt;

  const pricesJson = {
    syncedAt: data.syncedAt,
    sellerId: 55354,
    items: Object.fromEntries(data.products.map((p) => [p.id, { price: p.price, oldPrice: p.oldPrice }])),
  };

  fs.writeFileSync(path.join(ROOT, 'js', 'products.data.js'),
    `/* AUTO-GENERATED — ${data.syncedAt} */\nconst PRODUCTS_DATA = ${JSON.stringify(data)};\n`);
  fs.writeFileSync(path.join(ROOT, 'js', 'prices.json'), JSON.stringify(pricesJson, null, 2));

  console.log(`\n✓ Обновлено цен: ${updated}`);
}

main().catch(console.error);
