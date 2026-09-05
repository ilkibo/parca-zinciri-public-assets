export const machineTypes = {
  excavator: "Ekskavatör",
  wheel_loader: "Loader",
  telehandler: "Telehandler",
  forklift: "Forklift",
  backhoe_loader: "Beko Loder",
  road_roller: "Yol Silindiri",
  heavy_offroad_truck: "Ağır yük off-road kamyonu",
};
export const conditions = {
  new_unboxed: "Sıfır, kutusuz",
  new_boxed: "Sıfır, kutulu",
  used_good: "Kullanılmış, iyi durumda",
  repaired_working_good: "Tamir edilmiş, çalışır durumda",
};
export const equipmentTypes = {
  engine: "Motor",
  transmission: "Şanzıman",
  front_differential: "Ön diferansiyel",
  rear_differential: "Arka diferansiyel",
  operator_cabin: "Operatör kabini",
  chassis: "Şase",
  hydraulic_cylinder: "Hidrolik silindir",
};
export const states = {
  pending: "Onay bekliyor",
  approved: "Onaylandı",
  draft: "Taslak",
  rejected: "Düzenleme gerekli",
  archived: "Arşivlendi",
};
export const imageTypes = ["image/jpeg", "image/png", "image/webp"];
export const videoTypes = ["video/mp4", "video/quicktime", "video/webm"];
export function validateProduct(input, media = []) {
  const out = {};
  function fail(field, message) {
    const e = new Error(message);
    e.field = field;
    e.status = 400;
    throw e;
  }
  function str(field, required = true, max = 200) {
    const value = String(input[field] ?? "").trim();
    if (required && !value) fail(field, "Bu alanı doldurun.");
    if (value.length > max) fail(field, "Bu alan çok uzun.");
    out[field] = value;
    return value;
  }
  function choice(field, choices) {
    const v = str(field);
    if (!choices.includes(v)) fail(field, "Geçerli bir seçenek belirleyin.");
    return v;
  }
  choice("listingType", ["part", "equipment", "machine"]);
  choice("machineType", Object.keys(machineTypes));
  str("machineBrandName");
  str("machineModelName");
  str("machineSerialNumber", true, 80);
  for (const k of [
    "machineBrandId",
    "machineModelId",
    "manualBrandName",
    "manualModelName",
  ])
    str(k, false);
  out.stockQuantity = Number(input.stockQuantity);
  if (!Number.isSafeInteger(out.stockQuantity) || out.stockQuantity < 1)
    fail("stockQuantity", "Stok adedi pozitif tam sayı olmalı.");
  const p = String(input.priceEur ?? "").trim();
  if (!/^\d+([.,]\d{1,2})?$/.test(p) || !(Number(p.replace(",", ".")) > 0))
    fail("priceEur", "Sıfırdan büyük bir EUR fiyatı girin.");
  out.priceEur = Number(p.replace(",", "."));
  out.currency = "EUR";
  out.productCodeUnknown = input.productCodeUnknown === true;
  const code = str("productCode", !out.productCodeUnknown, 80);
  if (out.productCodeUnknown && code)
    fail("productCode", "Diğer seçiliyken ürün kodu girilemez.");
  if (/^(diğer|diger)$/i.test(code))
    fail("productCode", "Kodunuz yoksa Diğer kutusunu kullanın.");
  if (/[<>]|https?:\/\/|@/i.test(code))
    fail("productCode", "Mevcut ürün kodunu kontrol edin.");
  // No fallback to a supplier SKU, serial number, title or generated identifier.
  if (input.listingType === "part") {
    str("partName");
    choice("partOriginType", ["original", "aftermarket"]);
    choice("partCondition", Object.keys(conditions));
    out.oemUnknown = input.oemUnknown === true;
    const oem = str("oem", !out.oemUnknown, 80);
    if (out.oemUnknown && oem)
      fail("oem", "OEM bilinmiyor seçiliyken OEM girilemez.");
    if (
      oem &&
      (/[<>@]|https?:\/\//i.test(oem) ||
        oem.split(/\s+/).length > 3 ||
        oem.replace(/[^a-z0-9]/gi, "").length < 3 ||
        oem.replace(/[^a-z0-9]/gi, "").length > 40)
    )
      fail("oem", "OEM / referans numarasını kontrol edin.");
    out.title = out.partName;
  } else if (input.listingType === "equipment") {
    choice("equipmentType", Object.keys(equipmentTypes));
    choice("equipmentCondition", ["new_original", "original_reconditioned"]);
    str(
      "equipmentWorkDescription",
      input.equipmentCondition === "original_reconditioned",
      8000,
    );
    out.title =
      equipmentTypes[out.equipmentType] +
      " · " +
      out.machineBrandName +
      " " +
      out.machineModelName;
  } else {
    out.modelYear = Number(input.modelYear);
    if (
      !Number.isInteger(out.modelYear) ||
      out.modelYear < 1900 ||
      out.modelYear > new Date().getFullYear()
    )
      fail("modelYear", "Geçerli bir model yılı girin.");
    str("machineModificationSummary", true, 8000);
    out.title =
      machineTypes[out.machineType] +
      " · " +
      out.machineBrandName +
      " " +
      out.machineModelName;
  }
  str("description", false, 4000);
  const images = media.filter((x) => imageTypes.includes(x.mime));
  const videos = media.filter((x) => videoTypes.includes(x.mime));
  if (images.length < 1 || images.length > 6)
    fail("media", "1–6 fotoğraf ekleyin.");
  if (videos.length > 1 || images.length + videos.length !== media.length)
    fail("media", "En fazla bir video ve desteklenen fotoğrafları ekleyin.");
  if (
    media.some(
      (x) =>
        x.size <= 0 ||
        x.size > (imageTypes.includes(x.mime) ? 10 : 50) * 1024 * 1024,
    )
  )
    fail("media", "Fotoğraf en fazla 10 MB, video 50 MB olabilir.");
  return out;
}
