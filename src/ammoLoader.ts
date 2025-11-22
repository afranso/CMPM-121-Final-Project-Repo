// Tell Deno where to find the TypeScript declaration for this npm package
// so `deno check` can resolve module types.
import AmmoFactory from "https://cdn.jsdelivr.net/gh/kripken/ammo.js@master/builds/ammo.wasm.js";

type AmmoInitializer = (...args: unknown[]) => Promise<unknown> | unknown;

async function initAmmo(): Promise<unknown> {
  const mod = AmmoFactory as unknown;

  // If the package export is a factory function, call it to initialize (WASM)
  if (typeof mod === "function") {
    return await (mod as AmmoInitializer)();
  }

  // If the package export is an object with a `default` factory, call that.
  const modObj = mod as { default?: AmmoInitializer } | unknown;
  if (
    modObj && typeof (modObj as { default?: unknown }).default === "function"
  ) {
    return await (modObj as { default: AmmoInitializer }).default();
  }

  // Otherwise return the raw export (could already be initialized).
  return mod;
}

const AmmoPromise: Promise<unknown> = initAmmo();

export default AmmoPromise;
