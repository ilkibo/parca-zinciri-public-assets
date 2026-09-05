import {
  machineTypes,
  conditions,
  equipmentTypes,
  states,
  validateProduct,
  imageTypes,
  videoTypes,
} from "./contract.js";
import { loadDraft, saveDraft, clearDraft } from "./drafts.js";
import { liveApi, liveUpload } from "./live-api.js";
let liveMode = !['localhost','127.0.0.1'].includes(location.hostname);
let machineCatalog = null;
const app = document.querySelector("#app"),
  nav = document.querySelector("#navigation");
let identity = null,
  testAccounts = [],
  products = [],
  suppliers = [],
  view = "products",
  draft = null,
  busy = false,
  objectUrls = [];
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (value) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "EUR" }).format(
    value,
  );
const draftKey = () => (liveMode?'wix:':'demo:') + identity.memberId + ":" + identity.supplierKey;
function message(text, error = false) {
  const box = document.querySelector("#message");
  box.textContent = text;
  box.classList.toggle("error", error);
}
async function api(route, body, options = {}) {
  if(liveMode && route!=='config')return liveApi(route,body);
  const response = await fetch("/api/" + route, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...options,
  });
  const result = await response.json();
  if (!response.ok) {
    const e = new Error(result.error || "İşlem tamamlanamadı.");
    e.field = result.field;
    e.status = response.status;
    throw e;
  }
  return result;
}
function cleanup() {
  objectUrls.forEach(URL.revokeObjectURL);
  objectUrls = [];
}
function blobUrl(file) {
  const url = URL.createObjectURL(file);
  objectUrls.push(url);
  return url;
}
function network() {
  document.querySelector("#network").textContent = navigator.onLine
    ? "Çevrimiçi"
    : "Çevrimdışı";
}
window.addEventListener("online", network);
window.addEventListener("offline", () => {
  network();
  message(
    "Bağlantı kesildi. Formu cihazınıza taslak olarak kaydedebilirsiniz.",
  );
});
network();
function options(map) {
  return (
    '<option value="">Seçin</option>' +
    Object.entries(map)
      .map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`)
      .join("")
  );
}
function input(name, label, type = "text", extra = "") {
  return `<label class="field">${label}<input name="${name}" type="${type}" required ${extra}></label>`;
}
function select(name, label, map) {
  return `<label class="field">${label}<select name="${name}" required>${options(map)}</select></label>`;
}
function textarea(name, label, required = false) {
  return `<label class="field full">${label}<textarea name="${name}" ${required ? "required" : ""}></textarea></label>`;
}
function showLogin() {
  cleanup();
  identity = null;
  nav.innerHTML = "";
  document.querySelector("#identity").textContent = "";
  if(liveMode){
    app.innerHTML=`<div class="narrow"><p class="eyebrow">Parça Zinciri Mobil</p><h1>Hesabınıza giriş yapın.</h1><p class="sub">Web panelindeki hesabınızla ürünlerinizi fotoğraf, video ve fiyat bilgisiyle gönderin.</p><form id="live-login" class="panel">${select('portal','Giriş türü',{tedarikci:'Tedarikçi',yonetici:'Yönetim'})}${input('email','E-posta','email','autocomplete="username"')}${input('password','Şifre','password','autocomplete="current-password"')}<button class="primary" type="submit">Giriş yap</button><p class="help">Oturum bilgisi yalnızca bellekte tutulur. Sayfayı yeniden açtığınızda tekrar giriş yapmanız gerekir; cihaz taslağınız korunur.</p></form></div>`;
    const form=document.querySelector('#live-login');form.elements.portal.value='tedarikci';
    form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;try{await api('login',Object.fromEntries(new FormData(form)));form.elements.password.value='';message('');await boot();}catch(err){message(err.message,true);}finally{b.disabled=false;}};
    return;
  }
  app.innerHTML = `<div class="narrow"><p class="eyebrow">Parça başında, tek seferde</p><h1>Çekin. Ekleyin.<br>İşinize devam edin.</h1><p class="sub">Ürünün fotoğrafını ve bilgilerini telefondan kaydedin; tedarikçi panelinizde takip edin.</p><section class="panel"><h2>Yerel deneme hesabı seçin</h2><div class="login-options"><button data-login="a"><span><strong>Örnek Tedarikçi A</strong><small>Kendi ürünlerini ekler ve görür</small></span><span class="arrow">↗</span></button><button data-login="b"><span><strong>Örnek Tedarikçi B</strong><small>Ayrı firma, ayrı ürün listesi</small></span><span class="arrow">↗</span></button><button class="admin-login" data-login="admin"><span><strong>Parça Zinciri Yönetim</strong><small>Tedarikçileri görür, ürünleri onaylar</small></span><span class="arrow">↗</span></button></div><p class="help">Bu hesaplar yalnızca işleyişi denemek içindir. Canlı uygulamada mevcut hesabınızla giriş yapacaksınız.</p></section><p class="help">Telefonda yayınlanan sürüm, tarayıcının paylaşım menüsünden ana ekrana eklenebilecek. Bu adres yalnızca bu bilgisayarda çalışır.</p></div>`;
  app.querySelector('.login-options').insertAdjacentHTML('afterbegin',testAccounts.map(a=>`<button data-login="${esc(a.account)}"><span><strong>${esc(a.companyName)}</strong><small>${esc(a.sellerNumber)} · Yeni test tedarikçisi</small></span><span class="arrow">↗</span></button>`).join(''));
  app.querySelectorAll("[data-login]").forEach(
    (btn) =>
      (btn.onclick = async () => {
        try {
          message("");
          await api("login", { account: btn.dataset.login });
          await boot();
        } catch (e) {
          message(e.message, true);
        }
      }),
  );
}
async function boot() {
  try {
    const config = ['localhost','127.0.0.1'].includes(location.hostname)?await api('config'):{mode:'live'};
    liveMode=config.mode==='live';
    document.querySelector('.demo-banner').textContent=liveMode?'PARÇA ZİNCİRİ · Canlı tedarikçi bağlantısı':'YEREL DEMO · Gerçek hesap ve parcazinciri.com bağlantısı yok';
    testAccounts = config.testAccounts || [];
    identity = await api("session");
    if(liveMode && identity.role!=='platform_admin')machineCatalog=await api('catalog');
    document.querySelector("#identity").innerHTML =
      `<span>${esc(identity.companyName || "Parça Zinciri Yönetim")}</span><strong>${esc(identity.sellerNumber || "Yönetim hesabı")}</strong>`;
    products = await api("products");
    if (identity.role === "platform_admin") suppliers = await api("suppliers");
    render("products");
  } catch (e) {
    showLogin();
    if (e.status !== 401)
      message(
        "Bağlantı kurulamadı. Cihazdaki taslaklar korunuyor; yeniden bağlantı kurduğunuzda aynı hesapla açabilirsiniz.",
        true,
      );
  }
}
function navigation() {
  nav.innerHTML = `<button data-view="products" class="${view === "products" ? "active" : ""}">Ürünler</button>${identity.role === "platform_admin" ? `<button data-view="suppliers" class="${view === "suppliers" ? "active" : ""}">Tedarikçiler</button>` : `<button data-view="form" class="${view === "form" ? "active" : ""}">＋ Ürün ekle</button>`}<button id="logout">Çıkış</button>`;
  nav.querySelectorAll("[data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!busy) render(b.dataset.view);
      }),
  );
  document.querySelector("#logout").onclick = async () => {
    if (busy) return;
    try {
      if (view === "form") await persist();
      await api("logout", {});
      draft = null;
      message("");
      showLogin();
    } catch (e) {
      message(e.message, true);
    }
  };
}
async function render(next) {
  if (busy) return;
  if (view === "form" && draft && document.querySelector("#product-form")) {
    try { await persist(); }
    catch { message("Taslak cihazda saklanamadı. Veri kaybetmemeniz için form açık tutuldu; cihaz alanını kontrol edin.", true); return; }
  }
  cleanup();
  view = next;
  navigation();
  if (next === "form") return formView();
  if (next === "suppliers") return suppliersView();
  productsView();
}
function productsView() {
  const filters = Object.fromEntries(
    ["search", "status-filter", "supplier-filter"].map((id) => [id, document.getElementById(id)?.value || ""]),
  );
  const admin = identity.role === "platform_admin";
  app.innerHTML = `<div class="topline"><div><p class="eyebrow">${admin ? "Yönetim paneli" : "Tedarikçi paneli"}</p><h1>${admin ? "Ürünleri yönetin." : "Ürünleriniz."}</h1></div>${!admin ? '<button class="primary" id="new-product">＋ Ürün ekle</button>' : ""}</div><p class="sub">${admin ? "Tedarikçilere göre filtreleyin, ürünleri inceleyip onaylayın." : "Telefondan eklediğiniz ürünleri ve onay durumlarını takip edin."}</p><div class="stats"><div class="stat"><strong>${products.length}</strong><span>Toplam ürün</span></div><div class="stat"><strong>${products.filter((p) => p.status === "pending").length}</strong><span>Onay bekliyor</span></div><div class="stat"><strong>${products.filter((p) => p.status === "approved").length}</strong><span>Onaylandı</span></div></div><div class="toolbar"><input id="search" type="search" aria-label="Ürün ara" placeholder="Ürün adı, kod veya satıcı no…"><select id="status-filter" aria-label="Durum filtresi"><option value="">Tüm durumlar</option><option value="pending">Onay bekliyor</option><option value="approved">Onaylandı</option></select>${admin ? `<select id="supplier-filter" aria-label="Tedarikçi filtresi"><option value="">Tüm tedarikçiler</option>${suppliers.map((s) => `<option value="${esc(s.supplierKey)}">${esc(s.companyName)} · ${esc(s.sellerNumber)}</option>`).join("")}</select>` : ""}<button id="refresh" class="secondary">Yenile</button></div><div id="cards" class="cards"></div>`;
  document
    .querySelector("#new-product")
    ?.addEventListener("click", () => render("form"));
  document.querySelector("#refresh").onclick = refresh;
  for (const id of ["search", "status-filter", "supplier-filter"])
    document.getElementById(id)?.addEventListener("input", cards);
  for (const [id, value] of Object.entries(filters)) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }
  cards();
}
function cards() {
  const q = document.querySelector("#search").value.toLocaleLowerCase("tr");
  const status = document.querySelector("#status-filter").value;
  const supplier = document.querySelector("#supplier-filter")?.value;
  const rows = products.filter(
    (p) =>
      (!status || p.status === status) &&
      (!supplier || p.supplierKey === supplier) &&
      [p.title, p.productCode, p.sellerNumber, p.companyName]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(q),
  );
  const target = document.querySelector("#cards");
  target.innerHTML = rows.length
    ? rows
        .map(
          (p) =>
            `<button class="product-card" data-id="${esc(p.listingKey)}"><img src="${esc(p.media.find((m) => imageTypes.includes(m.mime))?.url)}" alt="${esc(p.title)}"><div><span class="badge ${esc(p.status)}">${esc(states[p.status])}</span><h3>${esc(p.title)}</h3><p>${p.productCodeUnknown ? "Kod belirtilmemiş · Diğer" : esc(p.productCode)} · ${p.stockQuantity} adet</p><p>${money(p.priceEur)} ${identity.role === "platform_admin" ? " · " + esc(p.sellerNumber) : ""}</p></div></button>`,
        )
        .join("")
    : '<div class="empty full"><strong>Henüz gösterilecek ürün yok.</strong><p>Yeni bir ürün ekleyin veya filtreleri değiştirin.</p></div>';
  target
    .querySelectorAll("[data-id]")
    .forEach((b) => (b.onclick = () => detail(b.dataset.id)));
}
async function refresh() {
  if (busy || view === "form") return;
  try {
    const latest = await api("products");
    const changed = JSON.stringify(latest) !== JSON.stringify(products);
    products = latest;
    // Keep focused inputs and open filters stable when data has not changed.
    if (view === "products" && changed) productsView();
  } catch (e) {
    message(e.message, true);
  }
}
function suppliersView() {
  app.innerHTML = `<p class="eyebrow">Yönetim paneli</p><h1>Tedarikçiler.</h1><p class="sub">Her firma, sunucunun atadığı sabit bir satıcı numarasıyla tanımlanır.</p><section class="panel">${suppliers.map((s) => `<div class="supplier"><div><strong>${esc(s.companyName)}</strong><p>${products.filter((p) => p.supplierKey === s.supplierKey).length} ürün</p></div><strong>${esc(s.sellerNumber)}</strong></div>`).join("")}</section>`;
}
async function detail(id) {
  try {
    const p = await api("products/" + id);
    cleanup();
    view = "detail";
    navigation();
    const media = p.media
      .map((m) =>
        m.mime.startsWith("image/")
          ? `<div class="media-item"><img src="${esc(m.url)}" alt="${esc(p.title)}"></div>`
          : `<div class="media-item"><video controls preload="metadata" src="${esc(m.url)}"></video></div>`,
      )
      .join("");
    app.innerHTML = `<button id="back" class="secondary">← Ürünler</button><h1>${esc(p.title)}</h1><span class="badge ${esc(p.status)}">${esc(states[p.status])}</span><div class="media-grid">${media}</div><section class="panel"><dl class="details">${Object.entries(
      {
        "Ürün / stok kodu": p.productCodeUnknown
          ? "Belirtilmemiş — Diğer"
          : p.productCode,
        "Stok adedi": p.stockQuantity,
        "Birim fiyat": money(p.priceEur),
        Tedarikçi: p.companyName,
        "Satıcı no": p.sellerNumber,
        "Marka / model": p.machineBrandName + " " + p.machineModelName,
        "Makine seri no": p.machineSerialNumber,
        "OEM / referans": p.oem || "Belirtilmemiş",
      },
    )
      .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
      .join(
        "",
      )}</dl><p>${esc(p.description)}</p>${p.equipmentWorkDescription ? `<p>${esc(p.equipmentWorkDescription)}</p>` : ""}${p.machineModificationSummary ? `<p>${esc(p.machineModificationSummary)}</p>` : ""}</section>${identity.role === "platform_admin" && p.status === "pending" ? '<button id="approve" class="primary">Ürünü onayla</button><p class="help">'+(liveMode?'Onay verdiğiniz ürün canlı katalogda yayınlanır.':'Yerel demoda onay durumunu değiştirir; canlı katalogda yayın oluşturmaz.')+'</p>' : ""}`;
    document.querySelector("#back").onclick = () => render("products");
    document
      .querySelector("#approve")
      ?.addEventListener("click", async (event) => {
        event.target.disabled = true;
        try {
          await api("products/" + id + "/approve", {});
          products = await api("products");
          message(liveMode?"Ürün onaylandı ve canlı katalog yayın işlemi tamamlandı.":"Ürün yerel demoda onaylandı.");
          await detail(id);
        } catch (e) {
          message(e.message, true);
          event.target.disabled = false;
        }
      });
  } catch (e) {
    message(e.message, true);
  }
}
function freshDraft() {
  return {
    idempotencyKey: crypto.randomUUID(),
    fields: { listingType: "part", stockQuantity: "1" },
    media: [],
  };
}
async function formView() {
  try { draft = (await loadDraft(draftKey())) || freshDraft(); }
  catch {
    message("Cihazdaki taslak okunamadı. Eski taslağın üzerine yazılmadı; tarayıcı depolama izinlerini kontrol edin.", true);
    view = "products"; navigation(); productsView(); return;
  }
  app.innerHTML = `<p class="eyebrow">Parça başında ürün girişi</p><h1>Yeni ürün.</h1><p class="sub">Görselleri ekleyin, bilgileri tamamlayın, onaya gönderin.</p><form id="product-form"><section class="panel"><h2>1. Fotoğraf ve video</h2><div class="media-buttons"><label class="media-button">＋ Fotoğraf çek<input id="camera" type="file" accept="image/*" capture="environment"></label><label class="media-button">Galeri<input id="gallery" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><label class="media-button">＋ Video çek<input id="video" type="file" accept="video/*" capture="environment"></label></div><p class="help">1–6 fotoğraf, isteğe bağlı 1 video. Fotoğraf en fazla 10 MB, video 50 MB. JPEG, PNG, WebP; MP4, MOV veya WebM.</p><div id="media" class="media-grid"></div></section><section class="panel"><h2>2. Ürün bilgileri</h2>${select("listingType", "İlan türü", { part: "Parça", equipment: "Ekipman", machine: "Makine" })}<div data-kind="part" class="fields">${input("partName", "Parça adı", "text", 'maxlength="200" class="full"')}${select("partOriginType", "Parça türü", { original: "Orijinal", aftermarket: "Yan sanayi" })}${select("partCondition", "Parça durumu", conditions)}</div><div data-kind="equipment" class="fields">${select("equipmentType", "Ekipman türü", equipmentTypes)}${select("equipmentCondition", "Ekipman durumu", { new_original: "Sıfır, orijinal", original_reconditioned: "Orijinal, revizyonlu" })}${textarea("equipmentWorkDescription", "Revizyonda yapılan işlemler")}</div><div data-kind="machine" class="fields">${input("modelYear", "Model yılı", "number", `min="1900" max="${new Date().getFullYear()}"`)}${textarea("machineModificationSummary", "Yapılan işlemler / değişiklik özeti", true)}</div>${input("productCode", "Ürün / stok kodu", "text", 'maxlength="80" placeholder="Parçanın mevcut kodu" autocomplete="off"')}<p class="help">Mevcut ürün kodunu girin. Kendiniz yeni kod belirlemeyin.</p><label class="check"><input name="productCodeUnknown" type="checkbox"><span><strong>Diğer</strong> — ürün/stok kodu elimde yok</span></label><div class="fields">${input("stockQuantity", "Stok adedi", "number", 'min="1" step="1" inputmode="numeric"')}${input("priceEur", "Birim fiyat (€)", "text", 'inputmode="decimal" placeholder="0,00"')}</div></section><section class="panel"><h2>3. Makine ve uyumluluk</h2><div class="fields">${select("machineType", "Makine türü", machineTypes)}${input("machineBrandName", "Makine markası")}${input("machineModelName", "Makine modeli")}${input("machineSerialNumber", "Makine seri numarası", "text", 'maxlength="80"')}</div><div data-kind="part">${input("oem", "OEM / referans numarası", "text", 'maxlength="80"')}<label class="check"><input name="oemUnknown" type="checkbox"><span>OEM / referans numarası bilinmiyor</span></label></div>${textarea("description", "Açıklama (isteğe bağlı)")}</section><p class="note">Ürün, hesabınızdaki <strong>${esc(identity.sellerNumber)}</strong> satıcı numarasına kaydedilir. “Diğer” seçimi yeni bir ürün kodu üretmez.</p><p id="draft-state" class="help">${draft.media.length ? "Cihazdaki taslak açıldı." : "Form ve dosyalar bu hesap için cihazda taslak olarak saklanır."}</p><progress id="upload-progress" max="100" value="0" hidden></progress><div class="actions"><button id="save-draft" class="secondary" type="button">Taslağı cihazda sakla</button><button id="submit" class="primary" type="submit">Onaya gönder</button></div></form>`;
  const form = document.querySelector("#product-form");
  if(liveMode && machineCatalog){
    const brand=form.elements.machineBrandName.closest('label'),model=form.elements.machineModelName.closest('label');
    brand.insertAdjacentHTML('beforebegin',select('machineBrandId','Makine markası',{}));
    model.insertAdjacentHTML('beforebegin',select('machineModelId','Makine modeli',{}));
    brand.firstChild.textContent='Diğer marka adı';model.firstChild.textContent='Diğer model adı';
  }
  for (const [k, v] of Object.entries(draft.fields)) {
    const field = form.elements.namedItem(k);
    if (field) {
      if (field.type === "checkbox") field.checked = v === true;
      else field.value = v;
    }
  }
  function conditionsChanged() {
    const kind = form.elements.listingType.value;
    if(liveMode && machineCatalog){
      const type=form.elements.machineType.value;
      const b=form.elements.machineBrandId,m=form.elements.machineModelId;
      const bid=b.value||draft.fields.machineBrandId||'',mid=m.value||draft.fields.machineModelId||'';
      const brands=machineCatalog.brandsByType[type]||[];
      b.innerHTML=options(Object.fromEntries(brands.map(x=>[x.id,x.name])));b.value=brands.some(x=>x.id===bid)?bid:'';
      const models=machineCatalog.modelsByTypeAndBrand[type]?.[b.value]||[{id:machineCatalog.otherModelId,name:'Diğer'}];
      m.innerHTML=options(Object.fromEntries(models.map(x=>[x.id,x.name])));m.value=models.some(x=>x.id===mid)?mid:'';
      for(const [field,manual,selected] of [[form.elements.machineBrandName,b.value===machineCatalog.otherBrandId,brands.find(x=>x.id===b.value)],[form.elements.machineModelName,m.value===machineCatalog.otherModelId,models.find(x=>x.id===m.value)]]){
        field.closest('label').hidden=!manual;field.required=manual;
        if(!manual)field.value=selected?.name||'';
      }
    }
    app.querySelectorAll("[data-kind]").forEach((box) => {
      box.hidden = box.dataset.kind !== kind;
      box
        .querySelectorAll("input,select,textarea")
        .forEach((el) => (el.disabled = box.hidden));
    });
    for (const [flag, name] of [
      ["productCodeUnknown", "productCode"],
      ["oemUnknown", "oem"],
    ]) {
      const check = form.elements[flag],
        field = form.elements[name];
      if (check.checked) field.value = "";
      field.disabled = check.checked || (name === "oem" && kind !== "part");
      field.required = !field.disabled;
    }
    form.elements.equipmentWorkDescription.required =
      kind === "equipment" &&
      form.elements.equipmentCondition.value === "original_reconditioned";
  }
  form.addEventListener("change", () => {
    conditionsChanged();
    persist().catch((e) => message(e.message, true));
  });
  form.addEventListener("input", () => {
    collect();
  });
  conditionsChanged();
  for (const id of ["camera", "gallery", "video"])
    document.getElementById(id).onchange = async (event) => {
      try {
        for (const file of event.target.files) {
          if (![...imageTypes, ...videoTypes].includes(file.type))
            throw new Error(
              "Bu dosya biçimi desteklenmiyor. Fotoğraf için JPEG/PNG/WebP kullanın.",
            );
          const isImage = imageTypes.includes(file.type);
          if (!file.size || file.size > (isImage ? 10 : 50) * 1024 * 1024)
            throw new Error("Dosya boyutu sınırı aşıldı.");
          if (
            draft.media.filter(
              (m) => imageTypes.includes(m.file.type) === isImage,
            ).length >= (isImage ? 6 : 1)
          )
            throw new Error(
              isImage
                ? "En fazla 6 fotoğraf ekleyebilirsiniz."
                : "En fazla bir video ekleyebilirsiniz.",
            );
          draft.media.push({ localId: crypto.randomUUID(), file });
        }
        await persist();
      } catch (e) {
        message(e.message, true);
      } finally {
        event.target.value = "";
        mediaView();
      }
    };
  document.querySelector("#save-draft").onclick = async () => {
    try {
      await persist();
      message("Taslak ve dosyalar bu hesap için cihazda saklandı.");
    } catch (e) {
      message(e.message, true);
    }
  };
  form.onsubmit = submit;
  mediaView();
}
function collect() {
  const form = document.querySelector("#product-form");
  if (!form) return;
  draft.fields = Object.fromEntries(new FormData(form));
  if(liveMode && machineCatalog){
    draft.fields.manualBrandName=form.elements.machineBrandId.value===machineCatalog.otherBrandId?form.elements.machineBrandName.value:'';
    draft.fields.manualModelName=form.elements.machineModelId.value===machineCatalog.otherModelId?form.elements.machineModelName.value:'';
  }
  for (const name of ["productCodeUnknown", "oemUnknown"])
    draft.fields[name] = form.elements[name].checked;
  draft.fields.productCode = draft.fields.productCodeUnknown
    ? ""
    : String(draft.fields.productCode || "").trim();
  draft.fields.oem = draft.fields.oemUnknown
    ? ""
    : String(draft.fields.oem || "").trim();
}
async function persist() {
  if (!draft || !identity) return;
  collect();
  await saveDraft(draftKey(), structuredClone(draft));
  const status = document.querySelector("#draft-state");
  if (status)
    status.textContent =
      "Taslak cihazda saklandı · " +
      new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      });
}
function mediaView() {
  cleanup();
  document.querySelector("#media").innerHTML = draft.media
    .map(
      (m, i) =>
        `<div class="media-item">${imageTypes.includes(m.file.type) ? `<img alt="Ürün fotoğrafı ${i + 1}" src="${blobUrl(m.file)}">` : `<video controls preload="metadata" src="${blobUrl(m.file)}"></video>`}<p>${esc(m.file.name)}</p><button type="button" data-remove="${m.localId}">Kaldır</button></div>`,
    )
    .join("");
  app.querySelectorAll("[data-remove]").forEach(
    (btn) =>
      (btn.onclick = async () => {
        draft.media = draft.media.filter(
          (m) => m.localId !== btn.dataset.remove,
        );
        mediaView();
        await persist().catch((e) => message(e.message, true));
      }),
  );
}
async function submit(event) {
  event.preventDefault();
  if (busy) return;
  collect();
  try {
    validateProduct(
      draft.fields,
      draft.media.map((m) => ({ mime: m.file.type, size: m.file.size })),
    );
    await persist();
  } catch (e) {
    message(e.message, true);
    document
      .querySelector("#product-form")
      .elements.namedItem(e.field)
      ?.focus();
    return;
  }
  if (!navigator.onLine) {
    message(
      "İnternet bağlantısı yok. Taslak cihazda saklandı; bağlantı gelince tekrar gönderin.",
      true,
    );
    return;
  }
  busy = true;
  const form = document.querySelector("#product-form");
  const controls = [...form.querySelectorAll("input,select,textarea,button")];
  const disabled = controls.map((el) => el.disabled);
  controls.forEach((el) => (el.disabled = true));
  const progress = document.querySelector("#upload-progress");
  progress.hidden = false;
  try {
    for (let i = 0; i < draft.media.length; i++) {
      const media = draft.media[i];
      if (!media.remote) {
        if(liveMode){
          media.remote=await liveUpload(media,()=>saveDraft(draftKey(),structuredClone(draft)));
          await saveDraft(draftKey(),structuredClone(draft));
        }else{
        const response = await fetch("/api/media", {
          method: "POST",
          headers: {
            "Content-Type": media.file.type,
            "X-File-Name": encodeURIComponent(media.file.name),
          },
          body: media.file,
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Yükleme tamamlanamadı.");
        media.remote = result;
        await saveDraft(draftKey(), structuredClone(draft));
        }
      }
      progress.value = Math.round(((i + 1) / draft.media.length) * 90);
      message(`Dosyalar yükleniyor: ${i + 1}/${draft.media.length}`);
    }
    const saved = await api("products", {
      ...draft.fields,
      mediaIds: draft.media.map((m) => m.remote.id),
      idempotencyKey: draft.idempotencyKey,
    });
    progress.value = 100;
    // A local storage cleanup failure must not turn a confirmed server save into
    // a false upload failure. Reopening this draft safely retries the same key.
    let cleanupFailed = false;
    await clearDraft(draftKey()).catch(() => { cleanupFailed = true; });
    draft = null;
    busy = false;
    products = products
      .filter((p) => p.listingKey !== saved.listingKey)
      .concat(saved);
    message((liveMode?"Ürün gerçek tedarikçi panelinize kaydedildi ve yönetim onayına gönderildi.":"Ürün yerel demoya kaydedildi ve yönetim onayına gönderildi.") +
      (cleanupFailed ? " Cihazdaki eski taslak temizlenemedi; yeniden gönderilse de aynı ürün kaydı kullanılacak." : ""));
    render("products");
  } catch (e) {
    message(
      "Gönderim tamamlanamadı: " +
        e.message +
        " Taslak korundu; yeniden gönderebilirsiniz.",
      true,
    );
  } finally {
    busy = false;
    controls.forEach((el, i) => (el.disabled = disabled[i]));
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden && view === "form") persist().catch(() => {});
  else if (!document.hidden && identity && view === "products") refresh();
});
setInterval(() => {
  if (identity && view === "products" && !document.hidden && !busy) refresh();
}, 30000);
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("./sw.js").catch(() => {});
await boot();
