/* GETSTUFF — загрузчик каталога и утилиты */

const SITE = {
  phone: '+7 (911) 910-33-44',
  email: 'metiz@гетстафф.рф',
  wbSeller: 'https://www.wildberries.ru/seller/55354',
  ozon: 'https://www.ozon.ru',
  tagline: 'Крепёж, которому можно доверять',
  description: 'ТМ «Getstuff» — российский бренд качественных товаров для ремонта и строительства.',
};

// Загружается из products.data.js (генерируется scripts/sync-wb.mjs)
let CATEGORIES = [];
let PRODUCTS = [];

function initCatalog() {
  if (typeof PRODUCTS_DATA !== 'undefined') {
    CATEGORIES = PRODUCTS_DATA.categories || [];
    PRODUCTS = PRODUCTS_DATA.products || [];
  }
}
initCatalog();

function getWbRemoteImageUrl(nmId, n = 1) {
  const id = Number(nmId);
  if (!id) return '';
  const vol = Math.floor(id / 100000);
  const part = Math.floor(id / 1000);
  const host = String((vol % 20) + 1).padStart(2, '0');
  return `https://basket-${host}.wbbasket.ru/vol${vol}/part${part}/${id}/images/big/${n}.webp`;
}

function getLocalProductImagePath(nmId, n = 1) {
  return `assets/products/${nmId}/${n}.webp`;
}

function getWbImage(nmId, n = 1) {
  return getWbRemoteImageUrl(nmId, n);
}

function getProductImage(product, n = 1) {
  if (product.images?.[n - 1] && /^https?:\/\//.test(product.images[n - 1])) {
    return product.images[n - 1];
  }
  return getWbRemoteImageUrl(product.wbId, n);
}

function getCategoryImage(catId) {
  const cat = CATEGORIES.find(c => c.id === catId);
  if (cat?.wbId) return getWbRemoteImageUrl(cat.wbId);
  const first = PRODUCTS.find(p => p.category === catId);
  return first ? getProductImage(first) : '';
}

function getWbProductUrl(wbId) {
  return `https://www.wildberries.ru/catalog/${wbId}/detail.aspx`;
}

const PROMO_BANNERS = [
  { title: 'Кровельные саморезы RAL 8017', subtitle: 'С EPDM-прокладкой', link: 'catalog.html?cat=roof-screws', wbId: 848081947, accent: true },
  { title: 'Саморезы по дереву', subtitle: 'Жёлтый цинк · оптом', link: 'catalog.html?cat=wood-screws', wbId: 211763002 },
  { title: 'Оптовым клиентам', subtitle: 'Прайс и вход для опта', link: 'wholesale.html', wbId: 479499362 },
];

const HERO_SLIDES = [
  { title: 'Кровельные саморезы GETSTUFF', subtitle: 'Оцинковка RAL 8017 · EPDM-прокладка', link: 'catalog.html?cat=roof-screws', wbId: 848081947, badge: 'ХИТ ПРОДАЖ' },
  { title: 'Саморезы по дереву', subtitle: 'Жёлтый и чёрный цинк · упаковки от 150 шт.', link: 'catalog.html?cat=wood-screws', wbId: 211763002, badge: null },
  { title: 'Крепёж, которому можно доверять', subtitle: 'Российский бренд · 345+ позиций', link: 'catalog.html', wbId: 479499362, badge: 'GETSTUFF' },
];

const MOCK_ORDERS = [
  { id: 'GS-20260715-001', date: '15.07.2026', status: 'processing', statusText: 'В обработке', total: 818, items: 'Саморезы кровельные 5,5×19, Саморезы по дереву 4,2×75' },
  { id: 'GS-20260628-002', date: '28.06.2026', status: 'done', statusText: 'Доставлен', total: 429, items: 'Саморезы кровельные 5,5×29' },
];

function getProductImages(product) {
  const count = product.pics || product.images?.length || 1;
  return Array.from({ length: Math.min(count, 3) }, (_, i) => getProductImage(product, i + 1));
}

function renderProductImage(product, className = '') {
  const remote = getWbRemoteImageUrl(product.wbId);
  const local = getLocalProductImagePath(product.wbId);
  const fallback = product.category === 'nails' ? '📌' : product.category === 'wood-screws' ? '🪵' : '🔩';
  return `<img src="${remote}" data-local="${local}" alt="${product.name}" class="${className}" loading="lazy" onerror="if(this.dataset.fallback!=='1'&&this.dataset.local&&this.src.indexOf('wbbasket')!==-1){this.dataset.fallback='1';this.src=this.dataset.local}else{this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex'}"><span class="img-fallback" style="display:none">${fallback}</span>`;
}

