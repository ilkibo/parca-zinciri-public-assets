let database;
async function db() {
  if (database) return database;
  database = await new Promise((resolve, reject) => {
    const req = indexedDB.open("pz-mobile-drafts", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("drafts");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return database;
}
async function transaction(mode, action) {
  const connection = await db();
  return new Promise((resolve, reject) => {
    const tx = connection.transaction("drafts", mode);
    const request = action(tx.objectStore("drafts"));
    let result;
    request.onsuccess = () => {
      result = request.result;
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new Error("Cihaz kaydı tamamlanamadı."));
  });
}
export const loadDraft = (key) =>
  transaction("readonly", (store) => store.get(key));
export const saveDraft = (key, value) =>
  transaction("readwrite", (store) => store.put(value, key));
export const clearDraft = (key) =>
  transaction("readwrite", (store) => store.delete(key));
