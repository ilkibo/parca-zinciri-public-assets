// BEGIN SHARED LISTING PRICING
const pzListingPricing = (() => {
// Each in-page screen participates in browser/WebView back and forward history.
function createScreenHistory({key, initial, navigate, win = window}) {
  let current = initial, index = 0, restoring = false, disposed = false;
  const previous = win.history.state?.[key];
  if (previous && Number.isSafeInteger(previous.index)) index = previous.index;
  function state(route, i) {return {...win.history.state, [key]:{route,index:i}};}
  win.history.replaceState(state(initial,index), '');
  async function pop(event) {
    const entry = event.state?.[key];
    if (disposed || !entry || !Number.isSafeInteger(entry.index)) return;
    if (JSON.stringify(entry.route) === JSON.stringify(current)) {index=entry.index;return;}
    const oldIndex=index;
    restoring=true;
    try {
      const accepted=await navigate(entry.route);
      if (accepted === false) {win.history.go(oldIndex-entry.index);return;}
      current=entry.route;index=entry.index;
    } finally {restoring=false;}
  }
  win.addEventListener('popstate',pop);
  return {
    record(route) {
      if (disposed || restoring || JSON.stringify(route)===JSON.stringify(current)) return;
      current=route;index++;win.history.pushState(state(route,index),'');
    },
    back(fallback) {if(index>0)win.history.back();else fallback?.();},
    dispose() {disposed=true;win.removeEventListener('popstate',pop);}
  };
}

// Shared admin UI; tools/sync-pricing-ui.mjs embeds this same source in Wix CE.
const priceEsc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const priceMoney = (minor, currency = 'EUR') => minor == null ? 'Belirtilmemiş' : new Intl.NumberFormat('tr-TR', {style:'currency', currency}).format(minor / 100);
const priceConditions = {new_unboxed:'Sıfır, kutusuz',new_boxed:'Sıfır, kutulu',used_good:'Kullanılmış, iyi durumda',repaired_working_good:'Tamir edilmiş, çalışır durumda',new:'Yeni',used:'Kullanılmış',refurbished:'Yenilenmiş',new_original:'Sıfır, orijinal',original_reconditioned:'Orijinal, revizyonlu'};
const priceStates = {pending:'Onay bekliyor', approved:'Onaylandı', rejected:'Reddedildi', draft:'Taslak', archived:'Arşivlendi'};
const priceCss = `<style>
.pz-pricing{background:#f3f6ee;padding:16px;border-radius:16px;color:#16372d;font:16px/1.5 system-ui,-apple-system,sans-serif;max-width:100%;overflow-wrap:anywhere}.pz-pricing *{box-sizing:border-box}.pz-pricing h2{font-size:1.35rem}.pz-pricing h3{font-size:1.1rem}.pz-pricing .pr-box{background:#fff;border:1px solid #d6dfd5;border-radius:14px;padding:18px;margin:14px 0}.pz-pricing .pr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}.pz-pricing label{display:block;font-weight:600}.pz-pricing input,.pz-pricing select{display:block;width:100%;min-height:46px;border:1px solid #b6c6b8;border-radius:8px;padding:10px;margin:6px 0 12px;font:inherit;background:#fff;color:#16372d}.pz-pricing button{border:1px solid #b6c6b8;border-radius:9px;padding:12px 16px;background:#f3f6ee;color:#16372d;cursor:pointer;font:inherit;margin:5px 8px 5px 0;min-height:44px}.pz-pricing button.primary{background:#d85e13;color:white;border-color:#d85e13}.pz-pricing button:disabled{opacity:.5;cursor:wait}.pz-pricing .pr-muted{color:#5a705f;font-size:.9em}.pz-pricing .pr-error{color:#a62e1d}.pz-pricing .pr-total{font-size:1.6rem;font-weight:700}.pz-pricing .pr-table{overflow-x:auto}.pz-pricing table{width:100%;border-collapse:collapse;font-size:.95em}.pz-pricing th,.pz-pricing td{background:#fff;color:#16372d;text-align:left;padding:10px;border-bottom:1px solid #d6dfd5;vertical-align:top}.pz-pricing .pr-photo{max-width:160px;max-height:140px;object-fit:contain}.pz-pricing .pr-result{border-left:4px solid #d85e13}.pz-pricing dt{color:#5a705f}.pz-pricing dd{margin:4px 0 14px;font-weight:600}
</style>`;
function fxText(fx) {return fx ? `TCMB EUR döviz satış · ${priceEsc(fx.date)} · 1 EUR = ${priceEsc(fx.rate.toLocaleString('tr-TR', {minimumFractionDigits:4}))} TL` : 'TCMB kuru alınamadı. EUR ve yüzdelik komisyon kullanılabilir; TL komisyon için tekrar deneyin.';}
function offerTable(items) {
  if (!items.length) return '<p>Bu aramada ürün bulunamadı.</p>';
  return `<div class="pr-table"><table><thead><tr><th>Firma / ürün</th><th>Stok</th><th>satıcı fiyatı</th><th>Satış fiyatı</th><th>Durum / işlem</th></tr></thead><tbody>${items.map(p => `<tr><td><strong>${priceEsc(p.companyName)}</strong><br>${priceEsc(p.title)}<br>Kod: ${priceEsc(p.productCode || 'Diğer')}<br><small>${priceEsc(p.brand)} · ${priceEsc(priceConditions[p.condition] || 'Durum belirtilmemiş')}<br>${priceEsc(p.sellerNumber)}</small></td><td>${priceEsc(p.stockQuantity)} adet</td><td>${priceMoney(p.priceEur == null ? null : Math.round(p.priceEur * 100))}</td><td>${p.pricing ? priceMoney(p.pricing.saleMinor) : 'Henüz belirlenmedi'}</td><td>${priceEsc(priceStates[p.status] || p.status)}<br><button type="button" data-review-key="${priceEsc(p.listingKey)}">İncele / fiyatlandır</button></td></tr>`).join('')}</tbody></table></div>`;
}
async function mountListingReview(root, options) {
  const {api, listingKey, onBack, onApproved} = options;
  root.innerHTML = priceCss + '<div class="pz-pricing"><p role="status">Ürün ve TCMB kuru yükleniyor…</p></div>';
  try {
    const result = await api('getListingReview', {listingKey});
    if (!root.isConnected) return;
    options.onNavigate?.(listingKey);
    const p = result.listing, editable = ['pending', 'approved'].includes(p.status);
    root.innerHTML = priceCss + `<div class="pz-pricing">${onBack ? '<button type="button" data-back>← Ürün onayları ve arama</button>' : ''}<h2>${priceEsc(p.title)}</h2><div class="pr-box"><div class="pr-grid"><div>${/^https:\/\//.test(p.imageUrl) ? `<img class="pr-photo" src="${priceEsc(p.imageUrl)}" alt="${priceEsc(p.title)}">` : ''}<strong>${priceEsc(p.companyName)}</strong><p class="pr-muted">${priceEsc(p.sellerNumber)}</p></div><dl><dt>Parça kodu</dt><dd>${priceEsc(p.productCode || 'Belirtilmemiş — Diğer')}</dd><dt>OEM / referans</dt><dd>${priceEsc(p.oem || 'Belirtilmemiş')}</dd></dl><dl><dt>satıcı birim fiyatı</dt><dd>${priceMoney(p.priceEur == null ? null : Math.round(p.priceEur * 100))}</dd><dt>Stok / durum</dt><dd>${priceEsc(p.stockQuantity)} adet · ${priceEsc(priceStates[p.status] || p.status)}</dd></dl></div><p>${priceEsc(p.description)}</p><p class="pr-muted">Eklenme: ${priceEsc(p.createdAt ? new Date(p.createdAt).toLocaleString('tr-TR') : '—')}</p></div>
    <section class="pr-box"><h3>Aynı kod hangi satıcılarda var?</h3><form data-compare><label>Parça kodu<input name="productCode" required maxlength="80" value="${priceEsc(p.productCode)}" placeholder="Örneğin 18461"></label><button type="submit">satıcı fiyatlarını karşılaştır</button></form><p class="pr-muted">Kodun tamamı eşleşmelidir; boşluk ve noktalama farkları yok sayılır. Marka ve parça durumunu da karşılaştırın. Fiyatlar yalnızca yönetime gösterilir.</p><div data-offers aria-live="polite"></div></section>
    ${p.pricing ? `<section class="pr-box"><h3>Kaydedilmiş fiyat</h3><p>satıcı: ${priceMoney(p.pricing.supplierMinor)} · Komisyon: ${priceMoney(p.pricing.commissionMinor)}</p><p class="pr-total">Satış: ${priceMoney(p.pricing.saleMinor)}</p><p class="pr-muted">${p.pricing.fx ? fxText(p.pricing.fx) : 'EUR hesabı'} · ${priceEsc(p.pricing.approvedAt || '')}</p></section>` : ''}
    ${editable ? `<section class="pr-box"><h3>${p.status === 'approved' ? 'Komisyonu ve satış fiyatını güncelle' : 'Komisyon ve ürün onayı'}</h3><p>Komisyon, satıcı birim fiyatının üzerine eklenir.</p><form data-pricing><div class="pr-grid"><label>Komisyon türü<select name="mode"><option value="percent">Yüzde (%)</option><option value="fixed_eur">Sabit tutar (EUR)</option><option value="fixed_try">Sabit tutar (TL)</option></select></label><label><span data-value-label>Komisyon oranı (%)</span><input name="value" type="text" inputmode="decimal" required placeholder="Örneğin 10" autocomplete="off"></label></div><p class="pr-muted" data-fx>${fxText(result.fx)}</p><button type="submit">Satış fiyatını hesapla</button></form><div data-preview aria-live="polite"></div><p data-status role="status"></p></section>` : '<p>Bu durumdaki ürün için onay işlemi kullanılamaz.</p>'}${p.status === 'pending' ? '<details class="pr-box"><summary>Ürünü reddet</summary><form data-reject><label>Ret gerekçesi<input name="reason" required maxlength="500" placeholder="Satıcıya bildirilecek gerekçe"></label><button type="submit">Gerekçeyle reddet</button><p role="status"></p></form></details>' : ''}</div>`;
    root.querySelector('[data-back]')?.addEventListener('click', onBack);
    if (p.media?.length) {
      const gallery = document.createElement('div');gallery.className = 'pr-box pr-grid';
      gallery.innerHTML = p.media.filter(m => /^https:\/\//.test(m.url)).map(m => String(m.mime).startsWith('video/') ? `<video style="max-width:100%;max-height:280px" controls preload="metadata" src="${priceEsc(m.url)}"></video>` : `<a href="${priceEsc(m.url)}" target="_blank" rel="noopener"><img style="max-width:100%;max-height:220px;object-fit:contain" src="${priceEsc(m.url)}" alt="${priceEsc(p.title)}"></a>`).join('');
      root.querySelector('.pr-box').after(gallery);
    }
    const offers = root.querySelector('[data-offers]'), compare = root.querySelector('[data-compare]');
    let compareVersion = 0;
    const search = async (offset = 0, append = false) => {
      const version = ++compareVersion, code = compare.elements.productCode.value.trim();
      if (!append) offers.textContent = 'satıcılar aranıyor…';
      try {
        const r = await api('searchListingOffers', {productCode:code, offset});
        if (version !== compareVersion || !root.isConnected) return;
        if (!append) offers.innerHTML = '';
        offers.querySelector('[data-more]')?.remove();
        offers.insertAdjacentHTML('beforeend', offerTable(r.items) + (r.nextOffset !== null ? '<button type="button" data-more>Diğer sonuçları getir</button>' : ''));
        offers.querySelector('[data-more]')?.addEventListener('click', () => search(r.nextOffset, true));
        offers.querySelectorAll('[data-review-key]').forEach(b => b.onclick = () => mountListingReview(root, {...options, listingKey:b.dataset.reviewKey}));
      } catch (e) {if (version === compareVersion) offers.textContent = e.message;}
    };
    compare.onsubmit = e => {e.preventDefault();if (compare.reportValidity()) search();};
    if (p.productCode) search();
    const form = root.querySelector('[data-pricing]');
    if (!form) return;
    const preview = root.querySelector('[data-preview]'), status = root.querySelector('[data-status]');
    let snapshot = null, requestVersion = 0, approving = false;
    const rejectForm = root.querySelector('[data-reject]');
    if (rejectForm) rejectForm.onsubmit = async e => {
      e.preventDefault();if (approving || !rejectForm.reportValidity()) return;
      approving = true; const b = rejectForm.querySelector('button'), msg = rejectForm.querySelector('p');b.disabled = true;msg.textContent = 'Kaydediliyor…';
      try {await api('rejectReviewedListing', {listingKey, reason:rejectForm.elements.reason.value});await mountListingReview(root, options);onApproved?.();}
      catch (err) {msg.textContent = err.message;b.disabled = false;}
      finally {approving = false;}
    };
    if (p.pricing) {form.elements.mode.value = p.pricing.mode;form.elements.value.value = p.pricing.value;}
    const invalidate = () => {
      snapshot = null; requestVersion++; preview.innerHTML = ''; status.textContent = '';
      root.querySelector('[data-value-label]').textContent = {percent:'Komisyon oranı (%)', fixed_eur:'Eklenecek komisyon (EUR)', fixed_try:'Eklenecek komisyon (TL)'}[form.elements.mode.value];
    };
    form.addEventListener('input', invalidate);form.addEventListener('change', invalidate);invalidate();
    form.onsubmit = async e => {
      e.preventDefault(); if (approving || !form.reportValidity()) return;
      snapshot = null; preview.innerHTML = ''; const version = ++requestVersion;
      const button = form.querySelector('button');button.disabled = true;status.textContent = 'Satış fiyatı hesaplanıyor…';
      try {
        const s = await api('previewListingPrice', {listingKey, mode:form.elements.mode.value, value:form.elements.value.value});
        if (version !== requestVersion || !root.isConnected) return;
        snapshot = s; status.textContent = '';
        preview.innerHTML = `<div class="pr-box pr-result"><p>satıcı fiyatı: <strong>${priceMoney(s.supplierMinor)}</strong></p><p>Eklenecek komisyon: <strong>${priceMoney(s.commissionMinor)}</strong>${s.mode === 'fixed_try' ? ` (${priceMoney(Math.round(s.value * 100), 'TRY')})` : s.mode === 'percent' ? ` (%${priceEsc(s.value)})` : ''}</p><p class="pr-total">Satış fiyatı: ${priceMoney(s.saleMinor)}</p>${s.fx ? `<p>TL karşılığı: ${priceMoney(Math.round(s.saleMinor * s.fx.rate), 'TRY')}</p><p class="pr-muted">${fxText(s.fx)}</p>` : ''}<p class="pr-muted">Birim fiyat. EUR tutarı iki ondalığa yuvarlanır. Bu hesap 15 dakika geçerlidir; kaydedilen EUR fiyatı kur değişince kendiliğinden değişmez.</p><button type="button" class="primary" data-confirm>${p.status === 'approved' ? 'Bu fiyatla güncelle' : 'Bu fiyatla onayla ve yayınla'}</button></div>`;
        preview.querySelector('[data-confirm]').onclick = async event => {
          if (!snapshot || approving) return;
          approving = true; event.target.disabled = true;Array.from(form.elements).forEach(el => el.disabled = true);
          status.textContent = 'Fiyat kaydediliyor ve ürün yayınlanıyor…';
          try {
            await api('approvePricedListing', {listingKey, previewId:snapshot.previewId});
            if (!root.isConnected) return;
            await mountListingReview(root, options);
            const message = document.createElement('p');message.setAttribute('role', 'status');message.textContent = 'Fiyat kaydedildi. Ürün onaylandı ve katalog güncellendi.';
            root.querySelector('.pz-pricing').prepend(message);onApproved?.();
          } catch (err) {
            status.textContent = err.message + ' Sonuç belirsizse aynı onay düğmesiyle tekrar deneyebilirsiniz.';status.className = 'pr-error';
            event.target.disabled = false;Array.from(form.elements).forEach(el => el.disabled = false);
          } finally {approving = false;}
        };
      } catch (err) {if (version === requestVersion) {status.textContent = err.message; status.className = 'pr-error';}}
      finally {button.disabled = false;}
    };
  } catch (e) {
    root.innerHTML = priceCss + '<div class="pz-pricing"><p role="alert">' + priceEsc(e.message) + '</p><button data-retry>Tekrar dene</button></div>';
    root.querySelector('[data-retry]').onclick = () => mountListingReview(root, options);
  }
}
function mountListingWorkbench(root, {api, initialKey = '', onApproved, onNavigate, onBack}) {
  if (initialKey) return mountListingReview(root, {api, listingKey:initialKey, onApproved, onNavigate, onBack:onBack || (() => mountListingWorkbench(root, {api, onApproved, onNavigate, onBack}))});
  onNavigate?.('');
  root.innerHTML = priceCss + `<div class="pz-pricing"><p>Ürünleri inceleyin, satıcı fiyatlarını karşılaştırın ve komisyon ekleyerek onaylayın.</p><form data-search class="pr-box"><div class="pr-grid"><label>Parça koduyla ara<input name="productCode" maxlength="80" placeholder="Örneğin 18461"></label><label>Durum<select name="status"><option value="pending">Onay bekleyenler</option><option value="">Tüm durumlar</option><option value="approved">Onaylananlar</option><option value="rejected">Reddedilenler</option></select></label></div><button type="submit">Ara / yenile</button><p class="pr-muted">Kod yazıldığında tüm satıcıların panele eklediği ürünlerde tam kod eşleşmesi aranır. Firma, stok ve fiyat bilgileri yalnızca yönetim içindir.</p></form><div data-results aria-live="polite"></div></div>`;
  const form = root.querySelector('[data-search]'), output = root.querySelector('[data-results]');let version = 0;
  form.elements.productCode.addEventListener('input', () => {if (form.elements.productCode.value.trim()) form.elements.status.value = '';});
  async function search(offset = 0, append = false) {
    const ticket = ++version;
    if (!append) output.textContent = 'Ürünler yükleniyor…';
    try {
      const result = await api('searchListingOffers', {productCode:form.elements.productCode.value, status:form.elements.status.value, offset});
      if (ticket !== version || !root.isConnected) return;
      if (!append) output.innerHTML = '';
      output.querySelector('[data-more]')?.remove();
      output.insertAdjacentHTML('beforeend', offerTable(result.items) + (result.nextOffset !== null ? '<button data-more>Diğer ürünleri getir</button>' : ''));
      output.querySelector('[data-more]')?.addEventListener('click', () => search(result.nextOffset, true));
      output.querySelectorAll('[data-review-key]').forEach(b => b.onclick = () => mountListingWorkbench(root, {api, initialKey:b.dataset.reviewKey, onApproved, onNavigate, onBack}));
    } catch (e) {if (ticket === version) output.textContent = e.message;}
  }
  form.onsubmit = e => {e.preventDefault(); search();}; search();
}

return {mountListingReview, mountListingWorkbench, createScreenHistory};
})();
// END SHARED LISTING PRICING
/* ============================================================
   PARÇA ZİNCİRİ — parca-zinciri-admin-console
   B2B-2C admin operations console (fullscreen app shell)
   Runtime: production path never enables fixture mode.
   Never leave the host blank: sync first paint + boot watchdog.
   ============================================================ */
(function () {
  "use strict";

  // Visible surface before upgrade completes (script has loaded; define may be next tick).
  try {
    if (typeof document !== "undefined" && !document.getElementById("pz-admin-ce-pending")) {
      var pending = document.createElement("style");
      pending.id = "pz-admin-ce-pending";
      pending.textContent =
        "parca-zinciri-admin-console:not(:defined){" +
        "display:block!important;min-height:100vh;width:100%;box-sizing:border-box;" +
        "background:#0B0B0B;color:#F2F2F0;padding:48px 28px;font-family:system-ui,sans-serif}" +
        "parca-zinciri-admin-console:not(:defined)::before{" +
        "content:'Yönetici Aktivasyonu';display:block;font-size:28px;font-weight:700;margin:0 0 12px}" +
        "parca-zinciri-admin-console:not(:defined)::after{" +
        "content:'Yönetim konsolu hazırlanıyor…';display:block;color:#A7A7A0;font-size:15px}";
      (document.head || document.documentElement).appendChild(pending);
    }
  } catch (pendingErr) {
    // ignore
  }

  if (typeof customElements === "undefined") return;
  if (customElements.get("parca-zinciri-admin-console")) return;

  var FONT_HREF =
    "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,600;125,700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap";

  var OBSERVED_ATTRS = [
    "pzstate",
    "data-pz-state",
    "data-pz-portal-auth",
    "pzportalauth",
    "data-pz-portal-api-result",
    "pzportalapiresult",
    "data-pz-portal-bridge-ready",
    "data-pz-admin-cockpit"
  ];
  var BOOT_WATCHDOG_MS = 8000;
  var AUTH_STORAGE_KEY = "pz_yonetim_auth_v1";
  var AUTH_STORAGE_MAX_AGE_MS = 120000;

  var MARK =
    '<svg class="pz-mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 84" aria-hidden="true"><g transform="translate(-15,-18)"><path fill="#FF6B00" fill-rule="evenodd" d="M65,18 L77,30 L77,48 L93,48 L105,60 L105,90 L93,102 L55,102 L43,90 L43,72 L27,72 L15,60 L15,30 L27,18ZM69,45 L51,45 L45,51 L45,69 L51,75 L69,75 L75,69 L75,51Z"/></g></svg>';

  var MODULES = [
    { id: "overview", label: "Genel Bakış" },
    { id: "orders", label: "Siparişler" },
    { id: "suppliers", label: "satıcılar" },
    { id: "accounts", label: "Cari Hesaplar" },
    { id: "settlements", label: "Hakedişler" },
    { id: "payments", label: "Ödemeler" },
    { id: "commission", label: "Komisyon" },
    { id: "audit", label: "Denetim" }
  ];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function moneyMinor(minor, cur) {
    var v = (Number(minor) || 0) / 100;
    try {
      return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: cur || "TRY",
        maximumFractionDigits: 2
      }).format(v);
    } catch (e) {
      return v.toFixed(2) + " " + (cur || "TRY");
    }
  }

  function ensureFonts() {
    if (document.getElementById("pz-admin-fonts")) return;
    var link = document.createElement("link");
    link.id = "pz-admin-fonts";
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }

  function css() {
    return `
:host{display:block;width:100%;min-height:100vh;box-sizing:border-box}
*,*:before,*:after{box-sizing:border-box}
:host{
  --void:#0B0B0B; --plate:#111; --raise:#161616; --elev:#1C1C1C;
  --line:rgba(255,255,255,.06); --line-2:rgba(255,255,255,.10); --line-3:rgba(255,255,255,.16);
  --text:#F2F2F0; --mid:#A7A7A0; --dim:#6F6F68;
  --accent:#FF6B00; --accent-soft:rgba(255,107,0,.12); --accent-line:rgba(255,107,0,.42);
  --ok:#3DDC97; --warn:#F5C542; --danger:#FF5C5C; --info:#5BA4FF;
  --sans:"IBM Plex Sans",system-ui,sans-serif; --mono:"IBM Plex Mono",ui-monospace,monospace;
  --display:"Archivo",sans-serif; --ease:cubic-bezier(.2,.8,.2,1);
  --radius:10px; --sidebar:248px;
  font-family:var(--sans); color:var(--text); background:var(--void);
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
.shell{min-height:100vh;display:grid;grid-template-columns:var(--sidebar) 1fr;background:var(--void)}
.shell.activation{grid-template-columns:minmax(200px,248px) 1fr}
@media (max-width:1024px){.shell{grid-template-columns:1fr}.shell.activation{grid-template-columns:1fr}.nav{position:fixed;inset:0 auto 0 0;transform:translateX(-105%);z-index:40;width:min(86vw,280px);transition:transform .25s var(--ease)}.nav.open{transform:none}.scrim{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:30}.scrim.show{display:block}}
.nav{background:linear-gradient(180deg,#101010,#0C0C0C);border-right:1px solid var(--line-2);padding:22px 16px;display:flex;flex-direction:column;gap:18px}
.brand{display:flex;align-items:center;gap:12px}
.pz-mark{width:34px;height:32px;flex:0 0 auto}
.brand h1{font-family:var(--display);font-stretch:125%;font-size:15px;letter-spacing:.04em;margin:0;line-height:1.15}
.brand small{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin-top:4px}
.nav-list{display:flex;flex-direction:column;gap:4px;margin-top:8px}
.nav-btn{appearance:none;border:1px solid transparent;background:transparent;color:var(--mid);text-align:left;padding:11px 12px;border-radius:8px;font:500 13px/1.2 var(--sans);cursor:pointer}
.nav-btn:hover,.nav-btn:focus-visible{outline:2px solid var(--accent-line);outline-offset:1px;color:var(--text);background:rgba(255,255,255,.03)}
.nav-btn[aria-current="page"]{color:var(--text);border-color:var(--accent-line);background:var(--accent-soft)}
.main{min-width:0;display:flex;flex-direction:column}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid var(--line);background:rgba(11,11,11,.92);position:sticky;top:0;z-index:10;backdrop-filter:blur(8px)}
.menu{display:none;border:1px solid var(--line-2);background:var(--raise);color:var(--text);border-radius:8px;padding:8px 10px;font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase}
@media (max-width:1024px){.menu{display:inline-flex}}
.title{font-family:var(--display);font-stretch:125%;font-size:22px;margin:0}
.sub{color:var(--mid);font-size:13px;margin-top:4px}
.content{padding:20px clamp(14px,3vw,28px) 40px;display:flex;flex-direction:column;gap:18px}
.grid{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr))}
@media (max-width:1200px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:640px){.grid{grid-template-columns:1fr}}
.metric{background:var(--plate);border:1px solid var(--line-2);border-radius:var(--radius);padding:14px 14px 12px;min-height:96px}
.metric .k{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.metric .v{font-family:var(--display);font-stretch:125%;font-size:24px;margin-top:10px}
.metric .h{font-size:12px;color:var(--mid);margin-top:8px}
.panel{background:var(--plate);border:1px solid var(--line-2);border-radius:var(--radius);overflow:hidden}
.panel-h{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line)}
.panel-h h2{margin:0;font-size:14px;font-weight:600}
.toolbar{display:flex;flex-wrap:wrap;gap:8px;padding:12px 16px;border-bottom:1px solid var(--line)}
.field{display:flex;flex-direction:column;gap:6px;min-width:140px;flex:1}
.field label{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.field input,.field select{border:1px solid var(--line-2);background:#141414;color:var(--text);border-radius:8px;min-height:38px;padding:0 10px;font:13px var(--sans)}
.field input:focus,.field select:focus{outline:2px solid var(--accent-line);border-color:var(--accent-line)}
.btn{appearance:none;border:1px solid var(--line-2);background:var(--raise);color:var(--text);border-radius:8px;min-height:38px;padding:0 12px;font:500 13px var(--sans);cursor:pointer}
.btn:focus-visible{outline:2px solid var(--accent-line);outline-offset:1px}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#111;font-weight:600}
.btn.ghost{background:transparent}
.table-wrap{overflow:auto}
table{width:100%;border-collapse:collapse;min-width:720px}
th,td{padding:11px 12px;border-bottom:1px solid var(--line);text-align:left;font-size:13px;vertical-align:top}
th{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);background:#101010;position:sticky;top:0}
tr:hover td{background:rgba(255,255,255,.02)}
.chip{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:999px;border:1px solid var(--line-2);font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--mid)}
.chip.ok{color:#9AF0C8;border-color:rgba(61,220,151,.35)}
.chip.warn{color:#FFE08A;border-color:rgba(245,197,66,.35)}
.chip.danger{color:#FF9B9B;border-color:rgba(255,92,92,.35)}
.chip.info{color:#A9D0FF;border-color:rgba(91,164,255,.35)}
.state{min-height:52vh;display:grid;place-items:center;text-align:center;padding:40px 20px;color:var(--mid)}
.state h3{color:var(--text);font-family:var(--display);font-stretch:125%;margin:0 0 8px}
.cards{display:none;gap:10px;padding:12px}
@media (max-width:768px){table{min-width:0}.desktop-only{display:none}.cards{display:grid}.card{border:1px solid var(--line-2);border-radius:10px;padding:12px;background:var(--raise)}.card .row{display:flex;justify-content:space-between;gap:8px;margin:6px 0;font-size:13px}}
.drawer{position:fixed;inset:0;z-index:50;display:none}
.drawer.open{display:block}
.drawer .bg{position:absolute;inset:0;background:rgba(0,0,0,.58)}
.drawer .panel{position:absolute;top:0;right:0;height:100%;width:min(560px,100%);background:#101010;border-left:1px solid var(--line-2);overflow:auto;transform:translateX(0);border-radius:0}
.drawer-h{display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid var(--line)}
.drawer-b{padding:16px;display:flex;flex-direction:column;gap:14px}
.kv{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.kv div{background:var(--raise);border:1px solid var(--line);border-radius:8px;padding:10px}
.kv .k{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.kv .v{margin-top:6px;font-size:14px;word-break:break-word}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
`;
  }

  function chipClass(status) {
    var s = String(status || "").toLowerCase();
    if (/paid|active|delivered|succeeded|approved|ok/.test(s)) return "ok";
    if (/pending|held|processing|preparing|draft|calculated/.test(s)) return "warn";
    if (/failed|rejected|cancelled|suspended|danger/.test(s)) return "danger";
    return "info";
  }

  function isLegacyAdminMode(el) {
    // /yonetim is an activation entry point, not a second password database.
    // Always render the Wix-member activation surface first.  The portal ops
    // cockpit can only be reached after its own server-side entitlement is
    // intentionally enabled; it must never become the anonymous login UI.
    return !el || el.getAttribute("data-pz-admin-cockpit") !== "ops-v1";
  }

  function ensureOpsScript() {
    if (customElements.get("parca-zinciri-admin-ops")) return;
    if (document.getElementById("pz-admin-ops-src")) return;
    var src = "";
    try {
      var scripts = document.getElementsByTagName("script");
      for (var i = 0; i < scripts.length; i++) {
        var u = String(scripts[i].src || "");
        if (u.indexOf("parca-zinciri-admin-console") >= 0) {
          src = u.replace(/parca-zinciri-admin-console\.js(\?.*)?$/, "parca-zinciri-admin-ops.js$1");
          break;
        }
      }
    } catch (e) {}
    if (!src) src = "/src/public/custom-elements/parca-zinciri-admin-ops.js";
    var s = document.createElement("script");
    s.id = "pz-admin-ops-src";
    s.src = src;
    (document.head || document.documentElement).appendChild(s);
  }

  function isBootstrapOnlyFeature(feature) {
    var f = feature || {};
    return (
      f.adminConsoleEnabled !== true &&
      (f.bootstrapEnabled === true || f.profile === "BOOTSTRAP_ONLY")
    );
  }

  function unwrapAuthUi(authBoot) {
    if (!authBoot) return null;
    if (authBoot.data && authBoot.data.ui) return authBoot.data.ui;
    if (authBoot.ui) return authBoot.ui;
    return null;
  }

  class AdminConsole extends HTMLElement {
    static get observedAttributes() {
      return OBSERVED_ATTRS;
    }

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._state = {
        ui: "booting",
        module: "overview",
        data: null,
        drawer: null,
        error: null,
        mobileNav: false,
        bootstrapBusy: false
      };
      this._adapter = null;
      this._fixtureAllowed = false;
      this._bootToken = 0;
      this._watchdog = null;
      this._readyEmitted = false;
      // Synchronous first paint — never leave an upgraded host empty.
      this._paintActivationShell(
        '<div class="state" role="status"><h3>Yönetici Aktivasyonu</h3>' +
          "<p>Yönetim konsolu hazırlanıyor…</p></div>"
      );
    }

    connectedCallback() {
      if (!isLegacyAdminMode(this)) {
        this._mountOpsCockpit();
        return;
      }
      try {
        ensureFonts();
      } catch (fontErr) {
        // fonts are optional
      }
      this._render();
      this._armWatchdog();
      this._applyAttributeState();
      this._boot();
    }

    _forwardToOps(name, value) {
      if (!this._opsNode || !value) return;
      try {
        this._opsNode.setAttribute(name, value);
      } catch (e) {}
    }

    _mountOpsCockpit() {
      if (this._opsNode && this._opsNode.isConnected) return;
      if (this._opsMountPending) return;
      this._opsMountPending = true;
      var self = this;
      ensureOpsScript();
      var tries = 0;
      function mount() {
        if (!customElements.get("parca-zinciri-admin-ops") && tries < 50) {
          tries += 1;
          setTimeout(mount, 80);
          return;
        }
        if (!self.shadowRoot || isLegacyAdminMode(self)) {
          self._opsMountPending = false;
          return;
        }
        self._opsMountPending = false;
        self.shadowRoot.innerHTML =
          "<style>:host{display:block;width:100%;min-height:100vh}</style>";
        var node = document.createElement("parca-zinciri-admin-ops");
        self._opsNode = node;
        ["data-pz-portal-bridge-ready", "data-pz-portal-rpc-fallback", "data-pz-portal-auth", "data-pz-portal-api-result"].forEach(
          function (a) {
            var v = self.getAttribute(a);
            if (v) node.setAttribute(a, v);
          }
        );
        self.shadowRoot.appendChild(node);
        try {
          self.dispatchEvent(new CustomEvent("pz-admin-ready", { bubbles: true, composed: true }));
        } catch (eR) {}
      }
      mount();
    }

    disconnectedCallback() {
      this._clearWatchdog();
    }

    attributeChangedCallback(name, _old, value) {
      if (name === "data-pz-admin-cockpit" && value === "ops-v1" && !this._opsNode) {
        this._mountOpsCockpit();
        return;
      }
      if (this._opsNode && name.indexOf("portal") >= 0) {
        this._forwardToOps(name, value);
        return;
      }
      if (name === "pzstate" || name === "data-pz-state") {
        // Cancel in-flight HTTP boot so a later response cannot overwrite attribute state.
        this._bootToken += 1;
        this._applyAttributeState();
      }
    }

    _parseAttrState() {
      var raw = this.getAttribute("pzstate") || this.getAttribute("data-pz-state");
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }

    _applyAttributeState() {
      var parsed = this._parseAttrState();
      if (!parsed || !parsed.feature) return;
      this._applyParsedState(parsed);
    }

    _applyParsedState(parsed) {
      if (!parsed || !parsed.feature) return;
      var feature = parsed.feature || {};
      var auth = parsed.auth || {};
      var bootstrapOnly = isBootstrapOnlyFeature(feature);
      if (!feature.adminConsoleEnabled && !bootstrapOnly) {
        this._clearWatchdog();
        this._state.ui = "disabled";
        this._state.data = { feature: feature, auth: auth };
        this._render();
        return;
      }
      if (bootstrapOnly) {
        this._clearWatchdog();
        var bootUi = auth.ui || "unauthenticated";
        if (bootUi === "disabled" || bootUi === "enabled" || bootUi === "loaded") {
          bootUi = "unauthenticated";
        }
        this._state.ui = bootUi;
        this._state.data = { feature: feature, auth: auth };
        this._render();
        return;
      }
      if (auth.ui) {
        this._clearWatchdog();
        this._state.ui = auth.ui;
        this._state.data = { feature: feature, auth: auth };
        // The HTTP bridge is server-authenticated and cache-bypassed. If Wix
        // finishes member login before the Velo callback, use the same
        // active-admin path instead of waiting until the watchdog fires.
        if (feature.adminConsoleEnabled === true && auth.ui === "active_admin") {
          this.setAttribute("data-pz-admin-cockpit", "ops-v1");
          this._mountOpsCockpit();
          return;
        }
        this._opsNode = null;
        this.setAttribute("data-pz-admin-cockpit", "activation");
        this._render();
      }
    }

    _readAuthStorage() {
      try {
        if (typeof sessionStorage === "undefined") return null;
        var raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || !parsed.feature) return null;
        // Cached success is presentation history, never a fresh authorization.
        if (parsed.auth && parsed.auth.ui === "active_admin") return null;
        if (parsed.t && Date.now() - Number(parsed.t) > AUTH_STORAGE_MAX_AGE_MS) return null;
        return { feature: parsed.feature, auth: parsed.auth || {} };
      } catch (e) {
        return null;
      }
    }

    async _pollSessionBridge(maxAttempts) {
      var attempts = typeof maxAttempts === "number" ? maxAttempts : 12;
      var token = this._bootToken;
      for (var i = 0; i < attempts; i++) {
        if (token !== this._bootToken) return;
        var fromStore = this._readAuthStorage();
        if (
          fromStore &&
          fromStore.auth &&
          fromStore.auth.ui &&
          fromStore.auth.ui !== "session_initializing"
        ) {
          this._clearWatchdog();
          this._applyParsedState(fromStore);
          return;
        }
        await this._bootFromHttpQuiet();
        if (token !== this._bootToken) return;
        if (
          this._state.ui &&
          this._state.ui !== "booting" &&
          this._state.ui !== "session_initializing" &&
          this._state.ui !== "loading"
        ) {
          return;
        }
        await new Promise(function (resolve) {
          setTimeout(resolve, 500);
        });
      }
      if (token !== this._bootToken) return;
      if (this._state.ui === "session_initializing" || this._state.ui === "booting") {
        var last = this._readAuthStorage();
        if (last && last.auth && last.auth.ui) {
          this._applyParsedState(last);
          return;
        }
        this._showSafeError("Oturum doğrulanamadı. Sayfayı yenileyip tekrar deneyin.");
      }
    }

    async _bootFromHttpQuiet() {
      // Like _bootFromHttp but does not flip to error on transient failures during login poll.
      var token = this._bootToken;
      try {
        // This page lives at /yonetim. A relative _functions URL becomes
        // /yonetim/_functions/... and silently fails during the post-login
        // poll, leaving the user in the watchdog timeout state.
        var url = "/_functions/yonetimBootstrapState";
        try {
          var pathName = String((self.location && self.location.pathname) || "");
          var parts = pathName.split("/").filter(function (p) {
            return !!p;
          });
          if (parts.length >= 2) {
            url = "/" + parts[0] + "/_functions/yonetimBootstrapState";
          } else if (parts.length === 1 && parts[0] !== "yonetim") {
            url = "/" + parts[0] + "/_functions/yonetimBootstrapState";
          }
        } catch (locErr) {
          // keep relative
        }
        var res = await fetch(url + "?t=" + Date.now(), {
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json", "Cache-Control": "no-cache" }
        });
        if (token !== this._bootToken || !res || !res.ok) return;
        var json = await res.json();
        if (token !== this._bootToken) return;
        var state = json;
        if (json && json.body && !json.feature) {
          state = typeof json.body === "string" ? JSON.parse(json.body) : json.body;
        }
        if (json && json.data && json.data.feature) state = json.data;
        if (state && state.feature) {
          var ui = state.auth && state.auth.ui;
          if (ui && ui !== "unauthenticated") {
            this._clearWatchdog();
            this._applyParsedState(state);
          } else if (this._state.ui === "booting") {
            this._applyParsedState(state);
          }
        }
      } catch (e) {
        // quiet during poll
      }
    }

    async _bootFromHttp() {
      var token = this._bootToken;
      try {
        // Keep the root route explicit for /yonetim; see _bootFromHttpQuiet.
        var url = "/_functions/yonetimBootstrapState";
        try {
          var pathName = String((self.location && self.location.pathname) || "");
          var parts = pathName.split("/").filter(function (p) {
            return !!p;
          });
          if (parts.length >= 2) {
            url = "/" + parts[0] + "/_functions/yonetimBootstrapState";
          } else if (parts.length === 1 && parts[0] !== "yonetim") {
            url = "/" + parts[0] + "/_functions/yonetimBootstrapState";
          }
        } catch (locErr) {
          // keep relative url
        }
        var res = await fetch(url + "?t=" + Date.now(), {
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache"
          }
        });
        if (token !== this._bootToken) return;
        if (!res || !res.ok) {
          this._showSafeError("Durum alınamadı. Lütfen yeniden deneyin.");
          return;
        }
        var json = await res.json();
        if (token !== this._bootToken) return;
        var state = json;
        if (json && json.body && !json.feature) {
          state = typeof json.body === "string" ? JSON.parse(json.body) : json.body;
        }
        if (json && json.data && json.data.feature) state = json.data;
        if (state && state.feature) {
          this._clearWatchdog();
          this._applyParsedState(state);
          return;
        }
        this._showSafeError("Durum yanıtı okunamadı. Lütfen yeniden deneyin.");
      } catch (e) {
        if (token !== this._bootToken) return;
        this._showSafeError("Bağlantı kurulamadı. Lütfen yeniden deneyin.");
      }
    }

    _emit(name) {
      try {
        this.dispatchEvent(
          new CustomEvent(name, {
            bubbles: true,
            composed: true,
            detail: {}
          })
        );
      } catch (e) {
        // ignore
      }
    }

    _emitReady() {
      if (this._readyEmitted) return;
      this._readyEmitted = true;
      this._emit("pz-admin-ready");
    }

    _clearWatchdog() {
      if (this._watchdog) {
        clearTimeout(this._watchdog);
        this._watchdog = null;
      }
    }

    _armWatchdog() {
      var self = this;
      this._clearWatchdog();
      this._watchdog = setTimeout(function () {
        var ui = self._state.ui;
        if (ui === "booting" || ui === "loading" || ui === "session_initializing") {
          self._state.ui = "error";
          self._state.error =
            "Yönetim paneli zaman aşımına uğradı. Bağlantıyı kontrol edip yeniden deneyin.";
          self._render();
        }
      }, BOOT_WATCHDOG_MS);
    }

    _isActivationMode() {
      var ui = this._state.ui;
      return (
        ui === "booting" ||
        ui === "unauthenticated" ||
        ui === "disabled" ||
        ui === "session_unavailable" ||
        ui === "session_initializing" ||
        ui === "login_cancelled" ||
        ui === "membership_pending" ||
        ui === "email_verification_required" ||
        ui === "forbidden" ||
        ui === "error" ||
        ui === "bootstrap_required" ||
        ui === "bootstrap_progress" ||
        ui === "bootstrap_success" ||
        ui === "bootstrap_unavailable"
      );
    }

    _paintActivationShell(innerHtml) {
      var html =
        "<style>" +
        css() +
        "</style>" +
        '<div class="shell activation"><aside class="nav" aria-label="Yönetim">' +
        '<div class="brand">' +
        MARK +
        "<div><h1>Parça Zinciri</h1><small>Yönetim</small></div></div></aside>" +
        '<section class="main"><header class="top"><div><h2 class="title">Yönetici Girişi</h2>' +
        '<div class="sub">Parça Zinciri yönetim konsolu</div></div></header>' +
        '<div class="content">' +
        innerHtml +
        "</div></section></div>";
      this.shadowRoot.innerHTML = html;
      this._bind();
      this._emitReady();
    }

    _showSafeError(message) {
      this._state.ui = "error";
      this._state.error = message || "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
      this._clearWatchdog();
      this._render();
    }

    /**
     * Dependency injection for page controller / harness.
     * Production page controller must never call enableFixtureMode.
     */
    setDataAdapter(adapter, options) {
      this._adapter = adapter || null;
      this._fixtureAllowed = !!(options && options.allowFixture === true);
      this._boot();
    }

    async _boot() {
      var token = ++this._bootToken;
      try {
        if (!this._adapter) {
          if (this._parseAttrState()) {
            this._applyAttributeState();
            return;
          }
          var stored = this._readAuthStorage();
          if (
            stored &&
            stored.auth &&
            stored.auth.ui &&
            stored.auth.ui !== "session_initializing" &&
            stored.auth.ui !== "booting"
          ) {
            this._clearWatchdog();
            this._applyParsedState(stored);
            return;
          }
          await this._bootFromHttp();
          return;
        }

        var feature = this._adapter.getFeatureState
          ? await this._adapter.getFeatureState()
          : { adminConsoleEnabled: false, bootstrapEnabled: false, profile: "OFF" };
        if (token !== this._bootToken) return;

        var bootstrapOnly = isBootstrapOnlyFeature(feature);

        if (!feature.adminConsoleEnabled && !bootstrapOnly && !this._fixtureAllowed) {
          this._state.ui = "disabled";
          this._render();
          return;
        }

        if (bootstrapOnly) {
          var authBoot =
            this._adapter && this._adapter.getAuthState
              ? await this._adapter.getAuthState()
              : { ui: "unauthenticated", loginAvailable: true };
          if (token !== this._bootToken) return;
          var bootUi = unwrapAuthUi(authBoot) || "unauthenticated";
          if (bootUi === "disabled" || bootUi === "enabled" || bootUi === "loaded") {
            bootUi = "unauthenticated";
          }
          this._state.ui = bootUi;
          this._state.data = { auth: authBoot && authBoot.data ? authBoot.data : authBoot };
          this._render();
          return;
        }

        if (!this._adapter.getBootstrap) {
          if (this._adapter.getAuthState) {
            var authOnly = await this._adapter.getAuthState();
            if (token !== this._bootToken) return;
            var authUi = unwrapAuthUi(authOnly) || "disabled";
            this._state.ui = authUi;
            this._render();
            return;
          }
          this._state.ui = "disabled";
          this._render();
          return;
        }
        var boot = await this._adapter.getBootstrap();
        if (token !== this._bootToken) return;
        if (boot && boot.__auth === "unauthenticated") {
          this._state.ui = "unauthenticated";
          this._render();
          return;
        }
        if (boot && boot.__auth === "forbidden") {
          this._state.ui = "forbidden";
          this._render();
          return;
        }
        if (boot && boot.__auth === "session_unavailable") {
          this._state.ui = "session_unavailable";
          this._render();
          return;
        }
        this._state.data = { bootstrap: boot };
        this._state.ui = "loading";
        this._render();
        await this._loadModule(this._state.module);
      } catch (e) {
        if (token !== this._bootToken) return;
        this._state.ui = "error";
        this._state.error = "İşlem tamamlanamadı.";
        this._render();
      }
    }

    async _loadModule(id) {
      this._state.module = id;
      this._state.ui = "loading";
      this._state.mobileNav = false;
      this._render();
      try {
        var a = this._adapter;
        var payload = null;
        if (id === "overview") payload = await a.getOverview();
        else if (id === "orders") payload = await a.listOrders({ page: 1, pageSize: 20 });
        else if (id === "suppliers") payload = await a.listSuppliers({ page: 1, pageSize: 20 });
        else if (id === "accounts") payload = await a.getDefaultStatement();
        else if (id === "settlements") payload = await a.listSettlements({ page: 1, pageSize: 20 });
        else if (id === "payments") payload = await a.listPayments({ page: 1, pageSize: 20 });
        else if (id === "commission") payload = await a.listCommissionRules({ page: 1, pageSize: 20 });
        else if (id === "audit") payload = await a.listAuditEvents({ page: 1, pageSize: 20 });
        this._state.data.module = payload;
        this._state.ui = "loaded";
        this._render();
      } catch (e) {
        this._state.ui = "error";
        this._state.error = "Modül yüklenemedi.";
        this._render();
      }
    }

    _onNav(id) {
      this._loadModule(id);
    }

    async _openOrder(id) {
      if (!this._adapter.getOrderDetail) return;
      var detail = await this._adapter.getOrderDetail(id);
      this._state.drawer = { type: "order", detail: detail };
      this._render();
      this._trapFocus();
    }

    async _openSupplier(id) {
      if (!this._adapter.getSupplierDetail) return;
      var detail = await this._adapter.getSupplierDetail(id);
      this._state.drawer = { type: "supplier", detail: detail };
      this._render();
      this._trapFocus();
    }

    _closeDrawer() {
      this._state.drawer = null;
      this._render();
    }

    _trapFocus() {
      var root = this.shadowRoot;
      var panel = root.querySelector(".drawer .panel");
      if (!panel) return;
      var focusable = panel.querySelectorAll("button,[href],input,select,textarea,[tabindex]:not([tabindex='-1'])");
      if (focusable[0]) focusable[0].focus();
    }

    _exportOrders() {
      var items = (this._state.data.module && this._state.data.module.items) || [];
      this.dispatchEvent(
        new CustomEvent("pz-admin-export-orders", { detail: { items: items }, bubbles: true, composed: true })
      );
    }

    _exportStatement() {
      var stmt = this._state.data.module || {};
      this.dispatchEvent(
        new CustomEvent("pz-admin-export-statement", { detail: { statement: stmt }, bubbles: true, composed: true })
      );
    }

    _bind() {
      var root = this.shadowRoot;
      var self = this;
      root.querySelectorAll("[data-nav]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          self._onNav(btn.getAttribute("data-nav"));
        });
      });
      var menu = root.querySelector("[data-menu]");
      if (menu) {
        menu.addEventListener("click", function () {
          self._state.mobileNav = !self._state.mobileNav;
          self._render();
        });
      }
      var scrim = root.querySelector("[data-scrim]");
      if (scrim) {
        scrim.addEventListener("click", function () {
          self._state.mobileNav = false;
          self._render();
        });
      }
      root.querySelectorAll("[data-order]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          self._openOrder(btn.getAttribute("data-order"));
        });
      });
      root.querySelectorAll("[data-supplier]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          self._openSupplier(btn.getAttribute("data-supplier"));
        });
      });
      var close = root.querySelector("[data-close-drawer]");
      if (close) close.addEventListener("click", function () { self._closeDrawer(); });
      var bg = root.querySelector(".drawer .bg");
      if (bg) bg.addEventListener("click", function () { self._closeDrawer(); });
      var exO = root.querySelector("[data-export-orders]");
      if (exO) exO.addEventListener("click", function () { self._exportOrders(); });
      var exS = root.querySelector("[data-export-statement]");
      if (exS) exS.addEventListener("click", function () { self._exportStatement(); });
      var loginBtn = root.querySelector('[data-action="login"]');
      if (loginBtn) {
        loginBtn.addEventListener("click", function () {
          self._onLogin();
        });
      }
      var bootBtn = root.querySelector('[data-action="bootstrap"]');
      if (bootBtn) {
        bootBtn.addEventListener("click", function () {
          self._onBootstrap();
        });
      }
      var retryBtn = root.querySelector('[data-action="retry"]');
      if (retryBtn) {
        retryBtn.addEventListener("click", function () {
          if (!self._adapter) {
            self._bootToken += 1;
            self._state.ui = "session_initializing";
            self._render();
            self._armWatchdog();
            self.setAttribute("data-pz-admin-refresh-request", "refresh-" + Date.now().toString(36));
            // Wix does not reliably mirror CE-written attributes to Velo.
            // Match login's dual transport: event first, attribute fallback.
            self._emit("pz-admin-refresh");
            return;
          }
          self._state.ui = "booting";
          self._state.error = null;
          self._render();
          self._armWatchdog();
          self._boot();
        });
      }
      root.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") {
          if (self._state.drawer) self._closeDrawer();
          else if (self._state.mobileNav) {
            self._state.mobileNav = false;
            self._render();
          }
        }
      });
    }

    _stateView() {
      var ui = this._state.ui;
      if (ui === "booting" || ui === "loading") {
        return (
          '<div class="state" role="status"><h3>Yönetici Aktivasyonu</h3>' +
          "<p>Yönetim konsolu hazırlanıyor…</p></div>"
        );
      }
      if (ui === "disabled") {
        return '<div class="state"><h3>Yönetim paneli henüz etkin değil</h3><p>Bu özellik kontrollü olarak açılacaktır.</p></div>';
      }
      if (ui === "unauthenticated") {
        return (
          '<div class="state"><h3>Yönetici Aktivasyonu</h3>' +
          "<p>Yönetim konsoluna erişmek için Wix üye girişi yapın.</p>" +
          '<p class="h">Parça Zinciri şifre işlemez; giriş yalnızca Wix Members akışı ile yapılır.</p>' +
          '<div style="margin-top:18px"><button class="btn primary" type="button" data-action="login">Giriş Yap</button></div></div>'
        );
      }
      if (ui === "session_unavailable") {
        return '<div class="state"><h3>Oturum henüz doğrulanamadı</h3><p>Wix girişiniz yönetici oturumuna aktarılamadı. Mevcut yönetici hesabınızla siteye giriş yapın.</p><button class="btn primary" type="button" data-action="login">Yönetici hesabıyla giriş yap</button><button class="btn" type="button" data-action="retry">Oturumu yeniden kontrol et</button></div>';
      }
      if (ui === "session_initializing") {
        return (
          '<div class="state" role="status"><h3>Yönetici Aktivasyonu</h3>' +
          "<p>Oturum doğrulanıyor… Lütfen bekleyin.</p></div>"
        );
      }
      if (ui === "login_cancelled") {
        return (
          '<div class="state"><h3>Yönetici Aktivasyonu</h3>' +
          "<p>Giriş tamamlanmadı veya iptal edildi.</p>" +
          '<div style="margin-top:18px"><button class="btn primary" type="button" data-action="login">Giriş Yap</button></div></div>'
        );
      }
      if (ui === "membership_pending") {
        return (
          '<div class="state"><h3>Üyelik onayı bekleniyor</h3>' +
          "<p>Hesabınız kayıtlı ancak site üyeliği henüz onaylanmamış. Onay sonrası bu sayfayı yenileyin.</p></div>"
        );
      }
      if (ui === "email_verification_required") {
        return (
          '<div class="state"><h3>E-posta doğrulaması gerekli</h3>' +
          "<p>Giriş için e-posta doğrulamasını tamamlayın, ardından bu sayfaya dönün.</p></div>"
        );
      }
      if (ui === "forbidden") {
        return '<div class="state"><h3>Yönetici oturumu gerekli</h3><p>Bu site oturumuyla yönetici erişimi doğrulanamadı. Wix kontrol panelindeki giriş, site üye girişinin yerine geçmez.</p><p>Mevcut yönetici hesabınızla giriş yapın; yeni hesap oluşturmanız gerekmez.</p><button class="btn primary" type="button" data-action="login">Yönetici hesabıyla giriş yap</button><button class="btn" type="button" data-action="retry">Oturumu yeniden kontrol et</button></div>';
      }
      if (ui === "bootstrap_required") {
        var busy = this._state.bootstrapBusy;
        return (
          '<div class="state"><h3>Yönetici Aktivasyonu</h3>' +
          "<p>Oturum doğrulandı. İlk platform yöneticisini oluşturmak için devam edin.</p>" +
          '<p class="h">Kimlik bilgileri tarayıcıdan gönderilmez; işlem yalnızca sunucu oturumu ile çalışır.</p>' +
          '<div style="margin-top:18px"><button class="btn primary" type="button" data-action="bootstrap" ' +
          (busy ? "disabled" : "") +
          ">" +
          (busy ? "Oluşturuluyor…" : "İlk Yönetici Erişimini Oluştur") +
          "</button></div></div>"
        );
      }
      if (ui === "bootstrap_progress") {
        return '<div class="state" role="status"><h3>Yönetici Aktivasyonu</h3><p>İlk yönetici erişimi oluşturuluyor…</p></div>';
      }
      if (ui === "bootstrap_success") {
        return (
          '<div class="state"><h3>Yönetici erişimi oluşturuldu</h3>' +
          "<p>Bootstrap tamamlandı. Bootstrap mekanizması bir sonraki yayınla kalıcı olarak kapatılacaktır.</p>" +
          '<p class="h">İş paneli verileri bu aşamada yüklenmez.</p></div>'
        );
      }
      if (ui === "bootstrap_unavailable") {
        return '<div class="state"><h3>Kurulum kullanılamıyor</h3><p>Bootstrap şu an kapalıdır.</p></div>';
      }
      if (ui === "error") {
        return (
          '<div class="state"><h3>Bir sorun oluştu</h3><p>' +
          esc(this._state.error || "İşlem tamamlanamadı.") +
          "</p>" +
          '<div style="margin-top:18px"><button class="btn primary" type="button" data-action="retry">Yeniden Dene</button></div></div>'
        );
      }
      return this._moduleView();
    }

    async _onLogin() {
      if (this._adapter && typeof this._adapter.promptLogin === "function") {
        try {
          await this._adapter.promptLogin();
          await this._boot();
          return;
        } catch (e) {
          this._state.ui = "login_cancelled";
          this._render();
          return;
        }
      }
      this._state.ui = "session_initializing";
      this._render();
      // The login modal is a user-controlled wait. Do not let the generic boot
      // watchdog overwrite a completed member handoff while the page obtains
      // its server-authoritative permission state.
      this._clearWatchdog();
      // Send both supported Wix bridges. The Velo event is immediate where it
      // crosses the wrapper; the opaque attribute is its fallback where custom
      // event propagation is suppressed.
      this._emit("pz-admin-login");
      try {
        this.setAttribute(
          "data-pz-admin-login-request",
          "admin-login-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8)
        );
      } catch (requestError) {
        this._showSafeError("Giriş isteği başlatılamadı. Lütfen yeniden deneyin.");
        return;
      }
      // Poll remains only as a fallback while the Velo attribute bridge opens
      // the Wix login flow and pushes the server-authoritative state back.
      await this._pollSessionBridge(16);
    }

    async _onBootstrap() {
      if (this._state.bootstrapBusy) return;
      if (this._adapter && typeof this._adapter.runBootstrap === "function") {
        this._state.bootstrapBusy = true;
        this._state.ui = "bootstrap_progress";
        this._render();
        try {
          var res = await this._adapter.runBootstrap();
          var ok = res && (res.ok === true || res.status === "created" || res.status === "already_active");
          var data = res && res.data ? res.data : res;
          if (data && (data.status === "created" || data.status === "already_active")) ok = true;
          if (ok) {
            this._state.ui = "bootstrap_success";
          } else {
            this._state.ui = "error";
            this._state.error =
              (res && res.error && res.error.message) || "Yönetici erişimi oluşturulamadı.";
          }
        } catch (e) {
          this._state.ui = "error";
          this._state.error = "Yönetici erişimi oluşturulamadı.";
        }
        this._state.bootstrapBusy = false;
        this._render();
        return;
      }
      // The page bridge owns the server mutation. Its prior login watchdog is
      // irrelevant once the user has explicitly started activation; otherwise
      // it can overwrite this operation's real result with a false timeout.
      this._clearWatchdog();
      this._state.ui = "bootstrap_progress";
      this._render();
      this._emit("pz-admin-bootstrap");
      // Page controller runs bootstrap web method and pushes pzstate.
    }

    _metric(label, value, hint) {
      return (
        '<article class="metric"><div class="k">' +
        esc(label) +
        '</div><div class="v">' +
        esc(value) +
        "</div>" +
        (hint ? '<div class="h">' + esc(hint) + "</div>" : "") +
        "</article>"
      );
    }

    _currencyBlock(map, label) {
      var m = map || {};
      var keys = Object.keys(m);
      if (!keys.length) return this._metric(label, "—", "Veri yok");
      return keys
        .map(function (c) {
          return '<article class="metric"><div class="k">' + esc(label) + " · " + esc(c) + '</div><div class="v">' + esc(moneyMinor(m[c], c)) + "</div></article>";
        })
        .join("");
    }

    _overviewView(o) {
      o = o || {};
      var notes =
        (o.totalOrders || 0) === 0
          ? '<div class="panel"><div class="panel-h"><h2>Operasyon notları</h2></div><div class="state" style="min-height:160px"><h3>Henüz sipariş bulunmuyor</h3><p>Canlı CMS boşsa metrikler 0 / — gösterir.</p></div></div>'
          : '<div class="panel"><div class="panel-h"><h2>Operasyon notları</h2></div><div class="state" style="min-height:120px"><h3>Aktif operasyon özeti</h3><p>Para birimleri ayrı tutulur; çapraz para birimi toplamı yapılmaz.</p></div></div>';
      return (
        '<div class="grid">' +
        this._metric("Aktif satıcılar", o.activeSupplierCompanies || 0) +
        this._metric("Onay Bekleyenler", o.pendingSupplierApprovals || 0) +
        this._metric("Açık Siparişler", o.openOrders || 0) +
        this._metric("satıcı Aksiyonu Bekleyenler", o.ordersAwaitingSupplierAction || 0) +
        this._currencyBlock(o.totalBuyerSalesByCurrency, "Toplam Satış") +
        this._currencyBlock(o.totalPlatformCommissionByCurrency, "Platform Komisyonu") +
        this._currencyBlock(o.totalSupplierPayableByCurrency, "Satıcıya Ödenecek") +
        this._metric("Ödenmemiş Hakedişler", o.overdueOrHeldSettlements || 0) +
        this._metric("Başarısız Ödemeler", o.failedPaymentTransactionCount || 0) +
        "</div>" +
        notes
      );
    }

    _ordersView(payload) {
      var items = (payload && payload.items) || [];
      if (!items.length) {
        return '<div class="panel"><div class="state"><h3>Henüz sipariş bulunmuyor</h3><p>Marketplace siparişleri burada listelenir.</p></div></div>';
      }
      var rows = items
        .map(function (o) {
          return (
            "<tr><td>" +
            esc(o.orderNumber) +
            "</td><td>" +
            esc(o.createdAt) +
            "</td><td>" +
            esc(o.buyerLabel || o.buyerCompanyId || "—") +
            "</td><td>" +
            esc(o.supplierCount != null ? o.supplierCount : "—") +
            "</td><td><span class=\"chip " +
            chipClass(o.status) +
            '"><span class="sr-only">Durum:</span>' +
            esc(o.status) +
            '</span></td><td><span class="chip ' +
            chipClass(o.paymentStatus) +
            '">' +
            esc(o.paymentStatus) +
            "</span></td><td>" +
            esc(moneyMinor(o.buyerGrandTotalMinor, o.currency)) +
            '</td><td><button class="btn ghost" type="button" data-order="' +
            esc(o.id) +
            '">Detay</button></td></tr>'
          );
        })
        .join("");
      var cards = items
        .map(function (o) {
          return (
            '<article class="card"><strong>' +
            esc(o.orderNumber) +
            "</strong><div class=\"row\"><span>Durum</span><span>" +
            esc(o.status) +
            '</span></div><div class="row"><span>Toplam</span><span>' +
            esc(moneyMinor(o.buyerGrandTotalMinor, o.currency)) +
            '</span></div><button class="btn" type="button" data-order="' +
            esc(o.id) +
            '">Detay</button></article>'
          );
        })
        .join("");
      return (
        '<div class="panel"><div class="panel-h"><h2>Siparişler</h2><button class="btn" type="button" data-export-orders>CSV</button></div><div class="table-wrap desktop-only"><table><thead><tr><th>Sipariş</th><th>Tarih</th><th>Alıcı</th><th>satıcı</th><th>Durum</th><th>Ödeme</th><th>Toplam</th><th></th></tr></thead><tbody>' +
        rows +
        '</tbody></table></div><div class="cards">' +
        cards +
        "</div></div>"
      );
    }

    _suppliersView(payload) {
      var items = (payload && payload.items) || [];
      if (!items.length) {
        return '<div class="panel"><div class="state"><h3>Henüz satıcı kaydı yok</h3></div></div>';
      }
      var rows = items
        .map(function (s) {
          return (
            "<tr><td>" +
            esc(s.name) +
            '</td><td><span class="chip ' +
            chipClass(s.status) +
            '">' +
            esc(s.status) +
            "</span></td><td>" +
            esc(s.city || "—") +
            "</td><td>" +
            esc(s.inventoryItemCount) +
            "</td><td>" +
            esc(s.openSupplierOrders) +
            "</td><td>" +
            esc(moneyMinor(s.unsettledBalanceMinor, s.currency)) +
            '</td><td><button class="btn ghost" type="button" data-supplier="' +
            esc(s.companyId) +
            '">Detay</button></td></tr>'
          );
        })
        .join("");
      return (
        '<div class="panel"><div class="panel-h"><h2>satıcılar</h2></div><div class="table-wrap"><table><thead><tr><th>Firma</th><th>Durum</th><th>Şehir</th><th>Stok</th><th>Açık Sipariş</th><th>Cari</th><th></th></tr></thead><tbody>' +
        rows +
        "</tbody></table></div></div>"
      );
    }

    _accountsView(stmt) {
      stmt = stmt || {};
      var moves = stmt.movements || [];
      if (!moves.length && !stmt.openingBalanceMinor) {
        return '<div class="panel"><div class="state"><h3>Henüz cari hareket oluşmadı</h3></div></div>';
      }
      var rows = moves
        .map(function (m) {
          return (
            "<tr><td>" +
            esc(m.effectiveAt) +
            "</td><td>" +
            esc(m.entryType) +
            "</td><td>" +
            esc(m.description || "—") +
            "</td><td>" +
            (m.direction === "debit" ? esc(moneyMinor(m.amountMinor, stmt.currency)) : "—") +
            "</td><td>" +
            (m.direction === "credit" ? esc(moneyMinor(m.amountMinor, stmt.currency)) : "—") +
            "</td><td>" +
            esc(moneyMinor(m.runningBalanceMinor, stmt.currency)) +
            "</td></tr>"
          );
        })
        .join("");
      return (
        '<div class="grid">' +
        this._metric("Açılış", moneyMinor(stmt.openingBalanceMinor, stmt.currency), stmt.currency) +
        this._metric("Alacak", moneyMinor(stmt.totalCreditsMinor, stmt.currency)) +
        this._metric("Borç", moneyMinor(stmt.totalDebitsMinor, stmt.currency)) +
        this._metric("Kapanış", moneyMinor(stmt.closingBalanceMinor, stmt.currency)) +
        '</div><div class="panel"><div class="panel-h"><h2>Cari ekstresi</h2><button class="btn" type="button" data-export-statement>CSV</button></div><div class="table-wrap"><table><thead><tr><th>Tarih</th><th>Tür</th><th>Açıklama</th><th>Borç</th><th>Alacak</th><th>Bakiye</th></tr></thead><tbody>' +
        rows +
        "</tbody></table></div></div>"
      );
    }

    _simpleTable(title, emptyText, headers, rowHtml, items) {
      if (!items || !items.length) {
        return '<div class="panel"><div class="state"><h3>' + esc(emptyText) + "</h3></div></div>";
      }
      return (
        '<div class="panel"><div class="panel-h"><h2>' +
        esc(title) +
        '</h2></div><div class="table-wrap"><table><thead><tr>' +
        headers.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") +
        "</tr></thead><tbody>" +
        rowHtml +
        "</tbody></table></div></div>"
      );
    }

    _moduleView() {
      var id = this._state.module;
      var payload = this._state.data && this._state.data.module;
      if (id === "overview") return this._overviewView(payload);
      if (id === "orders") return this._ordersView(payload);
      if (id === "suppliers") return this._suppliersView(payload);
      if (id === "accounts") return this._accountsView(payload);
      if (id === "settlements") {
        var items = (payload && payload.items) || [];
        var rows = items
          .map(function (s) {
            return (
              "<tr><td>" +
              esc(s.settlementNumber) +
              "</td><td>" +
              esc(s.supplierCompanyId) +
              "</td><td>" +
              esc(s.status) +
              "</td><td>" +
              esc(moneyMinor(s.netPayableMinor, s.currency)) +
              "</td><td>" +
              esc(s.periodEnd || "—") +
              "</td></tr>"
            );
          })
          .join("");
        return this._simpleTable("Hakedişler", "Henüz hakediş hesaplanmadı", ["No", "satıcı", "Durum", "Net", "Dönem"], rows, items);
      }
      if (id === "payments") {
        var pays = (payload && payload.items) || [];
        var pr = pays
          .map(function (p) {
            return (
              "<tr><td>" +
              esc(p.providerReference || p.id) +
              "</td><td>" +
              esc(p.transactionType) +
              "</td><td>" +
              esc(p.status) +
              "</td><td>" +
              esc(moneyMinor(p.amountMinor, p.currency)) +
              "</td><td>" +
              esc(p.processedAt || "—") +
              "</td></tr>"
            );
          })
          .join("");
        return this._simpleTable("Ödemeler", "Henüz ödeme kaydı yok", ["Referans", "Tür", "Durum", "Tutar", "Tarih"], pr, pays);
      }
      if (id === "commission") {
        var rules = (payload && payload.items) || [];
        if (!rules.length) {
          return '<div class="panel"><div class="state"><h3>Henüz aktif komisyon kuralı tanımlanmadı.</h3><p>Oranlar bu fazda icat edilmez.</p></div></div>';
        }
        var rr = rules
          .map(function (r) {
            return (
              "<tr><td>" +
              esc(r.name) +
              "</td><td>" +
              esc(r.scopeType) +
              "</td><td>" +
              esc(r.rateBps != null ? r.rateBps + " bps" : "—") +
              "</td><td>" +
              esc(r.status) +
              "</td></tr>"
            );
          })
          .join("");
        return this._simpleTable("Komisyon Kuralları", "Henüz aktif komisyon kuralı tanımlanmadı.", ["Ad", "Kapsam", "Oran", "Durum"], rr, rules);
      }
      if (id === "audit") {
        var ev = (payload && payload.items) || [];
        var er = ev
          .map(function (a) {
            return (
              "<tr><td>" +
              esc(a.createdAt) +
              "</td><td>" +
              esc(a.actorMemberId || "—") +
              "</td><td>" +
              esc(a.action) +
              "</td><td>" +
              esc(a.entityType) +
              "</td><td>" +
              esc(a.entityId) +
              "</td></tr>"
            );
          })
          .join("");
        return this._simpleTable("Denetim Kayıtları", "Henüz denetim kaydı yok", ["Zaman", "Aktör", "Aksiyon", "Varlık", "Ref"], er, ev);
      }
      return "";
    }

    _drawerView() {
      var d = this._state.drawer;
      if (!d) return "";
      var body = "";
      if (d.type === "order" && d.detail) {
        var o = d.detail;
        body =
          '<div class="kv">' +
          '<div><div class="k">Sipariş</div><div class="v">' +
          esc(o.order && o.order.orderNumber) +
          '</div></div><div><div class="k">Alıcı toplam</div><div class="v">' +
          esc(moneyMinor(o.financials && o.financials.buyerGrandTotalMinor, o.financials && o.financials.currency)) +
          "</div></div></div>" +
          "<h3>Satıcı alt siparişleri</h3>" +
          (o.supplierOrders || [])
            .map(function (so) {
              return (
                "<p><strong>" +
                esc(so.supplierOrderNumber) +
                "</strong> · " +
                esc(so.status) +
                " · net " +
                esc(moneyMinor(so.supplierNetTotalMinor, so.currency)) +
                "</p>"
              );
            })
            .join("");
      }
      if (d.type === "supplier" && d.detail) {
        var s = d.detail;
        body =
          '<div class="kv"><div><div class="k">Firma</div><div class="v">' +
          esc(s.company && s.company.name) +
          '</div></div><div><div class="k">Durum</div><div class="v">' +
          esc(s.company && s.company.status) +
          "</div></div></div>";
      }
      return (
        '<div class="drawer open" role="dialog" aria-modal="true" aria-label="Detay"><div class="bg"></div><div class="panel"><div class="drawer-h"><strong>Detay</strong><button class="btn ghost" type="button" data-close-drawer>Kapat</button></div><div class="drawer-b">' +
        body +
        "</div></div></div>"
      );
    }

    _render() {
      if (this._isActivationMode()) {
        this._paintActivationShell(this._stateView());
        return;
      }
      var mod = MODULES.find(function (m) {
        return m.id === this._state.module;
      }, this);
      var nav = MODULES.map(function (m) {
        return (
          '<button type="button" class="nav-btn" data-nav="' +
          m.id +
          '" ' +
          (m.id === this._state.module ? 'aria-current="page"' : "") +
          ">" +
          esc(m.label) +
          "</button>"
        );
      }, this).join("");

      this.shadowRoot.innerHTML =
        "<style>" +
        css() +
        '</style><div class="shell"><aside class="nav' +
        (this._state.mobileNav ? " open" : "") +
        '" aria-label="Yönetim menüsü"><div class="brand">' +
        MARK +
        "<div><h1>Parça Zinciri</h1><small>Yönetim</small></div></div><nav class=\"nav-list\">" +
        nav +
        '</nav></aside><div class="scrim' +
        (this._state.mobileNav ? " show" : "") +
        '" data-scrim></div><section class="main"><header class="top"><div><button type="button" class="menu" data-menu aria-label="Menüyü aç">Menü</button><h2 class="title">' +
        esc(mod ? mod.label : "Yönetim") +
        '</h2><div class="sub">Operasyon konsolu · salt okunur V1</div></div></header><div class="content">' +
        this._stateView() +
        "</div></section></div>" +
        this._drawerView();
      this._bind();
      this._emitReady();
    }
  }

  customElements.define("parca-zinciri-admin-console", AdminConsole);
})();

