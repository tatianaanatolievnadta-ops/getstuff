/**
 * Расчёт доставки через Ozon с региональной привязкой
 */

const OZON_DELIVERY = {
  provider: 'Ozon',
  freeFrom: 5000,
  spbLeningradFreeFromPieces: 50000,
  dispatchNote: 'Отправка заказов — по пятницам.',
  managerNote: 'Точную дату и условия доставки согласуйте с менеджером индивидуально.',
  rates: {
    priority: 149,
    moscow: 199,
    major: 299,
    region: 449,
  },
  majorCities: [
    'москва', 'санкт-петербург', 'спб', 'петербург', 'новосибирск', 'екатеринбург',
    'казань', 'нижний новгород', 'челябинск', 'самара', 'омск', 'ростов', 'уфа',
    'красноярск', 'воронеж', 'пермь', 'волгоград', 'тюмень', 'тольятти',
  ],
  zones: [
    {
      id: 'leningrad',
      name: 'Ленинградская область',
      rate: 'priority',
      days: '1–2 рабочих дня',
      freeDays: '1–3 рабочих дня',
      note: 'Приоритетная зона. Бесплатная доставка от 50 000 шт.',
      keywords: [
        'ленинградская', 'ленинградской', 'ленобласт', 'лен. обл', 'л.o.', 'лo ',
        'выборг', 'гатчина', 'всеволожск', 'мурино', 'кудрово', 'сертолово',
        'тихвин', 'кириши', 'кингисепп', 'люга', 'волхов', 'приозерск', 'сосновый бор',
        'тосно', 'сланцы', 'лодейное поле', 'подпорожье', 'сясьстрой', 'светогорск',
        'никольское', 'отрадное', 'колтуши', 'шлиссельбург', 'кировск', 'сосново',
        'коммунар', 'сиверский', 'вырица', 'пикалёво', 'пикалево', 'бокситогорск',
      ],
    },
    {
      id: 'krasnodar',
      name: 'Краснодарский край',
      rate: 'priority',
      days: '1–2 рабочих дня',
      freeDays: '1–3 рабочих дня',
      note: 'Приоритетная зона — отправка со склада в регионе',
      keywords: [
        'краснодарский', 'краснодарск', 'кубань', 'кубан',
        'краснодар', 'сочи', 'новороссийск', 'армавир', 'анапа', 'геленджик',
        'ейск', 'туапсе', 'славянск', 'лабинск', 'кропоткин', 'тимашевск',
        'белореченск', 'кореновск', 'темрюк', 'абинск', 'апшеронск',
        'гулькевичи', 'каневская', 'курганинск', 'приморско-ахтарск', 'усть-лабинск',
        'хадыженск', 'новокубанск', 'тихорецк', 'адыгея',
      ],
    },
  ],
};

