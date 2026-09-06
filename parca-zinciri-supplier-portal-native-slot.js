/* ============================================================
   PARÇA ZİNCİRİ — parca-zinciri-supplier-portal
   B2B supplier operations portal — FULL VIEWPORT APP (not modal)
   Version: b2b-1-native-slot-3
   ============================================================ */
(function () {
  "use strict";

  if (typeof customElements === "undefined") return;
  if (customElements.get("parca-zinciri-supplier-portal")) return;

  var PORTAL_VERSION = "b2b-1-native-slot-3";
  var THEME_LS_KEY = "pz-portal-theme";

  var FONT_HREF =
    "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,600;125,700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap";

  var MARK =
    '<svg class="pz-mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 84" aria-hidden="true"><g transform="translate(-15,-18)"><path fill="#FF6B00" fill-rule="evenodd" d="M65,18 L77,30 L77,48 L93,48 L105,60 L105,90 L93,102 L55,102 L43,90 L43,72 L27,72 L15,60 L15,30 L27,18ZM69,45 L51,45 L45,51 L45,69 L51,75 L69,75 L75,69 L75,51Z"/></g></svg>';

  var LS = {
    session: "pz_supplier_portal_session",
    quotes: "pz_supplier_portal_quotes",
    inventory: "pz_supplier_portal_inventory",
    notifications: "pz_supplier_portal_notifications",
    orders: "pz_supplier_portal_orders",
    profile: "pz_supplier_portal_profile",
    documents: "pz_supplier_portal_documents",
    settings: "pz_supplier_portal_settings",
    activities: "pz_supplier_portal_activities",
    requests: "pz_supplier_portal_requests",
    applyDraft: "pz_supplier_portal_apply_draft"
  };

  function loadLS(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function saveLS(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }
  function readStoredTheme() {
    try {
      return localStorage.getItem(THEME_LS_KEY) === "dark" ? "dark" : "light";
    } catch (e) {
      return "light";
    }
  }
  function writeStoredTheme(theme) {
    try {
      localStorage.setItem(THEME_LS_KEY, theme === "dark" ? "dark" : "light");
    } catch (e) {}
  }

  var EXACT_MATCH_REASONS = {
    OEM_NORMALIZED_EXACT: "OEM no birebir eşleşme",
    PRODUCT_CODE_NORMALIZED_EXACT: "Parça no birebir eşleşme"
  };
  var MATCH_REASON_LABEL = {
    OEM_NORMALIZED_EXACT: "OEM no birebir eşleşme",
    PRODUCT_CODE_NORMALIZED_EXACT: "Parça no birebir eşleşme",
    TEXT_FALLBACK: "Metin benzerliği",
    MODEL_MATCH: "Model eşleşmesi",
    TITLE_HIGH_SIMILARITY: "İsim benzerliği"
  };
  var QUOTE_STATUS_STAGE = {
    Taslak: "Taslak",
    Gönderildi: "Gönderildi",
    Görüntülendi: "Gönderildi",
    "Revizyon İstendi": "Revizyon",
    "Kabul Edildi": "Kabul Edildi",
    Reddedildi: "Gönderildi",
    "Süresi Doldu": "Gönderildi"
  };
  var QUOTE_PIPELINE_TABS = ["Taslak", "Gönderildi", "Revizyon", "Kabul Edildi"];
  var HOST_ORDER_FLOW = [
    "Sipariş Alındı",
    "Hazırlanıyor",
    "Kargoya Hazır",
    "Kargoya Verildi",
    "Teslim Edildi"
  ];
  var HOST_ORDER_TERMINAL = {
    "Teslim Edildi": true,
    İptal: true,
    "İptal Edildi": true,
    İade: true
  };
  var REQUIRED_HOST_DOC_TYPES = ["tax_plate", "signature_circular", "activity_certificate"];

  function isExactMatchReason(code) {
    return !!EXACT_MATCH_REASONS[String(code || "")];
  }
  function matchReasonLabel(code) {
    var key = String(code || "");
    if (EXACT_MATCH_REASONS[key]) return EXACT_MATCH_REASONS[key];
    if (MATCH_REASON_LABEL[key]) return MATCH_REASON_LABEL[key];
    return "Eşleşme kanıtı yetersiz";
  }
  function quotePipelineStage(status) {
    return QUOTE_STATUS_STAGE[String(status || "")] || "";
  }
  function quoteActionsForStatus(status) {
    var stage = quotePipelineStage(status);
    if (stage === "Taslak") return { view: true, edit: true, send: true, revise: false, copy: true };
    if (stage === "Revizyon") return { view: true, edit: false, send: false, revise: true, copy: true };
    if (stage === "Kabul Edildi") return { view: true, edit: false, send: false, revise: false, copy: false };
    return { view: true, edit: false, send: false, revise: false, copy: true };
  }
  function parseDeadlineMs(value) {
    if (value == null || value === "") return null;
    var raw = String(value).trim();
    if (!raw || raw === "—") return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      var p = raw.split("-");
      return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 23, 59, 59, 999);
    }
    var ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  }
  function remainingTimeLabel(deadline) {
    var deadlineMs = parseDeadlineMs(deadline);
    if (deadlineMs == null) return { ok: false, label: "Talep süresi tanımlı değil" };
    var delta = deadlineMs - Date.now();
    if (delta <= 0) return { ok: false, label: "Süresi doldu" };
    var hours = Math.floor(delta / 3600000);
    if (hours < 24) return { ok: true, label: hours + " saat kaldı" };
    return { ok: true, label: Math.floor(hours / 24) + " gün kaldı" };
  }
  function requestCtaState(req) {
    var status = String((req && req.status) || "");
    var low = status.toLowerCase();
    if (/iptal/.test(low) || low === "cancelled") {
      return { enabled: false, reason: "Bu talep iptal edildiği için teklif gönderilemez." };
    }
    if (/kapalı|closed/.test(low)) {
      return { enabled: false, reason: "Bu talep kapalı olduğu için teklif gönderilemez." };
    }
    var remain = remainingTimeLabel(req && req.deadline);
    if (!remain.ok && remain.label === "Talep süresi tanımlı değil") {
      return { enabled: false, reason: "Talep süresi tanımlı değil" };
    }
    if (!remain.ok) {
      return { enabled: false, reason: "Bu talebin süresi dolduğu için teklif gönderilemez." };
    }
    return { enabled: true, reason: "" };
  }
  function hostDocStatus(label) {
    var s = String(label || "")
      .toLowerCase()
      .replace(/ı/g, "i")
      .replace(/ş/g, "s")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c");
    if (s.indexOf("onay") >= 0) return "approved";
    if (s.indexOf("incelen") >= 0) return "in_review";
    if (s.indexOf("yukle") >= 0 || s.indexOf("yükl") >= 0) return "uploaded";
    if (s.indexOf("guncelle") >= 0 || s.indexOf("güncelle") >= 0) return "update_required";
    return "missing";
  }
  function orderCanAdvance(status) {
    var ix = HOST_ORDER_FLOW.indexOf(String(status || ""));
    return ix >= 0 && ix < HOST_ORDER_FLOW.length - 1 && !HOST_ORDER_TERMINAL[status];
  }
  function seedStockMoves() {
    return [
      { id: "MV-1", at: "2026-08-28", sku: "YF-4412", name: "Yağ filtresi gövdesi", delta: -6, reason: "Sipariş SPR-9014" },
      { id: "MV-2", at: "2026-08-27", sku: "TH-8821", name: "Turbo hortumu", delta: -4, reason: "Sipariş SPR-9021" },
      { id: "MV-3", at: "2026-08-26", sku: "FK-3301", name: "Fren kaliperi", delta: +2, reason: "Sayım girişi" },
      { id: "MV-4", at: "2026-08-25", sku: "AC-5502", name: "Klima kompresörü", delta: -1, reason: "Rezerv" }
    ];
  }
  function uid(prefix) {
    return (prefix || "ID") + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function money(n, cur) {
    var v = Number(n) || 0;
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
  function greeting() {
    var h = new Date().getHours();
    if (h < 12) return "Günaydın";
    if (h < 18) return "İyi günler";
    return "İyi akşamlar";
  }
  function ensureFonts() {
    if (document.getElementById("pz-supplier-fonts")) return;
    var link = document.createElement("link");
    link.id = "pz-supplier-fonts";
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }

  /* -------------------- Seed data -------------------- */
  function seedRequests() {
    return [
      {
        id: "TLP-24081",
        oem: "YFS-4412-A",
        partName: "Yağ filtresi gövdesi",
        vehicle: "Volvo FH",
        year: "2019",
        engine: "D13K",
        qty: 4,
        conditionPref: "Yeni",
        category: "Motor",
        city: "İstanbul",
        urgency: "Acil",
        deadline: "2026-09-12",
        status: "Yeni",
        quoteStatus: "Teklif Bekliyor",
        buyer: "Kurumsal Alıcı #1042",
        createdAt: "2026-07-28",
        notes: "Orijinal veya eşdeğer OEM kabul edilir. Acil bakım planı için bu hafta teslim tercih edilir.",
        warnings: ["Motor seri ile uyumluluk doğrulanmalı", "Conta seti ayrıca talep edilmedi"],
        matchReason: "OEM_NORMALIZED_EXACT",
        matched: true
      },
      {
        id: "TLP-24074",
        oem: "TH-8821",
        partName: "Turbo hortumu",
        vehicle: "Scania R450",
        year: "2020",
        engine: "DC13",
        qty: 2,
        conditionPref: "Yeni / Revizyonlu",
        category: "Turbo",
        city: "Ankara",
        urgency: "Normal",
        deadline: "2026-09-08",
        status: "Eşleşti",
        quoteStatus: "Teklif Bekliyor",
        buyer: "Kurumsal Alıcı #2187",
        createdAt: "2026-07-27",
        notes: "Basınç dayanımı yüksek hortum aranıyor.",
        warnings: [],
        matchReason: "PRODUCT_CODE_NORMALIZED_EXACT",
        matched: true
      },
      {
        id: "TLP-24069",
        oem: "FK-3301-B",
        partName: "Fren kaliperi",
        vehicle: "MAN TGX",
        year: "2018",
        engine: "",
        qty: 1,
        conditionPref: "Çıkma",
        category: "Fren",
        city: "İzmir",
        urgency: "Planlı",
        deadline: "2026-08-15",
        status: "Açık",
        quoteStatus: "Teklif Yok",
        buyer: "Bölgesel Servis Ağı #031",
        createdAt: "2026-07-26",
        notes: "Sol ön kaliper. Montaj kiti dahil olabilir.",
        warnings: ["Pin aşınması kontrol edilmeli"],
        matchReason: "TEXT_FALLBACK",
        matched: false
      },
      {
        id: "TLP-24061",
        oem: "HCM- typ 09",
        partName: "Far kontrol modülü",
        vehicle: "Mercedes Actros",
        year: "2021",
        engine: "OM471",
        qty: 1,
        conditionPref: "Yeni",
        category: "Elektrik",
        city: "Bursa",
        urgency: "Acil",
        deadline: "",
        status: "Yeni",
        quoteStatus: "Teklif Bekliyor",
        buyer: "Kurumsal Alıcı #1042",
        createdAt: "2026-07-29",
        notes: "Kodlama gerekebilir. Garanti süresi belirtiniz.",
        warnings: ["Elektronik uyumluluk kritik"],
        matchReason: "MODEL_MATCH",
        matched: true
      },
      {
        id: "TLP-24055",
        oem: "MK-7710",
        partName: "Motor kulağı",
        vehicle: "Ford Cargo",
        year: "2017",
        engine: "Ecotorq",
        qty: 2,
        conditionPref: "Yeni",
        category: "Motor",
        city: "Konya",
        urgency: "Normal",
        deadline: "2026-09-18",
        status: "Kapalı",
        quoteStatus: "Teklif Yok",
        buyer: "Kurumsal Alıcı #2187",
        createdAt: "2026-07-25",
        notes: "Sağ ve sol takım.",
        warnings: [],
        matchReason: "OEM_NORMALIZED_EXACT",
        matched: true
      },
      {
        id: "TLP-24048",
        oem: "AC-5502",
        partName: "Klima kompresörü",
        vehicle: "Iveco Stralis",
        year: "2016",
        engine: "Cursor 10",
        qty: 1,
        conditionPref: "Revizyonlu",
        category: "Klima",
        city: "Antalya",
        urgency: "Planlı",
        deadline: "2026-09-20",
        status: "İptal",
        quoteStatus: "Teklif Yok",
        buyer: "Bölgesel Servis Ağı #031",
        createdAt: "2026-07-24",
        notes: "Debriyajlı tip tercih edilir.",
        warnings: [],
        matchReason: "TITLE_HIGH_SIMILARITY",
        matched: false
      }
    ];
  }

  function seedQuotes() {
    return [
      {
        id: "TKL-1190",
        requestId: "TLP-24081",
        oem: "YFS-4412-A",
        partName: "Yağ filtresi gövdesi",
        qty: 4,
        stockQty: 14,
        unitPrice: 2450,
        currency: "TRY",
        shipping: 180,
        condition: "Yeni",
        brand: "FleetSeal",
        leadTime: "1-2 gün",
        validity: "7 gün",
        warranty: "12 ay",
        notes: "OEM no birebir eşleşen stok.",
        status: "Taslak",
        lastActivity: "Taslak kaydedildi",
        updatedAt: "2026-08-29"
      },
      {
        id: "TKL-1182",
        requestId: "TLP-24048",
        oem: "AC-5502",
        partName: "Klima kompresörü",
        qty: 1,
        stockQty: 2,
        unitPrice: 18500,
        currency: "TRY",
        shipping: 450,
        condition: "Revizyonlu",
        brand: "Aftermarket Premium",
        leadTime: "3-5 gün",
        validity: "7 gün",
        warranty: "6 ay",
        notes: "Revizyonlu, test edilmiş ünite.",
        status: "Görüntülendi",
        lastActivity: "Alıcı görüntüledi",
        updatedAt: "2026-07-28"
      },
      {
        id: "TKL-1175",
        requestId: "TLP-24055",
        oem: "MK-7710",
        partName: "Motor kulağı",
        qty: 2,
        stockQty: 6,
        unitPrice: 3200,
        currency: "TRY",
        shipping: 280,
        condition: "Yeni",
        brand: "OEM Eşdeğer",
        leadTime: "2 gün",
        validity: "5 gün",
        warranty: "12 ay",
        notes: "",
        status: "Gönderildi",
        lastActivity: "Teklif iletildi",
        updatedAt: "2026-07-27"
      },
      {
        id: "TKL-1160",
        requestId: "TLP-24069",
        oem: "FK-3301-B",
        partName: "Fren kaliperi",
        qty: 1,
        stockQty: 1,
        unitPrice: 9800,
        currency: "TRY",
        shipping: 350,
        condition: "Çıkma",
        brand: "Çıkma Stok",
        leadTime: "1 gün",
        validity: "3 gün",
        warranty: "30 gün",
        notes: "Görsel onay sonrası sevkiyat.",
        status: "Revizyon İstendi",
        lastActivity: "Fiyat revizyonu istendi",
        updatedAt: "2026-07-26"
      },
      {
        id: "TKL-1140",
        requestId: "TLP-24074",
        oem: "TH-8821",
        partName: "Turbo hortumu",
        qty: 4,
        stockQty: 8,
        unitPrice: 1650,
        currency: "TRY",
        shipping: 220,
        condition: "Yeni",
        brand: "AirPath",
        leadTime: "2 gün",
        validity: "5 gün",
        warranty: "12 ay",
        notes: "",
        status: "Kabul Edildi",
        lastActivity: "Alıcı kabul etti",
        updatedAt: "2026-08-20"
      }
    ];
  }

  function seedInventory() {
    return [
      {
        id: "STK-01",
        partName: "Yağ filtresi gövdesi",
        partCode: "YF-4412",
        oem: "YFS-4412-A",
        manufacturer: "FleetSeal",
        vehicles: "Volvo FH / FM",
        category: "Motor",
        quantity: 14,
        condition: "Yeni",
        unitPrice: 2450,
        currency: "TRY",
        city: "İstanbul",
        leadTime: "1-2 gün",
        active: true,
        updatedAt: "2026-07-28"
      },
      {
        id: "STK-02",
        partName: "Turbo hortumu",
        partCode: "TH-8821",
        oem: "TH-8821",
        manufacturer: "AirPath",
        vehicles: "Scania R / S",
        category: "Turbo",
        quantity: 8,
        condition: "Yeni",
        unitPrice: 1650,
        currency: "TRY",
        city: "İstanbul",
        leadTime: "2 gün",
        active: true,
        updatedAt: "2026-07-27"
      },
      {
        id: "STK-03",
        partName: "Fren kaliperi",
        partCode: "FK-3301",
        oem: "FK-3301-B",
        manufacturer: "BrakeLine",
        vehicles: "MAN TGX",
        category: "Fren",
        quantity: 3,
        condition: "Çıkma",
        unitPrice: 9200,
        currency: "TRY",
        city: "Bursa",
        leadTime: "1 gün",
        active: true,
        updatedAt: "2026-07-26"
      },
      {
        id: "STK-04",
        partName: "Far kontrol modülü",
        partCode: "HCM-09",
        oem: "HCM- typ 09",
        manufacturer: "OptiModule",
        vehicles: "Mercedes Actros",
        category: "Elektrik",
        quantity: 2,
        condition: "Yeni",
        unitPrice: 14200,
        currency: "TRY",
        city: "İstanbul",
        leadTime: "3 gün",
        active: true,
        updatedAt: "2026-07-29"
      },
      {
        id: "STK-05",
        partName: "Motor kulağı",
        partCode: "MK-7710",
        oem: "MK-7710",
        manufacturer: "MountPro",
        vehicles: "Ford Cargo",
        category: "Motor",
        quantity: 11,
        condition: "Yeni",
        unitPrice: 3100,
        currency: "TRY",
        city: "Ankara",
        leadTime: "2 gün",
        active: true,
        updatedAt: "2026-07-25"
      },
      {
        id: "STK-06",
        partName: "Klima kompresörü",
        partCode: "AC-5502",
        oem: "AC-5502",
        manufacturer: "CoolDrive",
        vehicles: "Iveco Stralis",
        category: "Klima",
        quantity: 1,
        condition: "Revizyonlu",
        unitPrice: 17800,
        currency: "TRY",
        city: "İzmir",
        leadTime: "4 gün",
        active: false,
        updatedAt: "2026-07-24"
      }
    ];
  }

  function seedOrders() {
    return [
      {
        id: "SPR-9021",
        quoteId: "TKL-1140",
        partName: "Turbo hortumu",
        qty: 4,
        total: 7200,
        currency: "TRY",
        city: "İstanbul",
        status: "Hazırlanıyor",
        cargo: ""
      },
      {
        id: "SPR-9014",
        quoteId: "TKL-1132",
        partName: "Yağ filtresi gövdesi",
        qty: 6,
        total: 15600,
        currency: "TRY",
        city: "Ankara",
        status: "Kargoya Verildi",
        cargo: "YK 7845123690"
      },
      {
        id: "SPR-9008",
        quoteId: "TKL-1121",
        partName: "Motor kulağı",
        qty: 2,
        total: 6680,
        currency: "TRY",
        city: "Bursa",
        status: "Teslim Edildi",
        cargo: "AR 991200334"
      },
      {
        id: "SPR-9002",
        quoteId: "TKL-1110",
        partName: "Fren kaliperi",
        qty: 1,
        total: 10150,
        currency: "TRY",
        city: "İzmir",
        status: "Sipariş Alındı",
        cargo: ""
      }
    ];
  }

  function seedNotifications() {
    return [
      {
        id: "N1",
        type: "talep",
        title: "Yeni eşleşen talep",
        body: "TLP-24081 — Yağ filtresi gövdesi uzmanlık alanınızla eşleşti.",
        time: "Bugün 09:14",
        read: false
      },
      {
        id: "N2",
        type: "teklif",
        title: "Teklif görüntülendi",
        body: "TKL-1182 alıcı tarafından incelendi.",
        time: "Dün 16:40",
        read: false
      },
      {
        id: "N3",
        type: "revizyon",
        title: "Revizyon istendi",
        body: "TKL-1160 için fiyat revizyonu talep edildi.",
        time: "Dün 11:05",
        read: true
      },
      {
        id: "N4",
        type: "kabul",
        title: "Teklif kabul edildi",
        body: "Önceki dönem teklifiniz siparişe dönüştü.",
        time: "2 gün önce",
        read: true
      },
      {
        id: "N5",
        type: "belge",
        title: "Belge süresi yaklaşıyor",
        body: "Faaliyet belgesi güncelleme penceresi 18 gün içinde.",
        time: "3 gün önce",
        read: true
      },
      {
        id: "N6",
        type: "stok",
        title: "Stok kritik seviyede",
        body: "Klima kompresörü stok adedi 1.",
        time: "4 gün önce",
        read: false
      }
    ];
  }

  function seedActivities() {
    return [
      { id: "A1", text: "Teklif görüntülendi — TKL-1182", time: "Dün 16:40" },
      { id: "A2", text: "Yeni talep eşleşti — TLP-24081", time: "Bugün 09:14" },
      { id: "A3", text: "Teklif revizyonu istendi — TKL-1160", time: "Dün 11:05" },
      { id: "A4", text: "Belge doğrulama durumu güncellendi", time: "3 gün önce" }
    ];
  }

  function seedProfile() {
    return {
      companyName: "Marmara Endüstriyel Yan Sanayi",
      description:
        "Ağır vasıta ve iş makinesi yedek parça tedarikinde uzmanlaşmış bölgesel dağıtıcı. Motor, fren ve elektrik kategorilerinde hızlı teklif kapasitesi.",
      contactName: "Selim Karaca",
      phone: "0212 555 0142",
      email: "operasyon@marmara-yan.sanayi.example",
      website: "https://marmara-yan.example",
      address: "İkitelli OSB, Başakşehir / İstanbul",
      regions: ["Marmara", "İç Anadolu", "Ege"],
      categories: ["Motor", "Fren", "Turbo", "Elektrik"],
      brands: ["Volvo", "Scania", "MAN", "Mercedes", "Ford Cargo"],
      delivery: "Ambar + Kargo + Depodan teslim",
      warranty: "Yeni parçalarda 12 ay, çıkmada 30 gün",
      returns: "Kusurlu ürünlerde 7 gün içinde iade değerlendirmesi"
    };
  }

  function seedDocuments() {
    return [
      { id: "D1", type: "tax_plate", name: "Vergi levhası", status: "Onaylandı", updatedAt: "2026-06-12" },
      { id: "D2", type: "signature_circular", name: "İmza sirküleri", status: "İnceleniyor", updatedAt: "2026-07-20" },
      { id: "D3", type: "activity_certificate", name: "Faaliyet belgesi", status: "Yüklendi", updatedAt: "2026-07-18" },
      { id: "D4", type: "brand_authorization", name: "Marka yetki belgesi", status: "Eksik", updatedAt: "—" },
      { id: "D5", type: "quality_certs", name: "Kalite belgeleri", status: "Güncelleme Gerekli", updatedAt: "2026-05-02" }
    ];
  }

  function seedSettings() {
    return {
      currency: "TRY",
      leadDefault: "2-4 gün",
      validityDefault: "7 gün",
      emailNotif: true,
      waNotif: true,
      quoteNotif: true,
      stockNotif: true
    };
  }

  /* -------------------- CSS -------------------- */
  var CSS_TEXT = `
:host {
  display:block !important;
  position:relative;
  width:100% !important;
  min-height:100vh !important;
  min-height:100dvh !important;
  height:100vh !important;
  height:100dvh !important;
  max-width:none !important;
  margin:0 !important;
  padding:0 !important;
  border:0 !important;
  border-radius:0 !important;
  box-shadow:none !important;
  background:var(--void);
  color:var(--text);
  font-family:var(--body);
  font-size:15px;
  line-height:1.45;
  -webkit-font-smoothing:antialiased;
  box-sizing:border-box;
  overflow:hidden;
}
*,*::before,*::after{box-sizing:border-box}
:host,.root{
  --void:#F3F0EB; --plate:#FFFFFF; --raise:#FFFFFF; --elev:#EFEBE4;
  --line:#E4DED4; --line-2:#D3CBBE; --line-3:#B7AFA2;
  --text:#1A1A1A; --mid:#5E5953; --dim:#6F6A64;
  --accent:#FF6B00; --accent-soft:rgba(255,107,0,.12); --accent-line:rgba(255,107,0,.42);
  --ok:#1F8A5A; --warn:#B58100; --danger:#C43838; --info:#2B6CB0;
  --input:#FFFFFF; --sidebar:#F7F4EF; --topbar:rgba(255,255,255,.94); --inset:#F7F4EF;
  --hover:rgba(26,26,26,.06); --overlay:rgba(26,26,26,.45); --toast:#FFFFFF;
  --shadow:0 12px 40px rgba(26,26,26,.14); --on-accent:#111; --grid:rgba(26,26,26,.06);
  --accent-wash:rgba(255,107,0,.07);
  --chip-urgent:#9A3B00; --chip-ok:#0F6B45; --chip-warn:#8A5A00; --chip-danger:#B42318; --chip-info:#185FA5;
  --display:"Archivo","Arial Narrow",system-ui,sans-serif;
  --body:"IBM Plex Sans",system-ui,sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,monospace;
  --side:248px; --top:64px; --ease:cubic-bezier(.2,.7,.2,1);
  --radius:10px;
  background:var(--void);color:var(--text);
}
:host([data-theme="dark"]),:host([data-theme="dark"]) .root{
  --void:#0F0F0F; --plate:#1A1A1A; --raise:#202020; --elev:#262626;
  --line:#242424; --line-2:#363636; --line-3:#4A4A4A;
  --text:#F2F2F2; --mid:#A8A8A8; --dim:#8A8A8A;
  --ok:#3DDC97; --warn:#F5C542; --danger:#FF5C5C; --info:#5BA4FF;
  --input:#141414; --sidebar:#141414; --topbar:rgba(15,15,15,.96); --inset:#151515;
  --hover:rgba(255,255,255,.04); --overlay:rgba(0,0,0,.62); --toast:#1B1B1B;
  --shadow:0 12px 40px rgba(0,0,0,.45); --grid:rgba(255,255,255,.03);
  --accent-wash:rgba(255,107,0,.03);
  --chip-urgent:#FFB088; --chip-ok:#9AF0C8; --chip-warn:#FFE08A; --chip-danger:#FF9B9B; --chip-info:#A9D0FF;
}
.login{
  --void:#0F0F0F; --plate:#1A1A1A; --raise:#202020; --elev:#262626;
  --line:#242424; --line-2:#363636; --line-3:#4A4A4A;
  --text:#F2F2F2; --mid:#A8A8A8; --dim:#8A8A8A;
  --input:#141414; --sidebar:#141414; --topbar:rgba(15,15,15,.96); --inset:#151515;
  --hover:rgba(255,255,255,.04); --overlay:rgba(0,0,0,.62); --toast:#1B1B1B;
  --grid:rgba(255,255,255,.03); --accent-wash:rgba(255,107,0,.03);
}
/* Full-viewport application shell — escapes Wix widget height/centering */
.root{
  position:fixed;
  inset:0;
  width:100vw;
  width:100dvw;
  height:100vh;
  height:100dvh;
  margin:0;
  padding:0;
  border:0;
  border-radius:0;
  max-width:none;
  background:var(--void);
  color:var(--text);
  font-family:var(--body);
  overflow:hidden;
  z-index:2147483000;
  display:flex;
  flex-direction:column;
}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer}
a{color:inherit;text-decoration:none}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}

.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
.display{font-family:var(--display);font-variation-settings:"wdth" 125,"wght" 700;font-weight:700;text-transform:uppercase;letter-spacing:-.01em;line-height:1}
.h1{font-size:clamp(28px,3vw,40px)}.h2{font-size:22px}.h3{font-size:17px;font-weight:600}
.muted{color:var(--mid)}.dim{color:var(--dim)}
.brand-lock{display:flex;align-items:center;gap:12px}
.brand-lock .pz-mark{width:28px;height:26px;flex:none}
.brand-lock .name{font-family:var(--display);font-variation-settings:"wdth" 125,"wght" 700;font-size:15px;letter-spacing:.04em}

.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:44px;padding:0 16px;border-radius:8px;border:1px solid var(--line-2);
  background:var(--raise);color:var(--text);font-weight:500;transition:border-color .2s var(--ease),background .2s var(--ease),transform .15s var(--ease);
}
.btn:hover{border-color:var(--line-3);background:var(--elev)}
.btn:active{transform:translateY(1px)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--on-accent);font-weight:600}
.btn.primary:hover{filter:brightness(1.05)}
.btn.ghost{background:transparent}
.btn.link{background:transparent;border:0;color:var(--accent);min-height:auto;padding:0;font-size:13px}
.btn.sm{min-height:36px;padding:0 12px;font-size:13px}
.btn.block{width:100%}
.btn:disabled{opacity:.55;cursor:not-allowed}

.field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
.field label{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.field input,.field select,.field textarea{
  width:100%;min-height:44px;padding:10px 12px;border-radius:8px;
  border:1px solid var(--line-2);background:var(--input);color:var(--text);
}
.field textarea{min-height:96px;resize:vertical}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--accent-line);outline:none}
.field input:disabled,.field select:disabled,.field textarea:disabled{opacity:.55;cursor:not-allowed}
.field.err input,.field.err select,.field.err textarea{border-color:var(--danger)}
.ferr{display:none;color:var(--danger);font-size:12px}
.field.err .ferr{display:block}
.pass-wrap{position:relative}
.pass-wrap input{padding-right:48px}
.pass-toggle{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:var(--mid);min-height:36px;padding:0 8px;font-size:12px;font-family:var(--mono)}

.chip{
  display:inline-flex;align-items:center;gap:6px;min-height:24px;padding:0 8px;border-radius:999px;
  border:1px solid var(--line-2);font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--mid);background:var(--hover)
}
.chip::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.chip.urgent,.chip.acil{color:var(--chip-urgent);border-color:rgba(255,107,0,.35)}
.chip.ok,.chip.onaylandi,.chip.kabul,.chip.teslim{color:var(--chip-ok);border-color:rgba(61,220,151,.35)}
.chip.warn,.chip.inceleniyor,.chip.revizyon,.chip.hazirlaniyor{color:var(--chip-warn);border-color:rgba(245,197,66,.35)}
.chip.danger,.chip.eksik,.chip.red,.chip.sorun{color:var(--chip-danger);border-color:rgba(255,92,92,.35)}
.chip.info,.chip.gonderildi,.chip.yeni{color:var(--chip-info);border-color:rgba(91,164,255,.35)}

/* LOGIN — full viewport split, never a centered modal */
.login{
  flex:1; min-height:0; height:100%; width:100%;
  display:grid; grid-template-columns:1.05fr .95fr; background:var(--void)
}
.login-visual{
  position:relative;overflow:hidden;padding:48px clamp(28px,4vw,56px);
  background:
    radial-gradient(ellipse 70% 55% at 20% 30%, rgba(255,107,0,.16), transparent 60%),
    radial-gradient(ellipse 50% 40% at 80% 80%, rgba(255,107,0,.08), transparent 55%),
    linear-gradient(160deg,#121212 0%,#0F0F0F 50%,#171717 100%);
  border-right:1px solid var(--line);
  display:flex;flex-direction:column;justify-content:space-between;
}
.login-visual::before{
  content:"";position:absolute;inset:0;opacity:.35;pointer-events:none;
  background-image:
    linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
  background-size:48px 48px;
}
.login-copy{position:relative;z-index:1;max-width:460px}
.login-copy h1{margin:20px 0 14px;font-size:clamp(32px,3.4vw,46px)}
.login-copy p{color:var(--mid);font-size:15px;max-width:38ch}
.mech{
  position:relative;z-index:1;height:280px;margin-top:40px;
  display:grid;place-items:center;
}
.gear{
  width:180px;height:180px;border:2px solid rgba(255,107,0,.45);border-radius:50%;
  position:relative;animation:spin 18s linear infinite;
  box-shadow:0 0 0 18px rgba(255,107,0,.05), inset 0 0 40px rgba(255,107,0,.08);
}
.gear::before,.gear::after{
  content:"";position:absolute;inset:18px;border:1px dashed rgba(255,255,255,.18);border-radius:50%
}
.gear span{
  position:absolute;width:28px;height:28px;background:var(--accent);border-radius:4px;
  top:50%;left:50%;transform:translate(-50%,-50%) rotate(var(--r)) translateY(-86px);
}
.orbit{
  position:absolute;width:240px;height:240px;border:1px solid rgba(255,255,255,.08);border-radius:50%;
  animation:spin 28s linear infinite reverse;
}
.part-block{
  position:absolute;width:64px;height:40px;border:1px solid var(--accent-line);background:rgba(255,107,0,.08);
  transform:rotate(-18deg);animation:floaty 4.5s ease-in-out infinite;
}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes floaty{0%,100%{transform:translateY(0) rotate(-18deg)}50%{transform:translateY(-10px) rotate(-12deg)}}
.login-panel{
  display:flex;align-items:center;justify-content:center;padding:40px 28px;background:var(--plate)
}
.login-card{width:100%;max-width:480px}
.login-card h2{font-family:var(--display);font-variation-settings:"wdth" 125,"wght" 700;font-size:26px;margin:0 0 10px}
.login-card .lead{color:var(--mid);margin-bottom:22px;font-size:14px}
.login-error{
  margin:0 0 16px;padding:12px 14px;border-radius:8px;border:1px solid rgba(255,92,92,.35);
  background:rgba(255,92,92,.08);color:#FFB4A0;font-size:13px;line-height:1.45
}
.login-form{display:flex;flex-direction:column;gap:14px}
.login-form .field label{display:block;margin-bottom:6px}
.login-form .field input{width:100%}
.row-between{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0 4px;font-size:13px;color:var(--mid)}
.row-between label{display:flex;align-items:center;gap:8px;cursor:pointer}
.check{width:16px;height:16px;accent-color:var(--accent)}
.login-extra{margin-top:18px;text-align:center;font-size:13px;color:var(--mid)}
.login-extra .sep{margin:0 6px;color:var(--dim)}
.native-form-slot{min-height:380px;width:100%;pointer-events:none}
.spin-inline{width:16px;height:16px;border:2px solid rgba(0,0,0,.2);border-top-color:#111;border-radius:50%;animation:spin .7s linear infinite;display:inline-block;vertical-align:middle;margin-right:8px}
@media (max-width:640px){.login-card{max-width:none}}

/* APPLY — full-screen flow (not a popup over homepage) */
.apply-screen{
  flex:1; min-height:0; height:100%; width:100%; overflow:auto;
  background:var(--void); padding:28px clamp(16px,4vw,48px);
}
.apply-panel{
  width:min(880px,100%); margin:0 auto; background:var(--plate);
  border:1px solid var(--line-2); border-radius:14px; padding:28px; position:relative
}
.apply-overlay,.modal-shell-blocker{display:none!important}
.modal-overlay,.drawer-scrim{
  position:absolute; inset:0; background:var(--overlay); z-index:80;
  display:flex; align-items:center; justify-content:center; padding:20px
}
.apply-steps{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 24px}
.apply-steps span{
  font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;
  padding:6px 10px;border-radius:999px;border:1px solid var(--line-2);color:var(--dim)
}
.apply-steps span.on{border-color:var(--accent-line);color:var(--accent);background:var(--accent-soft)}
.apply-steps span.done{color:var(--ok);border-color:rgba(61,220,151,.3)}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}
.checks{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.checks label,.radio-row label{display:flex;align-items:center;gap:8px;min-height:40px;font-size:13px;color:var(--mid)}
.upload-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.upload-zone{
  border:1px dashed var(--line-2);border-radius:10px;padding:18px;min-height:110px;
  background:var(--inset);display:flex;flex-direction:column;gap:6px;justify-content:center;cursor:pointer
}
.upload-zone strong{font-size:13px}.upload-zone small{color:var(--dim);font-size:12px}
.upload-zone.has{border-style:solid;border-color:rgba(61,220,151,.35)}
.apply-actions{display:flex;justify-content:space-between;gap:12px;margin-top:22px;flex-wrap:wrap}
.success-box{text-align:center;padding:40px 12px}
.success-box .mark{width:56px;height:56px;margin:0 auto 16px;border-radius:50%;background:var(--accent-soft);border:1px solid var(--accent-line);display:grid;place-items:center;color:var(--accent);font-size:24px}
.modal-panel{
  width:min(760px,100%);max-height:min(92vh,900px);overflow:auto;background:var(--plate);
  border:1px solid var(--line-2);border-radius:14px;padding:28px;position:relative
}

/* APP SHELL */
.app{
  flex:1; min-height:0; height:100%; width:100%;
  display:grid; grid-template-columns:var(--side) 1fr; grid-template-rows:var(--top) 1fr;
}
.sidebar{
  grid-row:1 / span 2;background:var(--sidebar);border-right:1px solid var(--line);
  display:flex;flex-direction:column;padding:16px 12px;overflow:auto
}
.side-brand{display:flex;align-items:center;gap:10px;padding:8px 10px 18px}
.side-brand .sub{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin-top:2px}
.nav{display:flex;flex-direction:column;gap:4px;flex:1}
.nav button{
  display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:0 12px;border-radius:8px;
  border:0;background:transparent;color:var(--mid);text-align:left;font-size:13.5px
}
.nav button:hover{background:var(--hover);color:var(--text)}
.nav button:disabled{opacity:.55;cursor:not-allowed}
.nav button.active{background:var(--accent-soft);color:var(--text);font-weight:600;box-shadow:inset 3px 0 0 var(--accent)}
.nav .ico{width:18px;opacity:.85;font-family:var(--mono);font-size:11px;color:inherit}
.nav-foot{border-top:1px solid var(--line);padding-top:10px;margin-top:10px}
.topbar{
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  padding:0 20px;border-bottom:1px solid var(--line);background:var(--topbar);backdrop-filter:blur(8px)
}
.top-left{display:flex;align-items:center;gap:12px;min-width:0}
.menu-btn{display:none;min-width:44px;min-height:44px}
.page-title{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.top-actions{display:flex;align-items:center;gap:8px}
.icon-btn{
  position:relative;min-width:44px;min-height:44px;border-radius:8px;border:1px solid var(--line-2);
  background:var(--raise);display:grid;place-items:center;color:var(--text)
}
.icon-btn:hover{background:var(--hover);border-color:var(--line-3)}
.icon-btn:disabled{opacity:.55;cursor:not-allowed}
.icon-btn svg{width:18px;height:18px;display:block}
.icon-btn[data-action="toggle-theme"]{color:var(--text)}
.cta-note{margin-top:8px;font-size:12px;color:var(--mid);line-height:1.4}
.cta-note a{color:var(--accent);font-weight:600;text-decoration:underline}
.match-proof{font-family:var(--mono);font-size:11px;letter-spacing:.04em;color:var(--text);margin-top:6px}
.match-proof.exact{color:var(--chip-ok)}
.remain{font-size:12px;color:var(--mid)}
.remain.warn{color:var(--chip-danger);font-weight:600}
.tower-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:14px;margin-top:14px}
.low-stock{border-color:rgba(196,56,56,.35);background:rgba(196,56,56,.06)}
.qty-low{color:var(--chip-danger);font-weight:600}
.badge{
  position:absolute;top:6px;right:6px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;
  background:var(--accent);color:var(--on-accent);font-size:10px;font-weight:700;display:grid;place-items:center
}
.user-chip-wrap{position:relative}
.user-chip{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 12px;border-radius:8px;border:1px solid var(--line-2);background:var(--raise);max-width:220px}
.user-chip .av{width:28px;height:28px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-size:11px;font-weight:700;flex:none}
.user-chip .meta{min-width:0}.user-chip .meta strong{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.user-chip .meta span{display:block;font-size:11px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.user-menu{position:absolute;right:0;top:110%;min-width:220px;z-index:30;padding:12px}
.main{overflow:auto;padding:20px;background:
  linear-gradient(180deg, var(--accent-wash), transparent 180px),
  var(--void)
}
.main-inner{max-width:1200px;margin:0 auto}

.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0 22px}
.stat{
  background:var(--plate);border:1px solid var(--line);border-radius:var(--radius);padding:16px 16px 14px;
  position:relative;overflow:hidden
}
.stat::after{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--accent)}
.stat .lab{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.stat .val{font-size:28px;font-weight:600;margin-top:8px;font-variant-numeric:tabular-nums}
.stat .sub{font-size:12px;color:var(--mid);margin-top:4px}

.panel{background:var(--plate);border:1px solid var(--line);border-radius:var(--radius);padding:16px;margin-bottom:16px}
.panel-h{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.panel-h h3{margin:0;font-size:15px}
.split{display:grid;grid-template-columns:1.4fr .9fr;gap:16px}
.req-card{
  border:1px solid var(--line);border-radius:10px;padding:14px;background:var(--inset);margin-bottom:10px
}
.req-card:hover{border-color:var(--line-2)}
.req-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px}
.req-top strong{font-family:var(--mono);font-size:12px;color:var(--accent)}
.req-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:12px;color:var(--mid);margin:10px 0}
.req-meta b{color:var(--text);font-weight:500}
.req-actions{display:flex;gap:8px;flex-wrap:wrap}
.activity li{list-style:none;display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);font-size:13px}
.activity{margin:0;padding:0}
.quick{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.quick .btn{justify-content:flex-start}

.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;align-items:center}
.toolbar input,.toolbar select{
  min-height:40px;padding:8px 10px;border-radius:8px;border:1px solid var(--line-2);background:var(--input);color:var(--text)
}
.toolbar .grow{flex:1;min-width:160px}
.view-toggle{display:inline-flex;border:1px solid var(--line-2);border-radius:8px;overflow:hidden}
.view-toggle button{min-height:40px;border:0;background:transparent;color:var(--mid);padding:0 12px}
.view-toggle button:hover{background:var(--hover);color:var(--text)}
.view-toggle button.on{background:var(--accent-soft);color:var(--accent)}
.view-toggle button:disabled{opacity:.55;cursor:not-allowed}

.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:10px}
table.data{width:100%;border-collapse:collapse;min-width:860px;font-size:13px}
table.data th,table.data td{padding:12px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}
table.data th{
  font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);
  background:var(--inset);position:sticky;top:0;z-index:1;white-space:nowrap
}
table.data tr:hover td{background:var(--hover)}
table.data tr.clickable{cursor:pointer}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.empty{padding:36px 16px;text-align:center;color:var(--mid);border:1px dashed var(--line-2);border-radius:10px}

.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.tabs button{
  min-height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--line-2);background:transparent;color:var(--mid);font-size:12px
}
.tabs button:hover{background:var(--hover);color:var(--text)}
.tabs button.on{border-color:var(--accent-line);color:var(--accent);background:var(--accent-soft)}
.tabs button:disabled{opacity:.55;cursor:not-allowed}

.drawer-root{position:absolute;inset:0;z-index:70;pointer-events:none}
.drawer-root.open{pointer-events:auto}
.drawer-scrim{position:absolute;inset:0;background:var(--overlay);opacity:0;transition:opacity .2s}
.drawer-root.open .drawer-scrim{opacity:1}
.drawer{
  position:absolute;top:0;right:0;height:100%;width:min(480px,100%);background:var(--plate);
  border-left:1px solid var(--line-2);transform:translateX(104%);transition:transform .25s var(--ease);
  display:flex;flex-direction:column
}
.drawer-root.open .drawer{transform:none}
.drawer-h{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line)}
.drawer-b{padding:16px 18px;overflow:auto;flex:1}
.drawer-f{padding:14px 18px;border-top:1px solid var(--line);display:flex;gap:8px;flex-wrap:wrap}
.kv{display:grid;grid-template-columns:120px 1fr;gap:8px 12px;font-size:13px;margin:12px 0}
.kv dt{color:var(--dim)} .kv dd{margin:0;color:var(--text)}
.tech-viz{
  height:110px;border-radius:10px;border:1px solid var(--line);margin-bottom:14px;
  background:
    radial-gradient(circle at 30% 40%, rgba(255,107,0,.18), transparent 45%),
    linear-gradient(135deg,var(--inset),var(--elev));
  position:relative;overflow:hidden
}
.tech-viz .bar{position:absolute;height:2px;background:rgba(255,107,0,.55);animation:scan 3.2s ease-in-out infinite}
@keyframes scan{0%,100%{top:20%;left:10%;width:40%}50%{top:70%;left:35%;width:50%}}

.modal-overlay{z-index:90}
.modal-panel{width:min(720px,100%)}
.calc-box{display:grid;gap:8px;padding:12px;border-radius:8px;background:var(--inset);border:1px solid var(--line);margin:12px 0;font-size:13px}
.calc-box div{display:flex;justify-content:space-between}
.calc-box .tot{font-weight:600;color:var(--accent);border-top:1px solid var(--line);padding-top:8px;margin-top:4px}

.toast{
  position:absolute;right:18px;bottom:18px;z-index:100;min-width:240px;max-width:360px;
  background:var(--toast);border:1px solid var(--accent-line);border-radius:10px;padding:12px 14px;
  box-shadow:var(--shadow);transform:translateY(120%);opacity:0;transition:all .25s var(--ease)
}
.toast.show{transform:none;opacity:1}
.toast strong{display:block;font-size:13px;margin-bottom:2px}
.toast span{font-size:12px;color:var(--mid)}

.notif-panel{
  position:absolute;right:20px;top:calc(var(--top) + 8px);width:min(360px,calc(100vw - 24px));
  background:var(--plate);border:1px solid var(--line-2);border-radius:12px;z-index:60;
  box-shadow:var(--shadow);max-height:70vh;overflow:auto
}
.notif-panel[hidden]{display:none}
.notif-item{padding:12px 14px;border-bottom:1px solid var(--line);cursor:pointer}
.notif-item.unread{background:rgba(255,107,0,.06)}
.notif-item strong{display:block;font-size:13px}
.notif-item p{margin:4px 0;font-size:12px;color:var(--mid)}
.notif-item time{font-size:11px;color:var(--dim);font-family:var(--mono)}

.progress{height:8px;border-radius:999px;background:var(--line-2);overflow:hidden;margin:10px 0 18px}
.progress > i{display:block;height:100%;background:var(--accent);width:0}
.doc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.doc-card{border:1px solid var(--line);border-radius:10px;padding:14px;background:var(--inset)}
.map-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}
.map-grid select{min-height:40px;width:100%;border-radius:8px;border:1px solid var(--line-2);background:var(--input);padding:8px;color:var(--text)}
.preview-table{width:100%;border-collapse:collapse;font-size:12px}
.preview-table th,.preview-table td{border:1px solid var(--line);padding:8px;text-align:left}
.bottom-nav{display:none}
.side-backdrop{display:none}

@media (max-width:1100px){
  .stats{grid-template-columns:repeat(2,1fr)}
  .split{grid-template-columns:1fr}
}
@media (max-width:1024px){
  .app{grid-template-columns:72px 1fr}
  .side-brand .name,.side-brand .sub,.nav button span.lbl{display:none}
  .nav button{justify-content:center;padding:0}
  .user-chip .meta{display:none}
}
@media (max-width:768px){
  .login{grid-template-columns:1fr}
  .login-visual{min-height:280px;padding:28px 22px}
  .mech{height:140px;margin-top:16px}
  .gear{width:110px;height:110px}
  .orbit{width:150px;height:150px}
  .grid-2,.upload-grid,.checks,.map-grid,.quick{grid-template-columns:1fr}
  .app{grid-template-columns:1fr;grid-template-rows:var(--top) 1fr auto;height:100%;min-height:0}
  .sidebar{
    position:absolute;inset:0 auto 0 0;width:min(280px,86vw);z-index:75;transform:translateX(-105%);
    transition:transform .25s var(--ease)
  }
  .sidebar.open{transform:none}
  .side-backdrop{display:block;position:absolute;inset:0;background:var(--overlay);z-index:74}
  .side-brand .name,.side-brand .sub,.nav button span.lbl{display:inline}
  .nav button{justify-content:flex-start;padding:0 12px}
  .menu-btn{display:inline-grid}
  .stats{grid-template-columns:1fr 1fr}
  .main{padding:14px 12px 88px}
  .bottom-nav{
    display:grid;grid-template-columns:repeat(5,1fr);gap:2px;border-top:1px solid var(--line);
    background:var(--sidebar);padding:6px 4px calc(6px + env(safe-area-inset-bottom))
  }
  .bottom-nav button{
    border:0;background:transparent;color:var(--dim);min-height:56px;font-size:10px;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px
  }
  .bottom-nav button.on{color:var(--text);font-weight:600;box-shadow:inset 0 3px 0 var(--accent)}
  .drawer{width:100%}
  .user-chip{padding:0 8px;max-width:44px}
  table.data{min-width:720px}
  .tower-grid{grid-template-columns:1fr}
}
@media (max-width:420px){
  .stats{grid-template-columns:1fr 1fr}
  .stat .val{font-size:22px}
}
@media (max-width:320px){
  .topbar{gap:6px;padding:0 8px}
  .top-actions{gap:4px}
  .icon-btn{min-width:40px;min-height:40px}
  .page-title{font-size:13px;max-width:42vw}
  .user-chip-wrap{display:none}
  .tower-grid{grid-template-columns:1fr}
}
`;

  // APPLY_SESSION_HOST_PURE_START
  // UI-only apply-session allowlist. Not a backend authorization source.
  function isActiveSupplierBeginLogin(result) {
    if (!result || !(result.ok || result.approved)) return false;
    if (!result.sessionToken) return false;
    var role = result.role;
    if (role !== "supplier_owner" && role !== "supplier_staff") return false;
    var status = result.status != null ? String(result.status) : "";
    if (status !== "active") return false;
    if (!result.supplierKey || !result.memberId) return false;
    var portal = result.portal != null && result.portal !== "" ? String(result.portal) : "tedarikci";
    if (portal !== "tedarikci") return false;
    return true;
  }

  function applySessionDetailFromBeginLogin(detail, result) {
    if (!isActiveSupplierBeginLogin(result)) return null;
    return {
      reqId: detail && detail.reqId,
      sessionToken: result.sessionToken,
      portal: "tedarikci",
      supplierKey: String(result.supplierKey),
      memberId: String(result.memberId),
      role: result.role,
      status: "active"
    };
  }

  function hostAcceptsPortalAuthResult(result) {
    return !!(
      result &&
      result.authenticated &&
      (result.supplierKey || result.memberId || result.email)
    );
  }
  // APPLY_SESSION_HOST_PURE_END

  /* -------------------- Component -------------------- */
  class ParcaZinciriSupplierPortal extends HTMLElement {
    static get observedAttributes() {
      return ["pzstate", "data-pz-state", "data-pz-portal-auth"];
    }

    constructor() {
      super();
      this._theme = readStoredTheme();
      try {
        this.setAttribute("data-theme", this._theme);
      } catch (e) {}
    }

    attributeChangedCallback(name, _old, value) {
      if (!this.__mounted || !this._state) return;
      if (name === "data-pz-portal-auth") {
        this._applyPortalAuthAttr(value);
        return;
      }
      if (name !== "pzstate" && name !== "data-pz-state") return;
      this._applyServerAuthState(value);
    }

    connectedCallback() {
      this.setAttribute('data-pz-notifications-version','live-1');
      if(!this._noticeFocusRefresh)this._noticeFocusRefresh=()=>this._loadLiveNotifications();
      window.addEventListener('focus',this._noticeFocusRefresh);
      if(!this._noticePoll)this._noticePoll=setInterval(()=>{if(!document.hidden&&this._noticeRows().length<=30)this._loadLiveNotifications();},30000);
      if(!this._inventoryFocusRefresh)this._inventoryFocusRefresh=()=>{if(this._state?.authUi==='active_supplier'&&this._state.route==='inventory')this._loadLiveInventory();};
      window.addEventListener('focus',this._inventoryFocusRefresh);
      if (this.__mounted) return;
      this.__mounted = true;
      ensureFonts();
      this._applyTheme(readStoredTheme(), false);
      try {
        this.setAttribute("data-pz-portal-version", PORTAL_VERSION);
        this.setAttribute("data-pz-portal-mode", "fullscreen-app");
      } catch (e) {}
      this._ensureHostFillStyles();
      this._purgeLegacyAuthStorage();
      this._state = this._initState();
      var shadow = this.attachShadow({ mode: "open" });
      var style = document.createElement("style");
      style.textContent = CSS_TEXT;
      shadow.appendChild(style);
      this._root = document.createElement("div");
      this._root.className = "root";
      this._root.setAttribute("data-portal-shell", "fullscreen");
      this._root.setAttribute("data-theme", this._theme === "dark" ? "dark" : "light");
      shadow.appendChild(this._root);
      this._toastEl = null;
      this._loginWatchToken = 0;
      this._loginWatchTimer = null;
      this._httpDemoSession = false;
      this._bind();
      this._applyServerAuthState(
        this.getAttribute("pzstate") || this.getAttribute("data-pz-state")
      );
      this._render();
      this._alignNativeWixLogin();
      this._emit("pz-supplier-refresh");
    }

    disconnectedCallback() {
      if(this._inventoryFocusRefresh)window.removeEventListener('focus',this._inventoryFocusRefresh);
      if(this._noticeFocusRefresh)window.removeEventListener('focus',this._noticeFocusRefresh);
      clearInterval(this._noticePoll);this._noticePoll=null;this._noticeEpoch=(this._noticeEpoch||0)+1;this._noticeLoading=false;
    }

    _purgeLegacyAuthStorage() {
      try {
        localStorage.removeItem(LS.session);
      } catch (e) {}
    }

    _buildPreviewSafeHomePath() {
      try {
        if (typeof location === "undefined" || !location.href) return "/";
        var u = new URL(location.href);
        var parts = String(u.pathname || "/")
          .split("/")
          .filter(Boolean);
        var known = {
          kataloglar: true,
          tedarikci: true,
          yonetim: true,
          "katalog-siparis-basarili": true,
          urunlerimiz: true
        };
        var base = "";
        if (parts.length && !known[parts[0]]) base = "/" + parts[0];
        var out = new URL(base || "/", u.origin);
        ["siteRevision", "branchId"].forEach(function (k) {
          var v = u.searchParams.get(k);
          if (v) out.searchParams.set(k, v);
        });
        return out.pathname + out.search;
      } catch (e) {
        return "/";
      }
    }

    _navigateHomeFallback() {
      var home = this._buildPreviewSafeHomePath() || "/";
      try {
        if (typeof history !== "undefined" && history.replaceState) {
          history.replaceState(null, "", home);
        }
      } catch (e0) {}
      var abs = home;
      try {
        abs = new URL(home, location.origin).href;
      } catch (e1) {}
      try {
        var target = typeof window !== "undefined" && window.top ? window.top : window;
        if (target && target.location) target.location.assign(abs);
        else if (typeof location !== "undefined") location.assign(abs);
      } catch (e2) {
        try {
          if (typeof location !== "undefined") location.href = abs;
        } catch (e3) {}
      }
    }

    _scheduleLogoutHomeFallback() {
      var self = this;
      if (self._logoutHomeTimer) {
        clearTimeout(self._logoutHomeTimer);
        self._logoutHomeTimer = null;
      }
      // Page bridge should navigate first; CE fallback if still on portal route.
      self._logoutHomeTimer = setTimeout(function () {
        self._logoutHomeTimer = null;
        try {
          var path = String((location && location.pathname) || "");
          if (/\/tedarikci\/?$/i.test(path) || /\/tedarikci\?/i.test(path + (location.search || ""))) {
            self._navigateHomeFallback();
          }
        } catch (e) {
          self._navigateHomeFallback();
        }
      }, 3200);
    }

    _emit(name, detail) {
      try {
        this.dispatchEvent(
          new CustomEvent(name, { bubbles: true, composed: true, detail: detail || {} })
        );
      } catch (e) {}
    }

    _applyServerAuthState(raw) {
      var authUi = "unauthenticated";
      var ctx = null;
      var loginError = null;
      try {
        var parsed = typeof raw === "string" && raw ? JSON.parse(raw) : raw;
        if (parsed && parsed.auth) {
          authUi = String(parsed.auth.ui || "unauthenticated");
          ctx = parsed.auth.context || null;
          if (parsed.auth.loginError) loginError = String(parsed.auth.loginError);
        }
      } catch (e) {
        authUi = "unauthenticated";
      }
      if (this._httpDemoSession && authUi !== "active_supplier") {
        return;
      }
      if(authUi!=='active_supplier'||ctx?.companyId!==this._state.serverContext?.companyId){this._liveInventory=[];this._liveInventoryIdentity=null;this._inventoryError='';}
      var noticeScope=authUi==='active_supplier'&&ctx&&ctx.companyId?String(ctx.companyId)+':'+String(ctx.role||''):'';
      var noticeChanged=noticeScope!==this._noticeScope;
      if(noticeChanged){this._noticeScope=noticeScope;this._noticeEpoch=(this._noticeEpoch||0)+1;this._liveNotices=[];this._noticeNext=null;this._noticeLoading=false;this._noticeError='';this._noticeLoaded=false;}
      this._state.authUi = authUi;
      this._state.serverContext = ctx;
      this._state.logoutBusy = false;
      this._loginWatchToken += 1;
      if (this._loginWatchTimer) {
        clearTimeout(this._loginWatchTimer);
        this._loginWatchTimer = null;
      }
      if (loginError) this._state.loginError = loginError;
      if (authUi === "active_supplier" && ctx && ctx.companyId) {
        this._state.session = {
          loggedIn: true,
          companyId: ctx.companyId,
          companyName: ctx.companyName || "",
          role: ctx.role || "",
          email: ctx.loginEmail || "",
          source: "wix-members"
        };
        if (ctx.companyName) this._state.profile.companyName = ctx.companyName;
        this._state.screen = "app";
        this._state.loginLoading = false;
        this._state.loginError = null;
      } else {
        this._state.session = null;
        this._state.screen = "login";
        this._state.loginLoading = false;
        if (authUi === "forbidden") {
          // Keep forbidden UI; no technical membership wording.
          this._state.loginError = null;
        }
      }
      if (this._root) this._render();
      if(noticeChanged&&noticeScope)this._loadLiveNotifications();
    }

    _applyTheme(theme, persist) {
      this._theme = theme === "dark" ? "dark" : "light";
      try {
        this.setAttribute("data-theme", this._theme);
      } catch (e) {}
      if (this._root) this._root.setAttribute("data-theme", this._theme);
      if (persist !== false) writeStoredTheme(this._theme);
      this._ensureHostFillStyles();
    }

    _ensureHostFillStyles() {
      var fill = document.getElementById("pz-supplier-portal-host-fill");
      if (!fill) {
        fill = document.createElement("style");
        fill.id = "pz-supplier-portal-host-fill";
        document.head.appendChild(fill);
      }
      var theme = this._theme === "dark" ? "dark" : "light";
      var screen = (this._state && this._state.screen) || "login";
      var fillBg = screen === "app" && theme === "light" ? "#F3F0EB" : "#0F0F0F";
      fill.textContent =
        "parca-zinciri-supplier-portal{" +
        "display:block!important;width:100%!important;min-height:100vh!important;min-height:100dvh!important;" +
        "height:100vh!important;height:100dvh!important;max-width:none!important;margin:0!important;" +
        "padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;" +
        "background:" +
        fillBg +
        "!important;position:relative!important;overflow:hidden!important;}" +
        "html.pz-supplier-portal-active,body.pz-supplier-portal-active{margin:0!important;padding:0!important;" +
        "overflow:hidden!important;height:100%!important;background:" +
        fillBg +
        "!important;}" +
        "#comp-ms6lkj0l{position:relative!important;z-index:1!important;}" +
        "#comp-mtennvmu{position:relative!important;z-index:20!important;}";
      try {
        document.documentElement.classList.add("pz-supplier-portal-active");
        document.body.classList.add("pz-supplier-portal-active");
      } catch (e2) {}
    }

    _alignNativeWixLogin() {
      var self = this;
      var run = function () {
        try {
          var slot = self._root && self._root.querySelector(".native-form-slot");
          var box = document.getElementById("comp-mtennvmu");
          if (!slot || !box) return;
          var br = box.getBoundingClientRect();
          var sr = slot.getBoundingClientRect();
          if (!br.width || !sr.width) return;
          var adx = Math.round(sr.left - br.left);
          var ady = Math.round(sr.top - br.top);
          if (adx === 0 && ady === 0) return;
          var m = /translate\((-?\d+)px,\s*(-?\d+)px\)/.exec(box.style.transform || "");
          var tx = m ? parseInt(m[1], 10) : 0;
          var ty = m ? parseInt(m[2], 10) : 0;
          box.style.setProperty(
            "transform",
            "translate(" + (tx + adx) + "px," + (ty + ady) + "px)"
          );
        } catch (eAlign) {}
      };
      run();
      setTimeout(run, 50);
      setTimeout(run, 300);
      setTimeout(run, 1000);
      if (!this._nativeAlignBound) {
        this._nativeAlignBound = true;
        try {
          window.addEventListener("resize", run);
        } catch (eRe) {}
      }
    }

    _initState() {
      this._purgeLegacyAuthStorage();
      var requests = loadLS(LS.requests, null) || seedRequests();
      var quotes = loadLS(LS.quotes, null) || seedQuotes();
      var inventory = loadLS(LS.inventory, null) || seedInventory();
      var orders = loadLS(LS.orders, null) || seedOrders();
      var notifications = loadLS(LS.notifications, null) || seedNotifications();
      var activities = loadLS(LS.activities, null) || seedActivities();
      var profile = loadLS(LS.profile, null) || seedProfile();
      var documents = loadLS(LS.documents, null) || seedDocuments();
      var settings = loadLS(LS.settings, null) || seedSettings();
      return {
        session: null,
        authUi: "unauthenticated",
        serverContext: null,
        screen: "login",
        route: "overview",
        sideOpen: false,
        notifOpen: false,
        userMenuOpen: false,
        logoutBusy: false,
        applyOpen: false,
        applyStep: 1,
        apply: loadLS(LS.applyDraft, {
          company: "",
          taxNo: "",
          taxOffice: "",
          city: "",
          website: "",
          phone: "",
          contactName: "",
          role: "",
          email: "",
          mobile: "",
          whatsapp: "",
          categories: [],
          brands: "",
          conditions: [],
          lead: "",
          regions: "",
          capacity: "",
          files: {}
        }),
        loginLoading: false,
        showPass: false,
        loginEmail: "",
        loginError: null,
        requests: requests,
        quotes: quotes,
        inventory: inventory,
        orders: orders,
        notifications: notifications,
        activities: activities,
        profile: profile,
        documents: documents,
        settings: settings,
        filters: {
          q: "",
          oem: "",
          brand: "",
          category: "",
          city: "",
          status: "",
          urgency: "",
          matchedOnly: false
        },
        requestView: "table",
        quoteTab: "Gönderildi",
        selectedIds: [],
        stockMoves: seedStockMoves(),
        drawer: null,
        modal: null,
        quoteForm: null,
        bulk: null,
        invSort: { key: "partName", dir: 1 },
        toast: null
      };
    }

    _persist() {
      var s = this._state;
      this._purgeLegacyAuthStorage();
      saveLS(LS.quotes, s.quotes);
      saveLS(LS.inventory, s.inventory);
      saveLS(LS.notifications, s.notifications);
      saveLS(LS.orders, s.orders);
      saveLS(LS.profile, s.profile);
      saveLS(LS.documents, s.documents);
      saveLS(LS.settings, s.settings);
      saveLS(LS.activities, s.activities);
      saveLS(LS.requests, s.requests);
      saveLS(LS.applyDraft, s.apply);
    }

    _bind() {
      var self = this;
      this._root.addEventListener("click", function (e) {
        self._onClick(e);
      });
      this._root.addEventListener("submit", function (e) {
        self._onSubmit(e);
      });
      this._root.addEventListener("input", function (e) {
        self._onInput(e);
      });
      this._root.addEventListener("change", function (e) {
        self._onChange(e);
      });
      this._root.addEventListener("keydown", function (e) {
        if (e.key === "Escape") self._onEscape();
      });
    }

    _toast(title, body) {
      var self = this;
      this._state.toast = { title: title, body: body || "" };
      this._renderToast();
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(function () {
        self._state.toast = null;
        self._renderToast();
      }, 3200);
    }

    _renderToast() {
      var existing = this._root.querySelector(".toast");
      if (existing) existing.remove();
      if (!this._state.toast) return;
      var t = document.createElement("div");
      t.className = "toast show";
      t.setAttribute("role", "status");
      t.innerHTML =
        "<strong>" +
        esc(this._state.toast.title) +
        "</strong><span>" +
        esc(this._state.toast.body) +
        "</span>";
      this._root.appendChild(t);
    }

    _onEscape() {
      if (this._state.modal) {
        this._state.modal = null;
        this._render();
        return;
      }
      if (this._state.drawer) {
        this._state.drawer = null;
        this._render();
        return;
      }
      if (this._state.screen === "apply") {
        this._state.applyOpen = false;
        this._state.screen = "login";
        this._render();
        return;
      }
      if (this._state.notifOpen) {
        this._state.notifOpen = false;
        this._render();
      }
      if (this._state.sideOpen) {
        this._state.sideOpen = false;
        this._render();
      }
    }

    _setRoute(route) {
      if(route==='inventory')this._loadLiveInventory();
      this._state.route = route;
      this._state.sideOpen = false;
      this._state.notifOpen = false;
      this._state.drawer = null;
      this._state.modal = null;
      this._render();
      if(route==='notifications')this._loadLiveNotifications();
    }

    _filteredRequests() {
      var f = this._state.filters;
      return this._state.requests.filter(function (r) {
        if (f.matchedOnly && !r.matched) return false;
        if (f.q) {
          var blob = (r.id + " " + r.partName + " " + r.oem + " " + r.vehicle).toLowerCase();
          if (blob.indexOf(f.q.toLowerCase()) === -1) return false;
        }
        if (f.oem && String(r.oem).toLowerCase().indexOf(f.oem.toLowerCase()) === -1) return false;
        if (f.brand && String(r.vehicle).toLowerCase().indexOf(f.brand.toLowerCase()) === -1)
          return false;
        if (f.category && r.category !== f.category) return false;
        if (f.city && r.city !== f.city) return false;
        if (f.status && r.status !== f.status) return false;
        if (f.urgency && r.urgency !== f.urgency) return false;
        return true;
      });
    }

    _openRequest(id) {
      this._state.drawer = { type: "request", id: id };
      this._render();
    }

    _openQuoteBuilder(requestId, quoteId) {
      var req = this._state.requests.find(function (r) {
        return r.id === requestId;
      });
      var existing = quoteId
        ? this._state.quotes.find(function (q) {
            return q.id === quoteId;
          })
        : null;
      if (existing) {
        var acts = quoteActionsForStatus(existing.status);
        if (!acts.edit && !acts.revise) {
          this._toast("Teklif kilitli", "Gönderilmiş teklif düzenlenemez.");
          return;
        }
      } else {
        var cta = requestCtaState(req);
        if (!cta.enabled) {
          this._toast("Teklif kapalı", cta.reason);
          return;
        }
      }
      this._state.quoteForm = existing
        ? Object.assign({}, existing)
        : {
            id: null,
            requestId: req ? req.id : "",
            oem: req ? req.oem : "",
            partName: req ? req.partName : "",
            qty: req ? req.qty : 1,
            stockQty: 0,
            unitPrice: "",
            currency: this._state.settings.currency || "TRY",
            shipping: 0,
            condition: req ? req.conditionPref.split("/")[0].trim() : "Yeni",
            brand: "",
            leadTime: this._state.settings.leadDefault || "2-4 gün",
            validity: this._state.settings.validityDefault || "7 gün",
            warranty: "12 ay",
            notes: "",
            attachmentName: "",
            status: "Taslak"
          };
      this._state.modal = { type: "quote" };
      this._state.drawer = null;
      this._render();
    }

    _quoteTotals(form) {
      var qty = Number(form.qty) || 0;
      var unit = Number(form.unitPrice) || 0;
      var ship = Number(form.shipping) || 0;
      var sub = qty * unit;
      return { sub: sub, ship: ship, total: sub + ship };
    }

    _chipClass(label) {
      var l = String(label || "").toLowerCase();
      if (/acil|urgent/.test(l)) return "chip urgent";
      if (/kabul|onay|teslim|aktif|ok/.test(l)) return "chip ok";
      if (/revizyon|incelen|hazırlan|bekli|warn|planlı|normal/.test(l)) return "chip warn";
      if (/eksik|red|sorun|pasif|doldu|iptal|kapalı/.test(l)) return "chip danger";
      if (/gönder|yeni|eşleş|alındı|info/.test(l)) return "chip info";
      return "chip";
    }

    _supplierEligibility() {
      var docs = this._state.documents || [];
      var byType = {};
      docs.forEach(function (d) {
        if (d && d.type) byType[d.type] = hostDocStatus(d.status);
      });
      var missing = [];
      REQUIRED_HOST_DOC_TYPES.forEach(function (type) {
        if (byType[type] !== "approved") missing.push(type);
      });
      var pct = this._profileCompletion ? this._profileCompletion() : 100;
      return {
        docsOk: missing.length === 0,
        profileOk: pct >= 100,
        message: missing.length
          ? "Zorunlu belgeleriniz onaylı değil. Teklif göndermek için belgelerini tamamlayın."
          : pct < 100
            ? "Firma profiliniz eksik. Teklif göndermek için profilinizi tamamlayın."
            : ""
      };
    }

    _quoteCtaButtons(req, extraClass) {
      var cta = requestCtaState(req);
      var gate = this._supplierEligibility();
      var cls = extraClass || "btn sm primary";
      if (!cta.enabled) {
        return (
          '<button type="button" class="' +
          cls +
          '" disabled aria-disabled="true">Teklif Hazırla</button>' +
          '<p class="cta-note">' +
          esc(cta.reason) +
          "</p>"
        );
      }
      if (!gate.docsOk) {
        return (
          '<button type="button" class="' +
          cls +
          '" disabled aria-disabled="true">Teklif Hazırla</button>' +
          '<p class="cta-note">' +
          esc(gate.message) +
          ' <a href="#" data-action="nav" data-route="documents">Belgeleri tamamla</a></p>'
        );
      }
      return (
        '<button type="button" class="' +
        cls +
        '" data-action="quote-from-request" data-id="' +
        esc(req.id) +
        '">Teklif Hazırla</button>'
      );
    }

    _requestProofHtml(r) {
      var remain = remainingTimeLabel(r.deadline);
      var exact = isExactMatchReason(r.matchReason);
      return (
        '<div class="match-proof' +
        (exact ? " exact" : "") +
        '">' +
        esc(matchReasonLabel(r.matchReason)) +
        (exact ? " · kanıt" : "") +
        '</div><div class="remain' +
        (remain.ok ? "" : " warn") +
        '">' +
        esc(remain.label) +
        "</div>"
      );
    }

    /* -------------------- Events -------------------- */
    _onClick(e) {
      var t = e.target.closest("[data-action]");
      if (!t) {
        if (!e.target.closest("[data-notif-panel]") && !e.target.closest('[data-action="toggle-notif"]')) {
          if (this._state.notifOpen) {
            this._state.notifOpen = false;
            this._render();
          }
        }
        return;
      }
      var action = t.getAttribute("data-action");
      if(action==='reload-live-inventory'){this._loadLiveInventory();return;}
      if(action==='reload-live-notices'){this._loadLiveNotifications();return;}
      if(action==='more-live-notices'){this._loadLiveNotifications(true);return;}
      if (action === "load-server-drafts") {this._loadServerDrafts(Number(t.getAttribute("data-offset")) || 0);return;}
      if (action === "open-server-draft") {this._openServerDraft(t.getAttribute("data-rfq"),t.getAttribute("data-draft"));return;}
      var id = t.getAttribute("data-id") || "";
      var s = this._state;

      if (action === "toggle-pass") {
        s.showPass = !s.showPass;
        this._render();
        return;
      }
      if (action === "forgot") {
        this._emit("pz-supplier-forgot-password", {
          email: String(s.loginEmail || "").trim().toLowerCase()
        });
        return;
      }
      if (action === "switch-account") {
        if (s.logoutBusy) return;
        s.logoutBusy = true;
        this._httpDemoSession = false;
        s.session = null;
        s.serverContext = null;
        s.authUi = "unauthenticated";
        this._resetLiveNotices();
        s.loginError = null;
        s.screen = "login";
        s.userMenuOpen = false;
        this._purgeLegacyAuthStorage();
        this._emit("pz-supplier-switch-account");
        this._render();
        return;
      }
      if (action === "open-apply") {
        s.screen = "apply";
        s.applyOpen = true;
        s.applyStep = 1;
        this._render();
        return;
      }
      if (action === "close-apply") {
        s.applyOpen = false;
        s.screen = "login";
        this._render();
        return;
      }
      if (action === "apply-next") {
        if (!this._validateApplyStep()) return;
        if (s.applyStep < 5) s.applyStep += 1;
        this._persist();
        this._render();
        return;
      }
      if (action === "apply-back") {
        if (s.applyStep > 1) s.applyStep -= 1;
        this._render();
        return;
      }
      if (action === "apply-finish") {
        s.applyOpen = false;
        s.applyStep = 1;
        s.screen = "login";
        this._toast("Başvuru alındı", "Başvurunuz değerlendirmeye alındı.");
        this._render();
        return;
      }
      if (action === "nav") {
        this._setRoute(t.getAttribute("data-route"));
        return;
      }
      if (action === "logout") {
        if (s.logoutBusy) return;
        s.logoutBusy = true;
        this._httpDemoSession = false;
        s.session = null;
        s.serverContext = null;
        s.authUi = "unauthenticated";
        this._resetLiveNotices();
        s.screen = "login";
        s.userMenuOpen = false;
        this._purgeLegacyAuthStorage();
        this._emit("pz-supplier-logout");
        this._scheduleLogoutHomeFallback();
        this._render();
        return;
      }
      if (action === "toggle-user-menu") {
        s.userMenuOpen = !s.userMenuOpen;
        this._render();
        return;
      }
      if (action === "change-password") {
        s.userMenuOpen = false;
        this._emit("pz-supplier-change-password");
        this._render();
        return;
      }
      if (action === "toggle-side") {
        s.sideOpen = !s.sideOpen;
        this._render();
        return;
      }
      if (action === "close-side") {
        s.sideOpen = false;
        this._render();
        return;
      }
      if (action === "toggle-theme") {
        this._applyTheme(this._theme === "dark" ? "light" : "dark");
        this._render();
        var themeBtn = this._root && this._root.querySelector('[data-action="toggle-theme"]');
        if (themeBtn) {
          try {
            themeBtn.focus();
          } catch (eFocus) {}
        }
        return;
      }
      if (action === "toggle-notif") {
        s.notifOpen = !s.notifOpen;
        this._render();
        if(s.notifOpen)this._loadLiveNotifications();
        return;
      }
      if (action === "read-notif") {
        var n = this._noticeRows().find(function (x) {
          return x.id === id;
        });
        if (n) n.read = true;
        this._persistNoticeReads();
        this._render();
        return;
      }
      if (action === "mark-all-read") {
        this._noticeRows().forEach(function (x) {
          x.read = true;
        });
        this._persistNoticeReads();
        this._render();
        return;
      }
      if (action === "open-request") {
        this._openRequest(id);
        return;
      }
      if (action === "close-drawer") {
        s.drawer = null;
        this._render();
        return;
      }
      if (action === "quote-from-request") {
        this._openQuoteBuilder(id);
        return;
      }
      if (action === "close-modal") {
        s.modal = null;
        s.quoteForm = null;
        s.bulk = null;
        this._render();
        return;
      }
      if (action === "save-quote-draft") {
        this._saveQuote("Taslak");
        return;
      }
      if (action === "preview-quote") {
        this._submitPricedQuote(false);
        return;
      }
      if (action === "send-quote") {
        this._saveQuote("Gönderildi");
        return;
      }
      if (action === "quote-tab") {
        s.quoteTab = t.getAttribute("data-tab");
        this._render();
        return;
      }
      if (action === "view-quote") {
        var q = s.quotes.find(function (x) {
          return x.id === id;
        });
        if (q) {
          s.quoteForm = Object.assign({}, q);
          s.modal = { type: "quote-preview" };
          this._render();
        }
        return;
      }
      if (action === "edit-quote") {
        var qq = s.quotes.find(function (x) {
          return x.id === id;
        });
        if (qq) this._openQuoteBuilder(qq.requestId, qq.id);
        return;
      }
      if (action === "copy-quote") {
        var src = s.quotes.find(function (x) {
          return x.id === id;
        });
        if (src) {
          var copy = Object.assign({}, src, {
            id: uid("TKL"),
            status: "Taslak",
            lastActivity: "Kopyalandı",
            updatedAt: new Date().toISOString().slice(0, 10)
          });
          s.quotes.unshift(copy);
          this._persist();
          this._toast("Teklif kopyalandı", copy.id);
          this._render();
        }
        return;
      }
      if (action === "revise-quote") {
        var rq = s.quotes.find(function (x) {
          return x.id === id;
        });
        if (rq) this._openQuoteBuilder(rq.requestId, rq.id);
        return;
      }
      if (action === "set-request-view") {
        s.requestView = t.getAttribute("data-view") || "table";
        this._render();
        return;
      }
      if (action === "quick") {
        var qk = t.getAttribute("data-quick");
        if (qk === "quote") {
          var first = s.requests.find(function (r) {
            return requestCtaState(r).enabled && r.quoteStatus !== "Teklif Gönderildi";
          });
          if (first) this._openQuoteBuilder(first.id);
          else this._setRoute("requests");
        } else if (qk === "stock") {
          s.modal = { type: "inventory-edit", id: null };
          this._render();
        } else if (qk === "bulk") {
          this._setRoute("inventory");
          s.modal = { type: "bulk" };
          s.bulk = { fileName: "", size: 0, rows: [], mapping: {}, result: null };
          this._render();
        } else if (qk === "profile") {
          this._setRoute("profile");
        }
        return;
      }
      if (action === "open-bulk") {
        s.modal = { type: "bulk" };
        s.bulk = { fileName: "", size: 0, rows: [], mapping: {}, result: null };
        this._render();
        return;
      }
      if (action === "download-template") {
        this._downloadTemplate();
        return;
      }
      if (action === "import-bulk") {
        this._importBulk();
        return;
      }
      if (action === "add-inventory") {
        s.modal = { type: "inventory-edit", id: null };
        this._render();
        return;
      }
      if (action === "edit-inventory") {
        s.modal = { type: "inventory-edit", id: id };
        this._render();
        return;
      }
      if (action === "bulk-activate") {
        this._bulkSetActive(true);
        return;
      }
      if (action === "bulk-deactivate") {
        this._bulkSetActive(false);
        return;
      }
      if (action === "bulk-stock") {
        var delta = prompt("Stok güncellemesi (örn. +5 veya 12):", "+1");
        if (delta == null) return;
        this._bulkStock(delta);
        return;
      }
      if (action === "sort-inv") {
        var key = t.getAttribute("data-key");
        if (s.invSort.key === key) s.invSort.dir *= -1;
        else {
          s.invSort.key = key;
          s.invSort.dir = 1;
        }
        this._render();
        return;
      }
      if (action === "order-status") {
        var ord = s.orders.find(function (o) {
          return o.id === id;
        });
        if (!ord) return;
        if (!orderCanAdvance(ord.status)) {
          this._toast("Sipariş kapalı", "Bu sipariş durumunda işlem yapılamaz.");
          return;
        }
        var flow = HOST_ORDER_FLOW;
        var ix = flow.indexOf(ord.status);
        if (ix >= 0 && ix < flow.length - 1) ord.status = flow[ix + 1];
        this._persist();
        this._toast("Sipariş güncellendi", ord.id + " → " + ord.status);
        this._render();
        return;
      }
      if (action === "order-cargo") {
        var o2 = s.orders.find(function (o) {
          return o.id === id;
        });
        if (!o2) return;
        if (HOST_ORDER_TERMINAL[o2.status]) {
          this._toast("Sipariş kapalı", "Bu sipariş durumunda kargo güncellenemez.");
          return;
        }
        var cargo = prompt("Kargo takip numarası:", o2.cargo || "");
        if (cargo == null) return;
        o2.cargo = cargo;
        if (cargo && o2.status === "Kargoya Hazır") o2.status = "Kargoya Verildi";
        this._persist();
        this._render();
        return;
      }
      if (action === "order-detail") {
        s.drawer = { type: "order", id: id };
        this._render();
        return;
      }
      if (action === "upload-doc") {
        var doc = s.documents.find(function (d) {
          return d.id === id;
        });
        if (doc) {
          doc.status = "Yüklendi";
          doc.updatedAt = new Date().toISOString().slice(0, 10);
          this._persist();
          this._toast("Belge yüklendi", doc.name);
          this._render();
        }
        return;
      }
    }

    _onSubmit(e) {
      e.preventDefault();
      var form = e.target;
      if (!form || !form.id) return;
      if (form.id === "pz-login-form") {
        this._handleLogin(form);
        return;
      }
      if (form.id === "pz-quote-form") {
        return;
      }
      if (form.id === "pz-inv-form") {
        this._saveInventory(form);
        return;
      }
      if (form.id === "pz-profile-form") {
        this._saveProfile(form);
        return;
      }
      if (form.id === "pz-settings-form") {
        this._saveSettings(form);
        return;
      }
      if (form.id === "pz-password-form") {
        this._toast("Güvenlik", "Şifre güncelleme isteği kaydedildi.");
        form.reset();
        return;
      }
    }

    _onInput(e) {
      var el = e.target;
      if (!el) return;
      if (el.hasAttribute("data-filter")) {
        var key = el.getAttribute("data-filter");
        this._state.filters[key] = el.type === "checkbox" ? el.checked : el.value;
        this._renderMainOnly();
        return;
      }
      if (el.hasAttribute("data-quote-field")) {
        var qf = el.getAttribute("data-quote-field");
        if (this._state.quoteForm) {
          this._state.quoteForm[qf] = el.type === "number" ? el.value : el.value;
          var totals = this._root.querySelector("[data-quote-totals]");
          if (totals) {
            var t = this._quoteTotals(this._state.quoteForm);
            totals.innerHTML =
              "<div><span>Ara toplam</span><span>" +
              esc(money(t.sub, this._state.quoteForm.currency)) +
              "</span></div><div><span>Kargo</span><span>" +
              esc(money(t.ship, this._state.quoteForm.currency)) +
              '</span></div><div class="tot"><span>Genel toplam</span><span>' +
              esc(money(t.total, this._state.quoteForm.currency)) +
              "</span></div>";
          }
        }
        return;
      }
      if (el.hasAttribute("data-apply-field")) {
        var af = el.getAttribute("data-apply-field");
        this._state.apply[af] = el.value;
        return;
      }
      if (el.hasAttribute("data-inv-search")) {
        this._state.invSearch = el.value;
        this._renderMainOnly();
      }
    }

    _onChange(e) {
      var el = e.target;
      if (!el) return;
      if (el.hasAttribute("data-filter")) {
        var key = el.getAttribute("data-filter");
        this._state.filters[key] = el.type === "checkbox" ? el.checked : el.value;
        this._renderMainOnly();
        return;
      }
      if (el.getAttribute("data-action") === "select-row") {
        var id = el.getAttribute("data-id");
        if (el.checked) {
          if (this._state.selectedIds.indexOf(id) === -1) this._state.selectedIds.push(id);
        } else {
          this._state.selectedIds = this._state.selectedIds.filter(function (x) {
            return x !== id;
          });
        }
        return;
      }
      if (el.getAttribute("data-action") === "apply-check") {
        var group = el.getAttribute("data-group");
        var val = el.value;
        var arr = this._state.apply[group] || [];
        if (el.checked) {
          if (arr.indexOf(val) === -1) arr.push(val);
        } else {
          arr = arr.filter(function (x) {
            return x !== val;
          });
        }
        this._state.apply[group] = arr;
        return;
      }
      if (el.getAttribute("data-action") === "apply-file") {
        var key2 = el.getAttribute("data-file");
        var file = el.files && el.files[0];
        if (file) {
          this._state.apply.files[key2] = {
            name: file.name,
            size: file.size,
            status: "Yüklendi"
          };
          this._persist();
          this._render();
        }
        return;
      }
      if (el.getAttribute("data-action") === "quote-file") {
        var f = el.files && el.files[0];
        if (f && this._state.quoteForm) {
          this._state.quoteForm.attachmentName = f.name;
          this._render();
        }
        return;
      }
      if (el.getAttribute("data-action") === "bulk-file") {
        this._handleBulkFile(el);
        return;
      }
      if (el.hasAttribute("data-map")) {
        if (!this._state.bulk) return;
        this._state.bulk.mapping[el.getAttribute("data-map")] = el.value;
        return;
      }
    }

    _handleLogin(form) {
      if (this._state.loginLoading) return;
      if (form && form.preventDefault) form.preventDefault();
      this._purgeLegacyAuthStorage();

      var emailRaw = "";
      var password = "";
      if (form && form.elements) {
        var emailEl = form.elements.namedItem("email") || form.querySelector('[name="email"]');
        var passEl = form.elements.namedItem("password") || form.querySelector('[name="password"]');
        emailRaw = emailEl && emailEl.value != null ? String(emailEl.value) : "";
        password = passEl && passEl.value != null ? String(passEl.value) : "";
      }
      var email = emailRaw.trim().toLowerCase();
      this._state.loginEmail = email;
      this._state.loginError = null;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        this._state.loginError = "invalid_credentials";
        this._render();
        return;
      }
      if (!password || password.length < 1) {
        this._state.loginError = "invalid_credentials";
        this._render();
        return;
      }

      this._state.loginLoading = true;
      this._render();
      var reqId = "spl_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
      var loginDetail = {
        reqId: reqId,
        kind: "login",
        email: email,
        password: password,
        portal: "tedarikci"
      };
      var self = this;
      var watch = ++this._loginWatchToken;
      clearTimeout(this._loginWatchTimer);
      this._loginWatchTimer = setTimeout(function () {
        if (watch !== self._loginWatchToken) return;
        if (self._state.loginLoading && self._state.screen === "login") {
          self._state.loginLoading = false;
          if (!self._state.loginError) self._state.loginError = "network";
          self._render();
        }
      }, 12000);
      this._beginLoginHttp(loginDetail, watch);
    }

    _functionsBase() {
      try {
        return String(location.origin || "") + "/_functions";
      } catch (e) {
        return "/_functions";
      }
    }

    _beginLoginHttp(detail, watch) {
      var self = this;
      var url = this._functionsBase() + "/portalBeginLogin";
      fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: detail.email,
          password: detail.password,
          portal: detail.portal || "tedarikci"
        })
      })
        .then(function (res) {
          return res.json().catch(function () {
            return { ok: false, message: "Giriş şu anda yapılamıyor" };
          });
        })
        .then(function (result) {
          if (watch !== self._loginWatchToken) return;
          if (result && (result.ok || result.approved) && (result.supplierKey || result.memberId || result.email)) {
            self._httpDemoSession = !!result.isDemo || !result.sessionToken;
            self._applyServerAuthState({
              auth: {
                ui: "active_supplier",
                context: {
                  companyId: result.supplierKey || result.memberId || "supplier",
                  companyName: result.displayName || result.email || "",
                  role: result.role || "",
                  loginEmail: result.email || detail.email || ""
                }
              }
            });
            if (result.sessionToken) {
              var applyDetail = applySessionDetailFromBeginLogin(detail, result);
              if (applyDetail) self._emit("pz-portal-apply-session", applyDetail);
            }
            return;
          }
          var msg = String((result && result.message) || "");
          self._applyServerAuthState({
            auth: {
              ui: "unauthenticated",
              loginError: /zaman|yapılamıyor/i.test(msg) ? "network" : "invalid_credentials"
            }
          });
        })
        .catch(function () {
          if (watch !== self._loginWatchToken) return;
          if (self._state.loginLoading && self._state.screen === "login") {
            self._state.loginLoading = false;
            self._state.loginError = "network";
            self._render();
          }
        });
    }

    _applyPortalAuthAttr(raw) {
      try {
        var parsed = typeof raw === "string" && raw ? JSON.parse(raw) : raw;
        var result = parsed && parsed.result;
        if (!result) return;
        if (hostAcceptsPortalAuthResult(result)) {
          this._applyServerAuthState({
            auth: {
              ui: "active_supplier",
              context: {
                companyId: result.supplierKey || result.memberId || "supplier",
                companyName: result.displayName || result.email || "",
                role: result.role || "",
                loginEmail: result.email || ""
              }
            }
          });
          return;
        }
        var msg = String((result && result.message) || "");
        this._applyServerAuthState({
          auth: {
            ui: "unauthenticated",
            loginError: /zaman|yapılamıyor/i.test(msg) ? "network" : "invalid_credentials"
          }
        });
      } catch (eAuth) {}
    }

    _publicLoginErrorMessage(code) {
      if (code === "rate_limited") {
        return "Çok fazla başarısız giriş denemesi yapıldı. Lütfen bir süre sonra tekrar deneyin.";
      }
      if (code === "network") {
        return "Giriş şu anda tamamlanamıyor. Lütfen tekrar deneyin.";
      }
      if (code === "forbidden_supplier") {
        return "Bu hesap tedarikçi portalına erişim yetkisine sahip değil.";
      }
      return "E-posta adresi veya şifre hatalı.";
    }

    _validateApplyStep() {
      var step = this._state.applyStep;
      var a = this._state.apply;
      if (step === 1) {
        if (!a.company || !a.taxNo || !a.city || !a.phone) {
          this._toast("Eksik bilgi", "Firma unvanı, vergi no, şehir ve telefon zorunludur.");
          return false;
        }
      }
      if (step === 2) {
        if (!a.contactName || !a.email || !a.mobile) {
          this._toast("Eksik bilgi", "Yetkili ad soyad, e-posta ve cep zorunludur.");
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) {
          this._toast("E-posta", "Geçerli bir kurumsal e-posta girin.");
          return false;
        }
      }
      if (step === 3) {
        if (!a.categories.length) {
          this._toast("Kapasite", "En az bir uzmanlık kategorisi seçin.");
          return false;
        }
      }
      return true;
    }

    async _loadServerDrafts(offset) {
      try {
        var result=await this._pricedQuoteApi("listSupplierQuoteDrafts",{offset:offset});
        if (!result || !Array.isArray(result.items)) throw new Error("Talep listesi doğrulanamadı.");
        this._serverDrafts=result;this._render();
        if (!result.items.length) this._toast("Sunucu talepleri","Onaylı teklif taslağı bulunamadı. Yerel örnekler gerçek talep değildir.");
      } catch(err) {this._toast("Talepler okunamadı",err.message);}
    }

    async _openServerDraft(rfqId,draftId) {
      try {
        var draft=await this._pricedQuoteApi("getSupplierQuoteDraft",{rfqId:rfqId,draftId:draftId});
        this._state.quoteForm={requestId:rfqId,draftId:draft.draftId,partName:draft.partName,qty:draft.quantity,unitPrice:"",currency:"TRY",
          stockQty:draft.quantity,shipping:draft.shippingTotalMinor/100,condition:"Yeni",brand:"",leadTime:"",
          validity:draft.expiresAt,warranty:"",notes:"",attachmentName:"",serverApproved:true,status:"Taslak"};
        this._state.modal={type:"quote"};this._render();
      } catch(err) {this._toast("Teklif açılamadı",err.message);}
    }

    _pricedQuoteApi(method,payload) {
      var host=this;
      return new Promise(function(resolve,reject) {
        var reqId="priced_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2);
        var timer;
        var observer=new MutationObserver(function() {
          var raw=host.getAttribute("data-pz-portal-api-result");
          if (!raw) return;
          var message;
          try {message=JSON.parse(raw);} catch(e) {return;}
          if (message.reqId !== reqId) return;
          clearTimeout(timer);observer.disconnect();
          if (!message.result || message.result.ok !== true) reject(new Error("Sunucu teklifi doğrulayamadı. Onaylı talep, fiyat kuralı ve üyelik bağlantısı gerekli."));
          else resolve(message.result.data);
        });
        observer.observe(host,{attributes:true,attributeFilter:["data-pz-portal-api-result"]});
        timer=setTimeout(function(){observer.disconnect();reject(new Error("Sunucu yanıtı alınamadı. Gönderildi sayılmadı."));},15000);
        var detail={kind:"api",portal:"tedarikci",reqId:reqId,method:method,payload:payload};
        host.setAttribute("data-pz-portal-api-request",JSON.stringify(detail));
        host.dispatchEvent(new CustomEvent("pz-portal-api",{detail:detail,bubbles:true,composed:true}));
      });
    }

    async _submitPricedQuote(send) {
      if (this._quoteSending) return;
      var form=this._state.quoteForm;
      if (!form) return;
      var price=String(form.unitPrice || "").replace(",",".");
      if (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) <= 0 || !Number.isSafeInteger(Math.round(Number(price)*100))) {
        this._toast("Fiyat geçersiz","Pozitif ve en fazla iki ondalıklı satış fiyatı girin.");return;
      }
      if (form.currency !== "TRY") {this._toast("Para birimi","Bu teklif bağlantısı yalnız TRY destekliyor.");return;}
      this._quoteSending=true;
      try {
        var draft=await this._pricedQuoteApi("getSupplierQuoteDraft",{rfqId:form.requestId,draftId:form.draftId});
        if (!draft || !draft.draftId || draft.quantity !== Number(form.qty)) throw new Error("Talep adedi / onaylı taslak doğrulanamadı.");
        var payload={draftId:draft.draftId,quantity:draft.quantity,supplierSalePriceMinor:Math.round(Number(price)*100),expiresAt:draft.expiresAt};
        var result=await this._pricedQuoteApi("prepareSupplierPricedQuote",payload);
        if (!result || result.ready !== true || !Number.isSafeInteger(result.commissionRateBps) || !Number.isSafeInteger(result.supplierNetTotalMinor)) throw new Error("Fiyat dökümü doğrulanamadı.");
        if (this._state.quoteForm !== form) return;
        var summary="Komisyon %"+(result.commissionRateBps/100)+": "+money(result.commissionTotalMinor/100,"TRY")+" · Net: "+money(result.supplierNetTotalMinor/100,"TRY");
        if (!send) {this._toast("Sunucudan doğrulanan teklif",summary);return;}
        var saved=await this._pricedQuoteApi("issueSupplierPricedQuote",payload);
        if (!saved || saved.persisted !== true || saved.quoteId !== draft.draftId) throw new Error("Teklif kaydı doğrulanamadı.");
        // Only an acknowledged immutable CMS quote may acquire sent status.
        form.id=saved.quoteId;form.status="Gönderildi";form.lastActivity="Sunucu kaydı doğrulandı";
        var index=this._state.quotes.findIndex(function(q){return q.id === saved.quoteId;});
        var record=Object.assign({},form,{serverPersisted:true,version:saved.version,commissionRateBps:result.commissionRateBps,
          commissionTotalMinor:result.commissionTotalMinor,supplierNetTotalMinor:result.supplierNetTotalMinor});
        if (index < 0) this._state.quotes.unshift(record);else this._state.quotes[index]=record;
        this._persist();this._state.modal=null;this._render();this._toast("Teklif sunucuya kaydedildi",summary);
      } catch(err) {this._toast("Teklif gönderilmedi",err.message || "Teklif kaydı doğrulanamadı.");}
      finally {this._quoteSending=false;}
    }

    _saveQuote(status) {
      if (status !== "Taslak") {
        this._submitPricedQuote(true);
        return;
      }
      var form = this._state.quoteForm;
      if (!form) return;
      if (!form.unitPrice || Number(form.unitPrice) <= 0) {
        this._toast("Eksik alan", "Birim fiyat girin.");
        return;
      }
      if (status !== "Taslak") {
        var gate = this._supplierEligibility();
        if (!gate.docsOk || !gate.profileOk) {
          this._toast("Teklif gönderilemedi", gate.message);
          return;
        }
        var current = form.id
          ? this._state.quotes.find(function (q) {
              return q.id === form.id;
            })
          : null;
        var stage = quotePipelineStage((current && current.status) || form.status);
        if (stage === "Gönderildi" || stage === "Kabul Edildi") {
          this._toast("Teklif kilitli", "Gönderilmiş teklif düzenlenemez.");
          return;
        }
        var reqCheck = this._state.requests.find(function (r) {
          return r.id === form.requestId;
        });
        var cta = requestCtaState(reqCheck);
        if (reqCheck && !cta.enabled && stage !== "Revizyon") {
          this._toast("Teklif kapalı", cta.reason);
          return;
        }
      }
      var totals = this._quoteTotals(form);
      var now = new Date().toISOString().slice(0, 10);
      if (!form.id) {
        form.id = uid("TKL");
        form.status = status;
        form.lastActivity = status === "Taslak" ? "Taslak kaydedildi" : "Teklif iletildi";
        form.updatedAt = now;
        form.total = totals.total;
        this._state.quotes.unshift(Object.assign({}, form, { total: totals.total }));
      } else {
        var ix = this._state.quotes.findIndex(function (q) {
          return q.id === form.id;
        });
        form.status = status === "Taslak" ? form.status === "Taslak" ? "Taslak" : status : status;
        if (status !== "Taslak") form.status = status;
        form.lastActivity = status === "Taslak" ? "Taslak güncellendi" : "Teklif gönderildi";
        form.updatedAt = now;
        form.total = totals.total;
        if (ix >= 0) this._state.quotes[ix] = Object.assign({}, form);
        else this._state.quotes.unshift(Object.assign({}, form));
      }
      if (status !== "Taslak") {
        var req = this._state.requests.find(function (r) {
          return r.id === form.requestId;
        });
        if (req) {
          req.quoteStatus = "Teklif Gönderildi";
          req.status = "Teklif Var";
        }
        this._state.activities.unshift({
          id: uid("A"),
          text: "Teklif gönderildi — " + form.id + " / " + form.requestId,
          time: "Az önce"
        });
        this._state.notifications.unshift({
          id: uid("N"),
          type: "teklif",
          title: "Teklif gönderildi",
          body: form.id + " başarıyla iletildi.",
          time: "Az önce",
          read: false
        });
      }
      this._persist();
      this._state.modal = null;
      this._state.quoteForm = null;
      this._toast(status === "Taslak" ? "Taslak kaydedildi" : "Teklif gönderildi", form.id);
      this._render();
    }

    _downloadTemplate() {
      var headers = [
        "part_name",
        "part_code",
        "oem_code",
        "manufacturer",
        "vehicle_compatibility",
        "category",
        "quantity",
        "condition",
        "unit_price",
        "currency",
        "city",
        "lead_time"
      ];
      var sample =
        headers.join(",") +
        "\nYağ filtresi gövdesi,YF-900,YFS-900,FleetSeal,Volvo FH,Motor,5,Yeni,2400,TRY,İstanbul,2 gün\n";
      var blob = new Blob([sample], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "parca-zinciri-stok-sablon.csv";
      a.click();
      URL.revokeObjectURL(a.href);
      this._toast("Şablon indirildi", "CSV şablonu hazır.");
    }

    _handleBulkFile(input) {
      var file = input.files && input.files[0];
      if (!file) return;
      var self = this;
      var bulk = {
        fileName: file.name,
        size: file.size,
        rows: [],
        mapping: {},
        result: null,
        headers: []
      };
      var isCsv = /\.csv$/i.test(file.name) || file.type.indexOf("csv") !== -1;
      if (!isCsv && !/\.xlsx?$/i.test(file.name)) {
        this._toast("Dosya", "CSV veya XLSX seçin.");
        return;
      }
      if (/\.xlsx?$/i.test(file.name) && !isCsv) {
        bulk.headers = [
          "part_name",
          "part_code",
          "oem_code",
          "manufacturer",
          "vehicle_compatibility",
          "category",
          "quantity",
          "condition",
          "unit_price",
          "currency",
          "city",
          "lead_time"
        ];
        bulk.rows = [
          {
            part_name: "(Önizleme)",
            part_code: "—",
            oem_code: "—",
            manufacturer: "—",
            vehicle_compatibility: "—",
            category: "—",
            quantity: "—",
            condition: "—",
            unit_price: "—",
            currency: "TRY",
            city: "—",
            lead_time: "—"
          }
        ];
        bulk.headers.forEach(function (h) {
          bulk.mapping[h] = h;
        });
        bulk.xlsxNote = true;
        this._state.bulk = bulk;
        this._render();
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var text = String(reader.result || "");
        var lines = text.split(/\r?\n/).filter(function (l) {
          return l.trim();
        });
        if (!lines.length) {
          self._toast("Dosya", "Dosya boş görünüyor.");
          return;
        }
        var headers = lines[0].split(",").map(function (h) {
          return h.trim();
        });
        bulk.headers = headers;
        var suggested = [
          "part_name",
          "part_code",
          "oem_code",
          "manufacturer",
          "vehicle_compatibility",
          "category",
          "quantity",
          "condition",
          "unit_price",
          "currency",
          "city",
          "lead_time"
        ];
        suggested.forEach(function (s) {
          bulk.mapping[s] = headers.indexOf(s) !== -1 ? s : headers[0] || "";
        });
        bulk.rows = lines.slice(1, 6).map(function (line) {
          var cols = line.split(",");
          var obj = {};
          headers.forEach(function (h, i) {
            obj[h] = (cols[i] || "").trim();
          });
          return obj;
        });
        self._state.bulk = bulk;
        self._render();
      };
      reader.readAsText(file);
    }

    _importBulk() {
      var bulk = this._state.bulk;
      if (!bulk || !bulk.fileName) {
        this._toast("Dosya", "Önce bir dosya seçin.");
        return;
      }
      if (bulk.xlsxNote) {
        bulk.result = {
          ok: 0,
          err: 0,
          message: "XLSX önizlemesi tamam. İçe aktarım için CSV kullanın veya kolon eşlemesini onaylayın."
        };
        this._render();
        return;
      }
      var map = bulk.mapping || {};
      var imported = 0;
      var errors = 0;
      (bulk.rows || []).forEach(function (row) {
        var name = row[map.part_name];
        if (!name || name === "(Önizleme)") {
          errors++;
          return;
        }
        this._state.inventory.unshift({
          id: uid("STK"),
          partName: name,
          partCode: row[map.part_code] || "",
          oem: row[map.oem_code] || "",
          manufacturer: row[map.manufacturer] || "",
          vehicles: row[map.vehicle_compatibility] || "",
          category: row[map.category] || "Genel",
          quantity: Number(row[map.quantity]) || 0,
          condition: row[map.condition] || "Yeni",
          unitPrice: Number(row[map.unit_price]) || 0,
          currency: row[map.currency] || "TRY",
          city: row[map.city] || "",
          leadTime: row[map.lead_time] || "",
          active: true,
          updatedAt: new Date().toISOString().slice(0, 10)
        });
        imported++;
      }, this);
      bulk.result = { ok: imported, err: errors, message: imported + " satır içe aktarıldı." };
      this._persist();
      this._toast("İçe aktarma", bulk.result.message);
      this._render();
    }

    _saveInventory(form) {
      var id = form.getAttribute("data-id");
      var item = {
        id: id || uid("STK"),
        partName: form.partName.value.trim(),
        partCode: form.partCode.value.trim(),
        oem: form.oem.value.trim(),
        manufacturer: form.manufacturer.value.trim(),
        vehicles: form.vehicles.value.trim(),
        category: form.category.value.trim(),
        quantity: Number(form.quantity.value) || 0,
        condition: form.condition.value,
        unitPrice: Number(form.unitPrice.value) || 0,
        currency: form.currency.value,
        city: form.city.value.trim(),
        leadTime: form.leadTime.value.trim(),
        active: form.active.value === "true",
        updatedAt: new Date().toISOString().slice(0, 10)
      };
      if (!item.partName) {
        this._toast("Eksik alan", "Parça adı zorunlu.");
        return;
      }
      if (id) {
        var ix = this._state.inventory.findIndex(function (x) {
          return x.id === id;
        });
        if (ix >= 0) this._state.inventory[ix] = item;
      } else {
        this._state.inventory.unshift(item);
      }
      this._state.modal = null;
      this._persist();
      this._toast("Stok güncellendi", item.partName);
      this._render();
    }

    _bulkSetActive(active) {
      var ids = this._state.selectedIds;
      if (!ids.length) {
        this._toast("Seçim yok", "Önce satır seçin.");
        return;
      }
      this._state.inventory.forEach(function (item) {
        if (ids.indexOf(item.id) !== -1) {
          item.active = active;
          item.updatedAt = new Date().toISOString().slice(0, 10);
        }
      });
      this._persist();
      this._toast("Toplu güncelleme", ids.length + " kayıt " + (active ? "aktif" : "pasif"));
      this._render();
    }

    _bulkStock(raw) {
      var ids = this._state.selectedIds;
      if (!ids.length) {
        this._toast("Seçim yok", "Önce satır seçin.");
        return;
      }
      var text = String(raw || "").trim();
      this._state.inventory.forEach(function (item) {
        if (ids.indexOf(item.id) === -1) return;
        if (/^[+-]/.test(text)) item.quantity = Math.max(0, (item.quantity || 0) + Number(text));
        else item.quantity = Math.max(0, Number(text) || 0);
        item.updatedAt = new Date().toISOString().slice(0, 10);
      });
      this._persist();
      this._toast("Stok güncellendi", ids.length + " kayıt");
      this._render();
    }

    _saveProfile(form) {
      var p = this._state.profile;
      p.companyName = form.companyName.value.trim();
      p.description = form.description.value.trim();
      p.contactName = form.contactName.value.trim();
      p.phone = form.phone.value.trim();
      p.email = form.email.value.trim();
      p.website = form.website.value.trim();
      p.address = form.address.value.trim();
      p.regions = form.regions.value.split(",").map(function (x) {
        return x.trim();
      }).filter(Boolean);
      p.categories = form.categories.value.split(",").map(function (x) {
        return x.trim();
      }).filter(Boolean);
      p.brands = form.brands.value.split(",").map(function (x) {
        return x.trim();
      }).filter(Boolean);
      p.delivery = form.delivery.value.trim();
      p.warranty = form.warranty.value.trim();
      p.returns = form.returns.value.trim();
      if (this._state.session) this._state.session.companyName = p.companyName;
      this._persist();
      this._toast("Profil kaydedildi", p.companyName);
      this._render();
    }

    _saveSettings(form) {
      var st = this._state.settings;
      st.currency = form.currency.value;
      st.leadDefault = form.leadDefault.value.trim();
      st.validityDefault = form.validityDefault.value.trim();
      st.emailNotif = !!form.emailNotif.checked;
      st.waNotif = !!form.waNotif.checked;
      st.quoteNotif = !!form.quoteNotif.checked;
      st.stockNotif = !!form.stockNotif.checked;
      this._persist();
      this._toast("Ayarlar kaydedildi", "");
      this._render();
    }

    _profileCompletion() {
      var p = this._state.profile;
      var fields = [
        p.companyName,
        p.description,
        p.contactName,
        p.phone,
        p.email,
        p.website,
        p.address,
        p.regions && p.regions.length,
        p.categories && p.categories.length,
        p.brands && p.brands.length,
        p.delivery,
        p.warranty,
        p.returns
      ];
      var filled = fields.filter(Boolean).length;
      return Math.round((filled / fields.length) * 100);
    }

    _renderMainOnly() {
      var main = this._root.querySelector("[data-main]");
      if (!main) {
        this._render();
        return;
      }
      main.innerHTML = this._renderRoute();
    }

    /* -------------------- Render -------------------- */
    _render() {
      var s = this._state;
      this._ensureHostFillStyles();
      if (this._root) this._root.setAttribute("data-theme", this._theme === "dark" ? "dark" : "light");
      if (s.screen === "apply") {
        this._root.innerHTML = this._renderApply() + '<div class="toast" hidden></div>';
      } else if (s.screen === "login") {
        this._root.innerHTML = this._renderLogin() + '<div class="toast" hidden></div>';
      } else {
        this._root.innerHTML =
          this._renderApp() +
          this._renderDrawer() +
          this._renderModal() +
          '<div class="toast" hidden></div>';
      }
      this._renderToast();
      if (s.screen === "login") this._alignNativeWixLogin();
      var focus = this._root.querySelector("[data-autofocus]");
      if (focus) {
        try {
          focus.focus();
        } catch (e) {}
      }
    }

    _renderLogin() {
      var loading = this._state.loginLoading;
      var authUi = this._state.authUi || "unauthenticated";
      var showPass = !!this._state.showPass;
      var emailVal = this._state.loginEmail || "";
      var disabled = loading || authUi === "disabled";
      var statusBlock = "";
      var formBlock = "";

      if (authUi === "disabled") {
        statusBlock =
          '<p class="lead">Tedarikçi portalı henüz etkin değil.</p>';
      } else if (authUi === "forbidden") {
        statusBlock =
          '<div class="login-error" role="alert">' +
          esc(this._publicLoginErrorMessage("forbidden_supplier")) +
          "</div>" +
          '<button type="button" class="btn primary block" data-action="switch-account" ' +
          (this._state.logoutBusy ? "disabled" : "") +
          ">Farklı Hesapla Giriş Yap</button>";
      } else if (authUi === "session_initializing") {
        statusBlock = '<p class="lead">Oturum doğrulanıyor…</p>';
      } else {
        var errCode = this._state.loginError;
        var errHtml = errCode
          ? '<div class="login-error" role="alert" data-login-error>' +
            esc(this._publicLoginErrorMessage(errCode)) +
            "</div>"
          : "";
        formBlock =
          '<div class="native-form-slot" aria-hidden="true"></div>' +
          '<p class="login-extra">Tedarikçi hesabınız yok mu?' +
          '<button type="button" class="btn link" data-action="open-apply">Tedarikçi Başvurusu Yap</button></p>';
      }

      return (
        '<div class="login" role="main">' +
        '<section class="login-visual" aria-label="Tedarikçi operasyon merkezi">' +
        '<div class="login-copy">' +
        '<div class="brand-lock">' +
        MARK +
        '<div><div class="name">PARÇA ZİNCİRİ</div><div class="eyebrow" style="margin-top:6px">B2B Portal</div></div>' +
        "</div>" +
        '<h1 class="display h1">Tedarikçi Operasyon Merkezi</h1>' +
        "<p>Parça taleplerini tek panelden görün, teklif süreçlerinizi yönetin ve stok hareketlerinizi hızlandırın.</p>" +
        "</div>" +
        '<div class="mech" aria-hidden="true">' +
        '<div class="orbit"></div><div class="part-block"></div>' +
        '<div class="gear">' +
        [0, 45, 90, 135, 180, 225, 270, 315]
          .map(function (r) {
            return '<span style="--r:' + r + 'deg"></span>';
          })
          .join("") +
        "</div></div>" +
        "</section>" +
        '<section class="login-panel">' +
        '<div class="login-card">' +
        statusBlock +
        formBlock +
        "</div></section></div>"
      );
    }

    _renderApply() {
      var step = this._state.applyStep;
      var a = this._state.apply;
      var steps = ["Firma", "Yetkili", "Kapasite", "Belgeler", "Sonuç"];
      var body = "";
      if (step === 1) {
        body =
          '<div class="grid-2">' +
          this._field("Firma unvanı", "company", a.company) +
          this._field("Vergi numarası", "taxNo", a.taxNo) +
          this._field("Vergi dairesi", "taxOffice", a.taxOffice) +
          this._field("Şehir", "city", a.city) +
          this._field("Web sitesi", "website", a.website) +
          this._field("Firma telefonu", "phone", a.phone) +
          "</div>";
      } else if (step === 2) {
        body =
          '<div class="grid-2">' +
          this._field("Ad soyad", "contactName", a.contactName) +
          this._field("Görev", "role", a.role) +
          this._field("Kurumsal e-posta", "email", a.email, "email") +
          this._field("Cep telefonu", "mobile", a.mobile) +
          this._field("WhatsApp numarası", "whatsapp", a.whatsapp) +
          "</div>";
      } else if (step === 3) {
        var cats = ["Motor", "Fren", "Turbo", "Elektrik", "Klima", "Şanzıman"];
        body =
          '<div class="field"><label>Uzmanlık kategorileri</label><div class="checks">' +
          cats
            .map(function (c) {
              return (
                '<label><input type="checkbox" data-action="apply-check" data-group="categories" value="' +
                esc(c) +
                '" ' +
                (a.categories.indexOf(c) !== -1 ? "checked" : "") +
                "/> " +
                esc(c) +
                "</label>"
              );
            })
            .join("") +
          "</div></div>" +
          this._field("Hizmet verilen markalar", "brands", a.brands) +
          '<div class="field"><label>Parça seçenekleri</label><div class="checks">' +
          ["Yeni", "Çıkma", "Revizyonlu"]
            .map(function (c) {
              return (
                '<label><input type="checkbox" data-action="apply-check" data-group="conditions" value="' +
                esc(c) +
                '" ' +
                (a.conditions.indexOf(c) !== -1 ? "checked" : "") +
                "/> " +
                esc(c) +
                "</label>"
              );
            })
            .join("") +
          "</div></div>" +
          '<div class="grid-2">' +
          this._field("Ortalama teslim süresi", "lead", a.lead) +
          this._field("Hizmet verilen bölgeler", "regions", a.regions) +
          this._field("Aylık yaklaşık teklif kapasitesi", "capacity", a.capacity) +
          "</div>";
      } else if (step === 4) {
        var files = [
          ["tax", "Vergi levhası"],
          ["sign", "İmza sirküleri"],
          ["activity", "Firma faaliyet belgesi"],
          ["brand", "Marka yetki belgesi (varsa)"]
        ];
        body =
          '<div class="upload-grid">' +
          files
            .map(function (f) {
              var meta = a.files[f[0]];
              return (
                '<label class="upload-zone' +
                (meta ? " has" : "") +
                '"><strong>' +
                esc(f[1]) +
                "</strong>" +
                (meta
                  ? "<small>" +
                    esc(meta.name) +
                    " · " +
                    Math.round(meta.size / 1024) +
                    " KB · " +
                    esc(meta.status) +
                    "</small>"
                  : "<small>PDF veya görsel seçin</small>") +
                '<input type="file" hidden data-action="apply-file" data-file="' +
                f[0] +
                '" accept=".pdf,image/*" /></label>'
              );
            })
            .join("") +
          "</div>";
      } else {
        body =
          '<div class="success-box"><div class="mark" aria-hidden="true">✓</div>' +
          '<h3 class="h3">Başvurunuz değerlendirmeye alındı.</h3>' +
          '<p class="muted" style="margin-top:10px">Operasyon ekibimiz belgelerinizi inceledikten sonra kurumsal e-posta adresiniz üzerinden bilgilendirme yapacaktır.</p></div>';
      }
      return (
        '<div class="apply-screen" role="main" aria-labelledby="pz-apply-title">' +
        '<div class="apply-panel">' +
        '<div class="panel-h"><div><div class="eyebrow">Tedarikçi başvurusu</div><h3 id="pz-apply-title" class="h3">Başvuru formu</h3></div>' +
        '<button type="button" class="btn sm" data-action="close-apply" aria-label="Giriş ekranına dön">Girişe dön</button></div>' +
        '<div class="apply-steps">' +
        steps
          .map(function (label, i) {
            var n = i + 1;
            var cls = n === step ? "on" : n < step ? "done" : "";
            return "<span class='" + cls + "'>" + n + ". " + label + "</span>";
          })
          .join("") +
        "</div>" +
        body +
        '<div class="apply-actions">' +
        (step > 1 && step < 5
          ? '<button type="button" class="btn" data-action="apply-back">Geri</button>'
          : "<span></span>") +
        (step < 4
          ? '<button type="button" class="btn primary" data-action="apply-next">Devam</button>'
          : step === 4
            ? '<button type="button" class="btn primary" data-action="apply-next">Başvuruyu Gönder</button>'
            : '<button type="button" class="btn primary" data-action="apply-finish">Giriş ekranına dön</button>') +
        "</div></div></div>"
      );
    }

    _field(label, key, value, type) {
      return (
        '<div class="field"><label for="ap-' +
        esc(key) +
        '">' +
        esc(label) +
        '</label><input id="ap-' +
        esc(key) +
        '" data-apply-field="' +
        esc(key) +
        '" type="' +
        (type || "text") +
        '" value="' +
        esc(value || "") +
        '" /></div>'
      );
    }

    _navItems() {
      return [
        ["overview", "01", "Genel Bakış"],
        ["requests", "02", "Parça Talepleri"],
        ["quotes", "03", "Tekliflerim"],
        ["inventory", "04", "Stok ve Katalog"],
        ["orders", "05", "Siparişler"],
        ["profile", "06", "Firma Profili"],
        ["documents", "07", "Belgeler ve Doğrulama"],
        ["notifications", "08", "Bildirimler"],
        ["settings", "09", "Ayarlar"]
      ];
    }

    _routeTitle() {
      var map = {
        overview: "Genel Bakış",
        requests: "Parça Talepleri",
        quotes: "Tekliflerim",
        inventory: "Stok ve Katalog",
        orders: "Siparişler",
        profile: "Firma Profili",
        documents: "Belgeler ve Doğrulama",
        notifications: "Bildirimler",
        settings: "Ayarlar"
      };
      return map[this._state.route] || "Portal";
    }

    _renderApp() {
      var s = this._state;
      var unread = this._noticeRows().filter(function (n) {
        return !n.read;
      }).length;
      var nav = this._navItems()
        .map(function (item) {
          return (
            '<button type="button" data-action="nav" data-route="' +
            item[0] +
            '" class="' +
            (s.route === item[0] ? "active" : "") +
            '"><span class="ico" aria-hidden="true">' +
            item[1] +
            '</span><span class="lbl">' +
            item[2] +
            "</span></button>"
          );
        })
        .join("");
      return (
        '<div class="app">' +
        (s.sideOpen ? '<div class="side-backdrop" data-action="close-side"></div>' : "") +
        '<aside class="sidebar' +
        (s.sideOpen ? " open" : "") +
        '" aria-label="Portal menüsü">' +
        '<div class="side-brand">' +
        MARK +
        '<div><div class="name">PARÇA ZİNCİRİ</div><div class="sub">Tedarikçi</div></div></div>' +
        '<nav class="nav">' +
        nav +
        '</nav><div class="nav-foot"><button type="button" data-action="logout"><span class="ico">⎋</span><span class="lbl">Çıkış Yap</span></button></div></aside>' +
        '<header class="topbar">' +
        '<div class="top-left"><button type="button" class="btn menu-btn" data-action="toggle-side" aria-label="Menü">☰</button>' +
        '<div class="page-title">' +
        esc(this._routeTitle()) +
        "</div></div>" +
        '<div class="top-actions">' +
        '<button type="button" class="icon-btn" data-action="toggle-theme" aria-pressed="' +
        (this._theme === "dark" ? "true" : "false") +
        '" title="' +
        (this._theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç") +
        '" aria-label="' +
        (this._theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç") +
        '">' +
        (this._theme === "dark"
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z"/></svg>') +
        "</button>" +
        '<button type="button" class="icon-btn" data-action="toggle-notif" aria-label="Bildirimler">' +
        "🔔" +
        (unread ? '<span class="badge">' + unread + "</span>" : "") +
        "</button>" +
        '<div class="user-chip-wrap">' +
        '<button type="button" class="user-chip" data-action="toggle-user-menu" aria-haspopup="true">' +
        '<div class="av">ME</div><div class="meta"><strong>' +
        esc((s.session && s.session.companyName) || s.profile.companyName) +
        "</strong><span>" +
        esc((s.session && s.session.email) || "") +
        "</span></div></button>" +
        (s.userMenuOpen
          ? '<div class="panel user-menu">' +
            "<strong>" +
            esc((s.session && s.session.companyName) || "Tedarikçi") +
            "</strong>" +
            "<div style=\"opacity:.7;margin:4px 0 10px;font-size:12px\">" +
            esc((s.session && s.session.email) || "") +
            "</div>" +
            '<button type="button" class="btn" data-action="change-password" style="width:100%;margin-bottom:8px">Şifremi Değiştir</button>' +
            '<button type="button" class="btn" data-action="logout" style="width:100%"' +
            (s.logoutBusy ? " disabled" : "") +
            ">Çıkış Yap</button></div>"
          : "") +
        "</div></div>" +
        (s.notifOpen ? this._renderNotifPanel() : "") +
        "</header>" +
        '<main class="main"><div class="main-inner" data-main>' +
        this._renderRoute() +
        "</div></main>" +
        '<nav class="bottom-nav" aria-label="Mobil gezinme">' +
        [
          ["overview", "Genel"],
          ["requests", "Talepler"],
          ["quotes", "Teklif"],
          ["inventory", "Stok"],
          ["orders", "Sipariş"]
        ]
          .map(function (x) {
            return (
              '<button type="button" class="' +
              (s.route === x[0] ? "on" : "") +
              '" data-action="nav" data-route="' +
              x[0] +
              '"><span aria-hidden="true">●</span>' +
              x[1] +
              "</button>"
            );
          })
          .join("") +
        "</nav></div>"
      );
    }

    _renderNotifPanel() {
      var items = this._noticeRows()
        .map(function (n) {
          return (
            '<div class="notif-item' +
            (n.read ? "" : " unread") +
            '" data-action="read-notif" data-id="' +
            esc(n.id) +
            '"><strong>' +
            esc(n.title) +
            "</strong><p>" +
            esc(n.body) +
            "</p><time>" +
            esc(n.time) +
            "</time></div>"
          );
        })
        .join("");
      return (
        '<div class="notif-panel" data-notif-panel role="dialog" aria-label="Bildirimler">' +
        '<div class="panel-h" style="padding:12px 14px;margin:0"><h3>Bildirimler</h3>' +
        '<button type="button" class="btn sm" data-action="mark-all-read">Tümünü okundu say</button></div>' +
        this._noticeStatus() + items + this._noticeControls() +
        "</div>"
      );
    }

    _renderRoute() {
      switch (this._state.route) {
        case "overview":
          return this._renderOverview();
        case "requests":
          return this._renderRequests();
        case "quotes":
          return this._renderQuotes();
        case "inventory":
          return this._renderInventory();
        case "orders":
          return this._renderOrders();
        case "profile":
          return this._renderProfile();
        case "documents":
          return this._renderDocuments();
        case "notifications":
          return this._renderNotificationsPage();
        case "settings":
          return this._renderSettings();
        default:
          return this._renderOverview();
      }
    }

    _renderOverview() {
      var reqs = this._state.requests.filter(function (r) {
        return r.matched;
      }).slice(0, 4);
      var acts = this._state.activities
        .slice(0, 6)
        .map(function (a) {
          return (
            "<li><span>" + esc(a.text) + "</span><span class='dim'>" + esc(a.time) + "</span></li>"
          );
        })
        .join("");
      var cards = reqs
        .map(function (r) {
          return this._requestCard(r, true);
        }, this)
        .join("");
      return (
        '<div class="eyebrow">Operasyon özeti</div>' +
        '<h2 class="h2" style="margin-top:8px">' +
        esc(greeting()) +
        "</h2>" +
        '<p class="muted" style="margin-top:6px">RFQ Command Center — öncelikli talepler, kalan süre ve birebir eşleşme kanıtı</p>' +
        '<div class="stats">' +
        this._stat("Yeni Talepler", "5", "Uzmanlık eşleşmesi") +
        this._stat("Teklif Bekleyenler", "3", "Yanıt süresi kritik") +
        this._stat("Gönderilen Teklifler", "8", "Son 30 gün") +
        this._stat("Sonuçlanan İşlemler", "12", "Kabul + sipariş") +
        "</div>" +
        '<div class="split"><section class="panel"><div class="panel-h"><h3>Öncelikli talepler</h3>' +
        '<button type="button" class="btn sm" data-action="nav" data-route="requests">Tümünü gör</button></div>' +
        cards +
        '</section><div><section class="panel"><div class="panel-h"><h3>Son aktiviteler</h3></div><ul class="activity">' +
        acts +
        '</ul></section><section class="panel"><div class="panel-h"><h3>Hızlı işlemler</h3></div><div class="quick">' +
        '<button type="button" class="btn" data-action="quick" data-quick="quote">Yeni Teklif Hazırla</button>' +
        '<button type="button" class="btn" data-action="quick" data-quick="stock">Stoğa Parça Ekle</button>' +
        '<button type="button" class="btn" data-action="quick" data-quick="bulk">Excel/CSV Yükle</button>' +
        '<button type="button" class="btn" data-action="quick" data-quick="profile">Firma Profilini Güncelle</button>' +
        "</div></section></div></div>"
      );
    }

    _stat(lab, val, sub) {
      return (
        '<article class="stat"><div class="lab">' +
        esc(lab) +
        '</div><div class="val">' +
        esc(val) +
        '</div><div class="sub">' +
        esc(sub) +
        "</div></article>"
      );
    }

    _requestCard(r, compact) {
      return (
        '<article class="req-card">' +
        '<div class="req-top"><strong>' +
        esc(r.id) +
        '</strong><span class="' +
        this._chipClass(r.urgency) +
        '">' +
        esc(r.urgency) +
        "</span></div>" +
        "<div><b>" +
        esc(r.partName) +
        "</b><div class='dim' style='font-size:12px;margin-top:4px'>" +
        esc(r.oem) +
        " · " +
        esc(r.vehicle) +
        "</div></div>" +
        this._requestProofHtml(r) +
        '<div class="req-meta"><div><span class="dim">Adet</span><br/><b>' +
        esc(r.qty) +
        "</b></div><div><span class='dim'>Şehir</span><br/><b>" +
        esc(r.city) +
        "</b></div><div><span class='dim'>Son teklif</span><br/><b>" +
        esc(r.deadline) +
        "</b></div><div><span class='dim'>Durum</span><br/><b>" +
        esc(r.quoteStatus) +
        "</b></div></div>" +
        '<div class="req-actions">' +
        '<button type="button" class="btn sm" data-action="open-request" data-id="' +
        esc(r.id) +
        '">Detayı Aç</button>' +
        this._quoteCtaButtons(r) +
        "</div></article>"
      );
    }

    _renderRequests() {
      var list = this._filteredRequests();
      var f = this._state.filters;
      var cities = ["İstanbul", "Ankara", "İzmir", "Bursa", "Konya", "Antalya"];
      var toolbar =
        '<div class="eyebrow">RFQ Command Center</div>' +
        '<p class="muted" style="margin:6px 0 12px">Öncelikli talepler, kalan süre, OEM/parça no birebir eşleşme kanıtı ve uygunluk.</p>' +
        '<div class="toolbar">' +
        '<input class="grow" placeholder="Ara: talep, parça, OEM" data-filter="q" value="' +
        esc(f.q) +
        '" aria-label="Arama" />' +
        '<input placeholder="OEM / parça kodu" data-filter="oem" value="' +
        esc(f.oem) +
        '" aria-label="OEM" />' +
        '<input placeholder="Araç markası" data-filter="brand" value="' +
        esc(f.brand) +
        '" aria-label="Marka" />' +
        '<select data-filter="category" aria-label="Kategori"><option value="">Kategori</option>' +
        ["Motor", "Turbo", "Fren", "Elektrik", "Klima"]
          .map(function (c) {
            return (
              '<option value="' +
              c +
              '" ' +
              (f.category === c ? "selected" : "") +
              ">" +
              c +
              "</option>"
            );
          })
          .join("") +
        "</select>" +
        '<select data-filter="city" aria-label="Şehir"><option value="">Şehir</option>' +
        cities
          .map(function (c) {
            return (
              '<option value="' +
              c +
              '" ' +
              (f.city === c ? "selected" : "") +
              ">" +
              c +
              "</option>"
            );
          })
          .join("") +
        "</select>" +
        '<select data-filter="urgency" aria-label="Aciliyet"><option value="">Aciliyet</option>' +
        ["Acil", "Normal", "Planlı"]
          .map(function (c) {
            return (
              '<option value="' +
              c +
              '" ' +
              (f.urgency === c ? "selected" : "") +
              ">" +
              c +
              "</option>"
            );
          })
          .join("") +
        "</select>" +
        '<select data-filter="status" aria-label="Durum"><option value="">Durum</option>' +
        ["Yeni", "Eşleşti", "Açık", "Teklif Var"]
          .map(function (c) {
            return (
              '<option value="' +
              c +
              '" ' +
              (f.status === c ? "selected" : "") +
              ">" +
              c +
              "</option>"
            );
          })
          .join("") +
        "</select>" +
        '<label class="btn sm"><input type="checkbox" data-filter="matchedOnly" ' +
        (f.matchedOnly ? "checked" : "") +
        " /> Yalnız eşleşen</label>" +
        '<div class="view-toggle" role="group" aria-label="Görünüm">' +
        '<button type="button" class="' +
        (this._state.requestView === "table" ? "on" : "") +
        '" data-action="set-request-view" data-view="table">Tablo</button>' +
        '<button type="button" class="' +
        (this._state.requestView === "cards" ? "on" : "") +
        '" data-action="set-request-view" data-view="cards">Kart</button>' +
        "</div></div>";

      if (!list.length) {
        return toolbar + '<div class="empty">Filtreye uygun talep bulunamadı.</div>';
      }

      if (this._state.requestView === "cards" || (typeof window !== "undefined" && window.innerWidth <= 768 && this._state.requestView !== "table")) {
        // Prefer explicit toggle; still support cards
      }
      if (this._state.requestView === "cards") {
        return (
          toolbar +
          '<div class="cards">' +
          list
            .map(function (r) {
              return this._requestCard(r);
            }, this)
            .join("") +
          "</div>"
        );
      }

      var rows = list
        .map(function (r) {
          return (
            '<tr class="clickable" data-action="open-request" data-id="' +
            esc(r.id) +
            '"><td>' +
            esc(r.id) +
            "</td><td>" +
            esc(r.partName) +
            '<div class="dim">' +
            esc(r.buyer) +
            "</div></td><td>" +
            esc(r.oem) +
            "</td><td>" +
            esc(r.vehicle) +
            "</td><td>" +
            esc(r.year) +
            "</td><td>" +
            esc(r.qty) +
            "</td><td>" +
            esc(r.conditionPref) +
            "</td><td>" +
            esc(r.city) +
            '</td><td><span class="' +
            this._chipClass(r.urgency) +
            '">' +
            esc(r.urgency) +
            "</span></td><td>" +
            esc(r.deadline || "Tanımsız") +
            "</td><td>" +
            esc(remainingTimeLabel(r.deadline).label) +
            "</td><td>" +
            esc(matchReasonLabel(r.matchReason)) +
            "</td><td>" +
            esc(r.quoteStatus) +
            "</td></tr>"
          );
        }, this)
        .join("");
      return (
        toolbar +
        '<div class="table-wrap"><table class="data"><thead><tr>' +
        ["Talep", "Parça", "OEM", "Araç", "Yıl", "Adet", "Tercih", "Şehir", "Aciliyet", "Son tarih", "Kalan", "Eşleşme", "Teklif"]
          .map(function (h) {
            return "<th>" + h + "</th>";
          })
          .join("") +
        "</tr></thead><tbody>" +
        rows +
        "</tbody></table></div>"
      );
    }

    _renderQuotes() {
      var tabs = QUOTE_PIPELINE_TABS;
      var tab = this._state.quoteTab;
      var list = this._state.quotes.filter(function (q) {
        return quotePipelineStage(q.status) === tab;
      });
      var tabHtml =
        '<div class="eyebrow">Quote Pipeline — teklif hattı</div>' +
        '<button type="button" class="btn" data-action="load-server-drafts">Onaylı Sunucu Taleplerini Getir</button>' +
        (this._serverDrafts ? this._serverDrafts.items.map(function(d) {return '<button type="button" class="btn" data-action="open-server-draft" data-draft="'+esc(d.draftId)+'" data-rfq="'+esc(d.rfqId)+'">Talep '+esc(d.rfqId)+' · Teklif Hazırla</button>';}).join("") +
          (this._serverDrafts.hasMore ? '<button type="button" class="btn" data-action="load-server-drafts" data-offset="'+(this._serverDrafts.offset+20)+'">Sonraki Talepler</button>':'') : '') +
        '<p class="muted" style="margin:6px 0 12px">Gerçek durumlar: Taslak, Gönderildi, Revizyon, Kabul Edildi. Gönderilmiş teklif kilitlidir.</p>' +
        '<div class="tabs">' +
        tabs
          .map(function (t) {
            return (
              '<button type="button" class="' +
              (tab === t ? "on" : "") +
              '" data-action="quote-tab" data-tab="' +
              t +
              '">' +
              t +
              "</button>"
            );
          })
          .join("") +
        "</div>";
      if (!list.length) return tabHtml + '<div class="empty">Bu sekmede teklif yok.</div>';
      var rows = list
        .map(function (q) {
          var total = q.total != null ? q.total : this._quoteTotals(q).total;
          var acts = quoteActionsForStatus(q.status);
          var actions =
            '<div class="req-actions">' +
            (acts.view
              ? '<button type="button" class="btn sm" data-action="view-quote" data-id="' +
                esc(q.id) +
                '">Görüntüle</button>'
              : "") +
            (acts.edit
              ? '<button type="button" class="btn sm" data-action="edit-quote" data-id="' +
                esc(q.id) +
                '">Düzenle</button>'
              : "") +
            (acts.copy
              ? '<button type="button" class="btn sm" data-action="copy-quote" data-id="' +
                esc(q.id) +
                '">Kopyala</button>'
              : "") +
            (acts.revise
              ? '<button type="button" class="btn sm" data-action="revise-quote" data-id="' +
                esc(q.id) +
                '">Revize Et</button>'
              : "") +
            (acts.view
              ? '<button type="button" class="btn sm" data-action="view-quote" data-id="' +
                esc(q.id) +
                '">PDF Önizleme</button>'
              : "") +
            "</div>";
          return (
            "<tr><td>" +
            esc(q.id) +
            "</td><td>" +
            esc(q.requestId) +
            "</td><td>" +
            esc(q.oem) +
            "</td><td>" +
            esc(money(total, q.currency)) +
            "</td><td>" +
            esc(q.leadTime) +
            "</td><td>" +
            esc(q.validity) +
            '</td><td><span class="' +
            this._chipClass(q.status) +
            '">' +
            esc(q.status) +
            "</span></td><td>" +
            esc(q.lastActivity) +
            "</td><td>" +
            actions +
            "</td></tr>"
          );
        }, this)
        .join("");
      return (
        tabHtml +
        '<div class="table-wrap"><table class="data"><thead><tr>' +
        ["Teklif", "Talep", "OEM", "Toplam", "Teslim", "Geçerlilik", "Durum", "Aktivite", "Aksiyon"]
          .map(function (h) {
            return "<th>" + h + "</th>";
          })
          .join("") +
        "</tr></thead><tbody>" +
        rows +
        "</tbody></table></div>"
      );
    }

    _renderInventory() {
      return this._renderLiveInventory();
    }

    async _loadLiveInventory() {
      if(this._inventoryLoading)return;
      this._inventoryLoading=true;this._inventoryError='';
      var company=this._state.serverContext && this._state.serverContext.companyId;
      try{
        var items=[],offset=0,result;
        do{result=await this._pricedQuoteApi('getMobileInventory',{offset:offset});items=items.concat(result.items||[]);offset=result.nextOffset;}while(offset!=null);
        if(company!==(this._state.serverContext && this._state.serverContext.companyId))return;
        this._liveInventory=items;this._liveInventoryIdentity=result.identity;
        if(result.identity && result.identity.companyName)this._state.profile.companyName=result.identity.companyName;
      }catch(err){this._liveInventory=[];this._inventoryError='Ürünler sunucudan okunamadı. Tekrar deneyin.';}
      finally{this._inventoryLoading=false;if(this._state.route==='inventory')this._render();}
    }

    _renderLiveInventory() {
      var q=(this._state.invSearch||'').toLocaleLowerCase('tr');
      var rows=(this._liveInventory||[]).filter(function(p){return [p.title,p.productCode,p.oem].join(' ').toLocaleLowerCase('tr').indexOf(q)!==-1;});
      var identity=this._liveInventoryIdentity||{};
      var status={draft:'Taslak',pending:'Onay bekliyor',approved:'Onaylandı',rejected:'Reddedildi',archived:'Arşivlendi'};
      var content=rows.map(function(p){
        var media=(p.media||[]).map(function(m){
          if(!/^https:\/\/(static\.wixstatic\.com|video\.wixstatic\.com|[a-z0-9.-]+\.wixmp\.com)\//i.test(m.url||''))return '';
          return m.mime.indexOf('video/')===0?'<video controls preload="metadata" style="max-width:260px" src="'+esc(m.url)+'"></video>':'<img alt="'+esc(p.title)+'" style="width:120px;height:100px;object-fit:contain;background:white" src="'+esc(m.url)+'">';
        }).join('');
        return '<article class="panel" data-live-listing="'+esc(p.listingKey)+'"><h3>'+esc(p.title)+'</h3><div>'+media+'</div><p>Ürün / stok kodu: '+esc(p.productCodeUnknown?'Belirtilmemiş · Diğer':p.productCode)+' · '+esc(p.stockQuantity)+' adet · '+esc(money(p.priceEur,'EUR'))+'</p><p>'+esc(status[p.status]||p.status)+'</p><details><summary>Kayıt bilgileri</summary><p>Satıcı no: '+esc(p.sellerNumber)+'</p><p>Kayıt no: '+esc(p.listingKey)+'</p><p>Kullanıcı no: '+esc(p.ownerMemberId)+'</p></details></article>';
      }).join('');
      return '<div class="eyebrow">Stok ve Katalog</div><p>Mobil uygulama ve bu panel aynı tedarikçi kayıtlarını kullanır.</p><p style="overflow-wrap:anywhere">'+esc(identity.companyName||'')+' · '+esc(identity.sellerNumber||'')+'</p><div class="toolbar"><a class="btn primary sm" href="https://ilkibo.github.io/parca-zinciri-public-assets/mobil/" target="_blank" rel="noopener">Yeni Parça Ekle</a><button class="btn sm" data-action="reload-live-inventory">Yenile</button><input aria-label="Stok arama" placeholder="Stokta ara" data-inv-search value="'+esc(this._state.invSearch||'')+'"></div>'+(this._inventoryLoading?'<p>Ürünler yükleniyor…</p>':this._inventoryError?'<p role="alert">'+esc(this._inventoryError)+'</p>':content||'<p>Henüz ürün bulunmuyor.</p>');
    }

    _renderLegacyInventory() {
      var q = (this._state.invSearch || "").toLowerCase();
      var sort = this._state.invSort;
      var list = this._state.inventory.slice().filter(function (i) {
        if (!q) return true;
        return (i.partName + " " + i.oem + " " + i.partCode).toLowerCase().indexOf(q) !== -1;
      });
      list.sort(function (a, b) {
        var av = a[sort.key];
        var bv = b[sort.key];
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
        return String(av).localeCompare(String(bv), "tr") * sort.dir;
      });
      var low = this._state.inventory.filter(function (i) {
        return i.active && Number(i.quantity) <= 3;
      });
      var moves = (this._state.stockMoves || [])
        .map(function (m) {
          return (
            "<li><span>" +
            esc(m.at) +
            " · " +
            esc(m.name) +
            " (" +
            (m.delta > 0 ? "+" : "") +
            esc(m.delta) +
            ")</span><span class='dim'>" +
            esc(m.reason) +
            "</span></li>"
          );
        })
        .join("");
      var lowHtml = low.length
        ? '<section class="panel low-stock"><div class="panel-h"><h3>Düşük stok uyarıları</h3></div><ul class="activity">' +
          low
            .map(function (i) {
              return (
                "<li><span>" +
                esc(i.partName) +
                " · " +
                esc(i.oem) +
                "</span><span class='qty-low'>" +
                esc(i.quantity) +
                " adet</span></li>"
              );
            })
            .join("") +
          "</ul></section>"
        : "";
      var rows = list
        .map(function (i) {
          return (
            "<tr><td><input type='checkbox' data-action='select-row' data-id='" +
            esc(i.id) +
            "' " +
            (this._state.selectedIds.indexOf(i.id) !== -1 ? "checked" : "") +
            " aria-label='Seç'/></td><td>" +
            esc(i.partName) +
            "</td><td>" +
            esc(i.partCode) +
            "</td><td>" +
            esc(i.oem) +
            "</td><td>" +
            esc(i.manufacturer) +
            "</td><td>" +
            esc(i.vehicles) +
            "</td><td>" +
            esc(i.category) +
            "</td><td class='" +
            (Number(i.quantity) <= 3 ? "qty-low" : "") +
            "'>" +
            esc(i.quantity) +
            "</td><td>" +
            esc(i.condition) +
            "</td><td>" +
            esc(money(i.unitPrice, i.currency)) +
            "</td><td>" +
            esc(i.city) +
            "</td><td>" +
            esc(i.leadTime) +
            '</td><td><span class="' +
            this._chipClass(i.active ? "ok" : "eksik") +
            '">' +
            (i.active ? "Aktif" : "Pasif") +
            "</span></td><td>" +
            esc(i.updatedAt) +
            '</td><td><button type="button" class="btn sm" data-action="edit-inventory" data-id="' +
            esc(i.id) +
            '">Düzenle</button></td></tr>'
          );
        }, this)
        .join("");
      return (
        '<div class="eyebrow">Stock &amp; Order Control Tower — stok kulesi</div>' +
        '<p class="muted" style="margin:6px 0 12px">Stok hareketleri, düşük stok uyarıları ve katalog kontrolü.</p>' +
        '<div class="toolbar">' +
        '<button type="button" class="btn primary sm" data-action="add-inventory">Yeni Parça Ekle</button>' +
        '<button type="button" class="btn sm" data-action="open-bulk">Toplu Veri Yükle</button>' +
        '<button type="button" class="btn sm" data-action="download-template">Excel Şablonunu İndir</button>' +
        '<button type="button" class="btn sm" data-action="bulk-stock">Stokları Güncelle</button>' +
        '<button type="button" class="btn sm" data-action="bulk-activate">Toplu Aktif</button>' +
        '<button type="button" class="btn sm" data-action="bulk-deactivate">Toplu Pasif</button>' +
        '<input class="grow" placeholder="Stokta ara" data-inv-search value="' +
        esc(this._state.invSearch || "") +
        '" aria-label="Stok arama" />' +
        "</div>" +
        '<div class="table-wrap"><table class="data"><thead><tr><th></th>' +
        [
          ["partName", "Parça"],
          ["partCode", "Kod"],
          ["oem", "OEM"],
          ["manufacturer", "Üretici"],
          ["vehicles", "Uyum"],
          ["category", "Kategori"],
          ["quantity", "Stok"],
          ["condition", "Durum"],
          ["unitPrice", "Fiyat"],
          ["city", "Şehir"],
          ["leadTime", "Teslim"],
          ["active", "Aktiflik"],
          ["updatedAt", "Güncelleme"]
        ]
          .map(function (h) {
            return (
              '<th><button type="button" class="btn link" data-action="sort-inv" data-key="' +
              h[0] +
              '">' +
              h[1] +
              "</button></th>"
            );
          })
          .join("") +
        "<th></th></tr></thead><tbody>" +
        rows +
        "</tbody></table></div>" +
        '<div class="tower-grid">' +
        lowHtml +
        '<section class="panel"><div class="panel-h"><h3>Stok hareketleri</h3></div><ul class="activity">' +
        moves +
        "</ul></section></div>"
      );
    }

    _renderOrders() {
      var cards = this._state.orders
        .map(function (o) {
          return (
            '<article class="req-card"><div class="req-top"><strong>' +
            esc(o.id) +
            '</strong><span class="' +
            this._chipClass(o.status) +
            '">' +
            esc(o.status) +
            "</span></div>" +
            "<div><b>" +
            esc(o.partName) +
            "</b><div class='dim' style='font-size:12px;margin-top:4px'>Teklif " +
            esc(o.quoteId) +
            "</div></div>" +
            '<div class="req-meta"><div><span class="dim">Adet</span><br/><b>' +
            esc(o.qty) +
            "</b></div><div><span class='dim'>Toplam</span><br/><b>" +
            esc(money(o.total, o.currency)) +
            "</b></div><div><span class='dim'>Şehir</span><br/><b>" +
            esc(o.city) +
            "</b></div><div><span class='dim'>Kargo</span><br/><b>" +
            esc(o.cargo || "—") +
            "</b></div></div>" +
            '<div class="req-actions">' +
            '<button type="button" class="btn sm" data-action="order-detail" data-id="' +
            esc(o.id) +
            '">Detay</button>' +
            (orderCanAdvance(o.status)
              ? '<button type="button" class="btn sm" data-action="order-status" data-id="' +
                esc(o.id) +
                '">Durumu Güncelle</button>'
              : "") +
            (!HOST_ORDER_TERMINAL[o.status]
              ? '<button type="button" class="btn sm" data-action="order-cargo" data-id="' +
                esc(o.id) +
                '">Kargo Bilgisi Ekle</button>'
              : "") +
            '<button type="button" class="btn sm" data-action="order-detail" data-id="' +
            esc(o.id) +
            '">Takip / Belge</button>' +
            "</div></article>"
          );
        }, this)
        .join("");
      return (
        '<div class="eyebrow">Stock &amp; Order Control Tower — sipariş kulesi</div>' +
        '<p class="muted" style="margin:6px 0 12px">Sipariş yaşam döngüsü ve takip. Terminal durumda işlem gösterilmez.</p>' +
        '<div class="cards">' +
        cards +
        "</div>"
      );
    }

    _renderProfile() {
      var p = this._state.profile;
      var pct = this._profileCompletion();
      return (
        '<div class="panel"><div class="panel-h"><div><h3>Firma profili</h3><p class="muted">Profil tamamlanma: ' +
        pct +
        "%</p></div><span class=\"chip warn\">Doğrulama İncelemede</span></div>" +
        '<div class="progress" aria-hidden="true"><i style="width:' +
        pct +
        '%"></i></div>' +
        '<form id="pz-profile-form">' +
        '<div class="grid-2">' +
        this._formInput("companyName", "Firma unvanı", p.companyName) +
        this._formInput("contactName", "Yetkili kişi", p.contactName) +
        this._formInput("phone", "Telefon", p.phone) +
        this._formInput("email", "E-posta", p.email) +
        this._formInput("website", "Web sitesi", p.website) +
        this._formInput("address", "Adres", p.address) +
        this._formInput("regions", "Hizmet bölgeleri", (p.regions || []).join(", ")) +
        this._formInput("categories", "Uzmanlık kategorileri", (p.categories || []).join(", ")) +
        this._formInput("brands", "Çalışılan markalar", (p.brands || []).join(", ")) +
        this._formInput("delivery", "Teslimat seçenekleri", p.delivery) +
        this._formInput("warranty", "Garanti politikası", p.warranty) +
        this._formInput("returns", "İade politikası", p.returns) +
        "</div>" +
        '<div class="field"><label for="description">Firma açıklaması</label><textarea id="description" name="description">' +
        esc(p.description) +
        "</textarea></div>" +
        '<button type="submit" class="btn primary">Profili Kaydet</button></form></div>'
      );
    }

    _formInput(name, label, value) {
      return (
        '<div class="field"><label for="' +
        name +
        '">' +
        esc(label) +
        '</label><input id="' +
        name +
        '" name="' +
        name +
        '" value="' +
        esc(value || "") +
        '" /></div>'
      );
    }

    _renderDocuments() {
      var cards = this._state.documents
        .map(function (d) {
          return (
            '<article class="doc-card"><div class="eyebrow">' +
            esc(d.name) +
            '</div><div style="margin:12px 0"><span class="' +
            this._chipClass(d.status) +
            '">' +
            esc(d.status) +
            "</span></div><div class='dim' style='font-size:12px'>Güncelleme: " +
            esc(d.updatedAt) +
            '</div><button type="button" class="btn sm" style="margin-top:12px" data-action="upload-doc" data-id="' +
            esc(d.id) +
            '">Belge Yükle / Güncelle</button></article>'
          );
        }, this)
        .join("");
      return (
        '<div class="panel"><div class="panel-h"><h3>Belgeler ve doğrulama</h3><span class="chip warn">Doğrulama İncelemede</span></div>' +
        '<p class="muted" style="margin-bottom:14px">Belge durumları operasyon incelemesine göre güncellenir.</p>' +
        '<div class="doc-grid">' +
        cards +
        "</div></div>"
      );
    }

    _noticeRows() {return this._state?.authUi==='active_supplier'&&this._noticeScope?(this._liveNotices||[]):[];}

    _resetLiveNotices() {this._noticeEpoch=(this._noticeEpoch||0)+1;this._noticeScope='';this._liveNotices=[];this._noticeNext=null;this._noticeLoading=false;this._noticeError='';this._noticeLoaded=false;}

    _noticeReadKey() {return 'pz-live-notice-reads:'+this._noticeScope;}

    _persistNoticeReads() {
      if(!this._noticeScope)return;
      var previous=loadLS(this._noticeReadKey(),[]);if(!Array.isArray(previous))previous=[];
      var ids=new Set(previous);this._noticeRows().filter(n=>n.read).forEach(n=>ids.add(n.id));
      saveLS(this._noticeReadKey(),Array.from(ids).slice(-500));
    }

    _noticeStatus() {
      if(this._noticeLoading)return '<p role="status">Bildirimler yükleniyor…</p>';
      if(this._noticeError)return '<p role="alert">'+esc(this._noticeError)+'</p>';
      if(this._noticeLoaded&&!this._noticeRows().length)return '<p role="status">Henüz bildirim yok.</p>';
      return '';
    }

    _noticeControls() {
      var disabled=this._noticeLoading?' disabled':'';
      return '<div class="toolbar"><button type="button" class="btn sm" data-action="reload-live-notices"'+disabled+'>'+(this._noticeError?'Tekrar dene':'Yenile')+'</button>'+(this._noticeNext!=null?'<button type="button" class="btn sm" data-action="more-live-notices"'+disabled+'>Daha fazla bildirim</button>':'')+'</div>';
    }

    _renderNoticeChange() {
      if(!this._root||this._state.authUi!=='active_supplier')return;
      if(this._state.route==='notifications'||this._state.notifOpen){this._render();return;}
      // Polling must not rebuild unrelated forms or remove their focused inputs.
      var button=this._root.querySelector('[data-action="toggle-notif"]');
      if(button){button.querySelector('.badge')?.remove();var unread=this._noticeRows().filter(n=>!n.read).length;if(unread)button.insertAdjacentHTML('beforeend','<span class="badge">'+unread+'</span>');}
    }

    async _loadLiveNotifications(append=false) {
      if(!this._noticeScope||this._state?.authUi!=='active_supplier'||this._httpDemoSession||this._noticeLoading||!this.isConnected)return;
      if(append&&this._noticeNext==null)return;
      var scope=this._noticeScope,epoch=this._noticeEpoch,offset=append?this._noticeNext:0;
      this._noticeLoading=true;this._noticeError='';this._renderNoticeChange();
      try{
        var result=await this._pricedQuoteApi('getSupplierNotifications',{offset:offset});
        if(epoch!==this._noticeEpoch||scope!==this._noticeScope||this._state.authUi!=='active_supplier'||!this.isConnected)return;
        if(!result||!Array.isArray(result.items)||!(result.nextOffset===null||Number.isSafeInteger(result.nextOffset)&&result.nextOffset>offset))throw Error('Invalid notification page');
        var stored=loadLS(this._noticeReadKey(),[]),read=new Set(Array.isArray(stored)?stored:[]);
        var items=result.items.map(n=>({id:String(n.id),listingKey:n.listingKey,title:String(n.title||''),body:String(n.message||''),time:n.createdAt?new Date(n.createdAt).toLocaleString('tr-TR'):'',read:read.has(String(n.id))}));
        var rows=append?this._noticeRows().concat(items):items;this._liveNotices=Array.from(new Map(rows.map(n=>[n.id,n])).values());this._noticeNext=result.nextOffset;this._noticeLoaded=true;
      }catch(err){if(epoch===this._noticeEpoch&&scope===this._noticeScope)this._noticeError='Bildirimler sunucudan alınamadı. Tekrar deneyin.';}
      finally{if(epoch===this._noticeEpoch&&scope===this._noticeScope){this._noticeLoading=false;this._renderNoticeChange();}}
    }

    _renderNotificationsPage() {
      return (
        '<div class="panel"><div class="panel-h"><h3>Bildirim merkezi</h3><button type="button" class="btn sm" data-action="mark-all-read">Tümünü okundu say</button></div>' +
        '<p class="muted">Ürün onayları ve düzenleme gerekçeleri sunucudan alınır.</p>'+this._noticeStatus()+this._noticeRows()
          .map(function (n) {
            return (
              '<div class="notif-item' +
              (n.read ? "" : " unread") +
              '" data-action="read-notif" data-id="' +
              esc(n.id) +
              '"><strong>' +
              esc(n.title) +
              "</strong><p>" +
              esc(n.body) +
              "</p><time>" +
              esc(n.time) +
              "</time></div>"
            );
          })
          .join("") +
        this._noticeControls()+"</div>"
      );
    }

    _renderSettings() {
      var st = this._state.settings;
      return (
        '<div class="split"><section class="panel"><h3>Hesap ve teklif varsayılanları</h3>' +
        '<form id="pz-settings-form" style="margin-top:14px">' +
        '<div class="grid-2">' +
        '<div class="field"><label for="currency">Para birimi</label><select id="currency" name="currency">' +
        ["TRY", "USD", "EUR"]
          .map(function (c) {
            return (
              '<option value="' +
              c +
              '" ' +
              (st.currency === c ? "selected" : "") +
              ">" +
              c +
              "</option>"
            );
          })
          .join("") +
        "</select></div>" +
        this._formInput("leadDefault", "Teslim süresi varsayılanı", st.leadDefault) +
        this._formInput("validityDefault", "Teklif geçerlilik varsayılanı", st.validityDefault) +
        "</div>" +
        '<div class="checks" style="margin:12px 0">' +
        '<label><input type="checkbox" name="emailNotif" ' +
        (st.emailNotif ? "checked" : "") +
        "/> E-posta bildirimleri</label>" +
        '<label><input type="checkbox" name="waNotif" ' +
        (st.waNotif ? "checked" : "") +
        "/> WhatsApp bildirimleri</label>" +
        '<label><input type="checkbox" name="quoteNotif" ' +
        (st.quoteNotif ? "checked" : "") +
        "/> Teklif aktivite bildirimleri</label>" +
        '<label><input type="checkbox" name="stockNotif" ' +
        (st.stockNotif ? "checked" : "") +
        "/> Stok uyarıları</label>" +
        "</div>" +
        '<button type="submit" class="btn primary">Ayarları Kaydet</button></form></section>' +
        '<section class="panel"><h3>Güvenlik</h3><form id="pz-password-form" style="margin-top:14px">' +
        '<div class="field"><label for="curPass">Mevcut şifre</label><input id="curPass" name="curPass" type="password" autocomplete="current-password"/></div>' +
        '<div class="field"><label for="newPass">Yeni şifre</label><input id="newPass" name="newPass" type="password" autocomplete="new-password" minlength="6"/></div>' +
        '<div class="field"><label for="newPass2">Yeni şifre (tekrar)</label><input id="newPass2" name="newPass2" type="password" autocomplete="new-password" minlength="6"/></div>' +
        '<button type="submit" class="btn">Şifreyi Güncelle</button></form></section></div>'
      );
    }

    _renderDrawer() {
      var d = this._state.drawer;
      if (!d) return '<div class="drawer-root" aria-hidden="true"></div>';
      var body = "";
      var title = "";
      var footer = "";
      if (d.type === "request") {
        var r = this._state.requests.find(function (x) {
          return x.id === d.id;
        });
        if (!r) return "";
        title = r.id;
        body =
          '<div class="tech-viz" aria-hidden="true"><div class="bar"></div></div>' +
          '<div class="eyebrow">' +
          esc(r.buyer) +
          "</div>" +
          "<h3 class='h3' style='margin-top:8px'>" +
          esc(r.partName) +
          "</h3>" +
          "<dl class='kv'>" +
          [
            ["Oluşturma", r.createdAt],
            ["OEM", r.oem],
            ["Araç", r.vehicle + " / " + r.year],
            ["Motor", r.engine || "—"],
            ["Adet", r.qty],
            ["Parça durumu", r.conditionPref],
            ["Şehir", r.city],
            ["Son teklif", r.deadline || "Tanımsız"],
            ["Kalan süre", remainingTimeLabel(r.deadline).label],
            ["Eşleşme", matchReasonLabel(r.matchReason)],
            ["Aciliyet", r.urgency],
            ["Teklif durumu", r.quoteStatus]
          ]
            .map(function (row) {
              return "<dt>" + esc(row[0]) + "</dt><dd>" + esc(row[1]) + "</dd>";
            })
            .join("") +
          "</dl>" +
          "<h4 class='h3' style='font-size:14px;margin-top:16px'>Alıcı notları</h4><p class='muted' style='margin-top:6px'>" +
          esc(r.notes) +
          "</p>" +
          (r.warnings && r.warnings.length
            ? "<h4 class='h3' style='font-size:14px;margin-top:16px'>Uyumluluk uyarıları</h4><ul style='margin:8px 0 0 18px;color:var(--warn)'>" +
              r.warnings
                .map(function (w) {
                  return "<li>" + esc(w) + "</li>";
                })
                .join("") +
              "</ul>"
            : "") +
          "<h4 class='h3' style='font-size:14px;margin-top:16px'>Görsel ekler</h4><div class='upload-zone' style='margin-top:8px'><small>Görsel ek bulunmuyor</small></div>" +
          "<h4 class='h3' style='font-size:14px;margin-top:16px'>Aktivite</h4><ul class='activity' style='margin-top:8px'><li><span>Talep oluşturuldu</span><span class='dim'>" +
          esc(r.createdAt) +
          "</span></li><li><span>Eşleşme değerlendirildi</span><span class='dim'>Sistem</span></li></ul>";
        footer = this._quoteCtaButtons(r, "btn primary block");
      } else if (d.type === "order") {
        var o = this._state.orders.find(function (x) {
          return x.id === d.id;
        });
        if (!o) return "";
        title = o.id;
        body =
          "<dl class='kv'>" +
          [
            ["Teklif", o.quoteId],
            ["Parça", o.partName],
            ["Adet", o.qty],
            ["Toplam", money(o.total, o.currency)],
            ["Şehir", o.city],
            ["Durum", o.status],
            ["Kargo", o.cargo || "—"]
          ]
            .map(function (row) {
              return "<dt>" + esc(row[0]) + "</dt><dd>" + esc(row[1]) + "</dd>";
            })
            .join("") +
          "</dl><p class='muted'>Sevkiyat belgesi portal üzerinden görüntülenebilir.</p>";
      }
      return (
        '<div class="drawer-root open" role="presentation">' +
        '<div class="drawer-scrim" data-action="close-drawer"></div>' +
        '<aside class="drawer" role="dialog" aria-modal="true" aria-label="Detay paneli">' +
        '<div class="drawer-h"><div><div class="eyebrow">Detay</div><h3 class="h3">' +
        esc(title) +
        '</h3></div><button type="button" class="btn sm" data-action="close-drawer" aria-label="Kapat">Kapat</button></div>' +
        '<div class="drawer-b">' +
        body +
        "</div>" +
        (footer ? '<div class="drawer-f">' + footer + "</div>" : "") +
        "</aside></div>"
      );
    }

    _renderModal() {
      var m = this._state.modal;
      if (!m) return "";
      if (m.type === "quote") return this._renderQuoteModal();
      if (m.type === "quote-preview") return this._renderQuotePreview();
      if (m.type === "bulk") return this._renderBulkModal();
      if (m.type === "inventory-edit") return this._renderInventoryModal();
      return "";
    }

    _renderQuoteModal() {
      var f = this._state.quoteForm || {};
      var t = this._quoteTotals(f);
      return (
        '<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="qz-title">' +
        '<div class="modal-panel">' +
        '<div class="panel-h"><div><div class="eyebrow">Teklif hazırlama</div><h3 id="qz-title" class="h3">' +
        esc(f.partName || "Teklif") +
        " · " +
        esc(f.requestId || "") +
        '</h3></div><button type="button" class="btn sm" data-action="close-modal" aria-label="Kapat">Kapat</button></div>' +
        '<form id="pz-quote-form"><div class="grid-2">' +
        this._qField("Talep edilen adet", "qty", f.qty, "number") +
        this._qField("Stokta bulunan adet", "stockQty", f.stockQty, "number") +
        this._qField("Birim satış fiyatı (vergi dahil)", "unitPrice", f.unitPrice, "number") +
        '<div class="field"><label for="qf-currency">Para birimi</label><select id="qf-currency" data-quote-field="currency">' +
        ["TRY", "USD", "EUR"]
          .map(function (c) {
            return (
              '<option value="' +
              c +
              '" ' +
              (f.currency === c ? "selected" : "") +
              ">" +
              c +
              "</option>"
            );
          })
          .join("") +
        "</select></div>" +
        this._qField("Parça durumu", "condition", f.condition) +
        this._qField("Marka / üretici", "brand", f.brand) +
        this._qField("Teslim süresi", "leadTime", f.leadTime) +
        this._qField("Kargo bedeli", "shipping", f.shipping, "number") +
        this._qField("Teklif geçerlilik süresi", "validity", f.validity) +
        this._qField("Garanti süresi", "warranty", f.warranty) +
        "</div>" +
        '<div class="field"><label for="qf-notes">Açıklama</label><textarea id="qf-notes" data-quote-field="notes">' +
        esc(f.notes || "") +
        "</textarea></div>" +
        '<div class="field"><label for="qf-file">Dosya ekleri</label><input id="qf-file" type="file" data-action="quote-file" />' +
        (f.attachmentName
          ? '<small class="dim">' + esc(f.attachmentName) + "</small>"
          : "") +
        "</div>" +
        '<div class="calc-box" data-quote-totals><div><span>Ara toplam</span><span>' +
        esc(money(t.sub, f.currency)) +
        "</span></div><div><span>Kargo</span><span>" +
        esc(money(t.ship, f.currency)) +
        '</span></div><div class="tot"><span>Genel toplam</span><span>' +
        esc(money(t.total, f.currency)) +
        "</span></div></div>" +
        '<div class="apply-actions">' +
        '<p role="status">Komisyon sunucuda hesaplanır. Önizle ile komisyon ve net tutarı kontrol edin. Kargo onaylı teklif kuralından alınır.</p>' +
        '<button type="button" class="btn" data-action="save-quote-draft">Yerel Taslak Kaydet</button>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;flex-direction:column;align-items:flex-end">' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" class="btn" data-action="preview-quote">Önizle</button>' +
        (f.serverApproved === true || this._supplierEligibility().docsOk && this._supplierEligibility().profileOk
          ? '<button type="button" class="btn primary" data-action="send-quote">Teklifi Gönder</button>'
          : '<button type="button" class="btn primary" disabled aria-disabled="true">Teklifi Gönder</button>') +
        "</div>" +
        (this._supplierEligibility().docsOk
          ? ""
          : '<p class="cta-note">' +
            esc(this._supplierEligibility().message) +
            ' <a href="#" data-action="nav" data-route="documents">Belgeleri tamamla</a></p>') +
        "</div></div></form></div></div>"
      );
    }

    _qField(label, key, value, type) {
      return (
        '<div class="field"><label for="qf-' +
        key +
        '">' +
        esc(label) +
        '</label><input id="qf-' +
        key +
        '" data-quote-field="' +
        key +
        '" type="' +
        (type || "text") +
        '" value="' +
        esc(value == null ? "" : value) +
        '" /></div>'
      );
    }

    _renderQuotePreview() {
      var f = this._state.quoteForm || {};
      var t = this._quoteTotals(f);
      return (
        '<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Teklif önizleme">' +
        '<div class="modal-panel">' +
        '<div class="panel-h"><div><div class="eyebrow">Teklif önizleme</div><h3 class="h3">' +
        esc(f.id || "Taslak") +
        '</h3></div><button type="button" class="btn sm" data-action="close-modal">Kapat</button></div>' +
        '<div class="panel" style="background:var(--inset)">' +
        '<div class="brand-lock" style="margin-bottom:16px">' +
        MARK +
        "<div><div class='name'>PARÇA ZİNCİRİ</div><div class='eyebrow'>Tedarikçi teklifi</div></div></div>" +
        "<p><b>" +
        esc(f.partName) +
        "</b> · OEM " +
        esc(f.oem) +
        "</p>" +
        "<p class='muted' style='margin-top:8px'>Talep " +
        esc(f.requestId) +
        " · " +
        esc(f.condition) +
        " · Teslim " +
        esc(f.leadTime) +
        "</p>" +
        '<div class="calc-box" style="margin-top:16px"><div><span>Adet × Birim</span><span>' +
        esc(f.qty) +
        " × " +
        esc(money(f.unitPrice, f.currency)) +
        "</span></div><div><span>Ara toplam</span><span>" +
        esc(money(t.sub, f.currency)) +
        "</span></div><div><span>Kargo</span><span>" +
        esc(money(t.ship, f.currency)) +
        '</span></div><div class="tot"><span>Genel toplam</span><span>' +
        esc(money(t.total, f.currency)) +
        "</span></div></div>" +
        "<p class='muted' style='margin-top:12px'>Geçerlilik: " +
        esc(f.validity) +
        " · Garanti: " +
        esc(f.warranty) +
        "</p>" +
        (f.notes ? "<p style='margin-top:10px'>" + esc(f.notes) + "</p>" : "") +
        '</div><div class="apply-actions"><button type="button" class="btn" data-action="close-modal">Kapat</button>' +
        '<button type="button" class="btn primary" data-action="send-quote">Teklifi Gönder</button></div></div></div>'
      );
    }

    _renderBulkModal() {
      var b = this._state.bulk || { fileName: "", rows: [], mapping: {}, headers: [] };
      var cols = [
        "part_name",
        "part_code",
        "oem_code",
        "manufacturer",
        "vehicle_compatibility",
        "category",
        "quantity",
        "condition",
        "unit_price",
        "currency",
        "city",
        "lead_time"
      ];
      var mapHtml = cols
        .map(function (c) {
          var opts = (b.headers || [])
            .map(function (h) {
              return (
                '<option value="' +
                esc(h) +
                '" ' +
                ((b.mapping || {})[c] === h ? "selected" : "") +
                ">" +
                esc(h) +
                "</option>"
              );
            })
            .join("");
          return (
            "<div><label class='eyebrow'>" +
            esc(c) +
            '</label><select data-map="' +
            esc(c) +
            '"><option value="">— eşleştir —</option>' +
            opts +
            "</select></div>"
          );
        })
        .join("");
      var preview = "";
      if (b.rows && b.rows.length) {
        var headers = b.headers || Object.keys(b.rows[0] || {});
        preview =
          '<div class="table-wrap" style="margin-top:12px"><table class="preview-table"><thead><tr>' +
          headers
            .map(function (h) {
              return "<th>" + esc(h) + "</th>";
            })
            .join("") +
          "</tr></thead><tbody>" +
          b.rows
            .map(function (row) {
              return (
                "<tr>" +
                headers
                  .map(function (h) {
                    return "<td>" + esc(row[h]) + "</td>";
                  })
                  .join("") +
                "</tr>"
              );
            })
            .join("") +
          "</tbody></table></div>";
      }
      return (
        '<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Toplu yükleme">' +
        '<div class="modal-panel"><div class="panel-h"><div><div class="eyebrow">Stok</div><h3 class="h3">Toplu veri yükleme</h3></div>' +
        '<button type="button" class="btn sm" data-action="close-modal">Kapat</button></div>' +
        '<label class="upload-zone' +
        (b.fileName ? " has" : "") +
        '"><strong>CSV veya XLSX seçin</strong><small>' +
        (b.fileName
          ? esc(b.fileName) + " · " + Math.round((b.size || 0) / 1024) + " KB"
          : "Dosya seçildiğinde önizleme ve kolon eşleştirme açılır") +
        '</small><input type="file" hidden data-action="bulk-file" accept=".csv,.xlsx,.xls" /></label>' +
        (b.xlsxNote
          ? '<p class="muted" style="margin-top:10px">XLSX için kolon eşleştirme arayüzü hazır. İçe aktarım doğrulaması CSV ile tam çalışır.</p>'
          : "") +
        (b.fileName
          ? '<h4 class="h3" style="font-size:14px;margin-top:18px">Kolon eşleştirme</h4><div class="map-grid">' +
            mapHtml +
            "</div>" +
            preview
          : "") +
        (b.result
          ? '<div class="panel" style="margin-top:12px"><strong>' +
            esc(b.result.message) +
            "</strong><div class='muted'>Başarılı: " +
            b.result.ok +
            " · Hatalı: " +
            b.result.err +
            "</div></div>"
          : "") +
        '<div class="apply-actions"><button type="button" class="btn" data-action="download-template">Şablon İndir</button>' +
        '<button type="button" class="btn primary" data-action="import-bulk">İçe Aktar</button></div></div></div>'
      );
    }

    _renderInventoryModal() {
      var id = this._state.modal && this._state.modal.id;
      var item = id
        ? this._state.inventory.find(function (x) {
            return x.id === id;
          })
        : null;
      var v = item || {
        partName: "",
        partCode: "",
        oem: "",
        manufacturer: "",
        vehicles: "",
        category: "",
        quantity: 0,
        condition: "Yeni",
        unitPrice: 0,
        currency: "TRY",
        city: "",
        leadTime: "",
        active: true
      };
      return (
        '<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Parça düzenle">' +
        '<div class="modal-panel"><div class="panel-h"><h3 class="h3">' +
        (item ? "Parça düzenle" : "Yeni parça ekle") +
        '</h3><button type="button" class="btn sm" data-action="close-modal">Kapat</button></div>' +
        '<form id="pz-inv-form" data-id="' +
        esc(item ? item.id : "") +
        '"><div class="grid-2">' +
        this._formInput("partName", "Parça adı", v.partName) +
        this._formInput("partCode", "Parça kodu", v.partCode) +
        this._formInput("oem", "OEM kodu", v.oem) +
        this._formInput("manufacturer", "Üretici marka", v.manufacturer) +
        this._formInput("vehicles", "Uyumlu araçlar", v.vehicles) +
        this._formInput("category", "Kategori", v.category) +
        this._formInput("quantity", "Stok adedi", v.quantity) +
        '<div class="field"><label for="condition">Parça durumu</label><select id="condition" name="condition">' +
        ["Yeni", "Çıkma", "Revizyonlu"]
          .map(function (c) {
            return (
              '<option value="' +
              c +
              '" ' +
              (v.condition === c ? "selected" : "") +
              ">" +
              c +
              "</option>"
            );
          })
          .join("") +
        "</select></div>" +
        this._formInput("unitPrice", "Birim fiyat", v.unitPrice) +
        '<div class="field"><label for="currency">Para birimi</label><select id="currency" name="currency">' +
        ["TRY", "USD", "EUR"]
          .map(function (c) {
            return (
              '<option value="' +
              c +
              '" ' +
              (v.currency === c ? "selected" : "") +
              ">" +
              c +
              "</option>"
            );
          })
          .join("") +
        "</select></div>" +
        this._formInput("city", "Şehir", v.city) +
        this._formInput("leadTime", "Teslim süresi", v.leadTime) +
        '<div class="field"><label for="active">Aktif / pasif</label><select id="active" name="active">' +
        '<option value="true" ' +
        (v.active ? "selected" : "") +
        ">Aktif</option>" +
        '<option value="false" ' +
        (!v.active ? "selected" : "") +
        ">Pasif</option></select></div>" +
        '</div><button type="submit" class="btn primary">Kaydet</button></form></div></div>'
      );
    }
  }

  customElements.define("parca-zinciri-supplier-portal", ParcaZinciriSupplierPortal);
})();
