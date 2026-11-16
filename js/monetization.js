// =============================================================================
// CAMADA DE MONETIZAÇÃO (REWARDED ADS, LOJA DE PACOTES, PASSE VIP E CHECKOUT)
// Pronta para plugar Google AdSense H5 Games (adBreak), AdMob, Stripe ou Mercado Pago.
// =============================================================================

import { dom } from './dom.js';
import { state, upgrades } from './state.js';
import { saveProgressState } from './storage.js';
import { syncProgressUI } from './ui.js';

const STORAGE_MONETIZATION_KEY = 'operacao_24h_voo_fuga_monetization_v1';
const GARAGE_AD_COOLDOWN_MS = 60000;
const DAILY_REWARDS = [15, 20, 35, 45, 60, 80, 120];

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const STORE_PACKS = [
  {
    id: 'pack_stars_150',
    icon: '⭐',
    badge: 'Popular',
    title: '150 Estrelas',
    desc: 'Acelere upgrades de Frota, Motor e Blindagem.',
    priceLabel: 'R$ 4,90',
    stars: 150,
    oneTime: false,
    checkoutUrl: '' // Opcional: cole aqui seu link Stripe / Mercado Pago
  },
  {
    id: 'pack_stars_500',
    icon: '💰',
    badge: 'Melhor Valor',
    title: '500 Estrelas',
    desc: 'Evolua todos os equipamentos e veículos rapidamente.',
    priceLabel: 'R$ 12,90',
    stars: 500,
    oneTime: false,
    checkoutUrl: ''
  },
  {
    id: 'remove_ads',
    icon: '🚫',
    badge: 'Vitalício',
    title: 'Remover Anúncios + 100 ★',
    desc: 'Resgate recompensas instantâneas sem assistir vídeos.',
    priceLabel: 'R$ 9,90',
    stars: 100,
    oneTime: true,
    grantsRemoveAds: true,
    checkoutUrl: ''
  },
  {
    id: 'vip_pass',
    icon: '👑',
    badge: 'Supremo',
    title: 'Passe VIP Ouro + 300 ★',
    desc: 'Frota máxima desbloqueada + Sem Anúncios + 300 ★.',
    priceLabel: 'R$ 19,90',
    stars: 300,
    oneTime: true,
    grantsRemoveAds: true,
    grantsVipPass: true,
    checkoutUrl: ''
  }
];

export const monetization = {
  removeAds: false,
  vipPass: false,
  purchasedIds: [],
  lastGarageAdAt: 0,
  lastDailyClaimDate: '',
  dailyStreak: 0,
  vipTrialActive: false,
  revivedThisRun: false,
  doubledStarsThisRun: false
};

let pendingCheckoutPack = null;
let onReviveHandler = null;

export function registerReviveHandler(fn) {
  onReviveHandler = fn;
}

