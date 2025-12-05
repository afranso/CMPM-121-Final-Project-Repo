export class UIManager {
  private overlay: HTMLDivElement;
  private messageBox: HTMLDivElement;
  private inventoryBox: HTMLDivElement;

  // NEW UI PANELS
  private topLeftBox: HTMLDivElement;
  private topRightBox: HTMLDivElement;
  private topCenterBox: HTMLDivElement;

  // optional bar text for bat strength
  private batBox: HTMLDivElement | null = null;

  private interactButton: HTMLButtonElement | null = null;
  private saveLoadButtons: HTMLDivElement | null = null;

  private isDarkMode = false;

  constructor() {
    // Detect theme preference
    this.detectTheme();
    this.overlay = document.createElement("div");
    this.overlay.className = "ui-overlay";

    this.messageBox = document.createElement("div");
    this.messageBox.className = "ui-message";

    this.inventoryBox = document.createElement("div");
    this.inventoryBox.className = "ui-inventory";

    // NEW — TOP LEFT OBJECTIVE TEXT
    this.topLeftBox = document.createElement("div");
    this.topLeftBox.className = "ui-top-left";
    this.topLeftBox.textContent = "";

    // NEW — TOP RIGHT CONTROL TEXT
    this.topRightBox = document.createElement("div");
    this.topRightBox.className = "ui-top-right";
    this.topRightBox.textContent = "";

    // NEW — TOP CENTER OBJECTIVE TEXT
    this.topCenterBox = document.createElement("div");
    this.topCenterBox.className = "ui-top-center";
    this.topCenterBox.textContent = "";

    // APPEND ALL ELEMENTS
    this.overlay.appendChild(this.messageBox);
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.inventoryBox);
    document.body.appendChild(this.topLeftBox);
    document.body.appendChild(this.topRightBox);
    document.body.appendChild(this.topCenterBox);

    this.updateInventory([]);
  }

  // TOP LEFT OBJECTIVE — NEW
  public showTopLeft(text: string) {
    this.topLeftBox.textContent = text;
  }

  // TOP RIGHT CONTROLS — NEW
  public showTopRight(text: string) {
    this.topRightBox.textContent = text;
  }

  // TOP CENTER OBJECTIVE — NEW
  public showTopCenter(text: string) {
    this.topCenterBox.textContent = text;
  }

  // Show standard game controls (reusable across all scenes)
  public showStandardControls() {
    this.topLeftBox.textContent =
      "CONTROLS\n[MOVE]: WASD / Arrows / Left Joystick\n[LOOK]: Mouse / Right Joystick\n[ACTION]: Spacebar / Onscreen button\n(Mouse) - Click to lock, ESC to unlock.";
  }

  // Create save/load buttons UI with event handlers
  public createSaveLoadButtons(
    onSave: () => void,
    onLoad: () => void,
    onNewGame: () => void,
  ): HTMLDivElement {
    if (this.saveLoadButtons) return this.saveLoadButtons;

    const div = document.createElement("div");
    div.className = "ui-save-instructions";

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "save-button-container";

    const saveBtn = document.createElement("button");
    saveBtn.className = "quick-save-btn";
    saveBtn.textContent = "💾 Save";
    saveBtn.addEventListener("click", onSave);

    const loadBtn = document.createElement("button");
    loadBtn.className = "quick-load-btn";
    loadBtn.textContent = "📂 Load";
    loadBtn.addEventListener("click", onLoad);

    const newGameBtn = document.createElement("button");
    newGameBtn.className = "new-game-btn";
    newGameBtn.textContent = "🔄 New Game";
    newGameBtn.addEventListener("click", onNewGame);

    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(loadBtn);
    buttonContainer.appendChild(newGameBtn);
    div.appendChild(buttonContainer);

    document.body.appendChild(div);
    this.saveLoadButtons = div;
    return div;
  }

  // Add save/load instructions to controls
  public addSaveLoadInstructions() {
    // No longer adding F5/F9 instructions
  }

  // On-screen interaction button for touch users.
  public createInteractButton(onPress: () => void): HTMLButtonElement {
    if (this.interactButton) return this.interactButton;
    const btn = document.createElement("button");
    btn.className = "ui-interact-btn";
    btn.textContent = "[SPACE]";
    btn.addEventListener("click", () => onPress());
    document.body.appendChild(btn);
    this.interactButton = btn;
    return btn;
  }

  public showMessage(text: string, duration = 2000) {
    this.messageBox.textContent = text;
    this.messageBox.style.display = "block";
    setTimeout(() => (this.messageBox.style.display = "none"), duration);
  }

  public updateInventory(items: string[]) {
    if (items.length === 0) {
      this.inventoryBox.innerHTML = "Inventory: (Empty)";
    } else {
      const itemStr = items
        .map((i) => `<span class="inventory-item">${i}</span>`)
        .join(", ");
      this.inventoryBox.innerHTML = `Inventory: [${itemStr}]`;
    }
  }

  // OPTIONAL BAT STRENGTH DISPLAY — USED BY LEVEL CODE
  public setBatStrength(strength: number) {
    if (!this.batBox) {
      this.batBox = document.createElement("div");
      this.batBox.className = "ui-bat";
      document.body.appendChild(this.batBox);
    }
    this.batBox.textContent = `Bat: ${Math.floor(strength)}%`;
  }

  private detectTheme() {
    const darkModeQuery = globalThis.matchMedia?.(
      "(prefers-color-scheme: dark)",
    );
    this.isDarkMode = darkModeQuery?.matches ?? false;

    // Listen for theme changes
    darkModeQuery?.addEventListener("change", (e: MediaQueryListEvent) => {
      this.isDarkMode = e.matches;
    });
  }

  public isDark(): boolean {
    return this.isDarkMode;
  }

  public dispose() {
    this.overlay.remove();
    this.inventoryBox.remove();
    this.topLeftBox.remove();
    this.topRightBox.remove();
    this.batBox?.remove();
    this.interactButton?.remove();
  }

  public showOverlay(title: string, message: string) {
    const overlay = document.createElement("div");
    overlay.id = "game-over-overlay";

    const h1 = document.createElement("h1");
    h1.textContent = title;

    const pMessage = document.createElement("p");
    pMessage.textContent = message;

    const pSub = document.createElement("p");
    pSub.className = "subtle";
    pSub.textContent = "Refresh to play again";

    overlay.append(h1, pMessage, pSub);
    document.body.appendChild(overlay);
  }
}
