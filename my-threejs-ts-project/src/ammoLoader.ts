import AmmoFactory from "ammo.js";

const initAmmo = async (): Promise<any> => {
  // The `ammo.js` package can export either a factory function or the module itself.
  // Handle both cases: if it's callable, call it to initialize (WASM), otherwise return the export.
  try {
    const mod = AmmoFactory as any;
    if (typeof mod === "function") {
      return await mod();
    }
    if (mod && typeof mod.default === "function") {
      return await mod.default();
    }
    return mod;
  } catch (err) {
    // rethrow to let callers handle errors
    throw err;
  }
};

const AmmoPromise: Promise<any> = initAmmo();

export default AmmoPromise;
