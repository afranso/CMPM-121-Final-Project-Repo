declare module "ammo.js" {
  // The package may export a factory function that initializes and returns the Ammo module,
  // or it may export the module directly. Use `any` here and provide a loader to handle both.
  const factory: any;
  export default factory;
}
