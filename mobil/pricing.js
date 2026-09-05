// Shared admin UI; tools/sync-pricing-ui.mjs embeds this same source in Wix CE.
const priceEsc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const priceMoney = (minor, currency = 'EUR') => minor == null ? 'Belirtilmemiş' : new Intl.NumberFormat('tr-TR', {style:'currency', currency}).format(minor / 100);
const priceConditions = {new_unboxed:'Sıfır, kutusuz',new_boxed:'Sıfır, kutulu',used_good:'Kullanılmış, iyi durumda',repaired_working_good:'Tamir edilmiş, çalışır durumda',new:'Yeni',used:'Kullanılmış',refurbished:'Yenilenmiş',new_original:'Sıfır, orijinal',original_reconditioned:'Orijinal, revizyonlu'};
const priceStates = {pending:'Onay bekliyor', approved:'Onaylandı', rejected:'Reddedildi', draft:'Taslak', archived:'Arşivlendi'};
const priceCss = `<style>
.pz-pricing{color:#16372d;font:inherit;max-width:100%;overflow-wrap:anywhere}.pz-pricing *{box-sizing:border-box}.pz-pricing h2{font-size:1.35rem}.pz-pricing h3{font-size:1.1rem}.pz-pricing .pr-box{background:#fff;border:1px solid #d6dfd5;border-radius:14px;padding:18px;margin:14px 0}.pz-pricing .pr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}.pz-pricing label{display:block;font-weight:600}.pz-pricing input,.pz-pricing select{display:block;width:100%;min-height:46px;border:1px solid #b6c6b8;border-radius:8px;padding:10px;margin:6px 0 12px;font:inherit;background:#fff;color:#16372d}.pz-pricing button{border:1px solid #b6c6b8;border-radius:9px;padding:12px 16px;background:#f3f6ee;color:#16372d;cursor:pointer;font:inherit;margin:5px 8px 5px 0;min-height:44px}.pz-pricing button.primary{background:#d85e13;color:white;border-color:#d85e13}.pz-pricing button:disabled{opacity:.5;cursor:wait}.pz-pricing .pr-muted{color:#5a705f;font-size:.9em}.pz-pricing .pr-error{color:#a62e1d}.pz-pricing .pr-total{font-size:1.6rem;font-weight:700}.pz-pricing .pr-table{overflow-x:auto}.pz-pricing table{width:100%;border-collapse:collapse;font-size:.95em}.pz-pricing th,.pz-pricing td{text-align:left;padding:10px;border-bottom:1px solid #d6dfd5;vertical-align:top}.pz-pricing .pr-photo{max-width:160px;max-height:140px;object-fit:contain}.pz-pricing .pr-result{border-left:4px solid #d85e13}.pz-pricing dt{color:#5a705f}.pz-pricing dd{margin:4px 0 14px;font-weight:600}
</style>`;
function fxText(fx) {return fx ? `TCMB EUR döviz satış · ${priceEsc(fx.date)} · 1 EUR = ${priceEsc(fx.rate.toLocaleString('tr-TR', {minimumFractionDigits:4}))} TL` : 'TCMB kuru alınamadı. EUR ve yüzdelik komisyon kullanılabilir; TL komisyon için tekrar deneyin.';}
function offerTable(items) {
  if (!items.length) return '<p>Bu aramada ürün bulunamadı.</p>';
  return `<div class="pr-table"><table><thead><tr><th>Firma / ürün</th><th>Stok</th><th>Tedarikçi fiyatı</th><th>Satış fiyatı</th><th>Durum / işlem</th></tr></thead><tbody>${items.map(p => `<tr><td><strong>${priceEsc(p.companyName)}</strong><br>${priceEsc(p.title)}<br>Kod: ${priceEsc(p.productCode || 'Diğer')}<br><small>${priceEsc(p.brand)} · ${priceEsc(priceConditions[p.condition] || 'Durum belirtilmemiş')}<br>${priceEsc(p.sellerNumber)}</small></td><td>${priceEsc(p.stockQuantity)} adet</td><td>${priceMoney(p.priceEur == null ? null : Math.round(p.priceEur * 100))}</td><td>${p.pricing ? priceMoney(p.pricing.saleMinor) : 'Henüz belirlenmedi'}</td><td>${priceEsc(priceStates[p.status] || p.status)}<br><button type="button" data-review-key="${priceEsc(p.listingKey)}">İncele / fiyatlandır</button></td></tr>`).join('')}</tbody></table></div>`;
}
export async function mountListingReview(root, options) {
  const {api, listingKey, onBack, onApproved} = options;
  root.innerHTML = priceCss + '<div class="pz-pricing"><p role="status">Ürün ve TCMB kuru yükleniyor…</p></div>';
  try {
    const result = await api('getListingReview', {listingKey});
    if (!root.isConnected) return;
    const p = result.listing, editable = ['pending', 'approved'].includes(p.status);
    root.innerHTML = priceCss + `<div class="pz-pricing">${onBack ? '<button type="button" data-back>← Ürün onayları ve arama</button>' : ''}<h2>${priceEsc(p.title)}</h2><div class="pr-box"><div class="pr-grid"><div>${/^https:\/\//.test(p.imageUrl) ? `<img class="pr-photo" src="${priceEsc(p.imageUrl)}" alt="${priceEsc(p.title)}">` : ''}<strong>${priceEsc(p.companyName)}</strong><p class="pr-muted">${priceEsc(p.sellerNumber)}</p></div><dl><dt>Ürün / stok kodu</dt><dd>${priceEsc(p.productCode || 'Belirtilmemiş — Diğer')}</dd><dt>OEM / referans</dt><dd>${priceEsc(p.oem || 'Belirtilmemiş')}</dd></dl><dl><dt>Tedarikçi birim fiyatı</dt><dd>${priceMoney(p.priceEur == null ? null : Math.round(p.priceEur * 100))}</dd><dt>Stok / durum</dt><dd>${priceEsc(p.stockQuantity)} adet · ${priceEsc(priceStates[p.status] || p.status)}</dd></dl></div><p>${priceEsc(p.description)}</p><p class="pr-muted">Eklenme: ${priceEsc(p.createdAt ? new Date(p.createdAt).toLocaleString('tr-TR') : '—')}</p></div>
    <section class="pr-box"><h3>Aynı kod hangi tedarikçilerde var?</h3><form data-compare><label>Ürün / stok kodu<input name="productCode" required maxlength="80" value="${priceEsc(p.productCode)}" placeholder="Örneğin 18461"></label><button type="submit">Tedarikçi fiyatlarını karşılaştır</button></form><p class="pr-muted">Kodun tamamı eşleşmelidir; boşluk ve noktalama farkları yok sayılır. Marka ve parça durumunu da karşılaştırın. Fiyatlar yalnızca yönetime gösterilir.</p><div data-offers aria-live="polite"></div></section>
    ${p.pricing ? `<section class="pr-box"><h3>Kaydedilmiş fiyat</h3><p>Tedarikçi: ${priceMoney(p.pricing.supplierMinor)} · Komisyon: ${priceMoney(p.pricing.commissionMinor)}</p><p class="pr-total">Satış: ${priceMoney(p.pricing.saleMinor)}</p><p class="pr-muted">${p.pricing.fx ? fxText(p.pricing.fx) : 'EUR hesabı'} · ${priceEsc(p.pricing.approvedAt || '')}</p></section>` : ''}
    ${editable ? `<section class="pr-box"><h3>${p.status === 'approved' ? 'Komisyonu ve satış fiyatını güncelle' : 'Komisyon ve ürün onayı'}</h3><p>Komisyon, tedarikçi birim fiyatının üzerine eklenir.</p><form data-pricing><div class="pr-grid"><label>Komisyon türü<select name="mode"><option value="percent">Yüzde (%)</option><option value="fixed_eur">Sabit tutar (EUR)</option><option value="fixed_try">Sabit tutar (TL)</option></select></label><label><span data-value-label>Komisyon oranı (%)</span><input name="value" type="text" inputmode="decimal" required placeholder="Örneğin 10" autocomplete="off"></label></div><p class="pr-muted" data-fx>${fxText(result.fx)}</p><button type="submit">Satış fiyatını hesapla</button></form><div data-preview aria-live="polite"></div><p data-status role="status"></p></section>` : '<p>Bu durumdaki ürün için onay işlemi kullanılamaz.</p>'}${p.status === 'pending' ? '<details class="pr-box"><summary>Ürünü reddet</summary><form data-reject><label>Ret gerekçesi<input name="reason" required maxlength="500" placeholder="Tedarikçiye bildirilecek gerekçe"></label><button type="submit">Gerekçeyle reddet</button><p role="status"></p></form></details>' : ''}</div>`;
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
      if (!append) offers.textContent = 'Tedarikçiler aranıyor…';
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
        preview.innerHTML = `<div class="pr-box pr-result"><p>Tedarikçi fiyatı: <strong>${priceMoney(s.supplierMinor)}</strong></p><p>Eklenecek komisyon: <strong>${priceMoney(s.commissionMinor)}</strong>${s.mode === 'fixed_try' ? ` (${priceMoney(Math.round(s.value * 100), 'TRY')})` : s.mode === 'percent' ? ` (%${priceEsc(s.value)})` : ''}</p><p class="pr-total">Satış fiyatı: ${priceMoney(s.saleMinor)}</p>${s.fx ? `<p>TL karşılığı: ${priceMoney(Math.round(s.saleMinor * s.fx.rate), 'TRY')}</p><p class="pr-muted">${fxText(s.fx)}</p>` : ''}<p class="pr-muted">Birim fiyat. EUR tutarı iki ondalığa yuvarlanır. Bu hesap 15 dakika geçerlidir; kaydedilen EUR fiyatı kur değişince kendiliğinden değişmez.</p><button type="button" class="primary" data-confirm>${p.status === 'approved' ? 'Bu fiyatla güncelle' : 'Bu fiyatla onayla ve yayınla'}</button></div>`;
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
export function mountListingWorkbench(root, {api, initialKey = '', onApproved}) {
  if (initialKey) return mountListingReview(root, {api, listingKey:initialKey, onApproved, onBack:() => mountListingWorkbench(root, {api, onApproved})});
  root.innerHTML = priceCss + `<div class="pz-pricing"><p>Ürünleri inceleyin, tedarikçi fiyatlarını karşılaştırın ve komisyon ekleyerek onaylayın.</p><form data-search class="pr-box"><div class="pr-grid"><label>Ürün / stok koduyla ara<input name="productCode" maxlength="80" placeholder="Örneğin 18461"></label><label>Durum<select name="status"><option value="pending">Onay bekleyenler</option><option value="">Tüm durumlar</option><option value="approved">Onaylananlar</option><option value="rejected">Reddedilenler</option></select></label></div><button type="submit">Ara / yenile</button><p class="pr-muted">Kod yazıldığında tüm tedarikçilerin panele eklediği ürünlerde tam kod eşleşmesi aranır. Firma, stok ve fiyat bilgileri yalnızca yönetim içindir.</p></form><div data-results aria-live="polite"></div></div>`;
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
      output.querySelectorAll('[data-review-key]').forEach(b => b.onclick = () => mountListingWorkbench(root, {api, initialKey:b.dataset.reviewKey, onApproved}));
    } catch (e) {if (ticket === version) output.textContent = e.message;}
  }
  form.onsubmit = e => {e.preventDefault(); search();}; search();
}
