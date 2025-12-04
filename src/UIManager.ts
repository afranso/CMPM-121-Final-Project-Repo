export class UIManager {
  private overlay: HTMLDivElement;
  private messageBox: HTMLDivElement;
  private inventoryBox: HTMLDivElement;

  // NEW UI PANELS
  private topLeftBox: HTMLDivElement;
  private topRightBox: HTMLDivElement;

  // optional bar text for bat strength
  private batBox: HTMLDivElement | null = null;

  constructor() {
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = `
      position: fixed; left: 0; top: 0; width: 100%; height: 100%;
      display: flex; align-items: flex-start; justify-content: center;
      pointer-events: none; z-index: 10;
    `;

    this.messageBox = document.createElement("div");
    this.messageBox.style.cssText = `
      margin-top: 10vh; padding: 24px 36px; background: rgba(0,0,0,0.8);
      color: white; font-family: sans-serif; font-size: 28px;
      border-radius: 8px; display: none;
    `;

    this.inventoryBox = document.createElement("div");
    this.inventoryBox.style.cssText = `
      position: fixed; right: 20px; bottom: 20px; padding: 10px;
      background: rgba(0,0,0,0.6); color: white; border-radius: 8px;
      font-family: sans-serif; font-size: 18px; min-width: 150px;
      text-align: center; z-index: 10;
    `;

    // NEW — TOP LEFT OBJECTIVE TEXT
    this.topLeftBox = document.createElement("div");
    this.topLeftBox.style.cssText = `
      position: fixed; left: 20px; top: 20px; padding: 10px 14px;
      background: rgba(0,0,0,0.5); color: white; border-radius: 6px;
      font-family: sans-serif; font-size: 18px;
      white-space: pre-line; z-index: 10;
    `;
    this.topLeftBox.textContent = "";

    // NEW — TOP RIGHT CONTROL TEXT
    this.topRightBox = document.createElement("div");
    this.topRightBox.style.cssText = `
      position: fixed; right: 20px; top: 20px; padding: 10px 14px;
      background: rgba(0,0,0,0.5); color: white; border-radius: 6px;
      font-family: sans-serif; font-size: 18px;
      white-space: pre-line; text-align: right; z-index: 10;
    `;
    this.topRightBox.textContent = "";

    // APPEND ALL ELEMENTS
    this.overlay.appendChild(this.messageBox);
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.inventoryBox);
    document.body.appendChild(this.topLeftBox);
    document.body.appendChild(this.topRightBox);

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
        .map((i) => `<span style="color: yellow;">${i}</span>`)
        .join(", ");
      this.inventoryBox.innerHTML = `Inventory: [${itemStr}]`;
    }
  }

  // OPTIONAL BAT STRENGTH DISPLAY — USED BY LEVEL CODE
  public setBatStrength(strength: number) {
    if (!this.batBox) {
      this.batBox = document.createElement("div");
      this.batBox.style.cssText = `
        position: fixed; right: 20px; bottom: 70px; padding: 10px 14px;
        background: rgba(0,0,0,0.6); color: white; border-radius: 8px;
        font-family: sans-serif; font-size: 18px;
        z-index: 10; min-width: 120px; text-align: center;
      `;
      document.body.appendChild(this.batBox);
    }
    this.batBox.textContent = `Bat: ${Math.floor(strength)}%`;
  }

  public dispose() {
    this.overlay.remove();
    this.inventoryBox.remove();
    this.topLeftBox.remove();
    this.topRightBox.remove();
    this.batBox?.remove();
  }

  public showOverlay(title: string, message: string) {
    const overlay = document.createElement("div");
    overlay.id = "game-over-overlay";
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    overlay.style.color = "white";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.fontSize = "32px";
    overlay.style.zIndex = "1000";
    overlay.style.textAlign = "center";
    overlay.innerHTML = `
      <h1>${title}</h1>
      <p style="font-size: 24px; color: #aaa;">${message}</p>
      <p style="font-size: 18px; color: #888;">Refresh to play again</p>
    `;
    document.body.appendChild(overlay);
  }
}
