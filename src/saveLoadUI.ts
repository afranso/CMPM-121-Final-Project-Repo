import { SaveManager, SaveSlot } from "./saveManager.ts";

export class SaveLoadUI {
  private overlay: HTMLDivElement;
  private saveManager: SaveManager;
  private onLoadCallback: ((slotId: number) => void) | null = null;
  private onSaveCallback: ((slotId: number) => void) | null = null;

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager;
    this.overlay = document.createElement("div");
    this.overlay.className = "save-load-overlay";
    this.overlay.style.display = "none";
    document.body.appendChild(this.overlay);
  }

  /**
   * Set callback for when a save is loaded
   */
  public setLoadCallback(callback: (slotId: number) => void): void {
    this.onLoadCallback = callback;
  }

  /**
   * Set callback for when a save is performed
   */
  public setSaveCallback(callback: (slotId: number) => void): void {
    this.onSaveCallback = callback;
  }

  /**
   * Show the save/load menu
   */
  public show(mode: "save" | "load"): void {
    this.overlay.innerHTML = "";
    this.overlay.style.display = "flex";

    const panel = document.createElement("div");
    panel.className = "save-load-panel";

    const title = document.createElement("h2");
    title.textContent = mode === "save" ? "Save Game" : "Load Game";
    panel.appendChild(title);

    const slotsContainer = document.createElement("div");
    slotsContainer.className = "slots-container";

    const saves = this.saveManager.getAllSaves();

    // Create slots 0-4 (0 is auto-save, 1-4 are manual saves)
    for (let i = 0; i < 5; i++) {
      const slotDiv = this.createSlotDiv(i, saves[i], mode);
      slotsContainer.appendChild(slotDiv);
    }

    panel.appendChild(slotsContainer);

    const closeButton = document.createElement("button");
    closeButton.className = "save-load-button close-button";
    closeButton.textContent = "Close";
    closeButton.onclick = () => this.hide();
    panel.appendChild(closeButton);

    this.overlay.appendChild(panel);
  }

  /**
   * Create a slot div element
   */
  private createSlotDiv(
    slotId: number,
    slot: SaveSlot | undefined,
    mode: "save" | "load",
  ): HTMLDivElement {
    const slotDiv = document.createElement("div");
    slotDiv.className = "save-slot";

    const slotHeader = document.createElement("div");
    slotHeader.className = "slot-header";

    const slotTitle = document.createElement("div");
    slotTitle.className = "slot-title";
    slotTitle.textContent = slotId === 0
      ? "🔄 Auto Save"
      : `💾 Save Slot ${slotId}`;
    slotHeader.appendChild(slotTitle);

    const slotInfo = document.createElement("div");
    slotInfo.className = "slot-info";

    if (slot) {
      const date = new Date(slot.timestamp);
      slotInfo.innerHTML = `
        <div class="slot-date">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</div>
        <div class="slot-details">
          Bats: ${slot.gameState.batsCollected}/3 | 
          Items: ${slot.gameState.inventory.length}
        </div>
      `;
    } else {
      slotInfo.innerHTML = '<div class="slot-empty">Empty Slot</div>';
    }

    slotDiv.appendChild(slotHeader);
    slotDiv.appendChild(slotInfo);

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "slot-buttons";

    if (mode === "load") {
      if (slot) {
        const loadButton = document.createElement("button");
        loadButton.className = "save-load-button load-button";
        loadButton.textContent = "Load";
        loadButton.onclick = () => {
          if (this.onLoadCallback) {
            this.onLoadCallback(slotId);
            this.hide();
            this.showFeedback(`Loaded save from slot ${slotId}!`);
          }
        };
        buttonContainer.appendChild(loadButton);
      }
    } else {
      // Save mode - only allow saving to slots 1-4 (not auto-save slot 0)
      if (slotId > 0) {
        const saveButton = document.createElement("button");
        saveButton.className = "save-load-button save-button";
        saveButton.textContent = slot ? "Overwrite" : "Save";
        saveButton.onclick = () => {
          if (this.onSaveCallback) {
            this.onSaveCallback(slotId);
            this.showFeedback(`Game saved to slot ${slotId}!`);
            setTimeout(() => this.show("save"), 500); // Refresh the display after feedback
          }
        };
        buttonContainer.appendChild(saveButton);

        if (slot) {
          const deleteButton = document.createElement("button");
          deleteButton.className = "save-load-button delete-button";
          deleteButton.textContent = "Delete";
          deleteButton.onclick = () => {
            if (confirm(`Delete save slot ${slotId}?`)) {
              this.saveManager.deleteSave(slotId);
              this.show("save"); // Refresh the display
            }
          };
          buttonContainer.appendChild(deleteButton);
        }
      } else {
        // Auto-save slot info
        const autoInfo = document.createElement("span");
        autoInfo.className = "auto-save-info";
        autoInfo.textContent = "Auto-saved every 30s";
        buttonContainer.appendChild(autoInfo);
      }
    }

    slotDiv.appendChild(buttonContainer);
    return slotDiv;
  }

  /**
   * Hide the save/load menu
   */
  public hide(): void {
    this.overlay.style.display = "none";
  }

  /**
   * Show feedback message
   */
  private showFeedback(message: string): void {
    const feedback = document.createElement("div");
    feedback.className = "save-feedback";
    feedback.textContent = message;
    document.body.appendChild(feedback);

    setTimeout(() => {
      feedback.classList.add("fade-out");
      setTimeout(() => feedback.remove(), 300);
    }, 2000);
  }

  /**
   * Clean up
   */
  public dispose(): void {
    this.overlay.remove();
  }
}
