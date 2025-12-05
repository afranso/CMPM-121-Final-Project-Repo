import * as THREE from "three";

// Lightweight on-screen joystick used for touch controls.
class VirtualJoystick {
  private container: HTMLDivElement;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private touchId: number | null = null;
  private value = new THREE.Vector2();
  private readonly radius = 60;
  private startX = 0;
  private startY = 0;

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

    this.setupTouchListeners();
  }

  private setupTouchListeners() {
    // Use touchstart/touchmove/touchend instead of pointer events to avoid conflicts with mouse
    this.base.addEventListener("touchstart", (e: TouchEvent) => {
      if (this.touchId !== null || e.touches.length === 0) return;
      e.preventDefault();
      e.stopPropagation();

      const touch = e.touches[0];
      this.touchId = touch.identifier;
      const rect = this.base.getBoundingClientRect();
      this.startX = rect.left + rect.width / 2;
      this.startY = rect.top + rect.height / 2;
      this.updateValue(touch.clientX, touch.clientY);
    });

    this.base.addEventListener("touchmove", (e: TouchEvent) => {
      if (this.touchId === null) return;
      e.preventDefault();
      e.stopPropagation();

      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.identifier === this.touchId) {
          this.updateValue(touch.clientX, touch.clientY);
          break;
        }
      }
    });

    const endHandler = (e: TouchEvent) => {
      if (this.touchId === null) return;
      e.preventDefault();
      e.stopPropagation();

      // Check if our touch ended
      let touchEnded = true;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === this.touchId) {
          touchEnded = false;
          break;
        }
      }

      if (touchEnded) {
        this.reset();
      }
    };

    this.base.addEventListener("touchend", endHandler);
    this.base.addEventListener("touchcancel", endHandler);
  }

  private updateValue(clientX: number, clientY: number) {
    const dx = clientX - this.startX;
    const dy = clientY - this.startY;

    // Normalize to -1..1 range, invert Y so up is positive
    const nx = THREE.MathUtils.clamp(dx / this.radius, -1, 1);
    const ny = THREE.MathUtils.clamp(-dy / this.radius, -1, 1);
    this.value.set(nx, ny);

    // Move knob visually
    const len = Math.min(1, Math.hypot(nx, ny));
    const angle = Math.atan2(ny, nx);
    const knobX = this.radius + Math.cos(angle) * this.radius * len;
    const knobY = this.radius - Math.sin(angle) * this.radius * len;
    this.knob.style.left = `${knobX}px`;
    this.knob.style.top = `${knobY}px`;
  }

  private reset() {
    this.touchId = null;
    this.value.set(0, 0);
    this.knob.style.left = `${this.radius}px`;
    this.knob.style.top = `${this.radius}px`;
  }

  public getValue(): THREE.Vector2 {
    return this.value.clone();
  }

  public isActive(): boolean {
    return this.touchId !== null;
  }

  public dispose() {
    this.reset();
    this.container.remove();
  }
}

// Touch control manager - completely separate from mouse/keyboard
class TouchControls {
  private leftJoystick: VirtualJoystick;
  private rightJoystick: VirtualJoystick;
  private swipeTouchId: number | null = null;
  private swipeStartX = 0;
  private swipeStartY = 0;
  private swipeDelta = new THREE.Vector2();
  private lastTouchPos = new THREE.Vector2();

  constructor() {
    this.leftJoystick = new VirtualJoystick("left");
    this.rightJoystick = new VirtualJoystick("right");
    this.setupSwipeListeners();
  }