const SITE_DISCOUNT = 0.2;

function getWbPrice(product) {
  return product?.price || 0;
}

function getSitePrice(product) {
  if (typeof getProductPriceForTier === 'function' && typeof getDisplayTier === 'function') {
    return getProductPriceForTier(product, getDisplayTier());
  }
  return Math.round(getWbPrice(product) * (1 - SITE_DISCOUNT));
}

function formatPrice(price) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(price)) + ' ₽';
}

function renderProductPrices(product, large = false) {
  const wbPrice = getWbPrice(product);
  const sitePrice = getSitePrice(product);
  const tierId = typeof getDisplayTier === 'function' ? getDisplayTier() : 'retail';
  const tier = typeof getTierInfo === 'function' ? getTierInfo(tierId) : null;
  const discountPct = tier ? Math.round(tier.discount * 100) : 20;
  const rowClass = large ? 'product-info__price-row' : 'product-card__price-row';
  const priceClass = large ? 'product-info__price product-info__price--site' : 'product-card__price product-card__price--site';
  const oldClass = large ? 'product-info__old-price' : 'product-card__old-price';
  const discountClass = large ? 'product-info__site-discount' : 'product-card__site-discount';

  return `
    <div class="${rowClass}" data-price-id="${product.id}" data-wb-price="${wbPrice}">
      <span class="${priceClass}">${formatPrice(sitePrice)}</span>
      <span class="${oldClass}">${formatPrice(wbPrice)}</span>
      <span class="${discountClass}">−${discountPct}%${tierId === 'retail' ? ' с сайта' : ''}</span>
    </div>
    ${typeof renderWholesalePriceNote === 'function' && !large ? renderWholesalePriceNote(product, large) : ''}`;
}

function getProductById(id) {
  return PRODUCTS.find(p => p.id === id);
}

function getProductsByCategory(categoryId) {
  if (!categoryId) return PRODUCTS;
  return PRODUCTS.filter(p => p.category === categoryId);
}

function getCategoryName(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.name : '';
}

function searchProducts(query) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.sku.includes(q)
  ).slice(0, 12);
}

function renderStars(rating) {
  const full = Math.floor(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function renderBadge(badge, product) {
  if (!badge) return '';
  if (badge === 'sale' && product?.oldPrice) {
    const pct = Math.round((1 - product.price / product.oldPrice) * 100);
    return `<span class="badge badge--sale">-${pct}%</span>`;
  }
  const labels = { hit: 'ХИТ', new: 'НОВИНКА', sale: 'АКЦИЯ' };
  const classes = { sale: 'badge--sale', hit: 'badge--hit', new: 'badge--new' };
  return `<span class="badge ${classes[badge]}">${labels[badge]}</span>`;
}

function renderProductCard(product) {
  const favClass = isFavorite(product.id) ? ' active' : '';
  const badgeLabel = (typeof isWholesaleBuyer === 'function' && isWholesaleBuyer()) ? 'Опт' : '−20%';
  return `
    <div class="product-card" data-id="${product.id}">
      <div class="product-card__badges">
        <span class="badge badge--site">${badgeLabel}</span>
        ${renderBadge(product.badge, product)}
      </div>
      <button class="product-card__fav${favClass}" onclick="event.preventDefault();toggleFavorite('${product.id}')" aria-label="В избранное">♡</button>
      <a href="product.html?id=${product.id}" class="product-card__img">
        ${renderProductImage(product)}
      </a>
      <div class="product-card__body">
        <a href="product.html?id=${product.id}" class="product-card__name">${product.name}</a>
        <div class="product-card__rating">
          <span class="product-card__stars">${renderStars(product.rating)}</span>
          <span>${product.rating}</span>
          <span class="product-card__reviews">(${product.reviews})</span>
        </div>
        ${renderProductPrices(product)}
        <div class="product-card__actions">
          <button class="btn btn--cart" onclick="addToCart('${product.id}')">В корзину</button>
          <a href="${getWbProductUrl(product.wbId)}" target="_blank" rel="noopener" class="btn btn--wb">Купить на WB</a>
        </div>
      </div>
    </div>`;
}

function getPopularProducts() {
  return [...PRODUCTS].sort((a, b) => b.reviews - a.reviews).slice(0, 12);
}

function getSaleProducts() {
  return PRODUCTS.filter(p => p.oldPrice).slice(0, 12);
}

function getNewProducts() {
  return PRODUCTS.filter(p => p.badge === 'new' || p.reviews < 10).slice(0, 12);
}

function getCatalogCount() {
  return PRODUCTS.length;
}
