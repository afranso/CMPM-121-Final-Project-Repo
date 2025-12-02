import * as THREE from "three";

export class InputManager {
  private keys: Set<string> = new Set();
  private mouseDelta = new THREE.Vector2();
  private _isRightMouseDown = false;
  private _mousePosition = new THREE.Vector2();

  private _handlers: Record<string, (e: Event) => void> = {};

  constructor() {
    this.setupHandlers();
    this.attach();
  }

  private setupHandlers() {
    this._handlers = {
      keydown: (e: Event) => this.keys.add((e as KeyboardEvent).key),
      keyup: (e: Event) => this.keys.delete((e as KeyboardEvent).key),
      mousedown: (e: Event) => {
        const me = e as MouseEvent;
        if (me.button === 2) this._isRightMouseDown = true;
      },
      mouseup: (e: Event) => {
        const me = e as MouseEvent;
        if (me.button === 2) this._isRightMouseDown = false;
      },
      mousemove: (e: Event) => {
        const me = e as MouseEvent;
        // Track raw position for raycasting
        this._mousePosition.x = (me.clientX / globalThis.innerWidth) * 2 - 1;
        this._mousePosition.y = -(me.clientY / globalThis.innerHeight) * 2 + 1;

        // Track delta for camera movement
        if (this._isRightMouseDown) {
          this.mouseDelta.x += me.movementX;
          this.mouseDelta.y += me.movementY;
        }
      },
      contextmenu: (e: Event) => (e as MouseEvent).preventDefault(),
    };
  }

  private attach() {
    Object.entries(this._handlers).forEach(([evt, handler]) => {
      globalThis.addEventListener(evt, handler);
    });
  }

  public dispose() {
    Object.entries(this._handlers).forEach(([evt, handler]) => {
      globalThis.removeEventListener(evt, handler);
    });
  }

  // --- Public API ---

  public getMouseDelta(): THREE.Vector2 {
    const delta = this.mouseDelta.clone();
    this.mouseDelta.set(0, 0); // Reset after reading
    return delta;
  }

  public getNormalizedMousePosition(): THREE.Vector2 {
    return this._mousePosition.clone();
  }

  public isKeyDown(key: string): boolean {
    return this.keys.has(key);
  }

  // Helper to get -1 to 1 value for movement axes
  public getAxis(positiveKey: string, negativeKey: string): number {
    return (this.keys.has(positiveKey) ? 1 : 0) -
      (this.keys.has(negativeKey) ? 1 : 0);
  }

  public consumeKey(key: string): boolean {
    if (this.keys.has(key)) {
      this.keys.delete(key);
      return true;
    }
    return false;
  }
}
