import * as THREE from "three";
import AmmoPromise from "./ammoLoader.ts";

// Checking if three and ammo are initilalized properly
console.log(THREE.REVISION);

AmmoPromise.then((Ammo) => {
  console.log("Ammo initialized:", Ammo ? "ok" : "no ammo");
}).catch((err) => {
  console.error("Failed to initialize Ammo:", err);
});