export function loadMonetizationState() {
  try {
    const raw = localStorage.getItem(STORAGE_MONETIZATION_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    monetization.removeAds = Boolean(parsed.removeAds);
    monetization.vipPass = Boolean(parsed.vipPass);
    monetization.purchasedIds = Array.isArray(parsed.purchasedIds) ? parsed.purchasedIds : [];
    monetization.lastGarageAdAt = Number(parsed.lastGarageAdAt) || 0;
    monetization.lastDailyClaimDate = typeof parsed.lastDailyClaimDate === 'string' ? parsed.lastDailyClaimDate : '';
    monetization.dailyStreak = Math.max(0, Math.min(6, Number(parsed.dailyStreak) || 0));
  } catch (e) {}
}

export function saveMonetizationState() {
  try {
    localStorage.setItem(STORAGE_MONETIZATION_KEY, JSON.stringify({
      removeAds: monetization.removeAds,
      vipPass: monetization.vipPass,
      purchasedIds: monetization.purchasedIds,
      lastGarageAdAt: monetization.lastGarageAdAt,
      lastDailyClaimDate: monetization.lastDailyClaimDate,
      dailyStreak: monetization.dailyStreak
    }));
  } catch (e) {}
}

export function canClaimDailyReward() {
  return monetization.lastDailyClaimDate !== getTodayKey();
}

export function claimDailyReward() {
  if (!canClaimDailyReward()) return false;
  const reward = DAILY_REWARDS[monetization.dailyStreak] || 15;
  monetization.lastDailyClaimDate = getTodayKey();
  monetization.dailyStreak = (monetization.dailyStreak + 1) % DAILY_REWARDS.length;
  state.totalStars += reward;
  saveProgressState();
  saveMonetizationState();
  syncProgressUI();
  renderShopUI();
  return true;
}

export function resetRunMonetizationFlags() {
  monetization.revivedThisRun = false;
  monetization.doubledStarsThisRun = false;
}

export function hasVipFleetActive() {
  return monetization.vipPass || monetization.vipTrialActive;
}

export function showRewardedAd(placementLabel) {
  if (monetization.removeAds) {
    return Promise.resolve(true);
  }

  // 1) Hook customizado (ex: AdMob / Capacitor / Unity / AppWrapper)
  if (window.OP24H_AD_PROVIDER && typeof window.OP24H_AD_PROVIDER.showRewarded === 'function') {
    return Promise.resolve(window.OP24H_AD_PROVIDER.showRewarded(placementLabel)).then(Boolean).catch(() => false);
  }

  // 2) Google AdSense H5 Games (adBreak)
  if (typeof window.adBreak === 'function') {
    return new Promise((resolve) => {
      let rewarded = false;
      try {
        window.adBreak({
          type: 'reward',
          name: placementLabel,
          beforeReward: (showAdFn) => showAdFn(),
          adViewed: () => { rewarded = true; },
          adDismissed: () => resolve(false),
          afterAd: () => resolve(rewarded)
        });
      } catch (e) {
        resolve(false);
      }
    });
  }

  // 3) Fallback: Player de Anúncio Recompensado (5s) pronto para testes
  return new Promise((resolve) => {
    if (!dom.adOverlay) {
      resolve(true);
      return;
    }
    dom.adOverlay.classList.remove('hidden');
    if (dom.adPlacementText) dom.adPlacementText.textContent = placementLabel;
    let remaining = 5;
    if (dom.adCountdownText) dom.adCountdownText.textContent = `Recompensa em ${remaining}s...`;
    if (dom.adProgressBar) dom.adProgressBar.style.width = '10%';
    if (dom.btnSkipAdDemo) dom.btnSkipAdDemo.textContent = 'Cancelar';

    let finished = false;
    const cleanup = (ok) => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      dom.adOverlay.classList.add('hidden');
      if (dom.btnSkipAdDemo) dom.btnSkipAdDemo.removeEventListener('click', onCancel);
      resolve(ok);
    };

    const onCancel = (e) => {
      e.stopPropagation();
      cleanup(false);
    };
    if (dom.btnSkipAdDemo) dom.btnSkipAdDemo.addEventListener('click', onCancel);

    const timer = setInterval(() => {
      remaining -= 1;
      const pct = Math.min(100, Math.round(((5 - remaining) / 5) * 100));
      if (dom.adProgressBar) dom.adProgressBar.style.width = `${pct}%`;
      if (remaining > 0) {
        if (dom.adCountdownText) dom.adCountdownText.textContent = `Recompensa em ${remaining}s...`;
      } else {
        if (dom.adCountdownText) dom.adCountdownText.textContent = 'Recompensa liberada!';
        setTimeout(() => cleanup(true), 250);
      }
    }, 1000);
  });
}

function applyPackReward(pack) {
  if (pack.stars > 0) {
    state.totalStars += pack.stars;
  }
  if (pack.grantsRemoveAds) {
    monetization.removeAds = true;
  }
  if (pack.grantsVipPass) {
    monetization.vipPass = true;
    upgrades.vehicleTier = 3;
  }
  if (pack.oneTime && !monetization.purchasedIds.includes(pack.id)) {
    monetization.purchasedIds.push(pack.id);
  }
  saveProgressState();
  saveMonetizationState();
  syncProgressUI();
  renderShopUI();
}

