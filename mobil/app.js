import {mountListingReview, mountListingWorkbench} from './pricing.js';
import {createScreenHistory} from './navigation.js';
let screenHistory = null;
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
import { liveApi, liveUpload, hasRememberedSession } from "./live-api.js";
import { uploadFile, uploadPercent } from "./upload.js";
import { readVideoDuration } from "./video.js";
import {recordVideo} from './recorder.js';
import {mountNotifications,checkNotifications} from './notifications.js';
let editingKey='', editSeed=null, nextOffset=null, listSearch='', listStatus='', offlineEditor=false;
let listRequest=0;
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
const draftKey = () => (liveMode?'wix:':'demo:') + identity.memberId + ":" + identity.supplierKey + (editingKey?':edit:'+editingKey:'');
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
  screenHistory?.dispose(); screenHistory = null;
  cleanup();
  identity = null;
  nav.innerHTML = "";
  document.querySelector("#identity").textContent = "";
  if(liveMode){
    app.innerHTML=`<div class="narrow"><p class="eyebrow">Parça Zinciri Mobil</p><h1>Hesabınıza giriş yapın.</h1><p class="sub">Web panelindeki hesabınızla ürünlerinizi fotoğraf, video ve fiyat bilgisiyle gönderin.</p><form id="live-login" class="panel">${select('portal','Giriş türü',{tedarikci:'Tedarikçi',yonetici:'Yönetim'})}${input('email','E-posta','email','autocomplete="username"')}${input('password','Şifre','password','autocomplete="current-password"')}<button class="primary" type="submit">Giriş yap</button><p class="help">Girişiniz bu cihazda 90 gün hatırlanır; şifreniz saklanmaz. Ortak cihaz kullanıyorsanız işiniz bitince Çıkış düğmesine basın.</p></form></div>`;
    const form=document.querySelector('#live-login');form.elements.portal.value='tedarikci';
    form.insertAdjacentHTML('beforeend','<button id="forgot-password" class="secondary" type="button">Şifremi unuttum</button>');
    form.querySelector('#forgot-password').onclick=async event=>{const email=form.elements.email;if(!email.reportValidity())return;event.target.disabled=true;try{const result=await api('resetPassword',{email:email.value});message(result.message);}catch(e){message(e.message,true);}finally{event.target.disabled=false;}};
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
    const config = ['localhost','127.0.0.1'].includes(location.hostname)&&navigator.onLine?await api('config').catch(e=>{if(hasRememberedSession())return {mode:'live'};throw e;}):{mode:'live'};
    liveMode=config.mode==='live';
    document.querySelector('.demo-banner').textContent=liveMode?'PARÇA ZİNCİRİ · Canlı tedarikçi bağlantısı':'YEREL DEMO · Gerçek hesap ve parcazinciri.com bağlantısı yok';
    testAccounts = config.testAccounts || [];
    if(!navigator.onLine)throw Object.assign(new Error('Offline'),{status:0});
    identity = await api("session");
    offlineEditor=false;
    if(liveMode && identity.role!=='platform_admin')machineCatalog=await api('catalog');
    document.querySelector("#identity").innerHTML =
      `<span>${esc(identity.companyName || "Parça Zinciri Yönetim")}</span><strong>${esc(identity.sellerNumber || "Yönetim hesabı")}</strong>`;
    try{localStorage.setItem('pz-mobile-offline-context',JSON.stringify({identity,machineCatalog}));}catch{}
    products=[];nextOffset=null;
    if(!liveMode)products=await api('products');
    screenHistory?.dispose();
    screenHistory = createScreenHistory({key:'pz-mobile-screens',initial:{view:'products',listingKey:''},navigate:async route=>{
      if(busy){message('Gönderim sürüyor. Tamamlanınca geri dönebilirsiniz.',true);return false;}
      if(!identity)return false;
      if(route.view==='detail')return detail(route.listingKey);
      return render(route.view, route.listingKey || '');
    }});
    render("products");
    if(liveMode)checkNotifications(api,identity).catch(()=>{});
  } catch (e) {
    if(liveMode && e.status!==401 && hasRememberedSession()){
      {
        try{const cached=JSON.parse(localStorage.getItem('pz-mobile-offline-context')||'null');if(cached?.identity?.supplierKey){identity=cached.identity;machineCatalog=cached.machineCatalog;offlineEditor=true;editingKey='';view='form';navigation();await formView();message('Çevrimdışı taslak düzenleme. Göndermeden önce bağlantı ve hesabınız yeniden doğrulanır.');return;}}catch{}
      }
      cleanup();identity=null;nav.innerHTML='';document.querySelector('#identity').textContent='';
      app.innerHTML='<div class="narrow panel"><h1>Bağlantı bekleniyor.</h1><p>Oturumunuz bu cihazda kayıtlı. İnternet bağlantısı geldiğinde şifre girmeden devam edebilirsiniz.</p><button id="retry-session" class="primary">Tekrar bağlan</button><button id="forget-session" class="secondary">Bu cihazdan çıkış yap</button></div>';
      document.querySelector('#retry-session').onclick=async e=>{e.target.disabled=true;message('');await boot();};
      document.querySelector('#forget-session').onclick=async()=>{await api('logout',{});message('');showLogin();};
      return;
    }
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
  if(liveMode&&!offlineEditor)nav.querySelector('#logout').insertAdjacentHTML('beforebegin','<button data-view="notifications">Bildirimler <span id="notification-count"></span></button>');
  if(offlineEditor){nav.querySelector('[data-view="products"]')?.remove();}
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
      localStorage.removeItem('pz-mobile-offline-context');offlineEditor=false;editingKey='';
      draft = null;
      message("");
      showLogin();
    } catch (e) {
      message(e.message, true);
    }
  };
}
async function render(next, listingKey = '') {
  if (busy) return false;
  if (view === "form" && draft && document.querySelector("#product-form")) {
    try { await persist(); }
    catch { message("Taslak cihazda saklanamadı. Veri kaybetmemeniz için form açık tutuldu; cihaz alanını kontrol edin.", true); return false; }
  }
  cleanup();
  view = next;
  if(next==='form'){editingKey='';editSeed=null;}
  screenHistory?.record({view:next,listingKey});
  navigation();
  if(next==='notifications')return mountNotifications(app,{api,identity,onOpen:key=>detail(key)});
  if (next === "form") return formView();
  if (next === "suppliers") {if(liveMode){const page=await api('supplierPage',{});suppliers=page.items;return suppliersView(page.nextOffset);}suppliers=await api('suppliers');return suppliersView();}
  productsView(listingKey);
  if(liveMode&&identity.role!=='platform_admin')await loadProducts();
}
function productsView(listingKey = '') {
  if (liveMode && identity.role === "platform_admin") {app.innerHTML = '<h1>Ürün onayları ve fiyatlar.</h1><div id="mobile-workbench"></div>'; mountListingWorkbench(app.querySelector("#mobile-workbench"), {api,initialKey:listingKey,onNavigate:key=>screenHistory?.record({view:'products',listingKey:key}),onBack:()=>screenHistory.back(()=>render('products'))}); return;}
  const filters = Object.fromEntries(
    ["search", "status-filter", "supplier-filter"].map((id) => [id, document.getElementById(id)?.value || ""]),
  );
  const admin = identity.role === "platform_admin";
  app.innerHTML = `<div class="topline"><div><p class="eyebrow">${admin ? "Yönetim paneli" : "Tedarikçi paneli"}</p><h1>${admin ? "Ürünleri yönetin." : "Ürünleriniz."}</h1></div>${!admin ? '<button class="primary" id="new-product">＋ Ürün ekle</button>' : ""}</div><p class="sub">${admin ? "Tedarikçilere göre filtreleyin, ürünleri inceleyip onaylayın." : "Telefondan eklediğiniz ürünleri ve onay durumlarını takip edin."}</p><div class="stats"><div class="stat"><strong>${products.length}</strong><span>Toplam ürün</span></div><div class="stat"><strong>${products.filter((p) => p.status === "pending").length}</strong><span>Onay bekliyor</span></div><div class="stat"><strong>${products.filter((p) => p.status === "approved").length}</strong><span>Onaylandı</span></div></div><div class="toolbar"><input id="search" type="search" aria-label="Ürün ara" placeholder="Ürün adı, kod veya satıcı no…"><select id="status-filter" aria-label="Durum filtresi"><option value="">Tüm durumlar</option><option value="pending">Onay bekliyor</option><option value="approved">Onaylandı</option></select>${admin ? `<select id="supplier-filter" aria-label="Tedarikçi filtresi"><option value="">Tüm tedarikçiler</option>${suppliers.map((s) => `<option value="${esc(s.supplierKey)}">${esc(s.companyName)} · ${esc(s.sellerNumber)}</option>`).join("")}</select>` : ""}<button id="refresh" class="secondary">Yenile</button></div><div id="cards" class="cards"></div>`;
  document
    .querySelector("#new-product")
    ?.addEventListener("click", () => render("form"));
  if(liveMode){
    document.querySelector('#status-filter').insertAdjacentHTML('beforeend','<option value="rejected">Düzenleme gerekli</option><option value="draft">Taslak</option><option value="archived">Arşivlendi</option>');
    document.querySelector('#search').placeholder='Ürün adı veya kodu…';
    document.querySelector('#search').value=listSearch;document.querySelector('#status-filter').value=listStatus;
    document.querySelector('.stats .stat span').textContent='Gösterilen ürün';
    document.querySelector('#cards').insertAdjacentHTML('afterend','<button id="load-more" class="secondary" hidden>Daha fazla ürün</button>');
    document.querySelector('#load-more').onclick=()=>loadProducts(true);
  }
  document.querySelector("#refresh").onclick = refresh;
  for (const id of ["search", "status-filter", "supplier-filter"])
    document.getElementById(id)?.addEventListener("input", ()=>{if(liveMode){listSearch=document.querySelector('#search').value;listStatus=document.querySelector('#status-filter').value;clearTimeout(window.pzSearchTimer);window.pzSearchTimer=setTimeout(()=>loadProducts(),300);}else cards();});
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
async function loadProducts(append=false){
  const ticket=++listRequest,button=document.querySelector('#load-more');if(button)button.disabled=true;
  try{
    const page=await api('productPage',{offset:append?(nextOffset||0):0,search:listSearch,status:listStatus});
    if(ticket!==listRequest||view!=='products'||identity?.role==='platform_admin')return;
    products=append?[...products,...page.items.filter(p=>!products.some(old=>old.listingKey===p.listingKey))]:page.items;nextOffset=page.nextOffset;
    cards();const stats=document.querySelectorAll('.stats strong');if(stats.length){stats[0].textContent=products.length;stats[1].textContent=products.filter(p=>p.status==='pending').length;stats[2].textContent=products.filter(p=>p.status==='approved').length;}
    if(button)button.hidden=nextOffset===null;
  }catch(e){if(ticket===listRequest)message(e.message,true);}finally{if(button)button.disabled=false;}
}
async function refresh() {
  if (busy || view === "form") return;
  if(liveMode){checkNotifications(api,identity).catch(()=>{});if(identity.role!=='platform_admin'&&view==='products')await loadProducts();return;}
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
function suppliersView(next=null) {
  app.innerHTML = `<p class="eyebrow">Yönetim paneli</p><h1>Tedarikçiler.</h1><p class="sub">Her firma, sunucunun atadığı sabit bir satıcı numarasıyla tanımlanır.</p><section class="panel">${suppliers.map((s) => `<div class="supplier"><div><strong>${esc(s.companyName)}</strong><p>${liveMode?s.listingCount:products.filter((p) => p.supplierKey === s.supplierKey).length} ürün</p></div><strong>${esc(s.sellerNumber)}</strong></div>`).join("")}</section>${next!==null?'<button id="more-suppliers" class="secondary">Daha fazla tedarikçi</button>':''}`;
  document.querySelector('#more-suppliers')?.addEventListener('click',async e=>{e.target.disabled=true;try{const page=await api('supplierPage',{offset:next});suppliers.push(...page.items);suppliersView(page.nextOffset);}catch(err){message(err.message,true);e.target.disabled=false;}});
}
async function detail(id) {
  if (liveMode && identity.role === "platform_admin") {cleanup();view="detail";navigation();app.innerHTML='<div id="mobile-review"></div>';await mountListingReview(app.querySelector("#mobile-review"), {api,listingKey:id,onBack:()=>render("products")});return;}
  try {
    const p = await api("products/" + id);
    cleanup();
    view = "detail";
    screenHistory?.record({view:'detail',listingKey:id});
    navigation();
    const media = p.media
      .map((m) =>
        !m.url?'<div class="media-item"><p>Bu dosya şu an açılamıyor. Ürünü yeniden açarak tekrar deneyebilirsiniz.</p></div>':m.mime.startsWith("image/")
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
    document.querySelector("#back").onclick = () => screenHistory ? screenHistory.back(()=>render('products')) : render('products');
    if(liveMode&&identity.role!=='platform_admin'){
      if(p.rejectionReason)app.querySelector('.panel').insertAdjacentHTML('afterbegin','<p class="note"><strong>Düzenleme gerekçesi:</strong> '+esc(p.rejectionReason)+'</p>');
      if(['draft','rejected','approved'].includes(p.status)){
        app.insertAdjacentHTML('beforeend','<div class="actions"><button id="edit-product" class="primary">Ürünü / stok ve fiyatı düzenle</button><button id="archive-product" class="secondary">Arşivle</button></div><p class="help">Stok değişikliği kayda yansır. Fiyat, görsel veya ürün bilgisi değişirse ürün yeniden yönetim onayına gider.</p>');
        document.querySelector('#edit-product').onclick=async()=>{
          editingKey=p.listingKey;editSeed={idempotencyKey:crypto.randomUUID(),listingKey:p.listingKey,expectedUpdatedAt:p.updatedAt,originalStatus:p.status,fields:{...p},media:p.media.map(m=>({localId:crypto.randomUUID(),existing:true,remote:{...m,id:m.id||m.fileId},file:{type:m.mime,size:m.size||1,name:m.name||'Kayıtlı dosya'}}))};
          cleanup();view='form';navigation();await formView();
        };
        document.querySelector('#archive-product').onclick=async e=>{if(!confirm('Ürün arşivlensin mi? Katalogda satıştan kaldırılacak.'))return;e.target.disabled=true;try{await api('archiveProduct',{listingKey:p.listingKey,expectedUpdatedAt:p.updatedAt});message('Ürün arşivlendi.');await render('products');}catch(err){message(err.message,true);e.target.disabled=false;}};
      }
    }
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
  try { draft = (await loadDraft(draftKey())) || editSeed || freshDraft(); }
  catch {
    message("Cihazdaki taslak okunamadı. Eski taslağın üzerine yazılmadı; tarayıcı depolama izinlerini kontrol edin.", true);
    view = "products"; navigation(); productsView(); return;
  }
  app.innerHTML = `<p class="eyebrow">Parça başında ürün girişi</p><h1>Yeni ürün.</h1><p class="sub">Görselleri ekleyin, bilgileri tamamlayın, onaya gönderin.</p><form id="product-form"><section class="panel"><h2>1. Fotoğraf ve video</h2><div class="media-buttons"><label class="media-button">＋ Fotoğraf çek<input id="camera" type="file" accept="image/*" capture="environment"></label><label class="media-button">Galeri<input id="gallery" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><label class="media-button">＋ Video çek<input id="video" type="file" accept="video/*" capture="environment"></label></div><p class="help">1–6 fotoğraf, isteğe bağlı 1 video. Video en fazla 10 saniye olmalı; daha uzunu yüklenmez. Fotoğraf en fazla 10 MB, video 50 MB. JPEG, PNG, WebP; MP4, MOV veya WebM.</p><div id="media" class="media-grid"></div></section><section class="panel"><h2>2. Ürün bilgileri</h2>${select("listingType", "İlan türü", { part: "Parça", equipment: "Ekipman", machine: "Makine" })}<div data-kind="part" class="fields">${input("partName", "Parça adı", "text", 'maxlength="200" class="full"')}${select("partOriginType", "Parça türü", { original: "Orijinal", aftermarket: "Yan sanayi" })}${select("partCondition", "Parça durumu", conditions)}</div><div data-kind="equipment" class="fields">${select("equipmentType", "Ekipman türü", equipmentTypes)}${select("equipmentCondition", "Ekipman durumu", { new_original: "Sıfır, orijinal", original_reconditioned: "Orijinal, revizyonlu" })}${textarea("equipmentWorkDescription", "Revizyonda yapılan işlemler")}</div><div data-kind="machine" class="fields">${input("modelYear", "Model yılı", "number", `min="1900" max="${new Date().getFullYear()}"`)}${textarea("machineModificationSummary", "Yapılan işlemler / değişiklik özeti", true)}</div>${input("productCode", "Ürün / stok kodu", "text", 'maxlength="80" placeholder="Mevcut kod veya kendi stok kodunuz" autocomplete="off"')}<p class="help">Parçanın mevcut kodunu veya kendiniz belirlediğiniz stok kodunu girebilirsiniz. Kod girmeyecekseniz Diğer seçeneğini kullanın.</p><label class="check"><input name="productCodeUnknown" type="checkbox"><span><strong>Diğer</strong> — ürün/stok kodu elimde yok</span></label><div class="fields">${input("stockQuantity", "Stok adedi", "number", 'min="1" step="1" inputmode="numeric"')}${input("priceEur", "Birim fiyat (€)", "text", 'inputmode="decimal" placeholder="0,00"')}</div></section><section class="panel"><h2>3. Makine ve uyumluluk</h2><div class="fields">${select("machineType", "Makine türü", machineTypes)}${input("machineBrandName", "Makine markası")}${input("machineModelName", "Makine modeli")}${input("machineSerialNumber", "Makine seri numarası", "text", 'maxlength="80"')}</div><div data-kind="part">${input("oem", "OEM / referans numarası", "text", 'maxlength="80"')}<label class="check"><input name="oemUnknown" type="checkbox"><span>OEM / referans numarası bilinmiyor</span></label></div>${textarea("description", "Açıklama (isteğe bağlı)")}</section><p class="note">Ürün, hesabınızdaki <strong>${esc(identity.sellerNumber)}</strong> satıcı numarasına kaydedilir. “Diğer” seçimi yeni bir ürün kodu üretmez.</p><p id="draft-state" class="help">${draft.media.length ? "Cihazdaki taslak açıldı." : "Form ve dosyalar bu hesap için cihazda taslak olarak saklanır."}</p><section id="upload-status" class="upload-status" hidden aria-label="Ürün gönderim durumu"><div class="upload-heading"><strong id="upload-stage" role="status" aria-live="polite">Gönderim hazırlanıyor</strong><strong id="upload-percent">%0</strong></div><progress id="upload-progress" aria-label="Toplam gönderim ilerlemesi" max="100" value="0"></progress><p id="upload-file"></p><p id="upload-hint"></p></section><div class="actions"><button id="save-draft" class="secondary" type="button">Taslağı cihazda sakla</button><button id="submit" class="primary" type="submit">Onaya gönder</button></div></form>`;
  const form = document.querySelector("#product-form");
  if(editingKey){app.querySelector('h1').textContent='Ürünü düzenle';form.querySelector('#submit').textContent='Değişiklikleri kaydet';if(draft.originalStatus==='approved')form.elements.stockQuantity.min='0';}
  form.querySelector('#video').closest('label').firstChild.textContent='Video seç/çek';
  if(!/; wv\)/.test(navigator.userAgent)){
    form.querySelector('.media-buttons').insertAdjacentHTML('beforeend','<button type="button" id="record-video" class="secondary">10 saniyelik video çek</button>');
    form.querySelector('#record-video').onclick=async e=>{if(draft.media.some(m=>videoTypes.includes(m.file.type))){message('En fazla bir video ekleyebilirsiniz.',true);return;}e.target.disabled=true;try{const file=await recordVideo();if(file){const durationSeconds=await readVideoDuration(file);draft.media.push({localId:crypto.randomUUID(),file,durationSeconds});await persist();mediaView();}}catch(err){message(err.message,true);}finally{e.target.disabled=false;}};
  }
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
          const durationSeconds=isImage?undefined:await readVideoDuration(file);
          draft.media.push({ localId: crypto.randomUUID(), file, durationSeconds });
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
  if (busy) return; // Disabled upload controls must never overwrite the saved fields.
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
        `<div class="media-item">${imageTypes.includes(m.file.type) ? `<img alt="Ürün fotoğrafı ${i + 1}" src="${esc(m.existing?m.remote.url:blobUrl(m.file))}">` : `<video controls preload="metadata" src="${esc(m.existing?m.remote.url:blobUrl(m.file))}"></video>`}<p>${esc(m.file.name)}</p><button type="button" data-remove="${m.localId}">Kaldır</button></div>`,
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
    validateProduct(draft.fields,draft.media.map(m=>({mime:m.file.type,size:m.file.size})),{allowZeroStock:draft.originalStatus==='approved'});
  } catch(e) {
    message(e.message,true);
    document.querySelector("#product-form").elements.namedItem(e.field)?.focus();
    return;
  }
  // Snapshot before locking the form; background saves cannot change this request.
  const submissionFields=structuredClone(draft.fields);
  const submissionKey=draft.idempotencyKey;
  busy=true;
  const form=document.querySelector("#product-form");
  const controls=[...form.querySelectorAll("input,select,textarea,button")];
  const disabled=controls.map(el=>el.disabled);
  controls.forEach(el=>el.disabled=true);
  document.activeElement?.blur();
  const panel=document.querySelector("#upload-status"),progress=document.querySelector("#upload-progress");
  const percent=document.querySelector("#upload-percent"),stage=document.querySelector("#upload-stage");
  const fileLabel=document.querySelector("#upload-file"),hint=document.querySelector("#upload-hint");
  const submitButton=document.querySelector("#submit");
  panel.hidden=false;panel.classList.remove("error");form.setAttribute("aria-busy","true");
  const started=Date.now();let changedAt=started,currentPercent=0,currentPhase="",failed=false,draftSaved=false;
  const labels={preparing:"Gönderim hazırlanıyor",uploading:"Dosya yükleniyor",processing:"Dosya işleniyor",saving:"Ürün kaydediliyor",complete:"Onaya gönderildi"};
  function updateHint(){
    const seconds=Math.floor((Date.now()-started)/1000);
    const waiting=Math.floor((Date.now()-changedAt)/1000);
    const detail=currentPhase==="processing"?"Yükleme alındı; sunucu dosyayı hazırlıyor.":
      currentPhase==="saving"?"Dosyalar hazır; ürün kaydının onayı bekleniyor.":
      waiting>=12?"Henüz yeni ilerleme bilgisi gelmedi. Bağlantı yavaş olabilir; işlem sonucu bekleniyor.":
      "Gönderim tamamlanana kadar uygulamayı açık tutun.";
    hint.textContent=detail+" · "+seconds+" sn";
  }
  function update(value,phase,file=""){
    const next=Math.max(currentPercent,Math.min(100,Math.floor(value)));
    if(next!==currentPercent||phase!==currentPhase)changedAt=Date.now();
    currentPercent=next;currentPhase=phase;
    progress.value=next;percent.textContent="%"+next;stage.textContent=labels[phase];
    fileLabel.textContent=file;submitButton.textContent="Gönderiliyor · %"+next;updateHint();
  }
  update(0,"preparing");
  panel.scrollIntoView({block:"center",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
  const timer=setInterval(updateHint,1000);
  try {
    await persist();draftSaved=true;
    if(!navigator.onLine)throw new Error("İnternet bağlantısı yok. Bağlantı gelince tekrar gönderin.");
    if(offlineEditor){const verified=await api('session');if(verified.memberId!==identity.memberId||verified.supplierKey!==identity.supplierKey)throw new Error('Hesap değişti. Taslak sahibi hesapla yeniden giriş yapın.');identity=verified;offlineEditor=false;}
    // Recheck restored drafts too, before uploading any bytes.
    for(const media of draft.media){
      if(!media.existing && videoTypes.includes(media.file.type)){
        update(0,"preparing","Video süresi kontrol ediliyor · En fazla 10 saniye");
        media.durationSeconds=await readVideoDuration(media.file);
      }
    }
    const total=draft.media.reduce((sum,m)=>sum+m.file.size,0);
    let finished=0;
    for(let i=0;i<draft.media.length;i++){
      const media=draft.media[i],kind=imageTypes.includes(media.file.type)?"Fotoğraf":"Video";
      const label=kind+" · "+(i+1)+"/"+draft.media.length+" · "+media.file.name;
      const report=({phase,loaded=0})=>update(uploadPercent(finished+loaded,total),phase,label);
      if(!media.remote){
        if(liveMode){
          media.remote=await liveUpload(media,()=>saveDraft(draftKey(),structuredClone(draft)),report);
          await saveDraft(draftKey(),structuredClone(draft));
        }else{
          report({phase:"uploading"});
          const result=await uploadFile("/api/media",media.file,{method:"POST",headers:{"Content-Type":media.file.type,"X-File-Name":encodeURIComponent(media.file.name)},onProgress:(loaded,total)=>report({phase:"uploading",loaded:total?loaded/total*media.file.size:0})});
          media.remote=result;
          await saveDraft(draftKey(),structuredClone(draft));
        }
      }
      finished+=media.file.size;
      update(uploadPercent(finished,total),"processing",label);
    }
    update(95,"saving","Fotoğraf ve video yüklemeleri tamamlandı.");
    const saved=await api(editingKey?'updateProduct':"products",{...submissionFields,mediaIds:draft.media.map(m=>m.remote.id),idempotencyKey:submissionKey,...(editingKey?{listingKey:editingKey,expectedUpdatedAt:draft.expectedUpdatedAt}:{})});
    update(100,"complete");
    let cleanupFailed=false;
    await clearDraft(draftKey()).catch(()=>{cleanupFailed=true;});
    draft=null;busy=false;editingKey='';editSeed=null;
    products=products.filter(p=>p.listingKey!==saved.listingKey).concat(saved);
    message("%100 · "+(liveMode?(saved.status==='approved'?"Stok güncellendi.":"Ürün kaydedildi ve yönetim onayına gönderildi."):"Ürün yerel demoda yönetim onayına gönderildi.")+
      (cleanupFailed?" Cihaz taslağı temizlenemedi; aynı taslağın tekrar gönderimi aynı ürün kaydını kullanır.":""));
    render("products");window.scrollTo({top:0,behavior:"instant"});
  } catch(e) {
    failed=true;panel.classList.add("error");
    stage.textContent="Gönderim tamamlanamadı";
    hint.textContent=e.message+(draftSaved?" Taslak korundu. Tekrar gönder düğmesini kullanabilirsiniz.":" Cihaz taslağı kaydedilemedi; form açık tutuldu.");
    message(hint.textContent,true);
  } finally {
    clearInterval(timer);busy=false;
    form.setAttribute("aria-busy","false");
    controls.forEach((el,i)=>el.disabled=disabled[i]);
    submitButton.textContent=failed?"Tekrar gönder":"Onaya gönder";
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
