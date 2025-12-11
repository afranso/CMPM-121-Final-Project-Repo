export interface PlayerState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
}

export interface GameState {
  level: number;
  timestamp: number;
  playerState: PlayerState;
  inventory: string[];
  levelState: {
    doorOpened: boolean;
    chestOpened: boolean;
    wrongLandings: number;
    blockSpawningEnabled: boolean;
    boardBroken: boolean;
    boardHits: number;
  };
  batsCollected: number;
  keyVisible: boolean;
  batsVisible: boolean[];
}

export interface SaveSlot {
  id: number;
  timestamp: number;
  level: number;
  gameState: GameState;
  slotName: string;
}

export class SaveManager {
  private static readonly MAX_SLOTS = 5;
  private static readonly AUTO_SAVE_SLOT = 0;
  private static readonly STORAGE_KEY = "game_saves";
  private static readonly AUTO_SAVE_INTERVAL = 30000; // 30 seconds

  private autoSaveTimer: number | null = null;
  private saveCallback: (() => GameState) | null = null;

  constructor() {
    this.initAutoSave();
    this.setupBeforeUnloadHandler();
  }

  /**
   * Set the callback function that returns the current game state
   */
  public setSaveCallback(callback: () => GameState): void {
    this.saveCallback = callback;
  }

  /**
   * Save to a specific slot
   */
  public save(slotId: number, slotName?: string): boolean {
    if (!this.saveCallback) {
      console.error("Save callback not set");
      return false;
    }

    if (slotId < 0 || slotId >= SaveManager.MAX_SLOTS) {
      console.error(`Invalid slot ID: ${slotId}`);
      return false;
    }

    try {
      const gameState = this.saveCallback();
      const saves = this.getAllSaves();

      const normalizedLevel = gameState.level ?? 1;
      const saveSlot: SaveSlot = {
        id: slotId,
        timestamp: Date.now(),
        level: normalizedLevel,
        gameState,
        slotName: slotName || (slotId === 0 ? "Auto Save" : `Save ${slotId}`),
      };

      saves[slotId] = saveSlot;
      localStorage.setItem(SaveManager.STORAGE_KEY, JSON.stringify(saves));

      console.log(`Game saved to slot ${slotId}`);
      return true;
    } catch (error) {
      console.error("Failed to save game:", error);
      return false;
    }
  }

  /**
   * Load from a specific slot
   */
  public load(slotId: number): GameState | null {
    if (slotId < 0 || slotId >= SaveManager.MAX_SLOTS) {
      console.error(`Invalid slot ID: ${slotId}`);
      return null;
    }

    try {
      const saves = this.getAllSaves();
      const saveSlot = saves[slotId];

      if (!saveSlot) {
        console.warn(`No save found in slot ${slotId}`);
        return null;
      }

      // Migrate older saves missing level metadata
      if (!saveSlot.level) {
        saveSlot.level = saveSlot.gameState.level ?? 1;
        saveSlot.gameState.level = saveSlot.level;
        localStorage.setItem(SaveManager.STORAGE_KEY, JSON.stringify(saves));
      }

      // Ensure gameState carries the level for scene routing
      if (!saveSlot.gameState.level) {
        saveSlot.gameState.level = saveSlot.level;
      }

      console.log(`Game loaded from slot ${slotId}`);
      return saveSlot.gameState;
    } catch (error) {
      console.error("Failed to load game:", error);
      return null;
    }
  }

  /**
   * Get all save slots
   */
  public getAllSaves(): SaveSlot[] {
    try {
      const data = localStorage.getItem(SaveManager.STORAGE_KEY);
      if (!data) return [];

      const saves = JSON.parse(data) as SaveSlot[];
      if (!Array.isArray(saves)) return [];

      // Normalize level metadata for UI and future loads
      let mutated = false;
      for (const slot of saves) {
        if (!slot) continue;
        if (!slot.level) {
          slot.level = slot.gameState?.level ?? 1;
          mutated = true;
        }
        if (slot.gameState && !slot.gameState.level) {
          slot.gameState.level = slot.level;
          mutated = true;
        }
      }

      if (mutated) {
        localStorage.setItem(SaveManager.STORAGE_KEY, JSON.stringify(saves));
      }

      return saves;
    } catch (error) {
      console.error("Failed to load saves:", error);
      return [];
    }
  }

  /**
   * Delete a save slot
   */
  public deleteSave(slotId: number): boolean {
    if (slotId === 0) {
      console.warn("Cannot delete auto-save slot");
      return false;
    }

    try {
      const saves = this.getAllSaves();
      if (saves[slotId]) {
        delete saves[slotId];
        localStorage.setItem(SaveManager.STORAGE_KEY, JSON.stringify(saves));
        console.log(`Deleted save slot ${slotId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to delete save:", error);
      return false;
    }
  }

  /**
   * Perform auto-save
   */
  public autoSave(): boolean {
    console.log("Auto-save triggered");
    const result = this.save(SaveManager.AUTO_SAVE_SLOT, "Auto Save");
    if (result) {
      console.log("✓ Auto-save successful");
    }
    return result;
  }

  /**
   * Start auto-save timer
   */
  private initAutoSave(): void {
    this.autoSaveTimer = globalThis.setInterval(() => {
      if (this.saveCallback) {
        this.autoSave();
        this.showAutoSaveIndicator();
      }
    }, SaveManager.AUTO_SAVE_INTERVAL);
  }

  /**
   * Show a brief auto-save indicator
   */
  private showAutoSaveIndicator(): void {
    const indicator = document.createElement("div");
    indicator.className = "auto-save-indicator";
    indicator.textContent = "💾 Auto-saved";
    document.body.appendChild(indicator);

    setTimeout(() => {
      indicator.classList.add("fade-out");
      setTimeout(() => indicator.remove(), 500);
    }, 2000);
  }

  /**
   * Stop auto-save timer
   */
  public stopAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Setup handler to save before closing/refreshing
   */
  private setupBeforeUnloadHandler(): void {
    globalThis.addEventListener("beforeunload", () => {
      if (this.saveCallback) {
        this.autoSave();
      }
    });
  }

  /**
   * Check if a slot has a save
   */
  public hasSlot(slotId: number): boolean {
    const saves = this.getAllSaves();
    return saves[slotId] !== undefined && saves[slotId] !== null;
  }

  /**
   * Get save slot info without loading full state
   */
  public getSlotInfo(
    slotId: number,
  ): { timestamp: number; slotName: string } | null {
    const saves = this.getAllSaves();
    const slot = saves[slotId];

    if (!slot) return null;

    return {
      timestamp: slot.timestamp,
      slotName: slot.slotName,
    };
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.stopAutoSave();
  }
}
