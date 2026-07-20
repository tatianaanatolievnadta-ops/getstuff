/**
 * Оптовые продажи GETSTUFF
 * Розница: до 20 000 ₽ · Опт: от 20 000 ₽ · Крупный опт: от 100 000 шт.
 */

const WHOLESALE_KEY = 'getstuff_wholesale_user';

const WHOLESALE_TIERS = {
  retail: {
    id: 'retail',
    name: 'Розница',
    badge: 'Розница',
    maxSum: 20000,
    discount: 0.2,
    summary: 'До 20 000 ₽',
    description: 'Стандартные цены сайта со скидкой 20% от Wildberries',
  },
  wholesale: {
    id: 'wholesale',
    name: 'Опт',
    badge: 'Опт',
    minSum: 20000,
    discount: 0.3,
    summary: 'От 20 000 ₽',
    description: 'Оптовые цены при сумме заказа от 20 000 ₽. Упаковка коробками.',
  },
  large: {
    id: 'large',
    name: 'Крупный опт',
    badge: 'Крупный опт',
    minPieces: 100000,
    discount: 0.4,
    summary: 'От 100 000 шт.',
    description: 'Максимальная скидка при заказе от 100 000 штук в одном заказе',
  },
};

const BOX_QTY_DEFAULTS = {
  'roof-screws': 1000,
  'wood-screws': 500,
  'metal-screws': 500,
  nails: 1000,
};

function getWholesaleUser() {
  try {
    return JSON.parse(localStorage.getItem(WHOLESALE_KEY)) || null;
  } catch {
    return null;
  }
}

function isWholesaleBuyer() {
  return !!getWholesaleUser();
}

function loginWholesale(data) {
  const user = {
    company: data.company?.trim() || '',
    name: data.name?.trim() || '',
    phone: data.phone?.trim() || '',
    email: data.email?.trim() || '',
    inn: data.inn?.trim() || '',
    loggedInAt: new Date().toISOString(),
  };
  localStorage.setItem(WHOLESALE_KEY, JSON.stringify(user));
  updateWholesaleUI();
  showToast('Вы вошли как оптовый покупатель');
  return user;
}

function logoutWholesale() {
  localStorage.removeItem(WHOLESALE_KEY);
  updateWholesaleUI();
  showToast('Вы вышли из оптового кабинета');
}