  private setupSwipeListeners() {
    // Handle touch swipes outside joysticks for camera control
    document.addEventListener("touchstart", (e: TouchEvent) => {
      if (this.swipeTouchId !== null) return;

      // Check if touch is on a joystick
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (this.isTouchOnJoystick(touch.clientX, touch.clientY)) {
          continue;
        }

        // Use this touch for swipe
        this.swipeTouchId = touch.identifier;
        this.swipeStartX = touch.clientX;
        this.swipeStartY = touch.clientY;
        this.lastTouchPos.x = (touch.clientX / globalThis.innerWidth) * 2 - 1;
        this.lastTouchPos.y = -(touch.clientY / globalThis.innerHeight) * 2 + 1;
        break;
      }
    });

    document.addEventListener("touchmove", (e: TouchEvent) => {
      if (this.swipeTouchId === null) return;

      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.identifier === this.swipeTouchId) {
          const deltaX = touch.clientX - this.swipeStartX;
          const deltaY = touch.clientY - this.swipeStartY;
          this.swipeDelta.x += deltaX;
          this.swipeDelta.y += deltaY;
          this.swipeStartX = touch.clientX;
          this.swipeStartY = touch.clientY;
          break;
        }
      }
    });

    const endSwipe = (e: TouchEvent) => {
      if (this.swipeTouchId === null) return;

      let touchEnded = true;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === this.swipeTouchId) {
          touchEnded = false;
          break;
        }
      }

      if (touchEnded) {
        this.swipeTouchId = null;
      }
    };

    document.addEventListener("touchend", endSwipe);
    document.addEventListener("touchcancel", endSwipe);
  }

  private isTouchOnJoystick(x: number, y: number): boolean {
    // Simple bounds check - joysticks are in bottom corners
    const joystickSize = 120;
    const padding = 24;

    // Left joystick: bottom-left
    if (
      x >= padding && x <= padding + joystickSize &&
      y >= globalThis.innerHeight - padding - joystickSize &&
      y <= globalThis.innerHeight - padding
    ) {
      return true;
    }

    // Right joystick: bottom-right
    if (
      x >= globalThis.innerWidth - padding - joystickSize &&
      x <= globalThis.innerWidth - padding &&
      y >= globalThis.innerHeight - padding - joystickSize &&
      y <= globalThis.innerHeight - padding
    ) {
      return true;
    }

    return false;
  }

  public getMovementVector(): THREE.Vector2 {
    return this.leftJoystick.getValue();
  }

  public getLookDelta(): THREE.Vector2 {
    const delta = new THREE.Vector2();

    // Right joystick for look
    const rightJoy = this.rightJoystick.getValue();
    if (rightJoy.lengthSq() > 0) {
      delta.x += rightJoy.x * 25;
      delta.y += rightJoy.y * 25;
    }

    // Swipe for look
    delta.x += this.swipeDelta.x;
    delta.y += this.swipeDelta.y;
    this.swipeDelta.set(0, 0);

    return delta;
  }

  public getLastTouchPosition(): THREE.Vector2 {
    return this.lastTouchPos.clone();
  }

  public dispose() {
    this.leftJoystick.dispose();
    this.rightJoystick.dispose();
  }
}

// Mouse/Keyboard control manager
class DesktopControls {
  private keys = new Set<string>();
  private mouseDelta = new THREE.Vector2();
  private mousePosition = new THREE.Vector2();
  private lastMousePosition = new THREE.Vector2();

  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      this.keys.add(e.key);

