const CART_KEY = 'getstuff_cart';
const FAV_KEY = 'getstuff_favorites';
const ORDERS_KEY = 'getstuff_orders';

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadges();
}

function addToCart(productId, qty = 1) {
  const cart = getCart();
  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ id: productId, qty });
  }
  saveCart(cart);
  showToast('Товар добавлен в корзину');
}

function removeFromCart(productId) {
  const cart = getCart().filter(item => item.id !== productId);
  saveCart(cart);
}

function updateCartQty(productId, qty) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (item) {
    item.qty = Math.max(1, qty);
    saveCart(cart);
  }
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.qty, 0);
}

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY)) || [];
  } catch { return []; }
}

function isFavorite(productId) {
  return getFavorites().includes(productId);
}

function toggleFavorite(productId) {
  let favs = getFavorites();
  if (favs.includes(productId)) {
    favs = favs.filter(id => id !== productId);
    showToast('Удалено из избранного');
  } else {
    favs.push(productId);
    showToast('Добавлено в избранное');
  }
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  document.querySelectorAll(`.product-card[data-id="${productId}"] .product-card__fav`).forEach(btn => {
    btn.classList.toggle('active', favs.includes(productId));
  });
}

function updateCartBadges() {
  const count = getCartCount();
  document.querySelectorAll('.header__badge, .bottom-nav__badge').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function initSearch() {
  const input = document.getElementById('search-input');
  const suggestions = document.getElementById('search-suggestions');
  if (!input || !suggestions) return;

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const results = searchProducts(input.value.trim());
      if (results.length === 0) {
        suggestions.classList.remove('active');
        suggestions.innerHTML = '';
        return;
      }
      suggestions.innerHTML = results.map(p => `
        <a href="product.html?id=${p.id}" class="search-suggestion">
          <div class="search-suggestion__img"><img src="${getWbImage(p.wbId)}" alt="" style="width:40px;height:40px;object-fit:contain"></div>
          <div class="search-suggestion__info">
            <div class="search-suggestion__name">${p.name}</div>
            <div class="search-suggestion__sku">Арт. ${p.sku}</div>
          </div>
          <div class="search-suggestion__price">${formatPrice(getSitePrice(p))}</div>
        </a>
      `).join('');
      suggestions.classList.add('active');
    }, 200);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      window.location.href = `catalog.html?q=${encodeURIComponent(input.value.trim())}`;
    }
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !suggestions.contains(e.target)) {
      suggestions.classList.remove('active');
    }
  });
}

function initHeroSlider() {
  const slideEl = document.getElementById('hero-slide');
  const dotsEl = document.getElementById('hero-dots');
  if (!slideEl || !HERO_SLIDES) return;

  let current = 0;

  function renderSlide(index) {
    const slide = HERO_SLIDES[index];
    slideEl.innerHTML = `
      ${slide.badge ? `<span class="hero__badge">${slide.badge}</span>` : ''}
      <div class="hero__content">
        <h1 class="hero__title">${slide.title}</h1>
        <p class="hero__subtitle">${slide.subtitle}</p>
        <a href="${slide.link}" class="btn btn--accent">Смотреть</a>
      </div>
      <div class="hero__visual">
        <img src="${getWbImage(slide.wbId)}" alt="${slide.title}" loading="lazy">
      </div>
    `;
    dotsEl.querySelectorAll('.hero__dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  }

  dotsEl.innerHTML = HERO_SLIDES.map((_, i) =>
    `<button class="hero__dot${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="Слайд ${i + 1}"></button>`
  ).join('');

  dotsEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('hero__dot')) {
      current = parseInt(e.target.dataset.index);
      renderSlide(current);
    }
  });

  renderSlide(0);
  setInterval(() => {
    current = (current + 1) % HERO_SLIDES.length;
    renderSlide(current);
  }, 5000);
}

function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  const navMap = {
    'index.html': 'home',
    'catalog.html': 'catalog',
    'cart.html': 'cart',
    'account.html': 'account',
    'favorites.html': 'favorites',
  };
  const active = navMap[page] || 'home';
  document.querySelectorAll('.bottom-nav__item').forEach(item => {
    item.classList.toggle('active', item.dataset.nav === active);
  });
}

function initNewsletter() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('Спасибо! Вы подписаны на рассылку');
    form.reset();
  });
}

function submitQuickOrder(e, productId) {
  e.preventDefault();
  const phone = e.target.querySelector('input[type="tel"]').value;
  if (phone.length < 10) {
    showToast('Введите корректный номер телефона');
    return;
  }
  showToast('Заявка принята! Менеджер свяжется с вами');
  e.target.reset();
}

function submitCheckout(e) {
  e.preventDefault();
  const cart = getCart();
  if (cart.length === 0) {
    showToast('Корзина пуста');
    return;
  }

  const formData = new FormData(e.target);
  const customer = Object.fromEntries(formData);
  const subtotal = getCartTotal();
  const delivery = calcOzonDelivery(customer.city, subtotal);
  const tierId = typeof getActivePriceTier === 'function' ? getActivePriceTier(cart) : 'retail';
  const order = {
    id: 'GS-' + Date.now(),
    date: new Date().toLocaleDateString('ru-RU'),
    status: 'new',
    statusText: 'Новый',
    subtotal,
    deliveryCost: delivery.cost,
    deliveryProvider: 'Ozon',
    deliveryZone: delivery.zoneName,
    priceTier: tierId,
    priceTierName: typeof getTierInfo === 'function' ? getTierInfo(tierId).name : 'Розница',
    total: subtotal + delivery.cost,
    items: cart.map(item => {
      const p = getProductById(item.id);
      return p ? `${p.name} × ${item.qty}` : '';
    }).join(', '),
    customer,
  };

  const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
  orders.unshift(order);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  saveCart([]);
  showToast('Ваша заявка принята! С вами свяжется первый освободившийся менеджер, но не позднее чем в течение 24 часов.');
  setTimeout(() => window.location.href = 'account.html', 1500);
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartBadges();
  initSearch();
  initHeroSlider();
  setActiveNav();
  initNewsletter();
});
