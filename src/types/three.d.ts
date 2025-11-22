// deno-lint-ignore-file no-explicit-any

declare module "three" {
  // Minimal, permissive declarations so Deno's checker won't attempt to
  // fetch remote types from esm.sh during `deno check`.
  // Replace `any` with stronger types if you want better checking later.
  namespace THREE {
    export type Mesh = any;
    export type Object3D = any;
    export type Vector3 = any;
    export type Vector2 = any;
    export type Scene = any;
    export type Camera = any;
    export type PerspectiveCamera = any;
    export type WebGLRenderer = any;
    export type Clock = any;
    export type Spherical = any;
    export type Color = any;
    export type Geometry = any;
    export type BufferGeometry = any;
    export type Material = any;
    export type MeshStandardMaterial = any;
    export type BoxGeometry = any;
    export type SphereGeometry = any;
    export type PlaneGeometry = any;
    export type LineSegments = any;
    export type EdgesGeometry = any;
    export type LineBasicMaterial = any;
    export type Raycaster = any;
    export type Plane = any;
    export type Group = any;
    export type Math = any;
  }

  const THREE: any;
  export = THREE;
}
