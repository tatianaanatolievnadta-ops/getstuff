/**
 * Синхронизация каталога GETSTUFF с Wildberries (продавец 55354)
 * Запуск: node scripts/sync-wb.mjs
 *
 * 1. Загружает все товары продавца
 * 2. Скачивает фото в assets/products/{id}/
 * 3. Генерирует js/products.js и js/prices.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets', 'products');
const JS_DIR = path.join(ROOT, 'js');

const SELLER_ID = 55354;
const DEST = -1257786;
const DELAY_MS = 2200;
const PAGE_DELAY_MS = 2500;

const SEARCH_QUERIES = [
  'GETSTUFF',
  'саморез GETSTUFF',
  'гвозд GETSTUFF',
  'шуруп GETSTUFF',
  'металл GETSTUFF',
  'крепеж GETSTUFF',
  'GETSTUFF саморез',
  'GETSTUFF гвозд',
  'GETSTUFF шуруп',
  'GETSTUFF кровель',
  'GETSTUFF RAL',
  'GETSTUFF оцинк',
  'GETSTUFF мм',
  'GETSTUFF кг',
  'саморезы GETSTUFF',
  'гвозди GETSTUFF',
  'шурупы GETSTUFF',
  'саморез кровельный GETSTUFF',
  'саморез по дереву GETSTUFF',
  'саморез по металлу GETSTUFF',
  'GETSTUFF 25',
  'GETSTUFF 35',
  'GETSTUFF 45',
  'GETSTUFF 55',
  'GETSTUFF черн',
  'GETSTUFF желт',
];

const ALLOWED_NAME = /саморез|гвозд|шуруп|креп[её]ж|метиз|винт|болт|дюбел|шайб|анкер|заклеп|уголок|пластин/i;
const EXCLUDED_NAME = /футбол|майк|пластыр|накладк|груд|одежд|бель[ея]|трус|носк|крем|шампун|кондиционер|стирк|капсул|игруш|книг|картхолдер|лототрон|python|ps5|pubg|детейлинг|унитаз|провод автомоб/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'ru-RU,ru;q=0.9',
};

function wbImageUrl(nmId, n = 1) {
  const vol = Math.floor(nmId / 100000);
  const part = Math.floor(nmId / 1000);
  const hosts = Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, '0'));
  const host = hosts[vol % hosts.length];
  return `https://basket-${host}.wbbasket.ru/vol${vol}/part${part}/${nmId}/images/big/${n}.webp`;
}

function isValidProduct(name) {
  const n = (name || '').trim();
  if (!n) return false;
  if (EXCLUDED_NAME.test(n)) return false;
  return ALLOWED_NAME.test(n);
}

function detectCategory(name) {
  const n = name.toLowerCase();
  if (/кровельн|кровл/i.test(n)) return 'roof-screws';
  if (/гвозд/i.test(n)) return 'nails';
  if (/уголок|пластин|крепежн.*угол|оцинкованн.*угол/i.test(n)) return 'angles';
  if (/фасад|подвес|дюбель/i.test(n)) return 'facade';
  if (/металл/i.test(n)) return 'metal-screws';
  if (/дерев|гкл|шуруп/i.test(n)) return 'wood-screws';
  if (/саморез/i.test(n)) return 'wood-screws';
  return 'other';
}

function parseSpecs(name) {
  const specs = {};
  const sizeMatch = name.match(/(\d+[,.]?\d*)\s*[xх×]\s*(\d+[,.]?\d*)/i);
  if (sizeMatch) {
    specs.diameter = sizeMatch[1].replace('.', ',') + ' мм';
    specs.length = sizeMatch[2].replace('.', ',') + ' мм';
  }
  const packMatch = name.match(/(\d+)\s*шт/i);
  if (packMatch) specs.pack = packMatch[1] + ' шт.';
  const kgMatch = name.match(/(\d+)\s*кг/i);
  if (kgMatch) specs.pack = kgMatch[1] + ' кг';
  const ralMatch = name.match(/RAL\s*(\d+)/i);
  if (ralMatch) specs.coating = 'RAL ' + ralMatch[1];
  if (/оцинк/i.test(name)) specs.material = specs.material || 'Оцинкованная сталь';
  if (/желт|жёлт/i.test(name)) specs.coating = specs.coating || 'Жёлтый цинк';
  if (/черн/i.test(name)) specs.coating = specs.coating || 'Чёрный фосфат';
  return specs;
}

function getBadge(product) {
  if (product.oldPrice && product.price < product.oldPrice * 0.85) return 'sale';
  if (product.reviews > 100) return 'hit';
  if (product.reviews < 5) return 'new';
  return null;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  if (!text.startsWith('{') && !text.startsWith('[')) throw new Error(`Not JSON: ${text.slice(0, 80)}`);
  return JSON.parse(text);
}

async function fetchSearchPage(query, page) {
  const url =
    `https://search.wb.ru/exactmatch/ru/common/v5/search?ab_testing=false&appType=1&curr=rub&dest=${DEST}` +
    `&page=${page}&query=${encodeURIComponent(query)}&resultset=catalog&sort=popular&spp=100&supplier=${SELLER_ID}`;

  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      return await fetchJson(url);
    } catch (e) {
      if (String(e?.message || '').includes('429') && attempt <= 8) {
        await sleep(1500 * attempt + 500);
        continue;
      }
      throw e;
    }
  }
  throw new Error(`Не удалось загрузить ${query}, стр. ${page}`);
}

function mapWbProduct(p) {
  const id = p.id || p.nmId;
  const sz = p.sizes?.[0]?.price || p.size?.price || {};
  const price = Math.round((sz.product || p.salePriceU || p.priceU || 0) / 100);
  const basic = Math.round((sz.basic || p.priceU || 0) / 100);

  return {
    wbId: id,
    id: String(id),
    sku: String(id),
    name: (p.name || '').trim(),
    brand: p.brand || 'GETSTUFF',
    price: price || basic,
    oldPrice: basic > price ? basic : null,
    rating: p.reviewRating || p.rating || 0,
    reviews: p.feedbacks || p.nmFeedbacks || 0,
    pics: p.pics || 1,
    inStock: (p.totalQuantity || 0) > 0,
  };
}

async function fetchAllProducts() {
  const all = new Map();
  let rejected = 0;

  console.log('\nЗагрузка через несколько поисковых запросов (только seller 55354)...');

  for (const query of SEARCH_QUERIES) {
    let expectedTotal = null;

    for (let page = 1; page <= 10; page++) {
      await sleep(page === 1 ? DELAY_MS : PAGE_DELAY_MS);
      const data = await fetchSearchPage(query, page);
      const products = (data?.products || []).filter((p) => Number(p.supplierId) === Number(SELLER_ID));

      if (page === 1) expectedTotal = data?.total || null;
      if (!products.length) break;
      if (page > 1 && data?.total !== expectedTotal) break;

      let added = 0;
      for (const p of products) {
        const mapped = mapWbProduct(p);
        if (!isValidProduct(mapped.name)) {
          rejected++;
          continue;
        }
        if (!all.has(mapped.wbId)) {
          all.set(mapped.wbId, mapped);
          added++;
        }
      }

      process.stdout.write(`\r  ${query.slice(0, 28).padEnd(28)} стр.${page}: +${added} (всего ${all.size})`);
      if (products.length < 100) break;
      if (expectedTotal && page * 100 >= expectedTotal) break;
    }
  }

  console.log(`\n\nОтфильтровано посторонних: ${rejected}`);
  if (all.size === 0) throw new Error('Не удалось загрузить каталог. Попробуйте позже.');

  return [...all.values()];
}

async function downloadImage(url, destPath) {
  if (fs.existsSync(destPath)) return true;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) return false;
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, buf);
    return true;
  } catch {
    return false;
  }
}

async function downloadProductImages(product) {
  const dir = path.join(ASSETS, String(product.wbId));
  // Чтобы быстрее обеспечить офлайн-картинку каталога,
  // достаточно 1 фото на карточку.
  const pics = 1;
  let downloaded = 0;

  for (let n = 1; n <= pics; n++) {
    const localPath = path.join(dir, `${n}.webp`);
    const relPath = `assets/products/${product.wbId}/${n}.webp`;

    // Пробуем несколько хостов
    const vol = Math.floor(product.wbId / 100000);
    const part = Math.floor(product.wbId / 1000);
    const hosts = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20'];

    for (const host of [hosts[vol % hosts.length], ...hosts.slice(0, 5)]) {
      const url = `https://basket-${host}.wbbasket.ru/vol${vol}/part${part}/${product.wbId}/images/big/${n}.webp`;
      const ok = await downloadImage(url, localPath);
      if (ok) {
        downloaded++;
        product.images = product.images || [];
        product.images.push(relPath);
        break;
      }
    }
    await sleep(80);
  }

  if (!product.images?.length) {
    product.images = [];
  }
  return downloaded;
}

function buildCategories(products) {
  const catMap = new Map();
  const names = {
    'roof-screws': 'Саморезы кровельные',
    'wood-screws': 'Саморезы и шурупы по дереву',
    'metal-screws': 'Саморезы по металлу',
    'nails': 'Гвозди строительные',
    'angles': 'Уголки и пластины',
    'facade': 'Крепёж фасадный',
  };

  for (const p of products) {
    p.category = detectCategory(p.name);
    if (p.category === 'other') continue;
    if (!catMap.has(p.category)) catMap.set(p.category, p.wbId);
  }

  const order = ['roof-screws', 'wood-screws', 'metal-screws', 'nails', 'angles', 'facade'];
  return order
    .filter((id) => catMap.has(id))
    .map((id) => ({
      id,
      name: names[id],
      slug: id,
      wbId: catMap.get(id),
      image: `assets/products/${catMap.get(id)}/1.webp`,
    }));
}

function enrichProducts(raw) {
  return raw
    .map((p) => {
      const category = detectCategory(p.name);
      const specs = parseSpecs(p.name);
      const badge = getBadge(p);
      const imgBase = `assets/products/${p.wbId}`;
      return {
        id: p.id,
        wbId: p.wbId,
        sku: p.sku,
        name: p.name,
        category,
        price: p.price,
        oldPrice: p.oldPrice,
        rating: Math.round((p.rating || 0) * 10) / 10,
        reviews: p.reviews,
        badge,
        inStock: p.inStock !== false,
        description: p.name + '. Товар бренда GETSTUFF — качественный строительный крепёж.',
        specs,
        pics: p.pics || 1,
        images: p.images?.length ? p.images : [`${imgBase}/1.webp`],
      };
    })
    .filter((p) => p.category !== 'other');
}

function writeProductsJs(products, categories) {
  const content = `/* AUTO-GENERATED by scripts/sync-wb.mjs — ${new Date().toISOString()} */
