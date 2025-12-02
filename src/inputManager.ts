import * as THREE from "three";

export class InputManager {
  public keys: { [key: string]: boolean } = {};
  public mouseDelta = new THREE.Vector2();
  public isRightMouseDown = false;

  private _onKeyDown: (e: KeyboardEvent) => void;
  private _onKeyUp: (e: KeyboardEvent) => void;
  private _onMouseDown: (e: MouseEvent) => void;
  private _onMouseUp: (e: MouseEvent) => void;
  private _onMouseMove: (e: MouseEvent) => void;
  private _onContextMenu: (e: MouseEvent) => void;

  constructor() {
    this._onKeyDown = (e) => (this.keys[e.key] = true);
    this._onKeyUp = (e) => (this.keys[e.key] = false);

    this._onMouseDown = (e) => {
      if (e.button === 2) this.isRightMouseDown = true;
    };

    this._onMouseUp = (e) => {
      if (e.button === 2) this.isRightMouseDown = false;
    };

    this._onMouseMove = (e) => {
      if (this.isRightMouseDown) {
        this.mouseDelta.x += e.movementX;
        this.mouseDelta.y += e.movementY;
      }
    };

    this._onContextMenu = (e) => e.preventDefault();

    this.attach();
  }

  private attach() {
    globalThis.addEventListener("keydown", this._onKeyDown);
    globalThis.addEventListener("keyup", this._onKeyUp);
    globalThis.addEventListener("mousedown", this._onMouseDown);
    globalThis.addEventListener("mouseup", this._onMouseUp);
    globalThis.addEventListener("mousemove", this._onMouseMove);
    globalThis.addEventListener("contextmenu", this._onContextMenu);
  }

  public dispose() {
    globalThis.removeEventListener("keydown", this._onKeyDown);
    globalThis.removeEventListener("keyup", this._onKeyUp);
    globalThis.removeEventListener("mousedown", this._onMouseDown);
    globalThis.removeEventListener("mouseup", this._onMouseUp);
    globalThis.removeEventListener("mousemove", this._onMouseMove);
    globalThis.removeEventListener("contextmenu", this._onContextMenu);
  }

  // Helper to get normalized mouse coordinates for raycasting
  public getNormalizedMouseCoordinates(
    clientX: number,
    clientY: number,
  ): THREE.Vector2 {
    return new THREE.Vector2(
      (clientX / globalThis.innerWidth) * 2 - 1,
      -(clientY / globalThis.innerHeight) * 2 + 1,
    );
  }
}
