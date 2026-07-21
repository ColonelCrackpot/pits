'use strict';
// ============================== ads (stub until launch) ==============================
const Ads = (() => {
  const CONSENT_KEY = 'pits_ad_consent';
  const Consent = {
    get() { try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(CONSENT_KEY, v); } catch (e) {} },
    chosen() { const v = Consent.get(); return v === 'granted' || v === 'npa'; },
  };
  function loadAdSense() {
    if (!ADS_CFG.web.adsenseClient || document.getElementById('adsbygoogle-js')) return;
    if (Consent.get() === 'npa') (window.adsbygoogle = window.adsbygoogle || []).requestNonPersonalizedAds = 1;
    const s = document.createElement('script');
    s.id = 'adsbygoogle-js'; s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(ADS_CFG.web.adsenseClient);
    document.head.appendChild(s);
  }
  function ensureConsent() {
    if (!ADS_CFG.web.adsenseClient) return;
    if (Consent.chosen()) { loadAdSense(); return; }
    const bar = document.createElement('div');
    bar.className = 'consent-bar';
    bar.innerHTML =
      `<span>INTO THE PITS is free thanks to ads. Choose how Google may use your data —
        <a href="privacy.html" target="_blank" rel="noopener">privacy policy</a>.</span>
      <span>
        <button class="consent-btn ok">Personalized ads</button>
        <button class="consent-btn no">Non-personalized</button>
      </span>`;
    const choose = v => { Consent.set(v); bar.remove(); loadAdSense(); };
    bar.querySelector('.ok').addEventListener('click', () => choose('granted'));
    bar.querySelector('.no').addEventListener('click', () => choose('npa'));
    document.body.appendChild(bar);
  }
  const adBreak = o => (window.adsbygoogle = window.adsbygoogle || []).push(o);
  const live = () => !!(ADS_CFG.web.live && ADS_CFG.web.adsenseClient);
  const isWideDesktop = () => window.matchMedia('(min-width: 1480px)').matches;
  let lastInterstitial = 0;
  function ensureRail(side) {
    let el = document.getElementById('adRail-' + side);
    if (!el) {
      el = document.createElement('div');
      el.id = 'adRail-' + side;
      el.className = 'ad-rail ad-rail-' + side;
      document.body.appendChild(el);
    }
    el.style.display = isWideDesktop() ? 'flex' : 'none';
    return el;
  }
  return {
    init() {
      ensureConsent();
      if (live() && ADS_CFG.web.h5) adBreak({ preloadAdBreaks: 'on', sound: 'on' });
      this.mountSideBanner();
      window.addEventListener('resize', () => {
        if (isWideDesktop()) this.mountSideBanner();
        else ['left', 'right'].forEach(s => {
          const r = document.getElementById('adRail-' + s);
          if (r) r.style.display = 'none';
        });
      });
    },
    hasRewarded() { return live() ? Consent.chosen() : true; },
    showRewarded({ onReward, onClose } = {}) {
      if (!live()) {
        console.log('[ads:stub] rewarded — granting (no real ad served)');
        setTimeout(() => { onReward && onReward(); onClose && onClose(); }, 900);
        return;
      }
      if (!Consent.chosen()) { onClose && onClose(); return; }
      let closed = false;
      const done = () => { if (!closed) { closed = true; onClose && onClose(); } };
      setTimeout(done, 20000);
      adBreak({
        type: 'reward', name: 'double-cred',
        beforeReward(showAdFn) { showAdFn(); },
        adViewed() { onReward && onReward(); },
        adBreakDone() { done(); },
      });
    },
    showInterstitial(tag) {
      const now = Date.now();
      if (now - lastInterstitial < ADS_CFG.interstitialMinGap * 1000) return false;
      lastInterstitial = now;
      if (!live()) { console.log('[ads:stub] interstitial', tag || ''); return true; }
      if (ADS_CFG.web.h5) adBreak({ type: 'next', name: tag || 'break' });
      return true;
    },
    mountSideBanner() {
      if (!isWideDesktop()) return;
      for (const side of ['left', 'right']) {
        const rail = ensureRail(side);
        if (rail.dataset.mounted) continue;
        rail.dataset.mounted = 'yes';
        if (live() && ADS_CFG.web.sideBannerSlot) {
          rail.innerHTML = '';
          const ins = document.createElement('ins');
          ins.className = 'adsbygoogle';
          ins.style.cssText = 'display:inline-block;width:160px;height:600px';
          ins.setAttribute('data-ad-client', ADS_CFG.web.adsenseClient);
          ins.setAttribute('data-ad-slot', ADS_CFG.web.sideBannerSlot);
          rail.appendChild(ins);
          try { adBreak({}); } catch (e) {}
        } else {
          rail.innerHTML = '<div class="ad-ph">ad</div>';
        }
      }
    },
  };
})();
Ads.init();
