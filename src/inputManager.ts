import * as THREE from "three";

// Lightweight on-screen joystick used for touch controls.
class VirtualJoystick {
  private container: HTMLDivElement;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private pointerId: number | null = null;
  private value = new THREE.Vector2();
  private readonly radius = 60; // visual radius (px)

  constructor(position: "left" | "right") {
    this.container = document.createElement("div");
    this.container.className = `joystick-container ${position}`;

    this.base = document.createElement("div");
    this.base.className = "joystick-base";

    this.knob = document.createElement("div");
    this.knob.className = "joystick-knob";

    this.base.appendChild(this.knob);
    this.container.appendChild(this.base);
    document.body.appendChild(this.container);

    // Prevent joystick touches from interacting with the world.
    const stopEvent = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    this.base.addEventListener("pointerdown", (e) => {
      if (this.pointerId !== null) return;
      this.pointerId = (e as PointerEvent).pointerId;
      this.base.setPointerCapture(this.pointerId);
      stopEvent(e);
      this.updateValue(e as PointerEvent);
    });

    this.base.addEventListener("pointermove", (e) => {
      if (this.pointerId !== (e as PointerEvent).pointerId) return;
      stopEvent(e);
      this.updateValue(e as PointerEvent);
    });

    const reset = (e: Event) => {
      const pe = e as PointerEvent;
      if (this.pointerId !== pe.pointerId) return;
      stopEvent(e);
      this.pointerId = null;
      this.value.set(0, 0);
      this.knob.style.left = `${this.radius}px`;
      this.knob.style.top = `${this.radius}px`;
    };

    this.base.addEventListener("pointerup", reset);
    this.base.addEventListener("pointercancel", reset);
    this.base.addEventListener("pointerleave", reset);
  }

  private updateValue(e: PointerEvent) {
    const rect = this.base.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);

    // Normalize to -1..1 range, invert Y so up is positive.
    const nx = THREE.MathUtils.clamp(dx / this.radius, -1, 1);
    const ny = THREE.MathUtils.clamp(-dy / this.radius, -1, 1);
    this.value.set(nx, ny);

    // Move knob visually within circle bounds.
    const len = Math.min(1, Math.hypot(nx, ny));
    const angle = Math.atan2(ny, nx);
    const knobX = this.radius + Math.cos(angle) * this.radius * len;
    const knobY = this.radius - Math.sin(angle) * this.radius * len;
    this.knob.style.left = `${knobX}px`;
    this.knob.style.top = `${knobY}px`;
  }

  public getValue(): THREE.Vector2 {
    return this.value.clone();
  }

  public isPointInside(clientX: number, clientY: number): boolean {
    const rect = this.base.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right &&
      clientY >= rect.top && clientY <= rect.bottom;
  }

  public dispose() {
    this.container.remove();
  }
}

export class InputManager {
  private keys: Set<string> = new Set();
  private mouseDelta = new THREE.Vector2();
  private _isRightMouseDown = false;
  private _mousePosition = new THREE.Vector2();
  private _lastTouchPosition = new THREE.Vector2();

  private readonly leftJoystick = new VirtualJoystick("left");
  private readonly rightJoystick = new VirtualJoystick("right");

  private _handlers: Record<string, (e: Event) => void> = {};
  private _lastTouchDown: { clientX: number; clientY: number } | null = null;

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
        this._lastTouchPosition.set(
          this._mousePosition.x,
          this._mousePosition.y,
        );

        // Track delta for camera movement
        if (this._isRightMouseDown) {
          this.mouseDelta.x += me.movementX;
          this.mouseDelta.y += me.movementY;
        }
      },
      pointerdown: (e: Event) => {
        const pe = e as PointerEvent;
        // Check if this is a touch or joystick event
        if (!this.isTouchOnJoystick(pe.clientX, pe.clientY)) {
          // Store the touch point for later use
          this._lastTouchDown = { clientX: pe.clientX, clientY: pe.clientY };
        }
        // Track touch position for interactions
        this._lastTouchPosition.x = (pe.clientX / globalThis.innerWidth) * 2 -
          1;
        this._lastTouchPosition.y = -(pe.clientY / globalThis.innerHeight) * 2 +
          1;
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
    this.leftJoystick.dispose();
    this.rightJoystick.dispose();
  }

  // --- Public API ---

  public getLookDelta(): THREE.Vector2 {
    const delta = this.mouseDelta.clone();
    this.mouseDelta.set(0, 0); // Reset after reading

    // Add right joystick contribution for touch look.
    const joy = this.rightJoystick.getValue();
    if (joy.lengthSq() > 0) {
      delta.x += joy.x * 25; // scale to match mouse sensitivity
      delta.y -= joy.y * 25;
    }
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

  public getMovementVector(): THREE.Vector2 {
    // Joystick has priority; falls back to keyboard for desktop play.
    const joy = this.leftJoystick.getValue();
    if (joy.lengthSq() > 0.0001) return joy.clone();

    const moveZ = this.getAxis("s", "w") ||
      this.getAxis("ArrowDown", "ArrowUp");
    const moveX = this.getAxis("d", "a") ||
      this.getAxis("ArrowRight", "ArrowLeft");
    return new THREE.Vector2(moveX, -moveZ); // y positive means forward like joystick
  }

  public consumeKey(key: string): boolean {
    if (this.keys.has(key)) {
      this.keys.delete(key);
      return true;
    }
    return false;
  }

  // Clears transient input state (used on level reset/game over).
  public clear() {
    this.keys.clear();
    this.mouseDelta.set(0, 0);
  }

  // Check if a screen coordinate is within joystick bounds
  public isTouchOnJoystick(clientX: number, clientY: number): boolean {
    return this.leftJoystick.isPointInside(clientX, clientY) ||
      this.rightJoystick.isPointInside(clientX, clientY);
  }

  // Get the last touch/pointer position for cursor placement
  public getLastTouchPosition(): THREE.Vector2 {
    return this._lastTouchPosition.clone();
  }

  // Get the touch down position (screen coordinates) for marker placement
  public getLastTouchDownPoint(): { clientX: number; clientY: number } | null {
    return this._lastTouchDown;
  }

  // Clear the touch down point after handling it
  public clearTouchDownPoint(): void {
    this._lastTouchDown = null;
  }
}