export function renderShopUI() {
  if (dom.shopTotalStars) {
    dom.shopTotalStars.textContent = String(state.totalStars);
  }
  if (dom.shopDailyTitle && dom.btnClaimDailyReward) {
    const canClaim = canClaimDailyReward();
    const dayNum = monetization.dailyStreak + 1;
    const reward = DAILY_REWARDS[monetization.dailyStreak] || 15;
    dom.shopDailyTitle.textContent = `🎁 Bônus Diário (Dia ${dayNum}/7)`;
    dom.btnClaimDailyReward.disabled = !canClaim;
    dom.btnClaimDailyReward.textContent = canClaim ? `Resgatar +${reward} ★` : '✓ Resgatado hoje';
  }
  if (dom.btnShopAdStars) {
    const waitMs = Math.max(0, GARAGE_AD_COOLDOWN_MS - (Date.now() - monetization.lastGarageAdAt));
    const ready = monetization.removeAds || waitMs <= 0;
    dom.btnShopAdStars.disabled = !ready;
    dom.btnShopAdStars.textContent = ready
      ? (monetization.removeAds ? '🎁 Resgatar +25 ★' : '📺 Ver Anúncio (+25 ★)')
      : `⏳ Aguarde ${Math.ceil(waitMs / 1000)}s`;
  }
  if (dom.btnShopAdVipTrial) {
    const active = hasVipFleetActive();
    dom.btnShopAdVipTrial.disabled = active;
    dom.btnShopAdVipTrial.textContent = monetization.vipPass
      ? '👑 VIP Permanente Ativo'
      : monetization.vipTrialActive
        ? '✓ VIP Liberado (1 corrida)'
        : '📺 Testar Frota VIP (1 corrida)';
  }

  if (!dom.shopPacksList) return;
  dom.shopPacksList.innerHTML = '';
  for (const pack of STORE_PACKS) {
    const owned = pack.oneTime && monetization.purchasedIds.includes(pack.id);
    const card = document.createElement('div');
    card.className = owned
      ? 'rounded-2xl bg-emerald-500/15 border border-emerald-400/45 p-3 flex flex-col justify-between gap-2'
      : 'rounded-2xl bg-white/5 border border-white/10 p-3 flex flex-col justify-between gap-2';

    const top = document.createElement('div');
    top.className = 'flex items-start justify-between gap-2';
    top.innerHTML = `
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-lg shrink-0">${pack.icon}</span>
        <div class="min-w-0">
          <p class="text-[9px] font-black uppercase tracking-wider text-amber-300">${pack.badge}</p>
          <p class="text-xs font-extrabold text-white truncate">${pack.title}</p>
        </div>
      </div>
    `;

    const desc = document.createElement('p');
    desc.className = 'text-[10px] text-slate-300 leading-snug';
    desc.textContent = pack.desc;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.disabled = owned;
    btn.className = owned
      ? 'w-full rounded-xl bg-emerald-500/25 border border-emerald-400/40 py-1.5 px-2.5 text-[11px] font-black uppercase text-emerald-200 cursor-default'
      : 'w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 py-1.5 px-2.5 text-[11px] font-black uppercase text-slate-950 cursor-pointer transition';
    btn.textContent = owned ? '✓ Adquirido' : `Comprar • ${pack.priceLabel}`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      startPackPurchase(pack);
    });

    card.appendChild(top);
    card.appendChild(desc);
    card.appendChild(btn);
    dom.shopPacksList.appendChild(card);
  }
}

function startPackPurchase(pack) {
  if (pack.oneTime && monetization.purchasedIds.includes(pack.id)) return;

  // 1) Hook real de compra (Play Billing / Stripe / Mercado Pago)
  if (window.OP24H_IAP_PROVIDER && typeof window.OP24H_IAP_PROVIDER.purchase === 'function') {
    Promise.resolve(window.OP24H_IAP_PROVIDER.purchase(pack)).then((ok) => {
      if (ok) applyPackReward(pack);
    }).catch(() => {});
    return;
  }

  // 2) Link externo configurado (Stripe Payment Link / Mercado Pago)
  if (pack.checkoutUrl) {
    window.open(pack.checkoutUrl, '_blank', 'noopener');
    return;
  }

  // 3) Confirmação Sandbox para testes locais antes de plugar gateway
  pendingCheckoutPack = pack;
  if (dom.shopCheckoutBox && dom.shopCheckoutTitle) {
    dom.shopCheckoutTitle.textContent = `${pack.title} (${pack.priceLabel})`;
    dom.shopCheckoutBox.classList.remove('hidden');
  } else {
    applyPackReward(pack);
  }
}

