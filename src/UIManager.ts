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
