/**
 * Автообновление цен с Wildberries в браузере
 * Использует prices.json (локально) + API WB (онлайн)
 */

const PRICES_CACHE_KEY = 'getstuff_prices_cache';
const PRICES_TTL_MS = 30 * 60 * 1000; // 30 минут

async function loadLocalPrices() {
  try {
    const res = await fetch('js/prices.json?_=' + Date.now());
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function applyPrices(pricesMap) {
  if (!pricesMap) return;
  for (const p of PRODUCTS) {
    const pr = pricesMap[p.id];
    if (!pr) continue;
    p.price = pr.price;
    p.oldPrice = pr.oldPrice;
  }
  document.querySelectorAll('[data-price-id]').forEach(el => {
    const product = getProductById(el.dataset.priceId);
    if (!product) return;
    const priceEl = el.querySelector('.product-card__price, .product-info__price');
    const oldEl = el.querySelector('.product-card__old-price, .product-info__old-price');
    if (priceEl) priceEl.textContent = formatPrice(getSitePrice(product));
    if (oldEl) oldEl.textContent = formatPrice(getWbPrice(product));
  });
}

async function fetchWbPricesBatch(ids) {
  const nm = ids.join(';');
  const url = `https://card.wb.ru/cards/v2/detail?appType=1&curr=rub&dest=-1257786&nm=${nm}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('WB API ' + res.status);
  const data = await res.json();
  const map = {};
  for (const p of data?.data?.products || []) {
    const sz = p.sizes?.[0]?.price || {};
    const price = Math.round((sz.product || 0) / 100);
    const basic = Math.round((sz.basic || 0) / 100);
    map[p.id] = { price: price || basic, oldPrice: basic > price ? basic : null };
  }
  return map;
}

async function refreshPricesFromWB() {
  const cached = JSON.parse(localStorage.getItem(PRICES_CACHE_KEY) || 'null');
  if (cached && Date.now() - cached.ts < PRICES_TTL_MS) {
    applyPrices(cached.items);
    return;
  }

  const ids = PRODUCTS.slice(0, 50).map(p => p.wbId);
  try {
    const online = await fetchWbPricesBatch(ids);
    applyPrices(online);
    localStorage.setItem(PRICES_CACHE_KEY, JSON.stringify({ ts: Date.now(), items: online }));
  } catch {
    const local = await loadLocalPrices();
    if (local?.items) applyPrices(local.items);
  }
}

async function initPrices() {
  const local = await loadLocalPrices();
  if (local?.items) applyPrices(local.items);
  if (navigator.onLine) refreshPricesFromWB();
}

document.addEventListener('DOMContentLoaded', () => {
  if (PRODUCTS.length) initPrices();
});