/* BUNDLED_ADMIN_OPS_V1 — Wix CE cannot load sibling parca-zinciri-admin-ops.js */
// BEGIN ARTICLE COVER
// Shared, deterministic vector cover. No upload, remote image or paid service.
function pzArticleCover(title) {
  const xml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const text = String(title || 'Makale başlığınız burada görünecek').replace(/\s+/g, ' ').trim().slice(0,180);
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    for (const part of word.match(/.{1,32}/gu) || ['']) {
      if (line && (line + ' ' + part).length > 32) { lines.push(line); line = ''; }
      line += (line ? ' ' : '') + part;
    }
  }
  if (line) lines.push(line);
  const size = lines.length > 5 ? 42 : 50;
  const step = size + 10;
  const top = 190 + Math.max(0, (330 - lines.length * step) / 2);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">' +
    '<rect width="1200" height="630" fill="#17191c"/><path d="M890 0h310v630H710z" fill="#212429"/>' +
    '<g fill="none" stroke="#ff6b00" stroke-width="2" opacity=".23"><circle cx="1080" cy="300" r="180"/><circle cx="1080" cy="300" r="135"/><path d="M840 300h360M1080 60v480"/></g>' +
    '<rect x="0" y="0" width="14" height="630" fill="#ff6b00"/><rect x="76" y="64" width="34" height="34" rx="8" fill="#ff6b00"/>' +
    '<g font-family="Arial, sans-serif"><text x="128" y="91" fill="#fff" font-weight="700" font-size="29">PARÇA ZİNCİRİ</text>' +
    '<text x="76" y="144" fill="#ff8b38" font-size="18" letter-spacing="4">BİLGİ MERKEZİ / MAKALELER</text>' +
    '<g fill="#fff" font-weight="700" font-size="'+size+'">' + lines.map((l,i)=>'<text x="76" y="'+(top+i*step)+'">'+xml(l)+'</text>').join('') + '</g>' +
    '<path d="M76 555h100" stroke="#ff6b00" stroke-width="6"/><text x="76" y="595" fill="#c8cdd3" font-size="19">İş makineleri · Yedek parçalar · Bakım</text></g></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