function normalizeCityInput(city) {
  return (city || '')
    .toLowerCase()
    .trim()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

function getCartWeightKg() {
  return getCart().reduce((sum, item) => {
    const p = getProductById(item.id);
    const weight = p?.specs?.weight ? parseFloat(String(p.specs.weight).replace(',', '.')) : 0.5;
    return sum + weight * item.qty;
  }, 0);
}

function detectDeliveryZone(city) {
  const c = normalizeCityInput(city);

  if (!c) {
    return {
      id: 'region',
      name: 'Другие регионы',
      rate: OZON_DELIVERY.rates.region,
      days: '3–7 рабочих дней',
      freeDays: '2–5 рабочих дней',
      note: 'Доставка осуществляется службой Ozon до пункта выдачи или курьером',
    };
  }

  for (const zone of OZON_DELIVERY.zones) {
    if (zone.keywords.some((keyword) => c.includes(normalizeCityInput(keyword)))) {
      return {
        id: zone.id,
        name: zone.name,
        rate: OZON_DELIVERY.rates[zone.rate],
        days: zone.days,
        freeDays: zone.freeDays,
        note: zone.note,
        priority: true,
      };
    }
  }

  if (c.includes('москва')) {
    return {
      id: 'moscow',
      name: 'Москва',
      rate: OZON_DELIVERY.rates.moscow,
      days: '2–4 рабочих дня',
      freeDays: '2–5 рабочих дней',
      note: 'Доставка осуществляется службой Ozon до пункта выдачи или курьером',
    };
  }

  if (c.includes('петербург') || c === 'спб') {
    return {
      id: 'spb',
      name: 'Санкт-Петербург',
      rate: OZON_DELIVERY.rates.priority,
      days: '1–2 рабочих дня',
      freeDays: '1–3 рабочих дня',
      note: 'Бесплатная доставка при заказе от 50 000 шт.',
      priority: true,
    };
  }

  if (OZON_DELIVERY.majorCities.some((cityName) => c.includes(normalizeCityInput(cityName)))) {
    return {
      id: 'major',
      name: 'Крупный город',
      rate: OZON_DELIVERY.rates.major,
      days: '2–4 рабочих дня',
      freeDays: '2–5 рабочих дней',
      note: 'Доставка осуществляется службой Ozon до пункта выдачи или курьером',
    };
  }

  return {
    id: 'region',
    name: 'Другие регионы',
    rate: OZON_DELIVERY.rates.region,
    days: '3–7 рабочих дней',
    freeDays: '2–5 рабочих дней',
    note: 'Доставка осуществляется службой Ozon до пункта выдачи или курьером',
  };
}

function isSpbLeningradRegion(city) {
  const zone = detectDeliveryZone(city);
  return zone.id === 'spb' || zone.id === 'leningrad';
}

function getDeliveryFreeStatus(city, subtotal, itemsCount) {
  if (isSpbLeningradRegion(city) && itemsCount >= OZON_DELIVERY.spbLeningradFreeFromPieces) {
    return {
      free: true,
      reason: 'spb_pieces',
      note: `Бесплатная доставка в СПб и Ленобласть при заказе от ${OZON_DELIVERY.spbLeningradFreeFromPieces.toLocaleString('ru-RU')} шт.`,
    };
  }
  if (!isSpbLeningradRegion(city) && subtotal >= OZON_DELIVERY.freeFrom) {
    return {
      free: true,
      reason: 'sum',
      note: `Бесплатная доставка Ozon при заказе от ${formatPrice(OZON_DELIVERY.freeFrom)}`,
    };
  }
  return { free: false, reason: null, note: '' };
}

function renderFreeDeliveryHint(city, subtotal, itemsCount) {
  const status = getDeliveryFreeStatus(city, subtotal, itemsCount);
  if (status.free) return '';

  if (isSpbLeningradRegion(city)) {
    const left = OZON_DELIVERY.spbLeningradFreeFromPieces - itemsCount;
    if (left > 0) {
      return `<div class="cart-summary__row cart-summary__hint">
        <span>До бесплатной доставки (СПб/ЛО)</span>
        <span>${left.toLocaleString('ru-RU')} шт</span>
      </div>`;
    }
    return '';
  }

  if (subtotal < OZON_DELIVERY.freeFrom) {
    return `<div class="cart-summary__row cart-summary__hint">
      <span>До бесплатной доставки</span>
      <span>${formatPrice(OZON_DELIVERY.freeFrom - subtotal)}</span>
    </div>`;
  }
  return '';
}

function calcOzonDelivery(city, subtotal) {
  const weight = getCartWeightKg();
  const itemsCount = getCartCount();
  const zone = detectDeliveryZone(city);
  const freeStatus = getDeliveryFreeStatus(city, subtotal, itemsCount);
  const scheduleNote = OZON_DELIVERY.dispatchNote;
  const managerNote = OZON_DELIVERY.managerNote;

  if (freeStatus.free) {
    return {
      provider: OZON_DELIVERY.provider,
      cost: 0,
      label: 'Бесплатно',
      days: zone.freeDays,
      note: freeStatus.note,
      scheduleNote,
      managerNote,
      weight,
      itemsCount,
      zone: zone.id,
      zoneName: zone.name,
      priority: !!zone.priority,
    };
  }

  let cost = zone.rate;
  if (weight > 5) cost += Math.ceil((weight - 5) / 5) * 50;
  if (itemsCount > 15) cost += 100;

  return {
    provider: OZON_DELIVERY.provider,
    cost,
    label: formatPrice(cost),
    days: zone.days,
    note: zone.note,
    scheduleNote,
    managerNote,
    weight,
    itemsCount,
    zone: zone.id,
    zoneName: zone.name,
    priority: !!zone.priority,
  };
}

function renderDeliveryInfo(delivery, city) {
  const cityText = city?.trim() ? `в ${city.trim()}` : '— укажите город для расчёта';
  const zoneBadge = delivery.zoneName && delivery.zone !== 'region'
    ? `<span class="delivery-info__zone${delivery.priority ? ' delivery-info__zone--priority' : ''}">${delivery.zoneName}</span>`
    : '';

  return `
    <div class="delivery-info">
      <div class="delivery-info__header">
        <span class="delivery-info__logo">Ozon</span>
        <span class="delivery-info__title">Доставка Ozon</span>
        ${zoneBadge}
      </div>
      <p class="delivery-info__text">
        Отправляем заказы через логистику <strong>Ozon</strong> ${cityText}.
        Срок: <strong>${delivery.days}</strong>.
        ${delivery.scheduleNote ? `<br>${delivery.scheduleNote}` : ''}
      </p>
      <p class="delivery-info__note">${delivery.note}</p>
      ${delivery.managerNote ? `<p class="delivery-info__hint">${delivery.managerNote}</p>` : ''}
      ${delivery.cost === 0 ? '' : renderDeliveryFreeHint(city)}
    </div>`;
}

function renderDeliveryFreeHint(city) {
  if (isSpbLeningradRegion(city)) {
    return `<p class="delivery-info__hint">Бесплатно в СПб и Ленобласть от ${OZON_DELIVERY.spbLeningradFreeFromPieces.toLocaleString('ru-RU')} шт</p>`;
  }
  return `<p class="delivery-info__hint">Бесплатно от ${formatPrice(OZON_DELIVERY.freeFrom)}</p>`;
}

function renderDeliveryZonesBlock() {
  const krasnodarZone = OZON_DELIVERY.zones.find((z) => z.id === 'krasnodar');

  return `
    <div class="delivery-zones">
      <div class="delivery-zone delivery-zone--priority">
        <div class="delivery-zone__badge">СПб и Ленобласть</div>
        <div class="delivery-zone__name">Санкт-Петербург и Ленобласть</div>
        <div class="delivery-zone__price">от ${formatPrice(OZON_DELIVERY.rates.priority)}</div>
        <div class="delivery-zone__days">1–2 дня · бесплатно от 50 000 шт</div>
      </div>
      ${krasnodarZone ? `
      <div class="delivery-zone delivery-zone--priority">
        <div class="delivery-zone__badge">Быстрее и дешевле</div>
        <div class="delivery-zone__name">${krasnodarZone.name}</div>
        <div class="delivery-zone__price">от ${formatPrice(OZON_DELIVERY.rates[krasnodarZone.rate])}</div>
        <div class="delivery-zone__days">${krasnodarZone.days}</div>
      </div>` : ''}
      <div class="delivery-zone">
        <div class="delivery-zone__name">Москва</div>
        <div class="delivery-zone__price">от ${formatPrice(OZON_DELIVERY.rates.moscow)}</div>
        <div class="delivery-zone__days">2–4 рабочих дня</div>
      </div>
      <div class="delivery-zone">
        <div class="delivery-zone__name">Крупные города</div>
        <div class="delivery-zone__price">от ${formatPrice(OZON_DELIVERY.rates.major)}</div>
        <div class="delivery-zone__days">2–4 рабочих дня</div>
      </div>
      <div class="delivery-zone">
        <div class="delivery-zone__name">Другие регионы</div>
        <div class="delivery-zone__price">от ${formatPrice(OZON_DELIVERY.rates.region)}</div>
        <div class="delivery-zone__days">3–7 рабочих дней</div>
      </div>
    </div>
    <p class="delivery-info__hint" style="margin-top:12px">
      <strong>СПб и Ленобласть:</strong> бесплатно от 50 000 шт.
      <strong>Другие регионы:</strong> бесплатно от ${formatPrice(OZON_DELIVERY.freeFrom)}.
      ${OZON_DELIVERY.dispatchNote}
    </p>
    <p class="delivery-info__hint">${OZON_DELIVERY.managerNote}</p>`;
}

function renderOrderSummaryRows(cart, city) {
  const subtotal = getCartTotal();
  const delivery = calcOzonDelivery(city, subtotal);
  const total = subtotal + delivery.cost;

  const itemsHtml = cart.map((item) => {
    const p = getProductById(item.id);
    return p ? `<div class="cart-summary__row"><span>${p.name} × ${item.qty}</span><span>${formatPrice(getSitePrice(p) * item.qty)}</span></div>` : '';
  }).join('');

  return {
    html: `
      ${itemsHtml}
      ${typeof renderCartTierSummary === 'function' ? renderCartTierSummary(cart) : ''}
      <div class="cart-summary__row"><span>Товары</span><span>${formatPrice(subtotal)}</span></div>
      <div class="cart-summary__row">
        <span>Доставка Ozon${delivery.zoneName && delivery.zone !== 'region' ? ` · ${delivery.zoneName}` : ''}</span>
        <span>${delivery.cost === 0 ? 'Бесплатно' : formatPrice(delivery.cost)}</span>
      </div>
      ${renderFreeDeliveryHint(city, subtotal, getCartCount())}
      <div class="cart-summary__row cart-summary__total"><span>Итого</span><span>${formatPrice(total)}</span></div>
      ${renderDeliveryInfo(delivery, city)}
    `,
    subtotal,
    delivery,
    total,
  };
}

function updateSummaryByCity(cityInputId, summaryId) {
  const city = document.getElementById(cityInputId)?.value || '';
  const summary = document.getElementById(summaryId);
  if (!summary) return;
  const cart = getCart();
  const result = renderOrderSummaryRows(cart, city);
  summary.innerHTML = result.html;
  return result;
}

function initDeliveryZones() {
  const el = document.getElementById('delivery-zones');
  if (el) el.innerHTML = renderDeliveryZonesBlock();
}