function getCartPieces(cart = getCart()) {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function getCartSubtotal(cart = getCart()) {
  return cart.reduce((sum, item) => {
    const product = getProductById(item.id);
    return sum + (product ? getProductPriceForTier(product, 'retail') * item.qty : 0);
  }, 0);
}

function resolveOrderTier(cart = getCart()) {
  const pieces = getCartPieces(cart);
  const subtotal = getCartSubtotal(cart);

  if (pieces >= WHOLESALE_TIERS.large.minPieces) return 'large';
  if (subtotal >= WHOLESALE_TIERS.wholesale.minSum) return 'wholesale';
  return 'retail';
}

function getActivePriceTier(cart = getCart()) {
  return resolveOrderTier(cart);
}

function getDisplayTier() {
  if (isWholesaleBuyer()) return 'wholesale';
  return 'retail';
}

function getTierInfo(tierId) {
  return WHOLESALE_TIERS[tierId] || WHOLESALE_TIERS.retail;
}

function getProductPriceForTier(product, tierId) {
  const tier = getTierInfo(tierId);
  return Math.round(getWbPrice(product) * (1 - tier.discount));
}

function getSitePrice(product) {
  return getProductPriceForTier(product, getDisplayTier());
}

function getCartTotal(cart = getCart()) {
  const tier = getActivePriceTier(cart);
  return cart.reduce((sum, item) => {
    const product = getProductById(item.id);
    return sum + (product ? getProductPriceForTier(product, tier) * item.qty : 0);
  }, 0);
}

function getBoxQty(product) {
  const pack = product.specs?.pack || '';
  const name = product.name || '';
  const match =
    pack.match(/(\d[\d\s]*)\s*шт/i) ||
    name.match(/(\d[\d\s]*)\s*шт/i) ||
    pack.match(/(\d[\d\s]*)\s*шт\.?\s*\/\s*кор/i);
  if (match) return parseInt(match[1].replace(/\s/g, ''), 10) || BOX_QTY_DEFAULTS[product.category] || 500;
  return BOX_QTY_DEFAULTS[product.category] || 500;
}

function getBoxesCount(product, qty) {
  const boxQty = getBoxQty(product);
  return Math.ceil(qty / boxQty);
}

function formatTierPrices(product) {
  return {
    retail: getProductPriceForTier(product, 'retail'),
    wholesale: getProductPriceForTier(product, 'wholesale'),
    large: getProductPriceForTier(product, 'large'),
    boxQty: getBoxQty(product),
  };
}

function renderWholesalePriceNote(product, large = false) {
  if (!isWholesaleBuyer()) return '';
  const prices = formatTierPrices(product);
  const cls = large ? 'product-info__wholesale' : 'product-card__wholesale';
  return `
    <div class="${cls}">
      <span class="wholesale-box">📦 ${prices.boxQty} шт/короб</span>
      <span class="wholesale-tier">Опт: ${formatPrice(prices.wholesale)}</span>
      <span class="wholesale-tier wholesale-tier--large">Крупный опт: ${formatPrice(prices.large)}</span>
    </div>`;
}

function renderWholesaleTierBadge(tierId) {
  const tier = getTierInfo(tierId);
  const cls = tierId === 'large' ? 'wholesale-badge wholesale-badge--large'
    : tierId === 'wholesale' ? 'wholesale-badge wholesale-badge--opt'
    : 'wholesale-badge';
  return `<span class="${cls}">${tier.badge}</span>`;
}

function renderWholesaleTiersBlock() {
  return `
    <div class="wholesale-tiers">
      ${Object.values(WHOLESALE_TIERS).map((tier) => `
        <div class="wholesale-tier-card wholesale-tier-card--${tier.id}">
          <div class="wholesale-tier-card__name">${tier.name}</div>
          <div class="wholesale-tier-card__summary">${tier.summary}</div>
          <div class="wholesale-tier-card__discount">−${Math.round(tier.discount * 100)}% от WB</div>
          <p class="wholesale-tier-card__text">${tier.description}</p>
        </div>
      `).join('')}
    </div>`;
}

function renderWholesaleLoginBlock() {
  const user = getWholesaleUser();
  if (user) {
    return `
      <div class="wholesale-login wholesale-login--active">
        <div class="wholesale-login__status">
          <span class="wholesale-login__icon">✓</span>
          <div>
            <div class="wholesale-login__title">Оптовый покупатель</div>
            <div class="wholesale-login__company">${user.company || user.name}</div>
            <div class="wholesale-login__meta">${user.email}${user.phone ? ' · ' + user.phone : ''}</div>
          </div>
        </div>
        <div class="wholesale-login__actions">
          <button type="button" class="btn btn--primary" onclick="downloadPriceList()">Скачать прайс-лист</button>
          <button type="button" class="btn btn--outline" onclick="logoutWholesale();location.reload()">Выйти</button>
        </div>
      </div>`;
  }

  return `
    <div class="wholesale-login">
      <h3 class="wholesale-login__heading">Вход для оптовых покупателей</h3>
      <p class="wholesale-login__sub">После входа отображаются оптовые цены, количество в коробке и полный прайс-лист</p>
      <form id="wholesale-login-form" class="wholesale-login__form" onsubmit="submitWholesaleLogin(event)">
        <div class="form-row">
          <div class="form-group">
            <label for="ws-company">Компания *</label>
            <input type="text" id="ws-company" name="company" required placeholder="ООО «Строй»">
          </div>
          <div class="form-group">
            <label for="ws-inn">ИНН</label>
            <input type="text" id="ws-inn" name="inn" placeholder="Необязательно">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="ws-name">Контактное лицо *</label>
            <input type="text" id="ws-name" name="name" required placeholder="Иван Иванов">
          </div>
          <div class="form-group">
            <label for="ws-phone">Телефон *</label>
            <input type="tel" id="ws-phone" name="phone" required placeholder="+7 (___) ___-__-__">
          </div>
        </div>
        <div class="form-group">
          <label for="ws-email">Email *</label>
          <input type="email" id="ws-email" name="email" required placeholder="opt@company.ru">
        </div>
        <button type="submit" class="btn btn--primary btn--block">Войти как оптовый покупатель</button>
      </form>
      <button type="button" class="btn btn--outline btn--block" style="margin-top:10px" onclick="downloadPriceList()">
        Скачать прайс-лист (розница)
      </button>
    </div>`;
}

function submitWholesaleLogin(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  loginWholesale(Object.fromEntries(formData));
  const loginEl = document.getElementById('wholesale-login');
  if (loginEl) loginEl.innerHTML = renderWholesaleLoginBlock();
}

function escapeCsv(value) {
  const str = String(value ?? '');
  if (/[",;\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadPriceList() {
  const includeOpt = isWholesaleBuyer();
  const header = includeOpt
    ? ['Артикул', 'Название', 'Категория', 'Цена WB', 'Розница', 'Опт', 'Крупный опт', 'Шт/короб', 'Ссылка WB']
    : ['Артикул', 'Название', 'Категория', 'Цена WB', 'Розница', 'Шт/короб', 'Ссылка WB'];

  const rows = [header.join(';')];

  PRODUCTS.forEach((product) => {
    const prices = formatTierPrices(product);
    const category = getCategoryName(product.category);
    const row = includeOpt
      ? [
          product.sku,
          product.name,
          category,
          getWbPrice(product),
          prices.retail,
          prices.wholesale,
          prices.large,
          prices.boxQty,
          getWbProductUrl(product.wbId),
        ]
      : [
          product.sku,
          product.name,
          category,
          getWbPrice(product),
          prices.retail,
          prices.boxQty,
          getWbProductUrl(product.wbId),
        ];
    rows.push(row.map(escapeCsv).join(';'));
  });

  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = includeOpt
    ? `GETSTUFF-prais-opt-${new Date().toISOString().slice(0, 10)}.csv`
    : `GETSTUFF-prais-roznica-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('Прайс-лист скачан');
}

function renderCartTierSummary(cart = getCart()) {
  const tierId = getActivePriceTier(cart);
  const subtotalRetail = getCartSubtotal(cart);
  const pieces = getCartPieces(cart);

  let hint = '';
  if (tierId === 'retail' && subtotalRetail < WHOLESALE_TIERS.wholesale.minSum) {
    hint = `<div class="cart-summary__row cart-summary__hint">
      <span>До оптовых цен</span>
      <span>${formatPrice(WHOLESALE_TIERS.wholesale.minSum - subtotalRetail)}</span>
    </div>`;
  } else if (tierId !== 'large' && pieces < WHOLESALE_TIERS.large.minPieces) {
    hint = `<div class="cart-summary__row cart-summary__hint">
      <span>До крупного опта</span>
      <span>${(WHOLESALE_TIERS.large.minPieces - pieces).toLocaleString('ru-RU')} шт</span>
    </div>`;
  }

  return `
    <div class="cart-summary__row cart-summary__tier">
      <span>Тариф</span>
      <span>${renderWholesaleTierBadge(tierId)}</span>
    </div>
    ${hint}`;
}

function updateWholesaleUI() {
  const active = isWholesaleBuyer();
  document.querySelectorAll('[data-wholesale-badge]').forEach((el) => {
    el.style.display = active ? 'inline-flex' : 'none';
  });
  document.querySelectorAll('[data-wholesale-label]').forEach((el) => {
    el.textContent = active ? 'Опт ✓' : 'Опт';
  });
}

function initWholesalePage() {
  const tiersEl = document.getElementById('wholesale-tiers');
  if (tiersEl) tiersEl.innerHTML = renderWholesaleTiersBlock();

  const loginEl = document.getElementById('wholesale-login');
  if (loginEl) loginEl.innerHTML = renderWholesaleLoginBlock();
}

function initWholesaleSection() {
  const sectionEl = document.getElementById('wholesale-section-content');
  if (!sectionEl) return;

  sectionEl.innerHTML = `
    ${renderWholesaleTiersBlock()}
    <div class="wholesale-section__actions">
      <a href="wholesale.html" class="btn btn--primary">Войти как оптовик</a>
      <button type="button" class="btn btn--outline" onclick="downloadPriceList()">Скачать прайс</button>
    </div>`;
}

document.addEventListener('DOMContentLoaded', updateWholesaleUI);