      // ESC unlocks pointer
      if (e.key === "Escape") {
        document.exitPointerLock?.();
      }
    });

    document.addEventListener("keyup", (e: KeyboardEvent) => {
      this.keys.delete(e.key);
    });

    document.addEventListener("mousedown", () => {
      // Request pointer lock on any mouse button
      if (!document.pointerLockElement) {
        document.body.requestPointerLock?.();
      }
    });

    document.addEventListener("mousemove", (e: MouseEvent) => {
      // Update normalized position for raycasting
      const newX = (e.clientX / globalThis.innerWidth) * 2 - 1;
      const newY = -(e.clientY / globalThis.innerHeight) * 2 + 1;
      this.mousePosition.set(newX, newY);

      // Use movement delta when pointer is locked
      if (document.pointerLockElement) {
        this.mouseDelta.x += e.movementX;
        this.mouseDelta.y += e.movementY;
      } else {
        // Fallback to position-based delta
        const posDeltaX = newX - this.lastMousePosition.x;
        const posDeltaY = newY - this.lastMousePosition.y;
        this.lastMousePosition.set(newX, newY);

        if (Math.abs(posDeltaX) > 0.001 || Math.abs(posDeltaY) > 0.001) {
          this.mouseDelta.x += posDeltaX * 100;
          this.mouseDelta.y += posDeltaY * 100;
        }
      }
    });

    document.addEventListener("contextmenu", (e: MouseEvent) => {
      e.preventDefault();
    });
  }

  public getMovementVector(): THREE.Vector2 {
    const moveZ = this.getAxis("s", "w") ||
      this.getAxis("ArrowDown", "ArrowUp");
    const moveX = this.getAxis("d", "a") ||
      this.getAxis("ArrowRight", "ArrowLeft");
    return new THREE.Vector2(moveX, -moveZ);
  }

  public getLookDelta(): THREE.Vector2 {
    const delta = this.mouseDelta.clone();
    this.mouseDelta.set(0, 0);
    return delta;
  }

  public getMousePosition(): THREE.Vector2 {
    return this.mousePosition.clone();
  }

  public isKeyDown(key: string): boolean {
    return this.keys.has(key);
  }

  public consumeKey(key: string): boolean {
    if (this.keys.has(key)) {
      this.keys.delete(key);
      return true;
    }
    return false;
  }

  private getAxis(positiveKey: string, negativeKey: string): number {
    return (this.keys.has(positiveKey) ? 1 : 0) -
      (this.keys.has(negativeKey) ? 1 : 0);
  }

  public clear() {
    this.keys.clear();
    this.mouseDelta.set(0, 0);
  }
}

// Main InputManager that coordinates both control schemes
export class InputManager {
  private desktopControls: DesktopControls;
  private touchControls: TouchControls;
  private interactRequested = false;

  constructor() {
    this.desktopControls = new DesktopControls();
    this.touchControls = new TouchControls();

    // Setup interaction triggers
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Spacebar" || e.key === "Space") {
        this.queueInteract();
      }
    });
  }

  public dispose() {
    this.touchControls.dispose();
  }

  // --- Public API ---

  public getMovementVector(): THREE.Vector2 {
    // Touch controls take priority if active
    const touchMove = this.touchControls.getMovementVector();
    if (touchMove.lengthSq() > 0.0001) {
      return touchMove;
    }

    // Fallback to keyboard
    return this.desktopControls.getMovementVector();
  }

  public getLookDelta(): THREE.Vector2 {
    // Combine both - touch and mouse won't both be active simultaneously
    const touchDelta = this.touchControls.getLookDelta();
    const mouseDelta = this.desktopControls.getLookDelta();
    return touchDelta.add(mouseDelta);
  }

  public getNormalizedMousePosition(): THREE.Vector2 {
    return this.desktopControls.getMousePosition();
  }

  public getLastTouchPosition(): THREE.Vector2 {
    return this.touchControls.getLastTouchPosition();
  }

  public isKeyDown(key: string): boolean {
    return this.desktopControls.isKeyDown(key);
  }

  public consumeKey(key: string): boolean {
    return this.desktopControls.consumeKey(key);
  }

  public queueInteract() {
    this.interactRequested = true;
  }

  public consumeInteractRequest(): boolean {
    const should = this.interactRequested;
    this.interactRequested = false;
    return should;
  }

  public clear() {
    this.desktopControls.clear();
    this.interactRequested = false;
  }

  // Kept for compatibility
  public getLastTouchDownPoint(): { clientX: number; clientY: number } | null {
    return null;
  }

  public clearTouchDownPoint(): void {
    // No-op for compatibility
  }
}