/* Товаров: ${products.length} | Продавец WB: ${SELLER_ID} */

const PRODUCTS_DATA = ${JSON.stringify({ categories, products, syncedAt: new Date().toISOString() }, null, 0)};
`;
  fs.writeFileSync(path.join(JS_DIR, 'products.data.js'), content, 'utf8');
  console.log(`\n✓ js/products.data.js (${products.length} товаров)`);
}

function writePricesJson(products) {
  const prices = {
    syncedAt: new Date().toISOString(),
    sellerId: SELLER_ID,
    items: Object.fromEntries(products.map((p) => [p.id, { price: p.price, oldPrice: p.oldPrice }])),
  };
  fs.writeFileSync(path.join(JS_DIR, 'prices.json'), JSON.stringify(prices, null, 2), 'utf8');
  console.log(`✓ js/prices.json`);
}

async function main() {
  console.log('=== GETSTUFF — синхронизация с Wildberries ===');
  console.log(`Продавец: ${SELLER_ID}\n`);

  fs.mkdirSync(ASSETS, { recursive: true });

  console.log('1/3 Загрузка каталога...');
  const raw = await fetchAllProducts();
  console.log(`\nЗагружено товаров: ${raw.length}`);

  console.log('\n2/3 Скачивание фотографий...');
  let imgOk = 0;
  for (let i = 0; i < raw.length; i++) {
    const n = await downloadProductImages(raw[i]);
    if (n > 0) imgOk++;
    if ((i + 1) % 25 === 0 || i === raw.length - 1) {
      process.stdout.write(`\r  ${i + 1}/${raw.length} товаров, фото: ${imgOk}`);
    }
  }
  console.log('');

  console.log('\n3/3 Генерация файлов...');
  const categories = buildCategories(raw);
  const products = enrichProducts(raw);
  writeProductsJs(products, categories);
  writePricesJson(products);

  const stats = {
    total: products.length,
    withImages: products.filter((p) => p.images?.length).length,
    categories: categories.length,
  };
  fs.writeFileSync(path.join(ROOT, 'assets', 'sync-stats.json'), JSON.stringify(stats, null, 2));
  console.log('\n=== Готово ===', stats);
}

main().catch((e) => {
  console.error('\nОШИБКА:', e.message);
  process.exit(1);
});