// END ARTICLE COVER
// BEGIN SHARED TCMB TICKER
// Shared TCMB EUR/USD ticker; visible browsers recheck at five-minute boundaries.
(function(){
 'use strict';
 if(customElements.get('pz-euro-rate'))return;
 var cached=null,pending=null;
 function today(){return new Date(Date.now()+3*3600000).toISOString().slice(0,10);}
 function valid(d){var day=Date.parse(d?.date+'T00:00:00Z'),current=Date.parse(today()+'T00:00:00Z'),checked=Date.parse(d?.checkedAt);return d?.source==='TCMB'&&d.type==='ForexSelling'&&/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')&&Number.isFinite(day)&&new Date(day).toISOString().slice(0,10)===d.date&&day<=current&&current-day<=10*86400000&&Number.isFinite(checked)&&checked<=Date.now()+300000&&['EUR','USD'].every(k=>Number.isSafeInteger(d.rates?.[k])&&d.rates[k]>0&&d.rates[k]<=100000000);}
 async function latest(){
  var hour=Math.floor(Date.now()/3600000),slot=Math.floor(Date.now()/300000);
  if(cached&&cached.slot===slot&&valid(cached.data))return cached.data;
  if(pending)return pending;
  pending=(async()=>{var controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
   var url=new URL('https://www.parcazinciri.com/_functions/tcmbRates?hour='+hour),query=new URLSearchParams(location.search);
   for(var key of ['branchId','siteRevision','rc'])if(query.has(key))url.searchParams.set(key,query.get(key));
   try{var r=await fetch(url.href,{credentials:'omit',cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('unavailable');
    var body=await r.json(),d=body.data;
    if(!body.ok||!valid(d))throw Error('invalid');
    cached={slot:slot,data:d};return d;
   }finally{clearTimeout(timer);pending=null;}
  })();return pending;
 }
 class EuroRate extends HTMLElement{
  constructor(){super();this.attachShadow({mode:'open'});}
  connectedCallback(){
   this.shadowRoot.innerHTML='<style>:host{display:block;flex:none;font-family:inherit;color:#38332e;background:#faf8f5;border-bottom:1px solid #e9e2d9}.bar{display:flex;align-items:center;min-height:32px;overflow:hidden;position:relative}.viewport{flex:1;min-width:0;overflow:hidden}.track{display:flex;width:max-content;animation:slide 44s linear infinite}.group{display:flex;flex:none}.piece{flex:none;white-space:nowrap;padding:6px 34px;font-size:13px;font-weight:500;font-variant-numeric:tabular-nums;line-height:20px;letter-spacing:.02em}.piece:before{content:"";display:inline-block;background:#ff6b00;width:5px;height:5px;border-radius:50%;margin-right:10px;vertical-align:middle}.bar:hover .track,.bar:focus-within .track,.paused .track{animation-play-state:paused}.toggle{flex:none;border:0;border-left:1px solid #e9e2d9;background:#faf8f5;color:#665b50;width:32px;align-self:stretch;cursor:pointer;font-size:13px}.toggle:focus-visible{outline:2px solid #ff6b00;outline-offset:-3px}.sr{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden;white-space:nowrap}@keyframes slide{to{transform:translateX(-50%)}}@media(prefers-reduced-motion:reduce){.track{animation:none;width:auto}.group{display:block}.group+.group,.piece+.piece,.toggle{display:none}.piece{display:block;white-space:normal;font-size:12px;padding:6px 12px;text-align:center}}@media(max-width:600px){.piece{font-size:12px;padding:6px 24px}}</style><div class="bar"><span class="sr" role="status" aria-live="polite"></span><div class="viewport"><div class="track" aria-hidden="true"><div class="group"></div><div class="group"></div></div></div><button class="toggle" type="button" aria-label="Kayan yazıyı durdur">Ⅱ</button></div>';
   this.setText('TCMB · Euro ve USD kurları yükleniyor…');
   this.shadowRoot.querySelector('.toggle').onclick=()=>{var b=this.shadowRoot.querySelector('.bar'),paused=b.classList.toggle('paused'),button=this.shadowRoot.querySelector('.toggle');button.textContent=paused?'▶':'Ⅱ';button.setAttribute('aria-label',paused?'Kayan yazıyı başlat':'Kayan yazıyı durdur');};
   this.refresh();this.schedule();this.onVisible=()=>{if(!document.hidden){this.refresh();this.schedule();}};document.addEventListener('visibilitychange',this.onVisible);
  }
  disconnectedCallback(){clearTimeout(this.timer);clearTimeout(this.retry);document.removeEventListener('visibilitychange',this.onVisible);}
  schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>{this.refresh();this.schedule();},300000-Date.now()%300000+100);}
  setText(text){this.shadowRoot.querySelector('.sr').textContent=text;this.shadowRoot.querySelectorAll('.group').forEach(g=>{g.replaceChildren();for(var i=0;i<3;i++){var s=document.createElement('span');s.className='piece';s.textContent=text;g.appendChild(s);}});}
  showRates(d,fallback){
    var date=d.date.split('-').reverse().join('.');
    this.setText('TCMB · '+date+' · Euro = '+(d.rates.EUR/10000).toFixed(2)+' TL   ·   USD = '+(d.rates.USD/10000).toFixed(2)+' TL'+(fallback?' · Son doğrulanan kur; bağlantı yeniden deneniyor':d.date!==today()?' · Son yayımlanan kur':''));
    this.shadowRoot.querySelector('.bar').title='TCMB döviz satış · '+date+' · Bilgilendirme amaçlı · Son başarılı kontrol: '+new Date(d.checkedAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'});
  }
  async refresh(){
   try{var d=await latest();if(!this.isConnected)return;clearTimeout(this.retry);
    this.showRates(d,d.status==='cached_fallback');
    if(d.status==='cached_fallback'){cached=null;this.retry=setTimeout(()=>this.refresh(),60000);}
   }catch(_){if(!this.isConnected)return;if(valid(this.lastData))this.showRates(this.lastData,true);else this.setText('TCMB · Euro ve USD kurları şu an alınamıyor');clearTimeout(this.retry);this.retry=setTimeout(()=>this.refresh(),60000);return;}
   this.lastData=d;
  }
 }
 customElements.define('pz-euro-rate',EuroRate);
})();
// END SHARED TCMB TICKER
/* global pzListingPricing */
/* ============================================================
   PARÇA ZİNCİRİ — <parca-zinciri-admin-ops>
   Full-page admin operations cockpit. Not a popup.
   Auth: Wix Members → PortalUsers.role platform_admin.
   Trusted auto-publish remains OFF. Copilot is "Sistem Önerisi".
   ============================================================ */
(function () {
  "use strict";

  try {
    if (typeof document !== "undefined" && !document.getElementById("pz-admin-ops-pending")) {
      var pending = document.createElement("style");
      pending.id = "pz-admin-ops-pending";
      pending.textContent =
        "parca-zinciri-admin-ops:not(:defined),parca-zinciri-admin-console:not(:defined){" +
        "display:block!important;min-height:100vh;width:100%;box-sizing:border-box;" +
        "background:#F5F6F8;color:#20252B;padding:48px 28px;font-family:system-ui,sans-serif}" +
        "parca-zinciri-admin-ops:not(:defined)::before,parca-zinciri-admin-console:not(:defined)::before{" +
        "content:'Yönetici Aktivasyonu';display:block;font-size:28px;font-weight:700;margin:0 0 12px}" +
        "parca-zinciri-admin-ops:not(:defined)::after,parca-zinciri-admin-console:not(:defined)::after{" +
        "content:'Yönetim konsolu hazırlanıyor…';display:block;color:#52606D;font-size:17px}";
      (document.head || document.documentElement).appendChild(pending);
    }
  } catch (e0) {}

  if (typeof customElements === "undefined") return;

  var FONT_HREF =
    "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,600;125,700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap";
  var MARK =
    '<svg class="pz-mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 84" aria-hidden="true"><g transform="translate(-15,-18)"><path fill="#FF6B00" fill-rule="evenodd" d="M65,18 L77,30 L77,48 L93,48 L105,60 L105,90 L93,102 L55,102 L43,90 L43,72 L27,72 L15,60 L15,30 L27,18ZM69,45 L51,45 L45,51 L45,69 L51,75 L69,75 L75,69 L75,51Z"/></g></svg>';
  var SESSION_KEY = "pz_admin_ops_session_v1";
  var THEME_KEY = "pz_admin_ops_theme_v1";
  function savedTheme() {
    try { return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"; }
    catch (e) { return "light"; }
  }
  var NAV = [
    { id: "overview", label: "Genel Bakış" },
    { id: "queue", label: "Sizi Bekleyenler" },
    { id: "rfqs", label: "Talepler" },
    { id: "commerce", label: "Ticari Takip" },
    { id: "owned", label: "Ürünlerimiz" },
    { id: "articles", label: "Makaleler" },
    { id: "costs", label: "Alış Fiyatları" },
    { id: "listings", label: "Ürün Onayları" },
    { id: "suppliers", label: "satıcılar" },
    { id: "audit", label: "İşlem Kayıtları" }
  ];
  var TYPE_LABEL = {
    AMBIGUOUS_MATCH: "Belirsiz Eşleşme",
    SUSPICIOUS_LISTING: "İnceleme bekleyen ürün",
    OEM_COLLISION: "OEM Çakışması",
    DUPLICATE_LISTING: "Mükerrer İlan",
    SUPPLIER_ISSUE: "Satıcı Sorunu",
    DISPUTE: "Uyuşmazlık",
    SYSTEM_ERROR: "Sistem Hatası"
  };
  var TYPE_CARD = {
    AMBIGUOUS_MATCH: "Belirsiz Eşleşmeler",
    SUSPICIOUS_LISTING: "İnceleme bekleyen ürünler",
    OEM_COLLISION: "OEM Çakışmaları",
    DUPLICATE_LISTING: "Mükerrer İlanlar",
    SUPPLIER_ISSUE: "Satıcı Sorunları",
    DISPUTE: "Uyuşmazlıklar",
    SYSTEM_ERROR: "Sistem Hataları"
  };
  var REASON_LABEL = {
    MALFORMED_OEM: "OEM numarası geçersiz",
    OEM_UNKNOWN: "OEM belirtilmemiş",
    OEM_COLLISION: "Aynı OEM birden fazla satıcıda",
    EXACT_DUPLICATE: "Aynı satıcıda mükerrer OEM",
    SUPPLIER_SUSPENDED: "Satıcı hesabı askıda",
    PROFILE_INCOMPLETE: "Firma profili eksik",
    MISSING_IMAGES: "Görsel yok",
    INVALID_PRICE: "Fiyat geçersiz",
    INVALID_STOCK: "Stok geçersiz",
    SPAM_INDICATOR: "Spam / şüpheli metin",
    ASSIGNMENT_CONFLICT: "Atama koruması — üzerine yazılamaz",
    PUBLISH_FAILURE: "Yayınlama başarısız",
    CATALOG_WRITE_FAILURE: "Katalog yazımı başarısız",
    REVERSE_MATCH_CONFLICT: "Ters eşleştirme çakışması",
    AMBIGUOUS_ELIGIBLE_SUPPLIERS: "Birden fazla uygun satıcı",
    TEXT_ONLY_IDENTITY: "Yalnızca metin benzerliği",
    TITLE_OEM_MISMATCH: "Başlık ile OEM uyuşmuyor",
    DISPUTE_FLAG: "Uyuşmazlık işaretli",
    SYSTEM_FAILURE: "Sistem hatası",
    VALID_OEM: "Geçerli OEM",
    OEM_NORMALIZED_EXACT: "Normalize OEM tam eşleşme",
    UNIQUE_SUPPLIER: "Tek uygun satıcı",
    UNIQUE_ELIGIBLE_CANDIDATE: "Tek uygun aday",
    PROFILE_COMPLETE: "Profil tamam",
    SUPPLIER_ACTIVE: "satıcı aktif",
    BRAND_MATCH: "Marka eşleşmesi",
    MODEL_MATCH: "Model eşleşmesi",
    TITLE_HIGH_SIMILARITY: "Başlık benzerliği yüksek",
    INSUFFICIENT_EVIDENCE: "Yetersiz kanıt"
  };
  var ACTION_LABEL = {
    APPROVE_MATCH: "Eşleşmeyi onayla",
    KEEP_UNASSIGNED: "Atamasız bırak",
    REJECT_LISTING: "İlanı reddet",
    REQUEST_OEM_CORRECTION: "OEM düzeltmesi iste",
    ESCALATE_AMBIGUOUS: "Belirsizliği yükselt",
    REVIEW_SUPPLIER: "Satıcıyı incele",
    ACKNOWLEDGE_SYSTEM_ERROR: "Sistem hatasını kaydet",
    NO_ACTION: "Şimdilik işlem yok"
  };
  var SHADOW_LABEL = {
    AUTO_SAFE: "Otomatik-güvenli aday",
    REVIEW_REQUIRED: "İnceleme gerekli",
    REJECT_CANDIDATE: "Red adayı"
  };
  var PRI_ORDER = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
  var AUDIT_LABEL = {
    approve: "İlan onaylandı",
    reject: "İlan reddedildi",
    supplier_oem_indexed: "satıcı OEM indekslendi",
    inventory_demand_match: "Stok → talep eşleşmesi",
    rfq_auto_assign: "RFQ otomatik atandı",
    exception_resolve: "İstisna kararı",
    supplier_suspend: "satıcı askıya alındı",
    supplier_activate: "satıcı etkinleştirildi",
    rfq_assign: "RFQ atandı",
    login_wrong_portal: "Yanlış portal girişi"
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function typeLabel(t) {
    return TYPE_LABEL[String(t || "")] || String(t || "");
  }
  function reasonLabel(c) {
    var k = String(c || "");
    return REASON_LABEL[k] || k.replace(/_/g, " ");
  }
  function actionLabel(c) {
    return ACTION_LABEL[String(c || "")] || String(c || "");
  }
  function shadowLabel(c) {
    return SHADOW_LABEL[String(c || "")] || String(c || "");
  }

  function sortExceptions(list) {
    var rows = (list || []).slice();
    rows.sort(function (a, b) {
      var pa = PRI_ORDER[a && a.priority] != null ? PRI_ORDER[a.priority] : 9;
      var pb = PRI_ORDER[b && b.priority] != null ? PRI_ORDER[b.priority] : 9;
      if (pa !== pb) return pa - pb;
      return (Date.parse((a && a.createdAt) || "") || 0) - (Date.parse((b && b.createdAt) || "") || 0);
    });
    return rows;
  }

  function enabledActions(ex) {
    var entity = String((ex && ex.entityType) || "");
    var type = String((ex && ex.exceptionType) || "");
    var out = { APPROVE: false, REJECT: false, CORRECT: true };
    if (entity === "SupplierListings") {
      out.APPROVE = true;
      out.REJECT = true;
    } else if (entity === "RFQRequests" && type === "AMBIGUOUS_MATCH") {
      out.APPROVE = true;
    }
    return out;
  }

  function ageLabel(iso) {
    var t = Date.parse(iso || "");
    if (!Number.isFinite(t)) return "—";
    var m = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (m < 60) return m + " dk";
    var h = Math.round(m / 60);
    if (h < 48) return h + " sa";
    return Math.round(h / 24) + " gün";
  }

  function pct(v) {
    if (v == null || !Number.isFinite(Number(v))) return "—";
    return "%" + Math.round(Number(v) * 100);
  }

  function adminMediaUrl(item) {
    if (!item) return "";
    if (typeof item === "string") return item;
    return String(item.url || item.mediaId || "").trim();
  }

  function adminPhotosHtml(images, uploading) {
    var list = Array.isArray(images) ? images : [];
    var cells = list.map(function (item, index) {
      var url = adminMediaUrl(item);
      return '<div class="pz-admin-photo" data-admin-photo-idx="' + index + '">' +
        (url ? '<img src="' + esc(url) + '" alt="Ürün görseli ' + (index + 1) + '">' : '<span>Yükleniyor…</span>') +
        (index === 0 ? '<b>Kapak</b>' : '') +
        '<button type="button" data-admin-photo-remove="' + index + '" aria-label="Görseli sil">×</button></div>';
    }).join("");
    var canAdd = list.length < 6 && !uploading;
    cells += '<label class="pz-admin-photo-add"' + (canAdd ? '' : ' aria-disabled="true"') + '>' +
      (uploading ? 'Yükleniyor…' : canAdd ? 'Görsel ekle<br>(1–6)' : 'En fazla 6 görsel') +
      '<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple hidden data-admin-photo-input' + (canAdd ? '' : ' disabled') + '></label>';
    return '<div class="field pz-admin-images-field"><label>Görseller</label><p class="sub">Satıcı panelindeki gibi dosya seçin; ilk görsel kapak olur. JPG, PNG veya WEBP · en fazla 10 MB.</p><div class="pz-admin-photos">' + cells + '</div><p class="sub" id="pz-admin-upload-status" role="status">' + (uploading ? 'Görseller yükleniyor…' : 'En az 1 görsel zorunludur.') + '</p></div>';
  }

  function ensureFonts() {
    if (document.getElementById("pz-admin-ops-fonts")) return;
    var link = document.createElement("link");
    link.id = "pz-admin-ops-fonts";
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    (document.head || document.documentElement).appendChild(link);
  }

  function css() {
    return (
      ":host{display:block;width:100%;min-height:100vh;box-sizing:border-box}" +
      "*,*:before,*:after{box-sizing:border-box}" +
      ":host{--void:#0B0B0B;--plate:#111;--raise:#161616;--line:rgba(255,255,255,.08);--text:#F2F2F0;--mid:#A7A7A0;--dim:#6F6F68;--accent:#FF6B00;--accent-soft:rgba(255,107,0,.12);--ok:#3DDC97;--danger:#FF5C5C;--sans:\"IBM Plex Sans\",system-ui,sans-serif;--mono:\"IBM Plex Mono\",ui-monospace,monospace;--display:\"Archivo\",sans-serif;--sidebar:250px;font-family:var(--sans);color:var(--text);background:var(--void)}" +
      ".shell{min-height:100vh;display:grid;grid-template-columns:var(--sidebar) 1fr;background:var(--void)}" +
      ".shell.login-only,.shell.denied{grid-template-columns:1fr}" +
      ".scrim{display:none}" +
      "@media (max-width:960px){.shell{grid-template-columns:1fr}.nav{position:fixed;inset:0 auto 0 0;transform:translateX(-105%);z-index:50;width:min(86vw,280px);transition:transform .22s ease;height:100vh;overflow:auto}.nav.open{transform:none}.scrim{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:40}.scrim.show{display:block}.menu{display:inline-flex!important}.cards-mobile{display:grid!important}.table-wrap.desktop{display:none!important}}" +
      ".nav{background:#101010;border-right:1px solid var(--line);padding:20px 14px;display:flex;flex-direction:column;gap:16px}" +
      ".brand{display:flex;align-items:center;gap:10px}.pz-mark{width:32px;height:30px}" +
      ".brand-text{font-family:var(--display);font-stretch:125%;font-size:13px;letter-spacing:.04em;text-transform:uppercase}.brand-text small{display:block;font-family:var(--mono);font-size:9px;letter-spacing:.14em;color:var(--dim);margin-top:4px}" +
      ".nav-list{display:flex;flex-direction:column;gap:4px;flex:1}" +
      ".nav-add{appearance:none;border:1px solid var(--accent);background:var(--accent);color:#111;border-radius:8px;min-height:48px;padding:10px 12px;font:600 15px var(--sans);cursor:pointer;text-align:left}" +
      ".nav-list button{appearance:none;border:1px solid transparent;background:transparent;text-align:left;padding:11px 12px;border-radius:8px;font:500 13px/1.2 var(--sans);color:var(--mid);cursor:pointer}" +
      ".nav-list button.active,.nav-list button[aria-current=\"page\"]{color:var(--text);border-color:var(--accent);background:var(--accent-soft)}" +
      ".nav-foot{padding-top:12px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px}" +
      ".btn{appearance:none;border:1px solid var(--line);background:var(--raise);color:var(--text);border-radius:8px;min-height:40px;padding:0 12px;font:500 13px var(--sans);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}" +
      ".btn.primary{background:var(--accent);border-color:var(--accent);color:#111;font-weight:600}" +
      ".btn.danger{border-color:rgba(255,92,92,.45);color:#FF9B9B}" +
      ".btn[disabled]{opacity:.45;cursor:not-allowed}" +
      ".main{min-width:0;display:flex;flex-direction:column;min-height:100vh}" +
      ".top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--line);background:rgba(11,11,11,.94);position:sticky;top:0;z-index:10}" +
      ".menu{display:none;border:1px solid var(--line);background:var(--raise);border-radius:8px;padding:8px 10px;font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;color:var(--text)}" +
      ".title{font-family:var(--display);font-stretch:125%;font-size:clamp(18px,2.2vw,24px);margin:0;text-transform:uppercase}" +
      ".sub{color:var(--mid);font-size:13px;margin:4px 0 0}" +
      ".content{padding:18px clamp(14px,3vw,28px) 40px;overflow-x:hidden}" +
      ".login-wrap{max-width:420px;margin:48px auto;padding:28px 24px;background:var(--plate);border:1px solid var(--line);border-radius:10px}" +
      ".denied{max-width:520px;margin:64px auto;padding:28px;background:var(--plate);border:1px solid var(--line);border-radius:10px;text-align:center}" +
      ".denied a{color:var(--accent)}" +
      ".field{margin-bottom:14px}.field label{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px}" +
      ".field input,.field select,.field textarea{width:100%;min-height:42px;border:1px solid var(--line);background:#141414;color:var(--text);padding:0 12px;border-radius:8px;font:15px var(--sans)}" +
      ".purchase-search{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin:20px 0}.purchase-search .field{flex:1;min-width:220px;margin:0}.purchase-search .btn{min-height:46px}" +
      ".err{display:none;margin:0 0 12px;padding:10px 12px;border:1px solid #6B2A2A;background:#2A1515;color:#F2B4B4;border-radius:8px}.err.on{display:block}" +
      ".toast{display:none;margin:0 0 12px;padding:10px 12px;border:1px solid var(--line)}.toast.on{display:block}.toast.ok{border-color:#2F5B38;color:#B7E0C0}" +
      ".grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}" +
      ".metric,.card{background:var(--plate);border:1px solid var(--line);border-radius:10px;padding:14px}" +
      ".metric .k,.card .k{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}" +
      ".metric .v{font-family:var(--display);font-stretch:125%;font-size:26px;margin-top:8px}" +
      ".empty{padding:36px 8px;color:var(--mid);max-width:640px}.empty h3{color:var(--text);font-family:var(--display);font-stretch:125%;margin:0 0 8px}" +
      ".chip{display:inline-flex;padding:3px 8px;border-radius:999px;border:1px solid var(--line);font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--mid)}" +
      ".chip.crit{color:#FF9B9B;border-color:rgba(255,92,92,.4)}.chip.high{color:#FFB86B;border-color:var(--accent)}" +
      ".queue-item,.cards-mobile .card{width:100%;text-align:left;background:var(--plate);border:1px solid var(--line);border-radius:10px;padding:14px;cursor:pointer;color:var(--text);margin:0 0 10px}" +
      ".queue-item:hover{border-color:var(--accent)}" +
      ".section h3{margin:18px 0 8px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;font-family:var(--mono);color:var(--mid)}" +
      ".cand{border:1px solid var(--line);background:var(--raise);border-radius:8px;padding:12px;margin:0 0 8px}" +
      ".actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}" +
      ".filters{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}" +
      ".filters button{border:1px solid var(--line);background:var(--raise);color:var(--mid);padding:7px 10px;border-radius:8px;cursor:pointer;font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase}" +
      ".filters button.active{border-color:var(--accent);color:var(--text);background:var(--accent-soft)}" +
      ".table-wrap{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}" +
      "table{width:100%;border-collapse:collapse;min-width:680px}th,td{padding:10px 8px;border-bottom:1px solid var(--line);text-align:left;font-size:13px;vertical-align:top}" +
      "th{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}" +
      ".cards-mobile{display:none;gap:10px}" +
      ".commerce .card{overflow-wrap:anywhere;cursor:default}.commerce .filters button{min-height:44px}.commerce button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.commerce button:disabled{opacity:.45;cursor:default}" +
      ".commerce form{display:grid;gap:8px;max-width:640px;margin:14px 0}.commerce form input:not([type=checkbox]),.commerce form select{width:100%;min-width:0;max-width:100%;min-height:44px;background:#141414;color:var(--text);border:1px solid var(--line);border-radius:8px;padding:8px}.commerce form button{min-height:44px}.commerce form label{overflow-wrap:anywhere}" +
      ".thumbs{display:flex;flex-wrap:wrap;gap:8px} .thumbs img{width:72px;height:72px;object-fit:cover;border:1px solid var(--line)}" +
      ".pz-admin-owner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;margin:0 0 14px;border:1px solid var(--accent);background:var(--accent-soft);border-radius:10px}.pz-admin-owner strong{font-size:17px}.pz-admin-owner span{color:var(--mid);font-size:14px}.pz-admin-new-head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:0 0 14px}.pz-admin-new-head h2{margin:0}.pz-admin-new-head .btn.primary{min-height:48px;padding:10px 18px}.pz-admin-photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px;margin-top:8px}.pz-admin-photo{position:relative;aspect-ratio:1;border:1px solid var(--line);background:var(--raise);overflow:hidden;border-radius:8px}.pz-admin-photo img{width:100%;height:100%;object-fit:cover;display:block}.pz-admin-photo span{display:flex;width:100%;height:100%;align-items:center;justify-content:center;color:var(--mid);font-size:12px}.pz-admin-photo b{position:absolute;left:0;right:0;bottom:0;padding:4px;text-align:center;background:rgba(0,0,0,.72);color:#fff;font:11px var(--mono);text-transform:uppercase}.pz-admin-photo button{position:absolute;right:4px;top:4px;width:28px;height:28px;border:0;border-radius:4px;background:rgba(0,0,0,.72);color:#fff;cursor:pointer;font-size:18px}.pz-admin-photo-add{min-height:96px;border:1px dashed var(--line);display:flex;align-items:center;justify-content:center;text-align:center;color:var(--mid);font:12px var(--mono);cursor:pointer;border-radius:8px;padding:8px}.pz-admin-photo-add[aria-disabled=true]{opacity:.5;cursor:not-allowed}.pz-admin-images-field>.sub{margin:4px 0 8px}.pz-admin-images-field{grid-column:1/-1}" +
      ".help{display:none;margin-top:10px;color:var(--mid);font-size:13px}.help.on{display:block}" +
      ".sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}" +
      // Admin shadow-root only. Explicit base size prevents Wix's small inherited font.
      ":host{--void:#F5F6F8;--plate:#FFFFFF;--raise:#EEF1F5;--line:#8995A3;--text:#20252B;--mid:#52606D;--dim:#52606D;--ok:#176440;--danger:#AE2424;color-scheme:light;font-size:18px;line-height:1.6}" +
      ":host([data-admin-theme=dark]){--void:#0B0B0B;--plate:#111111;--raise:#1C1F24;--line:#77818D;--text:#F2F2F0;--mid:#BAC2CC;--dim:#BAC2CC;--ok:#9CDEB8;--danger:#FFA6A6;color-scheme:dark}" +
      ".nav,.top{background:var(--plate)}.top{flex-wrap:wrap}.sub,.help{font-size:16px;overflow-wrap:anywhere}" +
      ".content{font-size:18px;line-height:1.65;overflow-wrap:anywhere}.section{max-width:100%}.section p{margin:8px 0 18px}.section h3{font-size:17px;letter-spacing:.06em;margin-top:24px;font-weight:600}" +
      ".brand-text{font-size:15px}.brand-text small{font-size:13px}.title{font-size:clamp(22px,2.2vw,28px)}" +
      ".btn,.nav-list button,.menu,.filters button{font-size:16px;line-height:1.4;min-height:44px}.btn{padding:10px 14px}.menu{letter-spacing:.04em}" +
      ".field label,.metric .k,.card .k,th,.chip{font-size:14px;letter-spacing:.04em}.field input,.field select,.field textarea,.commerce form input:not([type=checkbox]),.commerce form select{background:var(--plate);font:inherit;font-size:17px;min-height:46px;padding:10px 12px}" +
      "td{font-size:16px}.queue-item,.cards-mobile .card{font:inherit;line-height:1.6}.btn.danger,.chip.crit{color:var(--danger);border-color:var(--danger)}.chip.high{color:var(--text)}" +
      ".err{background:var(--plate);color:var(--danger);border-color:var(--danger)}.toast.ok{color:var(--ok);border-color:var(--ok)}.denied a{color:var(--text);text-decoration:underline}" +
      ".theme-switch{display:flex;gap:4px;flex-wrap:wrap;padding:4px;border:1px solid var(--line);border-radius:10px;background:var(--raise)}.theme-switch button{min-width:70px}.theme-switch button[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#111}" +
      "button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:3px solid var(--text);outline-offset:3px}" +
      ":host([data-admin-theme=dark]) .pz-pricing{background:var(--void);color:var(--text)}:host([data-admin-theme=dark]) .pz-pricing :is(.pr-box,input,select,button,th,td){background:var(--plate);color:var(--text);border-color:var(--line)}:host([data-admin-theme=dark]) .pz-pricing :is(.pr-muted,dt){color:var(--mid)}:host([data-admin-theme=dark]) .pz-pricing .pr-error{color:var(--danger)}:host([data-admin-theme=dark]) .pz-pricing button.primary{background:var(--accent);color:#111}" +
      "@media(max-width:560px){.top{position:static;padding:14px}.theme-switch{width:100%}.theme-switch button{flex:1}.title{font-size:22px}.content{padding:16px 14px 32px}.login-wrap{margin:24px 12px;padding:20px;min-width:0}}"
    );
  }

  function portalBusPush(item) {
    try {
      if (typeof window === "undefined") return;
      window.__PZ_PORTAL_Q = window.__PZ_PORTAL_Q || [];
      window.__PZ_PORTAL_Q.push(item);
      window.dispatchEvent(new CustomEvent("pz-portal-bridge", { detail: item }));
    } catch (e) {}
  }

  function portalBusWait(reqId, timeoutMs) {
    return new Promise(function (resolve) {
      var started = Date.now();
      var t = setInterval(function () {
        try {
          var bag = (typeof window !== "undefined" && window.__PZ_PORTAL_R) || {};
          if (bag && bag[reqId]) {
            clearInterval(t);
            var out = bag[reqId];
            try {
              delete bag[reqId];
            } catch (e) {}
            resolve(out);
            return;
          }
        } catch (e2) {}
        if (Date.now() - started > (timeoutMs || 25000)) {
          clearInterval(t);
          resolve({ ok: false, error: { message: "Zaman aşımı" } });
        }
      }, 200);
    });
  }

  function accessTokenFor(self) {
    var stored = self._readStored ? self._readStored() : null;
    return (self._session && self._session.portalAccessToken) || (stored && stored.portalAccessToken) || "";
  }

  function portalApiHttp(method, payload, accessToken) {
    var headers = { "Content-Type": "application/json" };
    if (accessToken) {
      headers.Authorization = "Bearer " + accessToken;
      headers["x-pz-portal-access-token"] = accessToken;
    }
    var body = { method: method, payload: payload || {}, portal: "yonetici" };
    if (accessToken) {
      body.portalAccessToken = accessToken;
      body.accessToken = accessToken;
    }
    return fetch(fnBase() + "/portalRpc", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: headers,
      body: JSON.stringify(body)
    })
      .then(function (r) {
        return r.json().catch(function () {
          return { ok: false, error: { message: "İşlem tamamlanamadı" } };
        });
      })
      .catch(function () {
        return { ok: false, error: { message: "Bağlantı kurulamadı" } };
      });
  }

  function bridgeRpcUnknown(res) {
    return !!(
      res &&
      res.error &&
      String(res.error.message || "").indexOf("Bilinmeyen") >= 0
    );
  }

  function publicLoginMessage(res) {
    var msg = String((res && res.message) || (res && res.error && res.error.message) || "");
    if (/çok fazla başarısız/i.test(msg)) {
      return "Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.";
    }
    if (/zaman aşımı/i.test(msg) || /giriş şu anda yapılamıyor/i.test(msg)) {
      return "Giriş şu anda yapılamıyor. Lütfen tekrar deneyin.";
    }
    if (/FUNCTION_NOT_FOUND|INTERNAL_ERROR|debugCode|Unauthorized/i.test(msg)) {
      return "Giriş şu anda yapılamıyor. Lütfen tekrar deneyin.";
    }
    if (msg && msg.length <= 160 && msg.indexOf("{") < 0) return msg;
    return "E-posta veya şifre hatalı";
  }

  function fnBase() {
    try {
      var path = String((location && location.pathname) || "/");
      var parts = path.split("/").filter(Boolean);
      if (!parts.length) return "/_functions";
      var first = String(parts[0] || "").toLowerCase();
      if (first === "yonetim" || first === "tedarikci" || first === "kataloglar") return "/_functions";
      if (first.indexOf(".") === -1) return "/" + parts[0] + "/_functions";
    } catch (e) {}
    return "/_functions";
  }

  class ParcaZinciriAdminOps extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._theme = savedTheme();
      this._screen = "queue";
      this._session = null;
      this._view = "boot";
      this._data = {};
      this._commerceKind = "matches";
      this._commerceOffset = 0;
      this._loadVersion = 0;
      this._detail = null;
      this._filter = "";
      this._toast = "";
      this._err = "";
      this._navOpen = false;
      this._busy = false;
      this._loginBusy = false;
      this._pendingApi = Object.create(null);
      this._adminDraft = null;
      this._adminImages = [];
      this._adminUploadsInFlight = 0;
      this._adminSaving = false;
      this.shadowRoot.innerHTML =
        "<style>" +
        css() +
        "</style><div class=\"shell login-only\"><div class=\"content\"><div class=\"login-wrap\" role=\"status\"><h2 class=\"title\">Yönetici Aktivasyonu</h2><p class=\"sub\">Yönetim konsolu hazırlanıyor…</p><p>Giriş Yap görünür olacak.</p></div></div></div>";
    }

    static get observedAttributes() {
      return ["data-pz-portal-auth", "pzportalauth", "data-pz-portal-api-result", "pzportalapiresult"];
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (newValue && name.indexOf("api-result") >= 0) {
        try {
          var reply = JSON.parse(newValue);
          var pending = reply && this._pendingApi[reply.reqId];
          if (pending && reply.result) pending(reply.result);
        } catch (eReply) {}
      }
      if (newValue && newValue !== oldValue && this.__onAttr) this.__onAttr(name, newValue);
    }

    connectedCallback() {
      if (this.__booted) return;
      this.__booted = true;
      this.setAttribute("data-admin-theme", this._theme);
      ensureFonts();
      if(this.mobileAdapter){
        this._session=this.mobileAdapter.identity;this._view='app';this._screen='owned';
        this._render();this._loadScreen();return;
      }
      this._bindSession();
      this._hydrate();
    }

    disconnectedCallback(){this._loadVersion++;this._screenHistory?.dispose();this._screenHistory=null;}

    _host() {
      var root = this.getRootNode();
      if (root && root.host && String(root.host.tagName || "").toLowerCase() === "parca-zinciri-admin-console") {
        return root.host;
      }
      return this;
    }

    _qs(sel) {
      return this.shadowRoot.querySelector(sel);
    }

    _bindSession() {
      var host = this;
      host.__onAttr = function (name, raw) {
        try {
          var payload = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (!payload) return;
          if (name.indexOf("auth") >= 0 && host.__loginWait) host.__loginWait(payload.result || payload);
        } catch (e) {}
      };
    }

    portalApi(method, payload) {
      if(this.mobileAdapter)return this.mobileAdapter.call(method,payload||{});
      var self = this;
      var host = this._host();
      var token = accessTokenFor(self);
      var waitStarted = Date.now();

      function bridgeCall() {
        return new Promise(function (resolve) {
          var bridgeReady = false;
          try {
            bridgeReady = host.getAttribute("data-pz-portal-bridge-ready") === "1";
          } catch (eBr) {}
          if (!bridgeReady) {
            if (host !== self) {
              if (Date.now() - waitStarted > 10000) {
                resolve({ ok: false, error: { code: "BRIDGE_UNAVAILABLE" } });
              } else {
                setTimeout(function () { bridgeCall().then(resolve); }, 100);
              }
              return;
            }
            portalApiHttp(method, payload || {}, token).then(resolve);
            return;
          }
          var reqId = "api_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1e9).toString(36);
          var detail = { kind: "api", reqId: reqId, method: method, payload: payload || {}, portal: "yonetici" };
          var started = Date.now();
          var done = false;
          var poll;
          function finish(res) {
            if (done) return;
            done = true;
            clearInterval(poll);
            delete self._pendingApi[reqId];
            resolve(res || { ok: false });
          }
          self._pendingApi[reqId] = finish;
          try {
            host.setAttribute("data-pz-portal-api-request", JSON.stringify(detail));
          } catch (eA) {}
          try {
            host.dispatchEvent(new CustomEvent("pz-portal-api", { bubbles: true, composed: true, detail: detail }));
          } catch (eE) {}
          portalBusPush(detail);
          if (done) return;
          poll = setInterval(function () {
            try {
              var bag = (typeof window !== "undefined" && window.__PZ_PORTAL_R) || {};
              if (bag && bag[reqId]) {
                clearInterval(poll);
                var out = bag[reqId];
                try {
                  delete bag[reqId];
                } catch (eD) {}
                finish(out);
                return;
              }
              var raw =
                host.getAttribute("data-pz-portal-api-result") || host.getAttribute("pzportalapiresult");
              if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed && parsed.reqId === reqId && parsed.result) {
                  clearInterval(poll);
                  try {
                    host.removeAttribute("data-pz-portal-api-result");
                    host.removeAttribute("pzportalapiresult");
                  } catch (eRm) {}
                  finish(parsed.result);
                  return;
                }
              }
            } catch (eP) {}
            if (Date.now() - started > 30000) {
              clearInterval(poll);
              finish({ ok: false, error: { message: "Zaman aşımı" } });
            }
          }, 200);
        });
      }

      if (token) {
        return portalApiHttp(method, payload || {}, token).then(function (res) {
          if (bridgeRpcUnknown(res)) return bridgeCall();
          return res;
        });
      }
      return bridgeCall();
    }

    _readStored() {
      try {
        var raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        var s = JSON.parse(raw);
        if (!s || s.role !== "platform_admin") return null;
        return s;
      } catch (e) {
        return null;
      }
    }

    _writeStored(s) {
      try {
        if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
        else sessionStorage.removeItem(SESSION_KEY);
      } catch (e) {}
    }

    _hydrate() {
      var self = this;
      var settled = false;
      function applyUser(res) {
        if (settled) return;
        settled = true;
        var data = (res && res.data) || res || {};
        var role = data.role || "";
        if (res && res.ok && role === "platform_admin") {
          var stored = self._readStored();
          self._session = {
            ok: true,
            role: role,
            email: data.email,
            displayName: data.displayName || data.email,
            portalAccessToken:
              data.portalAccessToken || (stored && stored.portalAccessToken) || ""
          };
          self._writeStored(self._session);
          self._view = "app";
          self._screen = "queue";
          self._render();
          self._loadScreen();
          return;
        }
        if (res && res.ok && (role === "supplier_owner" || role === "supplier_staff")) {
          self._writeStored(null);
          self._view = "denied";
          self._render();
          return;
        }
        var cached = self._readStored();
        if (cached && cached.portalAccessToken) {
          self._session = cached;
          self._view = "app";
          self._screen = "queue";
          self._render();
          self._loadScreen();
          return;
        }
        self._writeStored(null);
        self._session = null;
        self._view = "login";
        self._render();
      }
      var cached = this._readStored();
      if (this._host() === this && cached && cached.portalAccessToken) {
        applyUser({ ok: true, role: cached.role, email: cached.email, displayName: cached.displayName });
        this.portalApi("getCurrentPortalUser", {}).then(function (res) {
          if (res && res.ok) applyUser(res);
        });
        return;
      }
      this.portalApi("getCurrentPortalUser", {}).then(applyUser);
    }

    _login(email, password) {
      var self = this;
      if (self._loginBusy) return;
      self._loginBusy = true;
      var loginBtn = this._qs("#pz-ops-login-btn");
      if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = "Giriş yapılıyor…";
      }
      var host = this._host();
      var reqId = "login_" + Date.now().toString(36);
      var detail = { kind: "login", reqId: reqId, email: email, password: password, portal: "yonetici" };
      var settled = false;
      function finish(res) {
        if (settled) return;
        settled = true;
        self._loginBusy = false;
        if (!res || !res.ok || res.role !== "platform_admin") {
          if (res && (res.role === "supplier_owner" || res.role === "supplier_staff")) {
            self._view = "denied";
            self._render();
            return;
          }
          self._err = publicLoginMessage(res);
          self._view = "login";
          self._render();
          return;
        }
        self._session = {
          ok: true,
          role: res.role,
          email: res.email,
          displayName: res.displayName || res.email,
          portalAccessToken: res.portalAccessToken || ""
        };
        self._writeStored(self._session);
        self._view = "app";
        self._screen = "queue";
        self._render();
        self._loadScreen();
      }
      host.__pzOnPortalAuth = function (raw) {
        try {
          var payload = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (!payload || (payload.reqId && payload.reqId !== reqId)) return;
          finish(payload.result || payload);
          try {
            host.removeAttribute("data-pz-portal-auth");
            host.removeAttribute("pzportalauth");
          } catch (eRm) {}
        } catch (eAuth) {}
      };
      try {
        var pendingAuth =
          host.__pzPendingPortalAuth ||
          host.getAttribute("data-pz-portal-auth") ||
          host.getAttribute("pzportalauth");
        if (pendingAuth) {
          host.__pzPendingPortalAuth = null;
          host.__pzOnPortalAuth(pendingAuth);
        }
      } catch (eDrain) {}
      try {
        host.setAttribute("data-pz-portal-login-request", JSON.stringify(detail));
      } catch (e1) {}
      try {
        host.dispatchEvent(new CustomEvent("pz-portal-demo-login", { bubbles: true, composed: true, detail: detail }));
      } catch (e2) {}
      portalBusPush(detail);
      var authPoll = setInterval(function () {
        try {
          var raw = host.getAttribute("data-pz-portal-auth") || host.getAttribute("pzportalauth");
          if (!raw) return;
          var parsed = JSON.parse(raw);
          if (parsed && parsed.reqId === reqId && parsed.result) {
            clearInterval(authPoll);
            finish(parsed.result);
          }
        } catch (ePoll) {}
      }, 200);
      setTimeout(function () {
        clearInterval(authPoll);
      }, 26000);
      portalBusWait(reqId, 25000).then(function (res) {
        clearInterval(authPoll);
        finish(res);
      });
    }

    _logout() {
      if(this.mobileAdapter){this.mobileAdapter.logout();return;}
      var self = this;
      this._writeStored(null);
      this._session = null;
      try {
        if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(SESSION_KEY);
      } catch (e) {}
      this.portalApi("logout", {}).then(function () {
        self._view = "login";
        self._data = {};
        self._detail = null;
        self._render();
      });
    }

    _rememberScreen() {
      if (this._view !== 'app') return;
      var self=this;
      var route={screen:this._screen,commerceKind:this._commerceKind || 'matches',exceptionId:this._detail?.exceptionId || '',listingKey:this._pricingListingKey || ''};
      if (!this._screenHistory) this._screenHistory=pzListingPricing.createScreenHistory({key:'pz-admin-screens',initial:route,navigate:async function(next){
        self._screen=next.screen;self._commerceKind=next.commerceKind;self._pricingListingKey=next.listingKey || '';self._detail=null;
        if(next.screen==='detail' && next.exceptionId){await self._openDetail(next.exceptionId);return;}
        self._loadScreen();
      }});
      else this._screenHistory.record(route);
    }

    _loadScreen() {
      var self = this;
      var s = this._screen;
      var loadVersion = ++this._loadVersion;
      this._busy = true;
      this._err = "";
      this._render();
      function request(method, payload) {
        return self.portalApi(method, payload).then(function (result) {
          if (!result || result.ok !== true) throw new Error("ADMIN_DATA_UNAVAILABLE");
          return result;
        });
      }
      var jobs = [];
      if (s === 'articles') {
        jobs.push(request('adminArticles',{action:'list',offset:this._articleOffset||0}).then(r=>{if(loadVersion===self._loadVersion)self._data.articles=r.data;}));
      }
      if (s === "owned") {
        jobs.push(request("getAdminOwnedProducts", Object.assign({},this._ownedFilters || {},{offset:this._ownedOffset || 0})).then(function(r){
          if (loadVersion !== self._loadVersion) return;
          if (!r.data || !Array.isArray(r.data.items)) throw new Error("INVALID_OWNED_DATA");
          self._data.ownedProducts=r.data;
        }));
      }
      if (s === "costs") {
        jobs.push(request("getAdminCatalogPurchasePrices", {source:this._purchaseSource || 'yuksel-automotive',search:this._purchaseSearch || "",offset:this._purchaseOffset || 0}).then(function (r) {
          if (loadVersion !== self._loadVersion) return;
          if (!r.data || !Array.isArray(r.data.items)) throw new Error("INVALID_PURCHASE_DATA");
          self._data.purchasePrices = r.data;
        }));
      }
      if (s === "commerce" && this._commerceKind === "readiness") {
        jobs.push(request("getCommerceReadiness", {}).then(function (r) {
          if (loadVersion !== self._loadVersion) return;
          if (!r.data || !Array.isArray(r.data.checks) || !Array.isArray(r.data.missingCapabilities)) throw new Error("INVALID_COMMERCE_DATA");
          self._data.commerceReadiness = r.data;
        }));
      }
      if (s === "commerce" && this._commerceKind === "commission") {
        jobs.push(request("getCommissionSettings", {companyId:this._commissionCompanyId || "",search:this._commissionSearch || "",
          offset:this._commissionDirectoryOffset || 0,historyOffset:this._commissionHistoryOffset || 0}).then(function(r) {
          if (loadVersion !== self._loadVersion) return;
          if (!r.data || !Number.isSafeInteger(r.data.effectiveRateBps)) throw new Error("INVALID_COMMISSION_DATA");
          self._data.commission = r.data;
        }));
      }
      if (s === "commerce" && this._commerceKind === "case" && this._commerceCaseRef) {
        jobs.push(request("getCommerceCase",this._commerceCaseRef).then(function(r){
          if (loadVersion !== self._loadVersion) return;
          self._data.commerceCase=r.data;
        }));
      }
      if (s === "commerce" && this._commerceKind !== "readiness" && this._commerceKind !== "commission" && this._commerceKind !== "case") {
        jobs.push(request("listCommerceRecords", { kind: this._commerceKind, offset: this._commerceOffset }).then(function (r) {
          if (loadVersion !== self._loadVersion) return;
          if (!r.data || ["available", "unavailable"].indexOf(r.data.state) < 0 ||
              (r.data.state === "available" && !Array.isArray(r.data.items))) throw new Error("INVALID_COMMERCE_DATA");
          self._data.commerce = r.data;
        }));
      }
      if (s === "queue" || s === "overview") {
        jobs.push(
          request("getExceptionSummary", {}).then(function (r) {
            self._data.summary = r && r.ok ? r.data : null;
          })
        );
      }
      if (s === "queue") {
        jobs.push(
          request("listExceptions", {}).then(function (r) {
            self._data.exceptions = r && r.ok ? r.data || [] : [];
          })
        );
      }
      if (s === "overview") {
        jobs.push(
          request("getAdminDashboard", {}).then(function (r) {
            self._data.dash = r && r.ok ? r.data : null;
          })
        );
      }
      if (s === "rfqs") {
        jobs.push(
          request("listAllRfqs", {}).then(function (r) {
            self._data.rfqs = r && r.ok ? r.data || [] : [];
          })
        );
      }
      if (s === "listings") {
        jobs.push(
          request("listPendingModeration", {}).then(function (r) {
            self._data.moderation = r && r.ok ? r.data : null;
          })
        );
      }
      if (s === "suppliers") {
        jobs.push(
          request("listSuppliers", {}).then(function (r) {
            self._data.suppliers = r && r.ok ? r.data || [] : [];
          })
        );
        jobs.push(
          request("getTrustCalibration", {}).then(function (r) {
            self._data.trust = r && r.ok ? r.data || [] : [];
          })
        );
      }
      if (s === "new") {
        // Taxonomy is public reference data, not an authenticated admin RPC.
        // Use the same endpoint as product filters; keep the Velo bridge as fallback.
        jobs.push(fetch((this.mobileAdapter ? 'https://www.parcazinciri.com/_functions' : fnBase()) + '/catalogMachineCatalog?t=' + Date.now(), {credentials:'omit'})
          .then(function(response) { if (!response.ok) throw new Error('CATALOG_UNAVAILABLE'); return response.json(); })
          .then(function(r) { if (!r.ok || !r.data || !r.data.modelsByTypeAndBrand) throw new Error('INVALID_CATALOG'); return r; })
          .catch(function() { return request("getAdminMachineCatalog", {}); }).then(function (r) {
          if (loadVersion !== self._loadVersion) return;
          self._data.adminMachineCatalog = r.data || {};
        }).catch(function () {
          // Catalog enrichment is optional for rendering. The server still
          // validates the selected/manual brand and model on submit.
          self._data.adminMachineCatalog = { brandsByType: { excavator: [{ id: "__other__", name: "Listede Yok / Diğer" }] }, modelsByTypeAndBrand: { excavator: { __other__: [{ id: "__other__", name: "Listede Yok / Diğer" }] } } };
        }));
      }
      if (s === "audit") {
        jobs.push(
          request("listAuditLogs", { limit: 80 }).then(function (r) {
            self._data.audit = r && r.ok ? r.data || [] : [];
          })
        );
      }
      Promise.all(jobs).then(function () {
        if (loadVersion !== self._loadVersion) return;
        self._busy = false;
        self._render();
      }).catch(function () {
        if (loadVersion !== self._loadVersion) return;
        self._busy = false;
        self._err = "Yönetici verileri alınamadı. Bu ekran boş veri olarak gösterilmedi; sekmeyi yeniden seçerek deneyin.";
        self._render();
      });
    }

    _openDetail(id) {
      var self = this;
      return this.portalApi("getExceptionDetail", { exceptionId: id }).then(function (r) {
        self._detail = r && r.ok ? r.data : null;
        self._screen = "detail";
        self._render();
      });
    }

    _resolve(humanAction, extra) {
      var self = this;
      var id = this._detail && this._detail.exceptionId;
      if (!id) return;
      var payload = Object.assign({ exceptionId: id, humanAction: humanAction }, extra || {});
      this.portalApi("resolveException", payload).then(function (r) {
        if (!r || !r.ok) {
          self._err = (r && r.error && r.error.message) || "İşlem tamamlanamadı";
          self._render();
          return;
        }
        self._toast = "Karar kaydedildi";
        self._detail = null;
        self._screen = "queue";
        self._loadScreen();
      });
    }


    _syncRequiredSteps(form) {
      if (!form) return;
      if (!form.querySelector('[data-step-style]')) {
        const style = document.createElement('style');
        style.dataset.stepStyle = '';
        style.textContent = '.pz-next-required{outline:2px solid #ff6b00!important;outline-offset:2px;background:#fff3e8!important;color:#20160e!important}.pz-step-hint{display:block;color:#a83b00;background:#fff3e8;border-left:3px solid #ff6b00;padding:5px 8px;margin:6px 0;font:600 12px/1.4 Arial,sans-serif;letter-spacing:0;text-transform:none}';
        form.appendChild(style);
      }
      form.querySelectorAll('.pz-next-required').forEach(field => {
        field.classList.remove('pz-next-required');
        const ids = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== 'pz-next-step-hint');
        if (ids.length) field.setAttribute('aria-describedby', ids.join(' '));
        else field.removeAttribute('aria-describedby');
      });
      form.querySelectorAll('[data-step-hint]').forEach(hint => hint.remove());
      const fields = form.elements;
      const names = ['machineType', 'machineBrandId'];
      if (fields.machineBrandId?.value === '__other__') names.push('manualBrandName');
      names.push('machineModelId');
      if (fields.machineModelId?.value === '__other__') names.push('manualModelName');
      names.push('partGroupId', 'partSubgroupId');
      const field = names.map(name => fields[name]).find(control =>
        control && !control.disabled && !control.closest('[hidden]') &&
        !control.value.trim());
      if (!field) return;
      field.classList.add('pz-next-required');
      const hint = document.createElement('span');
      hint.id = 'pz-next-step-hint';
      hint.dataset.stepHint = '';
      hint.className = 'pz-step-hint';
      hint.textContent = 'Sıradaki adım: ' + (field.labels?.[0]?.textContent.trim() || 'Bu alanı tamamlayın');
      field.insertAdjacentElement('afterend', hint);
      field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), hint.id].filter(Boolean).join(' '));
    }

    _render() {
      this._rememberScreen();
      var root = this.shadowRoot;
      if (this._view === "denied") {
        root.innerHTML =
          "<style>" +
          css() +
          "</style><div class=\"shell denied\" id=\"pz-ops-shell\"><div class=\"denied\" id=\"pz-ops-denied\"><h2>ACCESS DENIED</h2><p>Bu sayfa yalnızca platform yöneticileri içindir.</p><p><a href=\"/tedarikci\">Satıcı paneline dön</a></p></div></div>";
        return;
      }
      if (this._view !== "app") {
        if (this._host() !== this) {
          root.innerHTML = "<style>" + css() + "</style>" +
            '<div class="shell login-only"><div class="login-wrap"><h2>Yönetici oturumu</h2>' +
            '<p>Yönetici verileri henüz doğrulanamadı. Yeniden deneme mevcut Wix oturumunu kontrol eder.</p>' +
            '<button class="btn" id="pz-ops-retry">Yeniden Dene</button>' +
            '<button class="btn" id="pz-ops-native-login">Wix ile Giriş Yap</button></div></div>';
          var owner = this;
          this._qs("#pz-ops-retry").onclick = function () { this.disabled = true; owner._hydrate(); };
          this._qs("#pz-ops-native-login").onclick = function () {
            var host = owner._host();
            host.setAttribute("data-pz-admin-login-request", String(Date.now()));
            host.dispatchEvent(new CustomEvent("pz-admin-login", { bubbles: true, composed: true }));
          };
          return;
        }
        root.innerHTML =
          "<style>" +
          css() +
          "</style><div class=\"shell login-only\" id=\"pz-ops-shell\"><div class=\"login-wrap\" id=\"pz-ops-login\"><h2 class=\"title\" id=\"pz-ops-login-title\">Yönetici Aktivasyonu</h2><p class=\"sub\">Parça Zinciri operasyon konsolu</p><div class=\"err" +
          (this._err ? " on" : "") +
          "\" id=\"pz-ops-err\">" +
          esc(this._err) +
          "</div><form id=\"pz-ops-form\"><div class=\"field\"><label for=\"pz-ops-email\">E-posta</label><input id=\"pz-ops-email\" type=\"email\" autocomplete=\"username\" required></div><div class=\"field\"><label for=\"pz-ops-pass\">Şifre</label><input id=\"pz-ops-pass\" type=\"password\" autocomplete=\"current-password\" required></div><button class=\"btn primary\" type=\"submit\" id=\"pz-ops-login-btn\"" +
          (this._loginBusy ? " disabled" : "") +
          ">" +
          (this._loginBusy ? "Giriş yapılıyor…" : "Giriş Yap") +
          "</button></form></div></div>";
        var form = this._qs("#pz-ops-form");
        var self = this;
        if (form) {
          form.addEventListener("submit", function (ev) {
            ev.preventDefault();
            if (self._loginBusy) return;
            self._err = "";
            var btn = self._qs("#pz-ops-login-btn");
            if (btn) {
              btn.disabled = true;
              btn.textContent = "Giriş yapılıyor…";
            }
            self._login(self._qs("#pz-ops-email").value, self._qs("#pz-ops-pass").value);
          });
        }
        return;
      }
      var inst = this;
      function screenOn(id) {
        if (id === "queue" && inst._screen === "detail") return true;
        return inst._screen === id;
      }
      var nav = NAV.filter(n=>!this.mobileAdapter||['owned','costs','listings','suppliers'].includes(n.id)).map(function (n) {
        return (
          "<button type=\"button\" data-nav=\"" +
          n.id +
          "\" class=\"" +
          (screenOn(n.id) ? "active" : "") +
          "\" " +
          (screenOn(n.id) ? "aria-current=\"page\"" : "") +
          ">" +
          esc(n.label) +
          "</button>"
        );
      }).join("");
      var title = "Sizi Bekleyenler";
      var i;
      for (i = 0; i < NAV.length; i++) if (NAV[i].id === this._screen) title = NAV[i].label;
      if (this._screen === "new") title = "Ürün Ekle";
      if (this._screen === "detail") title = "İstisna";
      root.innerHTML =
        "<style>" +
        css() +
        "</style><div class=\"shell\" id=\"pz-ops-shell\"><div class=\"scrim\" id=\"pz-ops-scrim\"></div>" +
        "<aside class=\"nav\" id=\"pz-ops-nav\" aria-label=\"Yönetim menü\"><div class=\"brand\">" +
        MARK +
        "<div class=\"brand-text\">Parça Zinciri<small>Operasyon</small></div></div><button type=\"button\" class=\"nav-add\" data-nav=\"new\">+ Ürün Ekle</button><div class=\"nav-list\">" +
        nav +
        "</div><div class=\"nav-foot\"><button type=\"button\" class=\"btn\" id=\"pz-ops-help\">Yardım</button><button type=\"button\" class=\"btn\" id=\"pz-ops-logout\">Çıkış Yap</button><a class=\"btn\" href=\"/yonetim?kurulum=1\">Kurulum</a></div></aside>" +
        "<div class=\"main\"><header class=\"top\"><div style=\"display:flex;gap:8px;min-width:0\"><button type=\"button\" class=\"menu\" id=\"pz-ops-menu\">Menü</button><div><h1 class=\"title\" id=\"pz-ops-title\">" +
        esc(title) +
        "</h1><p class=\"sub\">" +
        esc((this._session && this._session.displayName) || "") +
        '</p></div></div><div class="theme-switch" role="group" aria-label="Görünüm">' +
        '<button type="button" class="btn" data-theme="light" aria-pressed="' + (this._theme === "light") + '">Açık</button>' +
        '<button type="button" class="btn" data-theme="dark" aria-pressed="' + (this._theme === "dark") + '">Koyu</button>' +
        '</div></header><pz-euro-rate></pz-euro-rate><div class="content" id="pz-ops-content">' +
        (this._toast ? "<div class=\"toast on ok\">" + esc(this._toast) + "</div>" : "") +
        (this._err ? "<div class=\"err on\">" + esc(this._err) + "</div>" : "") +
        this._body() +
        "<div class=\"help\" id=\"pz-ops-helpbox\">Olağan işlemler otomatik yürür. Bu konsol yalnızca istisnalar, moderasyon ve satıcı durumları içindir. Trusted auto-publish kapalıdır.</div></div></div></div>";
      this._toast = "";
      this._bindApp();
    }

    _body() {
      if (this._busy) return "<p class=\"sub\">Yükleniyor…</p>";
      if (this._err) return "";
      switch (this._screen) {
        case "overview":
          return this._overview();
        case "queue":
          return this._queue();
        case "detail":
          return this._detailView();
        case "rfqs":
          return this._rfqs();
        case "commerce":
          return this._commerce();
        case "costs":
          return this._purchasePrices();
        case "owned":
          return this._ownedProducts();
        case "listings":
          return this._listings();
        case "new":
          return this._newProduct();
        case "articles":
          return this._articles();
        case "suppliers":
          return this._suppliers();
        case "audit":
          return this._audit();
        default:
          return this._queue();
      }
    }

    _overview() {
      var s = this._data.summary || {};
      var m = s.metrics || {};
      var d = this._data.dash || {};
      var waiting = s.waiting || [];
      var open = s.totalOpen || 0;
      var html =
        "<div class=\"grid\">" +
        this._metric("Bekleyen istisna", open) +
        this._metric("Onay bekleyen ilan", d.pendingListings != null ? d.pendingListings : "—") +
        this._metric("Açık talep", d.openRfqs != null ? d.openRfqs : "—") +
        this._metric("Aktif satıcı", d.activeSuppliers != null ? d.activeSuppliers : "—") +
        this._metric("Otomatik-güvenli aday", s.pendingAutoSafe != null ? s.pendingAutoSafe : "—") +
        this._metric("Sistem hatası", this._waitCount(waiting, "SYSTEM_ERROR")) +
        "</div><p class=\"sub\">Trusted auto-publish kapalı. Katalog yedek sayısı (46.920) canlı metrik olarak gösterilmez.</p>";
      void m;
      return html;
    }

    _waitCount(waiting, type) {
      var i;
      for (i = 0; i < waiting.length; i++) if (waiting[i].type === type) return waiting[i].count || 0;
      return 0;
    }

    _metric(k, v) {
      return "<div class=\"metric\"><div class=\"k\">" + esc(k) + "</div><div class=\"v\">" + esc(v) + "</div></div>";
    }

    _queue() {
      var s = this._data.summary || {};
      var waiting = (s.waiting || []).filter(function (w) {
        return Number(w.count) > 0;
      });
      var rows = sortExceptions(this._data.exceptions || []);
      if (!waiting.length && !rows.length) {
        return (
          "<div class=\"empty\" id=\"pz-ops-empty\"><h3>Şu anda sizi bekleyen kritik bir işlem yok.</h3>" +
          "<p>Otomatik eşleştirme ve moderasyon sistemi rutin işlemleri yürütüyor.</p></div>"
        );
      }
      var cards = waiting
        .map(function (w) {
          return (
            "<button type=\"button\" class=\"card\" data-filter-type=\"" +
            esc(w.type) +
            "\"><div class=\"k\">" +
            esc(TYPE_CARD[w.type] || w.label) +
            "</div><div class=\"v\">" +
            esc(w.count) +
            "</div></button>"
          );
        })
        .join("");
      var list = rows
        .filter(function (r) {
          return !this._filter || r.exceptionType === this._filter;
        }, this)
        .map(function (r) {
          var oem = (r.context && (r.context.buyerRequestedOem || r.context.oem)) || "—";
          var who = (r.context && r.context.companyName) || r.supplierKey || "";
          return (
            "<button type=\"button\" class=\"queue-item\" data-ex=\"" +
            esc(r.exceptionId) +
            "\"><div><span class=\"chip " +
            (r.priority === "CRITICAL" ? "crit" : r.priority === "HIGH" ? "high" : "") +
            "\">" +
            esc(r.priority) +
            "</span> <strong>" +
            esc(typeLabel(r.exceptionType)) +
            "</strong></div><div class=\"sub\">OEM " +
            esc(oem) +
            (who ? " · " + esc(who) : "") +
            " · " +
            esc(ageLabel(r.createdAt)) +
            " · güven " +
            esc(pct(r.confidence)) +
            "</div><div class=\"sub\">Sistem önerisi: " +
            esc(actionLabel(r.recommendedAction)) +
            " · " +
            esc(((r.reasonCodes || []).map(reasonLabel) || []).join(", ")) +
            "</div></button>"
          );
        })
        .join("");
      return "<div class=\"grid\" id=\"pz-ops-wait-cards\">" + cards + "</div><div id=\"pz-ops-queue-list\">" + list + "</div>";
    }

    _detailView() {
      var d = this._detail;
      if (!d) return "<p>Kayıt bulunamadı.</p>";
      var ctx = d.context || {};
      var brief = d.brief || {};
      var rec = (d.copilot && d.copilot.summary) || actionLabel(d.recommendedAction);
      var conf = (d.copilot && d.copilot.confidence) || d.confidence;
      var reasons = (d.copilot && d.copilot.reasonCodes) || d.reasonCodes || [];
      var cands = ctx.candidates || brief.candidates || [];
      var enabled = enabledActions(d);
      var candHtml = cands
        .map(function (c, idx) {
          var letter = String.fromCharCode(65 + idx);
          return (
            "<div class=\"cand\"><strong>ADAY " +
            letter +
            "</strong><div>OEM: " +
            esc(c.oem || c.label) +
            "</div><div>Marka: " +
            esc(c.brand || "—") +
            "</div><div>Eşleşme: " +
            esc(reasonLabel(c.matchReason)) +
            "</div><div>" +
            (c.supplierActive ? "Aktif satıcı" : "satıcı pasif") +
            "</div></div>"
          );
        })
        .join("");
      var listing = d.listingPreview;
      var listingHtml = listing
        ? "<div class=\"section\"><h3>Ürün</h3><div>satıcı: " +
          esc(listing.supplierKey) +
          "</div><div>Ürün: " +
          esc(listing.title) +
          "</div><div>OEM: " +
          esc(listing.oem) +
          "</div><div>Marka/model: " +
          esc(listing.brand) +
          " " +
          esc(listing.model) +
          "</div><div>Fiyat: " +
          esc(listing.priceEur) +
          " EUR · Stok: " +
          esc(listing.stockQuantity) +
          "</div><div class=\"thumbs\">" +
          (listing.images || [])
            .map(function (im) {
              var url = im && (im.url || im);
              return url ? "<img src=\"" + esc(url) + "\" alt=\"\">" : "";
            })
            .join("") +
          "</div><div>Shadow: " +
          esc(shadowLabel(d.shadowClass)) +
          " · WOULD_AUTO_PUBLISH: " +
          (d.wouldAutoPublish ? "true" : "false") +
          "</div></div>"
        : "";
      return (
        "<div class=\"section\" id=\"pz-ops-detail\"><h3>Olay</h3><p>" +
        esc(typeLabel(d.exceptionType)) +
        " · " +
        esc(d.priority) +
        "</p></div>" +
        "<div class=\"section\"><h3>Alıcı talebi</h3><p>OEM: " +
        esc(ctx.buyerRequestedOem || ctx.oem || brief.buyerRequested || "—") +
        "</p></div>" +
        "<div class=\"section\"><h3>Sistemin buldukları</h3>" +
        (candHtml || "<p class=\"sub\">Aday kaydı yok.</p>") +
        listingHtml +
        "</div>" +
        "<div class=\"section\"><h3>Sistem önerisi</h3><p id=\"pz-ops-reco\">" +
        esc(rec) +
        "</p></div>" +
        "<div class=\"section\"><h3>Güven</h3><p>" +
        esc(pct(conf)) +
        "</p></div>" +
        "<div class=\"section\"><h3>Neden</h3><p>" +
        esc(reasons.map(reasonLabel).join(" · ")) +
        "</p></div>" +
        "<div class=\"actions\">" +
        "<button class=\"btn primary\" data-act=\"APPROVE\" " +
        (enabled.APPROVE ? "" : "disabled") +
        ">Onayla</button>" +
        "<button class=\"btn danger\" data-act=\"REJECT\" " +
        (enabled.REJECT ? "" : "disabled") +
        ">Reddet</button>" +
        "<button class=\"btn\" data-act=\"CORRECT\" " +
        (enabled.CORRECT ? "" : "disabled") +
        ">Düzelt</button>" +
        (enabled.ACKNOWLEDGE
          ? "<button class=\"btn primary\" data-act=\"ACKNOWLEDGE\">Sistem hatasını kaydet</button>"
          : "") +
        "</div>" +
        (enabled.REJECT
          ? "<div class=\"field\" style=\"margin-top:12px\"><label>Red gerekçesi</label><input id=\"pz-ops-reject-reason\" placeholder=\"Kısa gerekçe\"></div>"
          : "")
      );
    }

    _rfqs() {
      var rows = this._data.rfqs || [];
      var f = this._filter;
      var filtered = rows.filter(function (r) {
        if (!f || f === "all") return true;
        if (f === "ambiguous") {
          return String(r.adminNote || "").indexOf("AMBIGUOUS:") === 0 || (!r.assignedSupplierKey && r.status === "new");
        }
        return String(r.status || "") === f;
      });
      function caseButton(r){return typeof r.rfqKey==='string' && /^[A-Za-z0-9_-]{1,80}$/.test(r.rfqKey) ? '<button class="btn" type="button" data-case-type="rfqKey" data-case-ref="'+esc(r.rfqKey)+'">İşlem Dosyası</button>':'Dosya kimliği yok';}
      var cards=filtered.map(function(r){var machine=[r.machineType,r.machineBrand,r.machineModel].filter(Boolean).join(' · ');return '<article class="card"><h3>'+esc(r.oem || r.productTitle || 'Talep')+'</h3><p>'+esc(r.customerName || '—')+' · '+esc(r.status || '—')+'</p><p>makine: '+esc(machine || 'Belirtilmedi')+(r.machineSerial ? ' · seri: '+esc(r.machineSerial) : '')+'</p><p>satıcı: '+esc(r.assignedSupplierKey || '—')+'</p><p>Yanıt: '+esc(r.supplierResponse || '—')+'</p><p>'+esc(r.createdAt || '')+'</p>'+caseButton(r)+'</article>';}).join('');
      var table = filtered
        .map(function (r) {
          var note = String(r.adminNote || "");
          var problem = note.indexOf("AMBIGUOUS:") === 0 || note.indexOf("DISPUTE:") === 0;
          return (
            "<tr class=\"" +
            (problem ? "is-priority" : "") +
            "\"><td>" +
            esc(r.customerName || "—") +
            "<div class=\"sub\">" +
            esc(r.customerEmail || "") +
            "</div></td><td>" +
            esc(r.oem || r.productTitle || "") +
            "<div class=\"sub\">Makine: " +
            esc([r.machineType, r.machineBrand, r.machineModel].filter(Boolean).join(" · ") || "Belirtilmedi") +
            (r.machineSerial ? " · Seri: " + esc(r.machineSerial) : "") +
            "</div></td><td>" +
            esc(r.status) +
            "</td><td>" +
            esc(r.assignedSupplierKey || "—") +
            "</td><td>" +
            esc(r.supplierResponse || "—") +
            "</td><td>" +
            esc(r.createdAt || "") +
            "</td><td>" + caseButton(r) + "</td></tr>"
          );
        })
        .join("");
      return (
        "<div class=\"filters\" id=\"pz-ops-rfq-filters\">" +
        ["all|Tümü", "new|Yeni", "assigned|Atanmış", "supplier_responded|Yanıtlandı", "closed|Kapandı", "ambiguous|Belirsiz / Atanmamış"]
          .map(function (p) {
            var parts = p.split("|");
            return (
              "<button type=\"button\" data-rfq-f=\"" +
              parts[0] +
              "\" class=\"" +
              ((f || "all") === parts[0] ? "active" : "") +
              "\">" +
              parts[1] +
              "</button>"
            );
          })
          .join("") +
        "</div><p>En yeni 100 talep gösterilir.</p><div class=\"table-wrap desktop\"><table><thead><tr><th>Alıcı</th><th>OEM / parça</th><th>Durum</th><th>satıcı</th><th>Yanıt</th><th>Tarih</th><th>Dosya</th></tr></thead><tbody>" +
        table +
        "</tbody></table></div><div class=\"cards-mobile\">"+cards+"</div>"+(filtered.length ? '':'<p>Bu filtrede talep bulunamadı.</p>')
      );
    }

    _listings() {
      return '<div id="pz-listing-workbench"></div>';
    }

    _procurementFields(draft) {
      var fields=[['purchaseSupplier','Alınan firma','text'],['purchasePrice','Net alış tutarı (isteğe bağlı)','number'],['purchaseDiscount','Alış iskontosu (%)','number'],['purchaseCommission','Anlaşmalı komisyon (%)','number']];
      return '<fieldset class="card"><legend>Özel alış bilgileri — yalnız yönetici</legend><p class="sub">Zorunlu değildir. Net alış tutarını girin; iskonto bu tutardan tekrar düşülmez. Komisyon bilgi amaçlıdır, satış fiyatını otomatik değiştirmez.</p><div class="grid">'+fields.map(function(f){return '<div class="field"><label for="pz-'+f[0]+'">'+f[1]+'</label><input id="pz-'+f[0]+'" name="'+f[0]+'" type="'+f[2]+'" '+(f[2]==='number'?'min="0" step="0.01" max="'+(f[0]==='purchasePrice'?'1000000000':'100')+'"':'maxlength="160"')+' value="'+esc(draft[f[0]]==null?'':draft[f[0]])+'"></div>';}).join('')+
        '<div class="field"><label for="pz-purchaseCurrency">Alış para birimi</label><select id="pz-purchaseCurrency" name="purchaseCurrency">'+['EUR','TRY','USD','GBP'].map(function(c){return '<option'+((draft.purchaseCurrency||'EUR')===c?' selected':'')+'>'+c+'</option>';}).join('')+'</select></div><div class="field"><label for="pz-purchaseVat">Alış KDV durumu</label><select id="pz-purchaseVat" name="purchaseVat">'+[['unknown','Belirtilmedi'],['excluded','KDV hariç'],['included','KDV dahil']].map(function(v){return '<option value="'+v[0]+'"'+((draft.purchaseVat||'unknown')===v[0]?' selected':'')+'>'+v[1]+'</option>';}).join('')+'</select></div></div></fieldset><section class="card"><h3>Aynı parçanın tedarik kaynakları</h3><p class="sub">Nokta, tire ve boşluk farkları eşleştirilir. Marka ve teknik uyumluluğu ayrıca kontrol edin. Farklı para birimleri kur çevrimi yapılmadan kıyaslanmaz.</p><div id="pz-procurement-matches" role="status">Parça numarası girildiğinde tüm kayıtlı firmaların alış bilgileri burada açılır.</div></section>';
    }

    _lookupProcurement(code) {
      var self=this, request=(this._procurementRequest||0)+1; this._procurementRequest=request;
      var target=this._qs('#pz-procurement-matches');if(!target)return;
      if(!code){target.textContent='Eşleştirme için parça numarası girin. Alış bilgilerini yine de elle ekleyebilirsiniz.';return;}
      target.textContent='Tedarik kaynakları kontrol ediliyor…';
      this.portalApi('getAdminProcurementMatches',{code:code}).then(function(result){
        if(request!==self._procurementRequest||!target.isConnected)return;
        if(!result||!result.ok)throw new Error('Alış kayıtları alınamadı.');
        var data=result.data||{},items=data.items||[];
        function amount(n,c){return n==null?'Belirtilmedi':Number(n).toLocaleString('tr-TR',{maximumFractionDigits:2})+' '+esc(c||'');}
        target.innerHTML=items.length?items.map(function(row){return '<article class="card"><strong>'+esc(row.supplierName)+'</strong> · '+esc(row.productCode)+'<p>'+esc(row.title||'')+'</p><div class="grid"><div>Liste fiyatı: '+amount(row.listPrice,row.currency)+'</div><div><strong>Net alış: '+amount(row.netPrice,row.currency)+'</strong></div><div>İskonto: '+(row.discountPercent==null?'Belirtilmedi':'%'+esc(row.discountPercent))+'</div><div>Komisyon: '+(row.commissionPercent==null?'Belirtilmedi':'%'+esc(row.commissionPercent))+'</div></div><p class="sub">'+esc(row.vatBasis==='excluded'?'KDV hariç':row.vatBasis==='included'?'KDV dahil':'KDV durumu doğrulanmadı')+' · Kayıt tarihi: '+esc(row.priceDate||'Bilinmiyor')+'<br>'+esc(row.evidence||'')+'</p></article>';}).join('')+(data.truncated?'<p>İlk 100 eşleşme gösteriliyor; daha fazla kayıt var.</p>':''):'Eşleşme yok. Yukarıdaki isteğe bağlı alış ve komisyon alanlarını elle doldurabilirsiniz.';
      }).catch(function(){if(request===self._procurementRequest&&target.isConnected)target.textContent='Alış kayıtları kontrol edilemedi. Bu durum eşleşme olmadığı anlamına gelmez. Parça kodunu yeniden girerek deneyin; manuel alanlar kullanılabilir.';});
    }

    _newProduct() {
      var catalog = this._data.adminMachineCatalog || {};
      var draft = this._adminDraft || {};
      var type = draft.listingType || "part";
      var machineType = draft.machineType || "excavator";
      var brands = (catalog.brandsByType && catalog.brandsByType[machineType]) || catalog.brands || [{ id: "__other__", name: "Listede Yok / Diğer" }];
      var brandId = draft.machineBrandId || "";
      var models = (catalog.modelsByTypeAndBrand && catalog.modelsByTypeAndBrand[machineType] && catalog.modelsByTypeAndBrand[machineType][brandId]) || [{ id: "__other__", name: "Listede Yok / Diğer" }];
      function opts(items, selected, valueKey) {
        return (items || []).map(function (item) {
          var value = valueKey ? item[valueKey] : item.value;
          var label = valueKey ? item.name : item.label;
          return '<option value="' + esc(value) + '"' + (String(value) === String(selected) ? ' selected' : '') + '>' + esc(label) + '</option>';
        }).join("");
      }
      var machineTypes = [
        ["excavator", "Ekskavatör"], ["wheel_loader", "Loader"], ["telehandler", "Telehandler"],
        ["forklift", "Forklift"], ["backhoe_loader", "Beko Loder"], ["road_roller", "Yol Silindiri"],
        ["heavy_offroad_truck", "Ağır Yük Off-Road Kamyonu"]
      ];
      var origin = [["original", "Orijinal"], ["aftermarket", "Yan Sanayi"], ["domestic", "Yerli"]];
      var conditions = [["new_unboxed", "Sıfır, Kutusuz"], ["new_boxed", "Sıfır, Kutulu"], ["used_good", "Kullanılmış, İyi Durumda"], ["repaired_working_good", "Tamir Edilmiş, Çalışır ve İyi Durumda"]];
      if (type !== "part") return this._newTypedProduct(type, draft, catalog, machineTypes);
      return '<section class="section" id="pz-admin-new-product"><div class="pz-admin-new-head"><h2>Ürün Ekle</h2></div><div class="pz-admin-owner"><div><strong>Ürün sahibi: Parça Zinciri</strong><span> Bu ürünler platform kataloğuna aittir.</span></div><span>Doğrudan onaylanır</span></div><p class="sub">Satıcı panelindeki parça alanlarıyla aynı bilgiler burada yönetici adına doğrudan onaylanır.</p>' +
        '<form id="pz-admin-product-form" class="card" novalidate>' +
        '<div class="grid">' +
        '<div class="field"><label for="pz-admin-listing-type">İlan türü</label><select id="pz-admin-listing-type" name="listingType"><option value="part" selected>Parça</option><option value="equipment">Ekipman</option><option value="machine">Makine</option></select></div>' +
        '</div><div class="grid">' +
        '<div class="field"><label for="pz-admin-part-name">Parça adı</label><input id="pz-admin-part-name" name="partName" maxlength="200" required value="' + esc(draft.partName || "") + '"></div>' +
        '<div class="field"><label for="pz-admin-oem">OEM / parça kodu</label><input id="pz-admin-oem" name="oem" maxlength="80" placeholder="Örn. 256-6669" value="' + esc(draft.oem || "") + '"><label><input type="checkbox" name="oemUnknown"' + (draft.oemUnknown ? ' checked' : '') + '> OEM bende yok</label></div>' +
        '<div class="field"><label for="pz-admin-machine-type">Makine tipi</label><select id="pz-admin-machine-type" name="machineType" required>' + machineTypes.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === machineType ? ' selected' : '') + '>' + x[1] + '</option>'; }).join("") + '</select></div>' +
        '<div class="field"><label for="pz-admin-brand">Makine markası</label><select id="pz-admin-brand" name="machineBrandId" required><option value="">Marka seçin</option>' + opts(brands, brandId, "id") + '</select></div>' +
        '<div class="field"><label for="pz-admin-model">Tam makine modeli / varyasyonu</label><select id="pz-admin-model" name="machineModelId" required><option value="">Model / varyasyon seçin</option>' + opts(models, draft.machineModelId, "id") + '</select><small>DX300 ile DX300LC-5 farklıdır. Listede yoksa Diğer seçip tam modeli yazın.</small></div>' +
        '<div class="field"><label for="pz-admin-manual-brand">Listede yoksa marka</label><input id="pz-admin-manual-brand" name="manualBrandName" maxlength="120" value="' + esc(draft.manualBrandName || "") + '"></div>' +
        '<div class="field"><label for="pz-admin-manual-model">Listede yoksa model</label><input id="pz-admin-manual-model" name="manualModelName" maxlength="120" value="' + esc(draft.manualModelName || "") + '"></div>' +
        '<div class="field"><label for="pz-admin-stock">Stok adedi</label><input id="pz-admin-stock" name="stockQuantity" type="number" min="1" step="1" required value="' + esc(draft.stockQuantity || "") + '"></div>' +
        '<div class="field"><label for="pz-admin-price">Birim fiyat (EUR)</label><input id="pz-admin-price" name="priceEur" type="number" min="0.01" step="0.01" required value="' + esc(draft.priceEur || "") + '"></div>' +
        '<div class="field"><label for="pz-admin-serial">Makine seri numarası</label><input id="pz-admin-serial" name="machineSerialNumber" maxlength="80" required value="' + esc(draft.machineSerialNumber || "") + '"></div>' +
        '<div class="field"><label for="pz-admin-origin">Parça menşei</label><select id="pz-admin-origin" name="partOriginType" required>' + origin.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === (draft.partOriginType || "original") ? ' selected' : '') + '>' + x[1] + '</option>'; }).join("") + '</select></div>' +
        '<div class="field"><label for="pz-admin-condition">Parça durumu</label><select id="pz-admin-condition" name="partCondition" required>' + conditions.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === (draft.partCondition || "new_boxed") ? ' selected' : '') + '>' + x[1] + '</option>'; }).join("") + '</select></div>' +
        '</div><div class="field"><label for="pz-admin-description">Açıklama</label><textarea id="pz-admin-description" name="description" maxlength="4000" rows="4">' + esc(draft.description || "") + '</textarea></div>' +
        this._procurementFields(draft) + adminPhotosHtml(this._adminImages, this._adminUploadsInFlight) +
        '<p id="pz-admin-product-status" class="sub" role="status"></p><button class="btn primary" id="pz-admin-product-submit" type="submit"' + (this._adminSaving || !this._adminImages.length || this._adminUploadsInFlight ? ' disabled' : '') + '>' + (this._adminSaving ? 'Onaylanıyor…' : 'Ürünü doğrudan onayla') + '</button></form></section>';
    }

    _newTypedProduct(type, draft, catalog, machineTypes) {
      var machineType = draft.machineType || "excavator";
      var brands = (catalog.brandsByType && catalog.brandsByType[machineType]) || catalog.brands || [{ id: "__other__", name: "Listede Yok / Diğer" }];
      var brandId = draft.machineBrandId || "";
      var models = (catalog.modelsByTypeAndBrand && catalog.modelsByTypeAndBrand[machineType] && catalog.modelsByTypeAndBrand[machineType][brandId]) || [{ id: "__other__", name: "Listede Yok / Diğer" }];
      var equipmentTypes = [["engine", "Motor"], ["transmission", "Şanzıman"], ["front_differential", "Diferansiyel — Ön"], ["rear_differential", "Diferansiyel — Arka"], ["operator_cabin", "Operatör Kabini"], ["chassis", "Şase"], ["hydraulic_cylinder", "Hidrolik Silindir"]];
      var equipmentConditions = [["new_original", "Sıfır, Orijinal"], ["original_reconditioned", "Orijinal, Revizyonlu"]];
      function selectOptions(items, selected) { return items.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (x[0] === selected ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join(""); }
      var catalogOptions = '<div class="grid"><div class="field"><label for="pz-admin-machine-type">Makine tipi</label><select id="pz-admin-machine-type" name="machineType" required>' + machineTypes.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === machineType ? ' selected' : '') + '>' + x[1] + '</option>'; }).join("") + '</select></div><div class="field"><label for="pz-admin-brand">Makine markası</label><select id="pz-admin-brand" name="machineBrandId" required><option value="">Marka seçin</option>' + brands.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === brandId ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join("") + '</select></div><div class="field"><label for="pz-admin-model">Makine modeli</label><select id="pz-admin-model" name="machineModelId" required><option value="">Model seçin</option>' + models.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === draft.machineModelId ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join("") + '</select></div><div class="field"><label for="pz-admin-manual-brand">Listede yoksa marka</label><input id="pz-admin-manual-brand" name="manualBrandName" maxlength="120" value="' + esc(draft.manualBrandName || "") + '"></div><div class="field"><label for="pz-admin-manual-model">Listede yoksa model</label><input id="pz-admin-manual-model" name="manualModelName" maxlength="120" value="' + esc(draft.manualModelName || "") + '"></div><div class="field"><label for="pz-admin-serial">Makine seri numarası</label><input id="pz-admin-serial" name="machineSerialNumber" maxlength="80" required value="' + esc(draft.machineSerialNumber || "") + '"></div></div>';
      var typed = type === "equipment" ? '<div class="grid"><div class="field"><label for="pz-admin-equipment-type">Ekipman türü</label><select id="pz-admin-equipment-type" name="equipmentType" required>' + selectOptions(equipmentTypes, draft.equipmentType || "engine") + '</select></div><div class="field"><label for="pz-admin-equipment-condition">Ekipman durumu</label><select id="pz-admin-equipment-condition" name="equipmentCondition" required>' + selectOptions(equipmentConditions, draft.equipmentCondition || "new_original") + '</select></div></div><div class="field"><label for="pz-admin-equipment-work">Revizyon / yapılan işlemler</label><textarea id="pz-admin-equipment-work" name="equipmentWorkDescription" maxlength="8000" rows="3">' + esc(draft.equipmentWorkDescription || "") + '</textarea></div>' : '<div class="grid"><div class="field"><label for="pz-admin-year">Model yılı</label><input id="pz-admin-year" name="modelYear" type="number" min="1900" max="' + new Date().getFullYear() + '" required value="' + esc(draft.modelYear || "") + '"></div><div class="field"><label for="pz-admin-modification">Makine değişiklik özeti</label><textarea id="pz-admin-modification" name="machineModificationSummary" maxlength="8000" rows="3" required>' + esc(draft.machineModificationSummary || "") + '</textarea></div></div>';
      return '<section class="section" id="pz-admin-new-product"><div class="pz-admin-new-head"><h2>Ürün Ekle</h2></div><div class="pz-admin-owner"><div><strong>Ürün sahibi: Parça Zinciri</strong><span> Bu ürünler platform kataloğuna aittir.</span></div><span>Doğrudan onaylanır</span></div><p class="sub">Satıcı panelindeki ekipman/makine alanları burada yönetici adına doğrudan onaylanır.</p><form id="pz-admin-product-form" class="card" novalidate><div class="grid"><div class="field"><label for="pz-admin-listing-type">İlan türü</label><select id="pz-admin-listing-type" name="listingType"><option value="part">Parça</option><option value="equipment"' + (type === "equipment" ? ' selected' : '') + '>Ekipman</option><option value="machine"' + (type === "machine" ? ' selected' : '') + '>Makine</option></select></div></div>' + catalogOptions + typed + '<div class="grid"><div class="field"><label for="pz-admin-stock">Stok adedi</label><input id="pz-admin-stock" name="stockQuantity" type="number" min="1" required value="' + esc(draft.stockQuantity || "") + '"></div><div class="field"><label for="pz-admin-price">Birim fiyat (EUR)</label><input id="pz-admin-price" name="priceEur" type="number" min="0.01" step="0.01" required value="' + esc(draft.priceEur || "") + '"></div></div><div class="field"><label for="pz-admin-description">Açıklama</label><textarea id="pz-admin-description" name="description" maxlength="4000" rows="4">' + esc(draft.description || "") + '</textarea></div>' + adminPhotosHtml(this._adminImages, this._adminUploadsInFlight) + '<p id="pz-admin-product-status" class="sub" role="status"></p><button class="btn primary" id="pz-admin-product-submit" type="submit"' + (this._adminSaving || !this._adminImages.length || this._adminUploadsInFlight ? ' disabled' : '') + '>' + (this._adminSaving ? 'Onaylanıyor…' : 'Ürünü doğrudan onayla') + '</button></form></section>';
    }

    _suppliers() {
      var list = this._data.suppliers || [];
      var trust = this._data.trust || [];
      var by = {};
      trust.forEach(function (t) {
        by[t.supplierKey] = t;
      });
      var rows = list
        .map(function (s) {
          var t = by[s.supplierKey] || {};
          return (
            "<tr><td>" +
            esc(s.companyName) +
            "<div class=\"sub\">" +
            esc(s.status) +
            "</div></td><td>" +
            pct(t.OEM_VALID_RATE) +
            "</td><td>" +
            esc(s.listingCount) +
            "</td><td>" +
            pct(t.REJECTION_RATE) +
            "</td><td>" +
            pct(t.DUPLICATE_RATE) +
            "</td><td>" +
            pct(t.PROFILE_COMPLETENESS) +
            "</td><td>" +
            pct(t.SHADOW_AUTO_SAFE_RATE) +
            "</td><td>" +
            esc(s.openRfqs) +
            "</td><td><button class=\"btn danger\" data-suspend=\"" +
            esc(s.supplierKey) +
            "\" " +
            (s.status === "suspended" ? "disabled" : "") +
            ">Askıya al</button> <button class=\"btn\" data-activate=\"" +
            esc(s.supplierKey) +
            "\" " +
            (s.status === "active" ? "disabled" : "") +
            ">Etkinleştir</button></td></tr>"
          );
        })
        .join("");
      return (
        "<p class=\"sub\">Tek bir güven skoru yok. Bileşenler ayrı gösterilir. TRUSTED statüsü yok.</p><div class=\"table-wrap desktop\"><table><thead><tr><th>Firma</th><th>OEM geçerli</th><th>İlan</th><th>Red</th><th>Mükerrer</th><th>Profil</th><th>Gölge auto-safe</th><th>Açık RFQ</th><th></th></tr></thead><tbody>" +
        rows +
        "</tbody></table></div>"
      );
    }

    _audit() {
      var rows = this._data.audit || [];
      var f = this._filter;
      var filtered = rows.filter(function (a) {
        if (!f) return true;
        return String(a.action || "").indexOf(f) >= 0 || String(a.entityType || "") === f;
      });
      var body = filtered
        .map(function (a) {
          var label = AUDIT_LABEL[a.action] || a.action;
          return (
            "<tr><td>" +
            esc(label) +
            "<div class=\"sub\">" +
            esc(a.action) +
            "</div></td><td>" +
            esc(a.entityType || "") +
            " " +
            esc(a.entityId || "") +
            "</td><td>" +
            esc(a.supplierKey || "—") +
            "</td><td>" +
            (a.success === false ? "Hata" : "Tamam") +
            "</td><td>" +
            esc(a.createdAt || "") +
            "</td></tr>"
          );
        })
        .join("");
      return (
        "<div class=\"filters\">" +
        ["|Tümü", "exception_resolve|İstisna", "approve|Onay", "inventory_demand_match|Eşleşme", "supplier_suspend|Askı"]
          .map(function (p) {
            var parts = p.split("|");
            return "<button type=\"button\" data-audit-f=\"" + parts[0] + "\" class=\"" + (f === parts[0] ? "active" : "") + "\">" + parts[1] + "</button>";
          })
          .join("") +
        "</div><div class=\"table-wrap desktop\"><table><thead><tr><th>Olay</th><th>Kayıt</th><th>satıcı</th><th>Sonuç</th><th>Zaman</th></tr></thead><tbody>" +
        body +
        "</tbody></table></div>"
      );
    }

    _commerce() {
      var kind = this._commerceKind;
      var data = this._data.commerce;
      var labels = { matches: "Eşleşmeler", quotes:"Gönderilmiş Teklifler", orders: "Siparişler", payments: "Ödeme Kayıtları", case:"İşlem Dosyası", readiness: "Siparişe Geçiş", commission:"Komisyon Ayarları" };
      var statusLabels = {
        assigned: "Tekil OEM eşleşmesi / atama", ambiguous: "Birden fazla aday / inceleme gerekli",
        unknown: "Doğrulanamayan durum", failed: "Başarısız", pending: "Bekliyor",
        confirmed: "Onaylandı", processing: "Hazırlanıyor", partially_shipped: "Kısmen gönderildi",
        shipped: "Gönderildi", delivered: "Teslim edildi", cancelled: "İptal",
        partially_returned: "Kısmen iade", returned: "İade edildi", unpaid: "Ödenmedi",
        paid: "Ödendi (kayıt durumu)", partially_refunded: "Kısmen geri ödendi", refunded: "Geri ödendi",
        succeeded: "Başarılı (kayıt durumu)", buyer_payment: "Alıcı ödemesi", supplier_payout: "satıcı ödemesi",
        buyer_refund: "Alıcıya iade", supplier_recovery: "Satıcıdan geri alım", manual_adjustment: "Manuel düzeltme",
        internal: "İç sistem", wix_ecommerce: "Wix e-ticaret", manual_admin: "Manuel yönetici"
      };
      function label(value) { return Object.prototype.hasOwnProperty.call(statusLabels, value) ? statusLabels[value] : value || "Bilinmiyor"; }
      function amount(row) {
        if (!Number.isSafeInteger(row.amountMinor) || row.amountMinor < 0 || !row.currency) return "Tutar / para birimi bilinmiyor";
        return (row.amountMinor / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + row.currency;
      }
      var html = '<section class="commerce" aria-label="Ticari takip"><div class="filters">' +
        Object.keys(labels).map(function (key) {
          return '<button type="button" data-commerce-kind="' + key + '" aria-pressed="' + (key === kind) + '" class="' + (key === kind ? "active" : "") + '">' + labels[key] + '</button>';
        }).join("") + '</div><p class="sub">Eşleşme satış değildir; teklif ödeme değildir. Talep ve satıcı yanıtları “Talepler” bölümündedir.</p>' +
        '<p class="sub">Bu ekran mevcut B2B kayıtlarını okur. Otomatik sipariş/ödeme aktarımı henüz doğrulanmadı. Wix dijital katalog satışları ve sistem dışı alışverişler bu listeye dahil değildir.</p>';
      if (kind === "case") {
        html += '<h2>İşlem Dosyası</h2><form id="commerce-case-form"><label for="commerce-case-key">Talep numarası (RFQ)</label><input id="commerce-case-key" required maxlength="80"><button class="btn" type="submit">Dosyayı Aç</button></form>';
        var caseData=this._data.commerceCase;
        if (!caseData) return html+'<p>Eşleşmeler veya Gönderilmiş Teklifler listesinden dosya açabilir ya da talep numarasını girebilirsiniz.</p></section>';
        if (caseData.state !== "available") return html+'<p role="status">'+(caseData.state === "not_found" ? 'Talep bulunamadı.':'Dosya doğrulanamadı veya kaynağı okunamadı.')+'</p></section>';
        html += '<h3>Talep '+esc(caseData.rfq.key)+'</h3><p>Güncel talep durumu: '+esc(label(caseData.rfq.status))+'</p><p>Son teklif tarihi: '+esc(caseData.rfq.deadlineAt || 'Bilinmiyor')+'</p>';
        var groups=[['Teklif kayıtları',caseData.quotes],['Sipariş kayıtları',caseData.orders],['Ödeme kayıtları',caseData.payments],['Talep işlem kayıtları',caseData.audit]];
        groups.forEach(function(pair){
          var group=pair[1];html+='<h3>'+pair[0]+'</h3>';
          if (!group || group.state !== 'available') {html+='<p>Kaynak okunamadı — kayıt yok sayılmadı.</p>';return;}
          if (!group.items.length) html+='<p>Bu taleple açık referansı olan kayıt bulunamadı.</p>';
          html+=group.items.map(function(row){return '<article class="card"><h4>'+esc(row.quoteId || row.orderNumber || row.transactionKey || row.id || 'Kayıt')+'</h4><p>'+esc(label(row.action || row.status || row.recordState))+'</p><p>'+esc(row.createdAt || row.processedAt || 'Tarih bilinmiyor')+'</p>'+(Object.prototype.hasOwnProperty.call(row,'amountMinor') ? '<p>'+esc(amount(row))+'</p>':'')+'</article>';}).join('');
          if (group.hasMore) html+='<p>Gösterim sınırı nedeniyle daha eski kayıtlar bu dosyada yer almıyor.</p>';
        });
        return html+'<p class="sub">Yalnız açık talep/sipariş referansları birleştirilir. En yeni 20 teklif/olay, 5 sipariş ve sipariş başına 20 ödeme gösterilir. Teslimat ve iade takibi henüz bağlı değildir. Bu görünüm satış, tahsilat veya teslim onayı vermez.</p><button class="btn" data-commerce-retry>Dosyayı Yenile</button></section>';
      }
      if (kind === "commission") {
        var cfg=this._data.commission;
        if (!cfg) return html + '<p role="status">Komisyon ayarları okunuyor.</p></section>';
        var target=cfg.companyId ? cfg.seller:cfg.general;
        var directory=cfg.directory, history=cfg.history;
        var options='<option value="">Genel komisyon ayarı (tüm satıcılar)</option>';
        var firms=directory && directory.state === "available" && Array.isArray(directory.items) ? directory.items:[];
        if (cfg.companyId && !firms.some(function(f){return f.id===cfg.companyId;})) options += '<option selected value="'+esc(cfg.companyId)+'">Seçili firma — '+esc(cfg.companyId)+'</option>';
        options += firms.map(function(f){return '<option value="'+esc(f.id)+'" '+(cfg.companyId===f.id ? 'selected':'')+'>'+esc(f.name)+' · '+esc(f.id)+'</option>';}).join("");
        var historyHtml='<h3>Komisyon değişiklik geçmişi</h3><p>Seçili kapsamın kayıtlarıdır. Satıcı genel orana döndüğünde o tarihteki genel kural uygulanır; eski teklifler yeniden fiyatlanmaz.</p>';
        if (!history || history.state !== "available" || !Array.isArray(history.items)) historyHtml += '<p>Geçmiş okunamadı; kayıt yok sayılmadı.</p>';
        else {
          if (!history.items.length) historyHtml += '<p>Bu kapsamda kayıtlı değişiklik yok.</p>';
          historyHtml += history.items.map(function(r){return '<article class="card"><h4>Sürüm '+esc(r.version)+' — '+(r.rateBps===null ? 'Genel oranı kullan':'%'+esc(r.rateBps/100))+'</h4><p>Geçerlilik: '+esc(r.effectiveFrom)+'</p><p>'+esc(r.reason)+'</p></article>';}).join("");
          if(history.capped) historyHtml+='<p>10.000 kayıt sınırına ulaşıldı; daha eski değişiklikler burada gösterilmiyor.</p>';
          historyHtml += '<button class="btn" type="button" data-commission-history="prev" '+(history.offset ? '':'disabled')+'>Önceki değişiklik sayfası</button><button class="btn" type="button" data-commission-history="next" '+(history.hasMore ? '':'disabled')+'>Sonraki değişiklik sayfası</button>';
        }
        return html + '<h2>Komisyon Ayarları</h2><p>Varsayılan %10. Komisyon, satış fiyatından kesilir; kargo dahil değildir. Eski teklifler değişmez.</p>' +
          (directory && directory.capped ? '<p>10.000 firma sınırına ulaşıldı. Firma adıyla aramayı daraltın.</p>':'') +
          '<form id="commission-search-form"><label for="commission-search">Firma adıyla ara</label><input id="commission-search" maxlength="80" value="'+esc(this._commissionSearch || '')+'"><button class="btn" type="submit">Firma Ara</button></form>' +
          (!directory || directory.state !== "available" ? '<p>Firma listesi okunamadı; liste boş kabul edilmedi.</p>':!firms.length ? '<p>Aramaya uygun aktif firma bulunamadı.</p>':'') +
          '<form id="commission-scope"><label for="commission-company">Komisyon uygulanacak firma</label><select id="commission-company">'+options+'</select><button class="btn" type="submit">Ayarları Getir</button></form>' +
          '<button class="btn" type="button" data-commission-directory="prev" '+(directory && directory.offset ? '':'disabled')+'>Önceki firmalar</button><button class="btn" type="button" data-commission-directory="next" '+(directory && directory.hasMore ? '':'disabled')+'>Sonraki firmalar</button>' +
          '<p>Kaydedilecek kapsam: <strong>'+esc(cfg.companyId ? 'Firma '+cfg.companyId:'Genel ayar — tüm satıcılar')+'</strong>. Firma seçimini değiştirdiğinizde önce Ayarları Getir düğmesine basın.</p><p>Uygulanacak oran: <strong>%'+esc(cfg.effectiveRateBps/100)+'</strong> · Kayıt sürümü: '+esc(target.version)+'</p><p>Son açıklama: '+esc(target.reason || "Henüz kayıt yok")+'</p>' +
          '<form id="commission-save"><label for="commission-percent">Komisyon yüzdesi</label><input id="commission-percent" type="number" min="0" max="100" step="0.01" required value="'+esc((target.rateBps === null ? cfg.effectiveRateBps:target.rateBps)/100)+'">' +
          (cfg.companyId ? '<label><input id="commission-inherit" type="checkbox"> Satıcı için genel oranı kullan</label>':'') +
          '<label for="commission-reason">Anlaşma / değişiklik açıklaması</label><input id="commission-reason" required minlength="3" maxlength="250">' +
          '<button class="btn primary" type="submit">Yeni Oranı Kaydet</button></form><p role="status" id="commission-status"></p>'+historyHtml+'</section>';
      }
      if (kind === "readiness") {
        var readiness = this._data.commerceReadiness;
        if (!readiness) return html + '<p role="status">Kontrol bekleniyor.</p></section>';
        var capabilityLabels = { STRUCTURED_QUOTE: "Fiyat, para birimi, adet ve geçerlilik süresi olan teklif",
          VERIFIED_BUYER_ACCEPTANCE: "Doğrulanmış alıcının belirli teklif sürümünü kabul etmesi",
          IDEMPOTENT_STOCK_RESERVATION: "Tekrarlanan istekte çift sipariş / stok düşüşü oluşturmayan rezervasyon",
          VERIFIED_PAYMENT_EVENTS: "Ödeme sağlayıcısından doğrulanan tahsilat ve iade olayları" };
        html += '<h2>Otomatik sipariş henüz açık değil</h2><p class="sub">Aşağıdaki sayılar B2B altyapısına aittir; katalogdaki ürün sayısı değildir. Kayıt bulunması fiyat, stok veya ödeme bağlantısının tamamlandığını kanıtlamaz.</p><div class="grid">' + readiness.checks.map(function (check) {
          var state = check.state === "unavailable" ? "Okunamadı — bilinmiyor" : check.state === "missing" ? "Eksik — 0 kayıt" : "Kaynak okunuyor — " + check.count + " kayıt";
          return '<article class="card"><h3>' + esc(check.label) + '</h3><p>' + esc(state) + '</p><p class="sub">' + esc(check.source) + '</p></article>';
        }).join("") + '</div><p class="sub">Onaylı ilan sayısı ile aktif sipariş stoğu ayrı kaynaklardır. İlan onayı tek başına sipariş stoğu oluşturmaz; eşit sayılar da kayıtların bağlı olduğunu kanıtlamaz. İlan fiyatı (EUR) fiyatlı teklife (TRY) otomatik çevrilmez.</p><h3>Tamamlanacak bağlantılar</h3><ul>' + readiness.missingCapabilities.map(function (key) {
          return '<li>' + esc(Object.prototype.hasOwnProperty.call(capabilityLabels,key) ? capabilityLabels[key] : "Tanımlanmamış bağlantı") + '</li>';
        }).join("") + '</ul><p class="sub">Bu ekran veri veya para hareketi oluşturmaz. Serbest metin yanıtı satın alma onayı sayılmaz.</p>';
        var audit = readiness.inventoryAudit;
        html += '<h3>İlan → sipariş stoğu bağlantı kontrolü</h3><p class="sub">İlk 10 onaylı ilan incelenir; tüm stokların denetimi değildir. Referans bulunması tek başına doğru parça eşleşmesi veya satış yetkisi kanıtlamaz. Bu kontrol eşitleme yapmaz.</p>';
        var issueLabels = { PART_LISTING_REQUIRED: "Parça dışı ilan — ayrı akış gerekli", PART_CODE_REVIEW_REQUIRED: "Gerçek parça/OEM kodu doğrulanmalı; ilan kodu makine seri numarası olabilir",
          TRY_PRICE_REQUIRED: "TRY teklif fiyatı ayrıca belirlenmeli; otomatik kur dönüşümü yok", LISTING_QUANTITY_INVALID: "İlan stok alanları geçersiz veya farklı",
          LISTING_IDENTITY_INVALID: "İlan/Satıcı kimliği eksik", COMPANY_AMBIGUOUS: "Birden fazla firma bağlantısı", COMPANY_MISSING: "B2B firma bağlantısı yok",
          COMPANY_INVALID: "Firma aktif değil veya kimlik uyuşmuyor", INVENTORY_REFERENCE_AMBIGUOUS: "Birden fazla stok referansı", INVENTORY_REFERENCE_MISSING: "Bu ilana açık referans veren firma stoğu bulunamadı",
          INVENTORY_INVALID: "Stok aktif değil veya kimlik uyuşmuyor", RESERVATION_INVALID: "Ayrılmış stok bilgisi geçersiz", RESERVATION_PRESENT: "Ayrılmış stok var — üzerine yazılamaz",
          QUANTITY_DIFFERS: "İlan ve sipariş stok miktarları farklı", LINK_SOURCE_UNAVAILABLE: "Bağlantı kaynağı okunamadı — bilinmiyor" };
        if (!audit || audit.state !== "available" || !Array.isArray(audit.rows)) html += '<p role="status">İlan bağlantıları okunamadı — sonuç bilinmiyor.</p>';
        else {
          if (!audit.rows.length) html += '<p>İncelenecek onaylı ilan bulunamadı.</p>';
          html += audit.rows.map(function (row) {
            return '<article class="card"><h4>İlan: ' + esc(row.listingId) + '</h4><ul>' + (Array.isArray(row.issues) ? row.issues : []).map(function (issue) {
              return '<li>' + esc(Object.prototype.hasOwnProperty.call(issueLabels,issue) ? issueLabels[issue] : "Kontrol gerekli") + '</li>';
            }).join("") + '</ul></article>';
          }).join("");
          if (audit.hasMore) html += '<p>Başka onaylı ilanlar da var; bu örneklemde incelenmedi.</p>';
        }
        return html + '<button class="btn" type="button" data-commerce-retry>Yeniden Kontrol Et</button></section>';
      }
      if (!data || data.kind !== kind) return html + '<p role="status">Veri bekleniyor.</p></section>';
      if (kind === "quotes") html += '<p class="sub">Yalnız sunucuda kayıtlı teklif sürümleri gösterilir; yerel taslaklar dahil değildir. Bu kayıt alıcı kabulü, güncel geçerlilik veya ödeme kanıtı değildir. Komisyon gönderim anındaki tutardır.</p>';
      if (kind === "matches") html += '<p class="sub">Yalnız stok yayınlandığında oluşan talep eşleştirme olayları gösterilir; tüm eşleştirme yollarını kapsamaz. Olaydaki atama, talebin bugünkü durumunu veya satış yapıldığını kanıtlamaz.</p>';
      if (data.state === "unavailable") return html + '<p role="alert">' + esc(data.source) + ' kaynağı okunamadı. Kayıt yok veya satış yok sonucu çıkarılamaz.</p><button class="btn" type="button" data-commerce-retry>Yeniden Dene</button></section>';
      var headers = kind === "quotes" ? ["Teklif / sürüm", "Talep", "satıcı", "Kayıt kontrolü", "Toplam", "Komisyon", "Satıcı neti", "Son geçerlilik"] : kind === "matches" ? ["Talep", "satıcı", "Eşleşme sonucu", "Olay zamanı"] :
        kind === "orders" ? ["Sipariş / kayıt ID", "Alıcı firma ID", "Sipariş durumu", "Ödeme durumu", "Tutar", "Kaynak", "Oluşturulma"] :
        ["İşlem", "Bağlı sipariş ID", "Tür", "Durum", "Tutar", "İşlem zamanı"];
      var cells = data.items.map(function (r) {
        if (kind === "quotes") return [(r.quoteId || r.id || "—")+" / v"+(r.version == null ? "?":r.version),r.rfqId,r.supplierCompanyId,
          r.recordState === "verified" ? "Kayıt tutarlı":"Kontrol gerekli",amount(r),
          amount({amountMinor:r.commissionMinor,currency:r.currency}),amount({amountMinor:r.supplierNetMinor,currency:r.currency}),r.expiresAt];
        if (kind === "matches") return [r.rfqKey, r.supplierKey, label(r.outcome), r.createdAt];
        if (kind === "orders") return [(r.orderNumber || "Numarasız") + " / " + (r.id || "—"), r.buyerCompanyId, label(r.status), label(r.paymentStatus), amount(r), label(r.sourceType), r.createdAt];
        return [r.transactionKey || r.id, r.orderId || "Bağlantı yok", label(r.transactionType), label(r.status), amount(r), r.processedAt || "İşlenme tarihi yok"];
      });
      html += '<p class="sub" role="status">Kaynak: ' + esc(data.source) + ' · ' + (data.total === null ? "Toplam bilinmiyor" : esc(data.total) + " kayıt") + ' · Sayfa ' + (Math.floor(data.offset / 20) + 1) + '</p>';
      if (!cells.length) html += '<p>Bu sayfada kayıt bulunamadı. Bu sonuç platform dışında satış yapılmadığı anlamına gelmez.</p>';
      else {
        function caseButton(index){var r=data.items[index],ref=kind==='quotes' ? r.rfqId:kind==='matches' ? r.rfqKey:null;return ref ? '<button class="btn" type="button" data-case-ref="'+esc(ref)+'" data-case-type="'+(kind==='quotes' ? 'rfqId':'rfqKey')+'">İşlem Dosyası</button>':'';}
        html += '<div class="table-wrap desktop"><table><thead><tr>' + headers.map(function (h) { return '<th scope="col">' + h + '</th>'; }).join("") + '<th scope="col">Dosya</th></tr></thead><tbody>' +
          cells.map(function (row,index) { return '<tr>' + row.map(function (v) { return '<td>' + esc(v == null ? "Bilinmiyor" : v) + '</td>'; }).join("") + '<td>'+caseButton(index)+'</td></tr>'; }).join("") + '</tbody></table></div>';
        html += '<div class="cards-mobile">' + cells.map(function (row,index) {
          return '<article class="card">' + row.map(function (v, i) { return '<p><strong>' + headers[i] + ':</strong> ' + esc(v == null ? "Bilinmiyor" : v) + '</p>'; }).join("") + caseButton(index)+'</article>';
        }).join("") + '</div>';
      }
      if (data.capped) html += '<p role="status">İlk 10.000 kayıt sınırına ulaşıldı; daha eski kayıtlar bu ekranda gösterilmez.</p>';
      return html + '<div class="filters"><button type="button" data-commerce-page="prev"' + (data.offset === 0 ? " disabled" : "") + '>Önceki</button><button type="button" data-commerce-page="next"' + (!data.hasMore ? " disabled" : "") + '>Sonraki</button><button type="button" data-commerce-retry>Yenile</button></div></section>';
    }

    _captureAdminDraft(form) {
      if (!form) return;
      var data = {};
      form.querySelectorAll("[name]").forEach(function (el) {
        if (el.type === "checkbox") data[el.name] = el.checked;
        else data[el.name] = el.value;
      });
      data.images = this._adminImages.slice();
      this._adminDraft = data;
    }

    _uploadAdminFiles(files) {
      var self = this;
      var room = 6 - this._adminImages.length;
      var selected = Array.prototype.slice.call(files || []).slice(0, Math.max(0, room));
      if (!selected.length) return;
      this._adminUploadsInFlight = selected.length;
      this._render();
      var chain = Promise.resolve();
      var uploaded = [];
      selected.forEach(function (file) {
        chain = chain.then(function () {
          var okType = /image\/(jpeg|jpg|png|webp)/i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name || "");
          if (!okType || file.size > 10 * 1024 * 1024) throw new Error("Yalnızca JPG, PNG, WEBP ve 10 MB altı dosyalar kabul edilir.");
          var mime = file.type === "image/jpg" ? "image/jpeg" : file.type || "image/jpeg";
          return self.portalApi("generateAdminListingImageUploadUrl", { mimeType: mime, fileName: file.name || "listing.jpg", sizeBytes: file.size }).then(function (res) {
            if (!res || !res.ok) throw new Error(res && res.error && res.error.message || "Yükleme adresi alınamadı.");
            var data = res.data || {};
            var putUrl = data.uploadUrl;
            if (!putUrl) throw new Error("Yükleme adresi eksik.");
            try { var parsed = new URL(putUrl); if (!parsed.searchParams.get("filename")) parsed.searchParams.set("filename", data.fileName || file.name || "listing.jpg"); putUrl = parsed.toString(); } catch (_) {}
            return fetch(putUrl, { method: "PUT", headers: { "Content-Type": data.mimeType || mime }, body: file });
          }).then(function (httpRes) {
            if (!httpRes.ok) throw new Error("Fotoğraf yükleme başarısız (" + httpRes.status + ")");
            return httpRes.json().catch(function () { return {}; });
          }).then(function (body) {
            return self.portalApi("confirmAdminListingImageUpload", { file: (body && body.file) || body || {} });
          }).then(function (res) {
            if (!res || !res.ok || !res.data) throw new Error(res && res.error && res.error.message || "Yükleme doğrulanamadı.");
            uploaded.push(res.data);
          });
        }).catch(function (err) {
          self._err = err && err.message || "Görsel yüklenemedi.";
        }).then(function () { self._adminUploadsInFlight = Math.max(0, self._adminUploadsInFlight - 1); });
      });
      chain.then(function () {
        self._adminImages = self._adminImages.concat(uploaded).slice(0, 6);
        self._adminUploadsInFlight = 0;
        self._render();
      });
    }

    _ownedProducts() {
      var data=this._data.ownedProducts, filters=this._ownedFilters || {};
      if(!data)return '<p role="status">Ürünlerimiz yükleniyor…</p>';
      function money(n,currency){return typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('tr-TR',{style:'currency',currency:currency || 'TRY'}) : 'Belirtilmemiş';}
      function option(value,label,current){return '<option value="'+esc(value)+'" '+(value===current?'selected':'')+'>'+esc(label)+'</option>';}
      var rows=data.items.map(function(row){
        var cost=row.purchase, status=row.status==='published'?'Yayında':row.status==='hidden'?'Yayında değil':'Henüz yayımlanmadı';
        var href=row.publicProductId ? '/yedek-parcalar?id='+encodeURIComponent(row.publicProductId) : '';
        return '<article class="card"><h3>'+esc(row.title || row.productCode)+'</h3><p><strong>'+esc(row.productCode)+'</strong> · '+esc(status)+' · '+(row.source==='import'?'İçe aktarılan ürün':'Elle eklenen ürün')+'</p>' +
          '<p>Satıcı: <strong>Parça Zinciri</strong> · '+(row.imageUrl?'Görsel mevcut':'Görsel bekleniyor')+'</p>'+
          '<p>OEM: '+esc(row.oem || 'Belirtilmemiş')+'</p><p>Marka: '+esc(row.brand || 'Belirtilmemiş')+' · Kategori: '+esc(row.category || 'Belirtilmemiş')+'</p>'+
          '<p>Uyum / model: '+esc(row.vehicleInfo || 'Belirtilmemiş')+'</p>'+
          '<div class="grid"><div><span>Satış fiyatı</span><p><strong>'+(row.inquiry?'Sorunuz':esc(money(row.salePriceEur,'EUR')))+'</strong></p></div><div><span>Stok</span><p><strong>'+(row.inquiry?'Sorunuz':esc(row.stockQuantity == null ? 'Belirtilmemiş' : row.stockQuantity))+'</strong></p></div></div>'+
          (cost?'<details><summary>Alış bilgileri · yalnız yönetici</summary><p>Tedarik kaynağı: '+esc(cost.supplierName)+'</p><p>Liste: '+esc(money(cost.listPrice,cost.currency))+' · İskonto: '+(cost.discountPercent==null?'Belirtilmedi':'%'+esc(cost.discountPercent))+' · Komisyon: '+(cost.commissionPercent==null?'Belirtilmedi':'%'+esc(cost.commissionPercent))+'</p><p><strong>Net alış: '+esc(money(cost.netPrice,cost.currency))+' · '+(cost.vatBasis==='included'?'KDV dahil':cost.vatBasis==='excluded'?'KDV hariç':'KDV doğrulanmadı')+'</strong></p><p>Kayıt tarihi: '+esc(cost.priceDate||'Bilinmiyor')+' · '+esc(cost.evidence||'')+'</p></details>':'<p class="sub">Alış maliyeti henüz kaydedilmemiş.</p>')+
          (href?'<p><a class="btn" href="'+esc(href)+'" target="_blank" rel="noopener">Sitede Gör</a></p>':'')+'</article>';
      }).join('');
      return '<section><h2>Ürünlerimiz</h2><p>Parça Zinciri adına satılan ürünler. Alış bilgileri müşterilere gösterilmez. Fiyatı ve stoğu teyit edilmeyen ürünlerde “Sorunuz” yazar.</p>'+
        '<div class="grid"><article class="card">Toplam ürün<strong> '+esc(data.summary.total)+'</strong></article><article class="card">Yayında<strong> '+esc(data.summary.published)+'</strong></article><article class="card">Görsel bekleyen<strong> '+esc(data.summary.missingImages)+'</strong></article><article class="card">Fiyat / stok sorunuz<strong> '+esc(data.summary.inquiry)+'</strong></article></div>'+
        '<form id="owned-search-form" class="purchase-search"><div class="field"><label for="owned-search">Ürün, OEM, marka veya model</label><input id="owned-search" maxlength="100" value="'+esc(filters.search || '')+'"></div>'+
        '<div class="field"><label for="owned-status">Yayın durumu</label><select id="owned-status">'+option('','Tümü',filters.status || '')+option('published','Yayında',filters.status)+option('hidden','Yayında değil',filters.status)+option('unpublished','Henüz yayımlanmadı',filters.status)+'</select></div>'+
        '<div class="field"><label for="owned-source">Kayıt kaynağı</label><select id="owned-source">'+option('','Tümü',filters.source || '')+option('import','İçe aktarılan',filters.source)+option('manual','Elle eklenen',filters.source)+'</select></div>'+
        '<div><label><input id="owned-missing-images" type="checkbox" '+(filters.missingImages?'checked':'')+'> Görseli eksik</label></div><button class="btn primary" type="submit">Filtrele</button></form>'+
        '<p>'+esc(data.total)+' ürün · '+(data.items.length?esc(data.offset+1)+'–'+esc(data.offset+data.items.length):'0')+' · <a href="/yedek-parcalar?scope=platform" target="_blank" rel="noopener">Web sitesindeki ürünlerimiz</a></p>'+
        (rows || '<p>Bu filtrelere uygun ürün bulunamadı.</p>')+
        '<button class="btn" data-owned-page="prev" '+(data.offset?'':'disabled')+'>Önceki</button> <button class="btn" data-owned-page="next" '+(data.hasNext?'':'disabled')+'>Sonraki</button></section>';
    }

    _purchasePrices() {
      var data = this._data.purchasePrices;
      if (!data) return '<p role="status">Alış fiyatları henüz alınamadı.</p>';
      function money(value,currency) { return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("tr-TR",{maximumFractionDigits:2})+' '+(currency||'') : "Belirtilmemiş"; }
      var rows = data.items.map(function (row) {
        return '<article class="card"><h3>'+esc(row.productCode)+' · '+esc(row.title||row.brand||'')+'</h3><p>'+esc(row.vehicleInfo||'')+'</p>' +
          '<div class="grid"><div><span>Liste fiyatı</span><p>'+esc(money(row.listPrice??row.supplierListPriceTry,row.currency))+'</p></div>' +
          '<div><span>İskonto</span><p>'+(row.discountPercent==null?'Belirtilmedi':'%'+esc(row.discountPercent))+'</p></div><div><span>Komisyon</span><p>'+(row.commissionPercent==null?'Belirtilmedi':'%'+esc(row.commissionPercent))+'</p></div>' +
          '<div><span>Net alış</span><p><strong>'+esc(money(row.netPrice??row.purchaseNetTry,row.currency))+'</strong></p></div></div>' +
          '<p class="sub">'+esc(row.supplierName)+' · Kayıt tarihi: '+esc(row.priceDate||'Bilinmiyor')+' · '+(row.vatBasis==='included'?'KDV dahil':row.vatBasis==='excluded'?'KDV hariç':'KDV doğrulanmadı')+'</p><p>'+esc(row.evidence||'')+'</p>' +
          '<p class="sub">Ürünün yayın, görsel, satış fiyatı ve stok durumunu Ürünlerimiz ekranından takip edin.</p></article>';
      }).join("");
      return '<section><h2>Alış Fiyatları</h2><p>Yalnız yöneticiler görür. Alış iskontosu, satış komisyonundan ayrıdır. KDV ve para birimi her kayıtta ayrı belirtilir.</p>' +
        '<p class="sub">Kaynak firma ve fiyat listesi dönemi ürün kartlarında gösterilir. Fiyatların güncel sipariş için geçerliliği ayrıca teyit edilmelidir.</p>' +
        '<form class="purchase-search" id="purchase-search-form"><div class="field"><label for="purchase-source">Tedarik kaynağı</label><select id="purchase-source">'+(data.sources||[]).map(function(v){return '<option value="'+esc(v[0])+'"'+((this._purchaseSource||'yuksel-automotive')===v[0]?' selected':'')+'>'+esc(v[1])+'</option>';},this).join('')+'</select></div><div class="field"><label for="purchase-search">Ürün kodu, OEM veya ürün adı</label><input id="purchase-search" maxlength="100" value="'+esc(this._purchaseSearch || "")+'"></div><button class="btn primary" type="submit">Ara</button></form>' +
        '<p>'+esc(data.total)+' ürün · '+(data.items.length ? esc(data.offset+1)+'–'+esc(data.offset+data.items.length):'0')+'</p>'+ (rows || '<p>Aramaya uygun ürün bulunamadı.</p>') +
        '<button class="btn" type="button" data-purchase-page="prev" '+(data.offset ? '':'disabled')+'>Önceki</button> '+
        '<button class="btn" type="button" data-purchase-page="next" '+(data.hasNext ? '':'disabled')+'>Sonraki</button></section>';
    }


    _articles() {
      const row=this._articleDraft || {}, d=row.draft || {};
      const field=(name,label,max)=>'<div class="field"><label for="article-'+name+'">'+label+'</label><input id="article-'+name+'" name="'+name+'" maxlength="'+max+'" value="'+esc(d[name]||'')+'"'+(name==='title'?' required':'')+'></div>';
      const rows=this._data.articles?.items || [];
      return '<section class="section"><h2>Makaleler</h2><p class="sub">Taslağı kaydetmek yayındaki metni değiştirmez. Değişiklikleri görünür yapmak için Yayınla düğmesini kullanın.</p><button type="button" class="btn primary" data-article-new>+ Yeni makale</button><div class="card"><h3>Makale listesi</h3>'+rows.map(a=>'<p><button type="button" class="btn" data-article-edit="'+esc(a._id)+'">'+esc(a.draft?.title||'Başlıksız')+'</button> <span>'+ (a.status==='published'?'Yayında':'Taslak')+'</span></p>').join('')+(!rows.length?'<p>Henüz makale yok.</p>':'')+
      '<button type="button" class="btn" data-article-page="-1"'+(!(this._articleOffset>0)?' disabled':'')+'>Önceki</button> <button type="button" class="btn" data-article-page="1"'+(!this._data.articles?.hasMore?' disabled':'')+'>Sonraki</button></div>'+
      '<form id="pz-article-form" class="card"><h3>'+ (row._id?'Makaleyi düzenle':'Yeni makale')+'</h3><div class="grid">'+field('title','Başlık',180)+field('category','Kategori (isteğe bağlı)',80)+field('authorName','Yazar adı (boşsa Parça Zinciri)',100)+'</div>'+field('excerpt','Kısa açıklama',320)+
      '<div class="field"><p><strong>Otomatik makale kapağı</strong></p><small>Başlığı yazmanız yeterli. Kapak Parça Zinciri tasarımıyla otomatik hazırlanır; görsel yüklemeniz gerekmez.</small><img data-article-auto-cover alt="Otomatik makale kapağı önizlemesi" src="'+pzArticleCover(d.title)+'" style="display:block;width:100%;max-width:600px;height:auto;border-radius:12px;margin:12px 0 24px"></div>'+
      '<div class="field"><label for="article-body">Makale metni</label><textarea id="article-body" name="body" maxlength="60000" rows="18" style="min-height:360px;padding:16px">'+esc(d.body||'')+'</textarea><small>Paragrafları boş satırla ayırın. HTML kodu çalıştırılmaz.</small></div>'+
      '<p id="article-feedback" role="status">'+esc(this._articleNotice||'')+'</p><button class="btn" type="submit" value="save">Taslağı kaydet</button> <button class="btn primary" type="submit" value="publish">Yayınla</button> <button class="btn" type="button" data-article-preview>Önizle</button>'+
      (row.status==='published'?' <button class="btn" type="button" data-article-unpublish>Yayından kaldır</button>':'')+'<div data-article-preview-body hidden style="white-space:pre-wrap;overflow-wrap:anywhere;margin-top:24px"></div></form></section>';
    }

    _bindArticles() {
      const form=this._qs('#pz-article-form'); if(!form)return;
      const capture=()=>{this._articleDraft={...(this._articleDraft||{}),draft:Object.fromEntries(new FormData(form))};};
      form.addEventListener('input',()=>{capture();form.querySelector('[data-article-auto-cover]').src=pzArticleCover(this._articleDraft.draft.title);});
      const feedback=message=>{this._articleNotice=message;form.querySelector('#article-feedback').textContent=message;};
      const save=async action=>{
        if(this._articleSaving)return;
        capture(); const row=this._articleDraft;
        this._articleSaving=true;
        form.querySelectorAll('button,input,textarea').forEach(e=>e.disabled=true);
        feedback('Kaydediliyor…');
        try {
          const r=await this.portalApi('adminArticles',{...row.draft,id:row._id,version:row.version,action});
          if(!r?.ok)throw Error(r?.error?.message||'Kayıt yapılamadı. Metniniz korunuyor.');
          this._articleDraft=r.data;this._articleNotice=action==='publish'?'Makale yayınlandı.':action==='unpublish'?'Makale yayından kaldırıldı.':'Taslak kaydedildi; yayındaki metin değiştirilmedi.';
          this._loadScreen();
        }catch(e){feedback(e.message);}
        finally{this._articleSaving=false;form.querySelectorAll('button,input,textarea').forEach(e=>e.disabled=false);}
      };
      form.addEventListener('submit',e=>{e.preventDefault();if(form.reportValidity())save(e.submitter?.value||'save');});
      form.querySelector('[data-article-unpublish]')?.addEventListener('click',()=>save('unpublish'));
      form.querySelector('[data-article-preview]').addEventListener('click',()=>{capture();const p=form.querySelector('[data-article-preview-body]');p.hidden=false;p.textContent=this._articleDraft.draft.title+'\n\n'+this._articleDraft.draft.body;});
      this.shadowRoot.querySelector('[data-article-new]').addEventListener('click',()=>{this._articleDraft={};this._articleNotice='';this._render();});
      this.shadowRoot.querySelectorAll('[data-article-edit]').forEach(button=>button.addEventListener('click',()=>{this._articleDraft=this._data.articles.items.find(a=>a._id===button.dataset.articleEdit);this._articleNotice='';this._render();}));
      this.shadowRoot.querySelectorAll('[data-article-page]').forEach(button=>button.addEventListener('click',()=>{this._articleOffset=Math.max(0,(this._articleOffset||0)+Number(button.dataset.articlePage)*30);this._loadScreen();}));
    }

    _bindMobileConnection() {
      const id=new URL(location.href).searchParams.get('mobileConnect');
      if(!/^[a-f0-9]{32}$/.test(id||''))return;
      const box=document.createElement('section');box.className='card';
      box.style.cssText='margin:16px;border:2px solid #d75f17;padding:20px;max-width:560px';
      box.setAttribute('aria-label','Mobil uygulamayı bağla');
      if(this._mobileConnected===id){box.innerHTML='<h2>Uygulama bağlantısı onaylandı</h2><p>Parça Zinciri uygulamasına geri dönün. Girişiniz otomatik tamamlanacak.</p>';}
      else {
        box.innerHTML='<h2>Mobil uygulamayı bağla</h2><p>Yalnızca kendi telefonunuzdaki Parça Zinciri uygulamasından başlattığınız bağlantıyı onaylayın. Uygulamada görünen kodu buraya yazın.</p><form><label class="field">Uygulamadaki 6 haneli kod<input name="code" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off" required></label><label style="display:block;margin:16px 0"><input type="checkbox" required> Bu bağlantıyı kendi cihazımdan başlattım.</label><button class="btn primary" type="submit">Yönetici hesabımı uygulamaya bağla</button><p role="status" aria-live="polite"></p></form>';
        box.querySelector('form').onsubmit=async event=>{
          event.preventDefault();const button=box.querySelector('button'),status=box.querySelector('[role=status]');button.disabled=true;status.textContent='Hesap doğrulanıyor…';
          try{
            const result=await this.portalApi('approveMobileConnection',{id,code:box.querySelector('[name=code]').value});
            if(!result?.ok)throw new Error(result?.error?.message||'Bağlantı onaylanamadı. Yeniden deneyin.');
            this._mobileConnected=id;box.innerHTML='<h2>Uygulama bağlantısı onaylandı</h2><p>Parça Zinciri uygulamasına geri dönün. Girişiniz otomatik tamamlanacak.</p>';
          }catch(e){status.textContent=e.message;button.disabled=false;}
        };
      }
      (this.shadowRoot.querySelector('.main')||this.shadowRoot).prepend(box);
    }

    _bindApp() {
      if(this.mobileAdapter){
        this.shadowRoot.querySelector('a[href="/yonetim?kurulum=1"]')?.remove();
        this.shadowRoot.querySelectorAll('a[href^="/"]').forEach(a=>{a.href='https://www.parcazinciri.com'+a.getAttribute('href');a.target=navigator.userAgent.includes('PZAndroid/')?'_self':'_blank';a.rel='noopener noreferrer';});
      }
      this._bindMobileConnection();
      this._bindArticles();
      var workbench = this._qs("#pz-listing-workbench"), pricingSelf = this;
      if (workbench) pzListingPricing.mountListingWorkbench(workbench, {initialKey: this._pricingListingKey || "", onNavigate:function(key){pricingSelf._pricingListingKey=key;pricingSelf._rememberScreen();},onBack:function(){pricingSelf._screenHistory.back(function(){pricingSelf._pricingListingKey="";pricingSelf._render();});}, api: async function(method,payload){var r=await pricingSelf.portalApi(method,payload);if(!r||!r.ok)throw new Error(r?.error?.message||"İşlem tamamlanamadı.");return r.data;}});
      var self = this;
      var adminForm = this._qs("#pz-admin-product-form");
      var ownedSearch=this._qs('#owned-search-form');
      if(ownedSearch)ownedSearch.addEventListener('submit',function(event){event.preventDefault();
        self._ownedFilters={search:self._qs('#owned-search').value,status:self._qs('#owned-status').value,source:self._qs('#owned-source').value,missingImages:self._qs('#owned-missing-images').checked};
        self._ownedOffset=0;self._loadScreen();
      });
      this.shadowRoot.querySelectorAll('[data-owned-page]').forEach(function(button){button.addEventListener('click',function(){
        self._ownedOffset=Math.max(0,(self._ownedOffset || 0)+(button.getAttribute('data-owned-page')==='next'?25:-25));self._loadScreen();
      });});
      var purchaseSearch = this._qs("#purchase-search-form");
      if (purchaseSearch) purchaseSearch.addEventListener("submit", function(event) {
        event.preventDefault();self._purchaseSearch=self._qs("#purchase-search").value;self._purchaseSource=self._qs('#purchase-source').value;self._purchaseOffset=0;self._loadScreen();
      });
      this.shadowRoot.querySelectorAll("[data-purchase-page]").forEach(function(button) {
        button.addEventListener("click",function() {self._purchaseOffset=Math.max(0,(self._purchaseOffset || 0)+(button.getAttribute("data-purchase-page")==="next" ? 25:-25));self._loadScreen();});
      });
      if (adminForm) {
        var procurementCode=self._qs('#pz-admin-oem');
        if(procurementCode){
          procurementCode.addEventListener('input',function(){clearTimeout(self._procurementTimer);self._procurementRequest=(self._procurementRequest||0)+1;var value=procurementCode.value;self._procurementTimer=setTimeout(function(){self._lookupProcurement(value);},450);});
          if(procurementCode.value)self._lookupProcurement(procurementCode.value);
        }
        this.shadowRoot.querySelectorAll("[data-admin-photo-input]").forEach(function (input) {
          input.addEventListener("change", function () { var files = input.files; input.value = ""; self._uploadAdminFiles(files); });
        });
        this.shadowRoot.querySelectorAll("[data-admin-photo-remove]").forEach(function (button) {
          button.addEventListener("click", function () { var index = Number(button.getAttribute("data-admin-photo-remove")); if (Number.isInteger(index)) { self._adminImages.splice(index, 1); self._render(); } });
        });
        this.shadowRoot.querySelectorAll("[data-admin-add-focus]").forEach(function (button) {
          button.addEventListener("click", function () { var form = self._qs("#pz-admin-product-form"); if (form) form.scrollIntoView({ behavior: "smooth", block: "start" }); });
        });
        ["pz-admin-machine-type", "pz-admin-brand", "pz-admin-listing-type"].forEach(function (id) {
          var control = self._qs("#" + id);
          if (control) control.addEventListener("change", function () {
            self._captureAdminDraft(adminForm);
            if (id === "pz-admin-listing-type") self._adminDraft.listingType = control.value;
            if (id === "pz-admin-machine-type") { self._adminDraft.machineType = control.value; self._adminDraft.machineBrandId = ""; self._adminDraft.machineModelId = ""; }
            if (id === "pz-admin-brand") self._adminDraft.machineModelId = "";
            self._render();
          });
        });
        this._syncRequiredSteps(adminForm);
        adminForm.addEventListener('input', function () { self._syncRequiredSteps(adminForm); });
        adminForm.addEventListener('change', function () { self._syncRequiredSteps(adminForm); });
        adminForm.addEventListener("submit", function (event) {
          event.preventDefault();
          if (self._adminSaving || !adminForm.reportValidity()) return;
          self._captureAdminDraft(adminForm);
          var d = self._adminDraft || {};
          var payload = Object.assign({}, d, { listingType: d.listingType || "part", images: d.images || [] });
          var status = self._qs("#pz-admin-product-status");
          self._adminSaving = true;
          if (status) status.textContent = "Ürün doğrulanıyor ve doğrudan kataloğa alınıyor…";
          self._render();
          self.portalApi("createAdminListing", payload).then(function (result) {
            if (!result || result.ok !== true) throw new Error((result && result.error && result.error.message) || "Kayıt doğrulanamadı.");
            self._adminDraft = null;
            self._adminImages = [];
            self._toast = "Ürün doğrudan onaylandı ve kataloğa alındı.";
            self._adminSaving = false;
            self._render();
          }).catch(function (error) {
            self._adminSaving = false;
            self._err = error && error.message ? error.message : "Ürün kaydedilemedi. Alanları kontrol edip yeniden deneyin.";
            self._render();
          });
        });
      }
      this.shadowRoot.querySelectorAll("[data-theme]").forEach(function (button) {
        button.addEventListener("click", function () {
          self._theme = button.getAttribute("data-theme") === "dark" ? "dark" : "light";
          self.setAttribute("data-admin-theme", self._theme);
          try { window.localStorage.setItem(THEME_KEY, self._theme); } catch (e) {}
          self.shadowRoot.querySelectorAll("[data-theme]").forEach(function (item) {
            item.setAttribute("aria-pressed", String(item.getAttribute("data-theme") === self._theme));
          });
          // No rerender/API call: retain draft inputs, focus and navigation history.
        });
      });
      function openCase(ref){self._screen='commerce';self._commerceCaseRef=ref;self._data.commerceCase=null;self._commerceKind='case';self._loadScreen();}
      var caseForm=this._qs('#commerce-case-form');
      if(caseForm)caseForm.addEventListener('submit',function(e){e.preventDefault();if(caseForm.reportValidity())openCase({rfqKey:self._qs('#commerce-case-key').value.trim()});});
      this.shadowRoot.querySelectorAll('[data-case-ref]').forEach(function(btn){btn.addEventListener('click',function(){var ref={};ref[btn.getAttribute('data-case-type')]=btn.getAttribute('data-case-ref');openCase(ref);});});
      var scopeForm=this._qs("#commission-scope"), saveForm=this._qs("#commission-save");
      var searchForm=this._qs("#commission-search-form");
      if (searchForm) searchForm.addEventListener("submit",function(e) {
        e.preventDefault();self._commissionSearch=self._qs("#commission-search").value.trim();
        self._commissionDirectoryOffset=0;self._loadScreen();
      });
      this.shadowRoot.querySelectorAll("[data-commission-directory],[data-commission-history]").forEach(function(btn){
        btn.addEventListener("click",function(){
          var isHistory=btn.hasAttribute("data-commission-history");
          var prop=isHistory ? "_commissionHistoryOffset":"_commissionDirectoryOffset";
          var direction=btn.getAttribute(isHistory ? "data-commission-history":"data-commission-directory");
          self[prop]=Math.max(0,(self[prop] || 0)+(direction === "next" ? 20:-20));self._loadScreen();
        });
      });
      if (scopeForm) scopeForm.addEventListener("submit",function(e) {
        e.preventDefault();
        self._commissionCompanyId=self._qs("#commission-company").value.trim();
        self._commissionHistoryOffset=0;
        self._data.commission=null;
        self._loadScreen();
      });
      if (saveForm) saveForm.addEventListener("submit",async function(e) {
        e.preventDefault();
        if (self._commissionSaving || !saveForm.reportValidity()) return;
        var cfg=self._data.commission, target=cfg.companyId ? cfg.seller:cfg.general;
        var input=self._qs("#commission-percent").value;
        if (!/^\d{1,3}(\.\d{1,2})?$/.test(input)) return;
        var inherit=self._qs("#commission-inherit");
        var payload={companyId:cfg.companyId,expectedVersion:target.version,
          rateBps:inherit && inherit.checked ? null:Math.round(Number(input)*100),reason:self._qs("#commission-reason").value.trim()};
        var status=self._qs("#commission-status"), button=saveForm.querySelector('button[type="submit"]');
        var saveLoadVersion=self._loadVersion;
        self._commissionSaving=true;button.disabled=true;status.textContent="Kaydediliyor…";
        try {
          var result=await self.portalApi("saveCommissionSettings",payload);
          if (!result || result.ok !== true) throw new Error("SAVE_FAILED");
          if(saveLoadVersion!==self._loadVersion) return;
          self._data.commission=result.data;
          self._render();
          var savedStatus=self._qs("#commission-status");
          if (savedStatus) savedStatus.textContent="Yeni oran kaydedildi. Önceki teklifler değiştirilmedi.";
        } catch (err) {
          status.textContent="Kayıt doğrulanamadı. Ayarları yeniden getirip kontrol edin; kaydedildi sayılmadı.";
        } finally {self._commissionSaving=false;button.disabled=false;}
      });
      this.shadowRoot.querySelectorAll("[data-commerce-kind]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          self._commerceKind = btn.getAttribute("data-commerce-kind");
          self._commerceOffset = 0;
          self._loadScreen();
        });
      });
      this.shadowRoot.querySelectorAll("[data-commerce-page]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (btn.disabled) return;
          self._commerceOffset += btn.getAttribute("data-commerce-page") === "next" ? 20 : -20;
          self._loadScreen();
        });
      });
      this.shadowRoot.querySelectorAll("[data-commerce-retry]").forEach(function (btn) {
        btn.addEventListener("click", function () { self._loadScreen(); });
      });
      var nav = this._qs("#pz-ops-nav");
      var scrim = this._qs("#pz-ops-scrim");
      var menu = this._qs("#pz-ops-menu");
      if (menu) {
        menu.addEventListener("click", function () {
          nav.classList.add("open");
          scrim.classList.add("show");
        });
      }
      if (scrim) {
        scrim.addEventListener("click", function () {
          nav.classList.remove("open");
          scrim.classList.remove("show");
        });
      }
      this.shadowRoot.querySelectorAll("[data-nav]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          self._pricingListingKey="";
          self._screen = btn.getAttribute("data-nav");
          self._filter = "";
          self._detail = null;
          nav.classList.remove("open");
          scrim.classList.remove("show");
          self._loadScreen();
        });
      });
      var help = this._qs("#pz-ops-help");
      if (help) {
        help.addEventListener("click", function () {
          var box = self._qs("#pz-ops-helpbox");
          if (box) box.classList.toggle("on");
        });
      }
      var logout = this._qs("#pz-ops-logout");
      if (logout) logout.addEventListener("click", function () {
        self._logout();
      });
      this.shadowRoot.querySelectorAll("[data-ex]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          self._openDetail(btn.getAttribute("data-ex"));
        });
      });
      this.shadowRoot.querySelectorAll("[data-filter-type]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          self._filter = btn.getAttribute("data-filter-type");
          self._render();
        });
      });
      this.shadowRoot.querySelectorAll("[data-act]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var act = btn.getAttribute("data-act");
          if (btn.disabled) return;
          var extra = {};
          if (act === "REJECT") {
            var reasonEl = self._qs("#pz-ops-reject-reason");
            extra.reason = (reasonEl && reasonEl.value) || "Ops reddi";
          }
          if (act === "APPROVE" && self._detail && self._detail.entityType === "RFQRequests") {
            var cands = (self._detail.context && self._detail.context.candidates) || [];
            extra.supplierKey = (cands[0] && cands[0].supplierKey) || "";
          }
          if(act === "APPROVE" && self._detail && self._detail.entityType === "SupplierListings"){
            self._pricingListingKey=self._detail.entityId;self._screen="listings";self._loadScreen();return;
          }
          self._resolve(act, extra);
        });
      });
      this.shadowRoot.querySelectorAll("[data-rfq-f]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          self._filter = btn.getAttribute("data-rfq-f");
          self._render();
        });
      });
      this.shadowRoot.querySelectorAll("[data-audit-f]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          self._filter = btn.getAttribute("data-audit-f");
          self._render();
        });
      });
      this.shadowRoot.querySelectorAll("[data-list-approve]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          self
            .portalApi("recordListingDecision", {
              listingKey: btn.getAttribute("data-list-approve"),
              humanAction: "APPROVE"
            })
            .then(function () {
              self._toast = "İlan onaylandı";
              self._loadScreen();
            });
        });
      });
      this.shadowRoot.querySelectorAll("[data-list-reject]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          self
            .portalApi("recordListingDecision", {
              listingKey: btn.getAttribute("data-list-reject"),
              humanAction: "REJECT",
              reason: "Ops reddi"
            })
            .then(function () {
              self._toast = "İlan reddedildi";
              self._loadScreen();
            });
        });
      });
      this.shadowRoot.querySelectorAll("[data-suspend]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (!window.confirm("satıcı askıya alınsın mı?")) return;
          self
            .portalApi("setSupplierStatus", { supplierKey: btn.getAttribute("data-suspend"), status: "suspended" })
            .then(function () {
              self._loadScreen();
            });
        });
      });
      this.shadowRoot.querySelectorAll("[data-activate]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          self
            .portalApi("setSupplierStatus", { supplierKey: btn.getAttribute("data-activate"), status: "active" })
            .then(function () {
              self._loadScreen();
            });
        });
      });
    }
  }

  if (!customElements.get("parca-zinciri-admin-ops")) {
    customElements.define("parca-zinciri-admin-ops", ParcaZinciriAdminOps);
  }
  window.ParcaZinciriAdminOps = ParcaZinciriAdminOps;
})();
