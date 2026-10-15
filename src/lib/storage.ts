// Prototype storage: localStorage for the farm profile, IndexedDB for crop records.
export type Farm = { name: string; owner: string; hectares: number; lat?: number; lon?: number; locationName: string };
export type Crop = {
  id: string; name: string; variety: string; stage: string; plantedOn: string; area: number;
  expectedYield: number; targetMarket: string; price: number; notes: string;
};

const FARM_KEY = "agri.farm";
export const emptyFarm: Farm = { name: "", owner: "", hectares: 0, locationName: "" };
export function loadFarm(): Farm {
  try { return { ...emptyFarm, ...JSON.parse(localStorage.getItem(FARM_KEY) || "{}") }; } catch { return emptyFarm; }
}
export function saveFarm(f: Farm) { localStorage.setItem(FARM_KEY, JSON.stringify(f)); }

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open("agri", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("crops", { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const req = fn(d.transaction("crops", mode).objectStore("crops"));
    req.onsuccess = () => res(req.result as T);
    req.onerror = () => rej(req.error);
  });
}
export const listCrops = () => tx<Crop[]>("readonly", (s) => s.getAll());
export const putCrop = (c: Crop) => tx("readwrite", (s) => s.put(c));
export const deleteCrop = (id: string) => tx("readwrite", (s) => s.delete(id));