export function confirmSandboxPurchase() {
  if (!pendingCheckoutPack) return;
  const pack = pendingCheckoutPack;
  pendingCheckoutPack = null;
  if (dom.shopCheckoutBox) dom.shopCheckoutBox.classList.add('hidden');
  applyPackReward(pack);
}

export function cancelSandboxPurchase() {
  pendingCheckoutPack = null;
  if (dom.shopCheckoutBox) dom.shopCheckoutBox.classList.add('hidden');
}

export function openShop() {
  pendingCheckoutPack = null;
  if (dom.shopCheckoutBox) dom.shopCheckoutBox.classList.add('hidden');
  renderShopUI();
  if (dom.shopOverlay) dom.shopOverlay.classList.remove('hidden');
}

export function closeShop() {
  pendingCheckoutPack = null;
  if (dom.shopCheckoutBox) dom.shopCheckoutBox.classList.add('hidden');
  if (dom.shopOverlay) dom.shopOverlay.classList.add('hidden');
}

export function syncGameOverAdUI(isMultiplayerMatch) {
  if (!dom.gameOverAdRow) return;
  const showRow = !isMultiplayerMatch && (!monetization.revivedThisRun || (!monetization.doubledStarsThisRun && state.runStars > 0));
  dom.gameOverAdRow.classList.toggle('hidden', !showRow);
  if (!showRow) return;

  if (dom.btnAdRevive) {
    dom.btnAdRevive.classList.toggle('hidden', monetization.revivedThisRun);
  }
  if (dom.btnAdDoubleStars) {
    const canDouble = !monetization.doubledStarsThisRun && state.runStars > 0;
    dom.btnAdDoubleStars.classList.toggle('hidden', !canDouble);
    if (canDouble) {
      dom.btnAdDoubleStars.textContent = `📺 2x Estrelas (+${state.runStars} ★)`;
    }
  }
}

export async function triggerAdRevive() {
  if (monetization.revivedThisRun) return;
  const ok = await showRewardedAd('Reviver na Fuga (+Escudo)');
  if (!ok) return;
  monetization.revivedThisRun = true;
  if (typeof onReviveHandler === 'function') {
    onReviveHandler();
  }
}

export async function triggerAdDoubleStars() {
  if (monetization.doubledStarsThisRun || state.runStars <= 0) return;
  const ok = await showRewardedAd(`Dobrar +${state.runStars} Estrelas`);
  if (!ok) return;
  monetization.doubledStarsThisRun = true;
  const bonus = state.runStars;
  state.totalStars += bonus;
  state.runStars += bonus;
  saveProgressState();
  syncProgressUI();
  if (dom.finalStatStars) {
    dom.finalStatStars.textContent = `+${state.runStars} ★ (2x!)`;
  }
  syncGameOverAdUI(false);
}

export async function triggerShopAdStars() {
  const waitMs = Math.max(0, GARAGE_AD_COOLDOWN_MS - (Date.now() - monetization.lastGarageAdAt));
  if (!monetization.removeAds && waitMs > 0) return;
  const ok = await showRewardedAd('Baú de +25 Estrelas');
  if (!ok) return;
  monetization.lastGarageAdAt = Date.now();
  state.totalStars += 25;
  saveProgressState();
  saveMonetizationState();
  syncProgressUI();
  renderShopUI();
}

export async function triggerShopAdVipTrial() {
  if (hasVipFleetActive()) return;
  const ok = await showRewardedAd('Test Drive Frota VIP (1 corrida)');
  if (!ok) return;
  monetization.vipTrialActive = true;
  renderShopUI();
}
