export type Item = {
  id: string;
  name: string;
  description: string;
  icon: string;
  count: number;
};

export type Quest = {
  id: string;
  title: string;
  description: string;
  status: 'available' | 'active' | 'completed';
};

export type PlayerState = {
  name: string;
  level: number;
  xp: number;
  health: number;
  maxHealth: number;
  gold: number;
  reputation: Record<string, number>;
  inventory: Item[];
  quests: Quest[];
};

export type SettingsState = {
  audio: {
    masterVolume: number;
    musicVolume: number;
    voiceActing: boolean;
    audioQuality: string;
    subtitles: boolean;
    language: string;
  };
  video: {
    resolution: string;
    fullscreen: boolean;
    vsync: boolean;
    antiAliasing: string;
    textureQuality: string;
  };
  gameplay: {
    difficulty: string;
    cameraShake: boolean;
    tutorialTooltips: boolean;
    autoSave: boolean;
  };
  controls: {
    invertY: boolean;
    mouseSensitivity: number;
    keyBindings: Record<string, string>;
  };
};

export type WorldLogEntry = {
  id: string;
  timestamp: number;
  text: string;
  type: 'info' | 'chat' | 'quest' | 'reward';
};

const INITIAL_STATE: PlayerState = {
  name: 'Initiate',
  level: 1,
  xp: 0,
  health: 5,
  maxHealth: 5,
  gold: 5,
  reputation: {
    'Nightshade': 0,
    'CityWatch': 0
  },
  inventory: [
    { id: 'rusty_dagger', name: 'Rusty Dagger', description: 'A blunt, rusted blade. Barely cuts.', icon: '⚔️', count: 1 }
  ],
  quests: [
    { id: 'meet_guide', title: 'The Shadowy Guide', description: 'Find the grizzled veteran leaning on a spear near the city gate.', status: 'active' }
  ]
};

const INITIAL_SETTINGS: SettingsState = {
  audio: {
    masterVolume: 0.8,
    musicVolume: 0.6,
    voiceActing: true,
    audioQuality: 'Medium / High',
    subtitles: true,
    language: 'English',
  },
  video: {
    resolution: '1920x1080',
    fullscreen: true,
    vsync: true,
    antiAliasing: 'TAA',
    textureQuality: 'High',
  },
  gameplay: {
    difficulty: 'Normal',
    cameraShake: true,
    tutorialTooltips: true,
    autoSave: true,
  },
  controls: {
    invertY: false,
    mouseSensitivity: 0.5,
    keyBindings: {
      moveUp: 'W',
      moveDown: 'S',
      moveLeft: 'A',
      moveRight: 'D',
      interact: 'E',
      inventory: 'I',
    },
  },
};

class GameStore extends EventTarget {
  private state: PlayerState = { ...INITIAL_STATE };
  private settings: SettingsState = { ...INITIAL_SETTINGS };
  private worldLogs: WorldLogEntry[] = [];

  constructor() {
    super();
    this.loadFromStorage();
    this.generateMockLogs();
  }

  getState() { return this.state; }
  getSettings() { return this.settings; }
  getLogs() { return this.worldLogs; }

  updateState(update: Partial<PlayerState>) {
    this.state = { ...this.state, ...update };
    this.saveToStorage();
    this.dispatchEvent(new CustomEvent('change', { detail: this.state }));
  }

  updateSettings<K extends keyof SettingsState>(category: K, update: Partial<SettingsState[K]>) {
    this.settings = {
      ...this.settings,
      [category]: { ...this.settings[category], ...update },
    };
    this.saveToStorage();
    this.dispatchEvent(new CustomEvent('settingsChange', { detail: this.settings }));
  }

  addLog(text: string, type: WorldLogEntry['type'] = 'info') {
    const log: WorldLogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      text,
      type
    };
    this.worldLogs = [log, ...this.worldLogs].slice(0, 50);
    this.dispatchEvent(new CustomEvent('log', { detail: log }));
  }

  addItem(item: Item) {
    const existing = this.state.inventory.find(i => i.id === item.id);
    if (existing) {
      existing.count += item.count;
      this.updateState({ inventory: [...this.state.inventory] });
    } else {
      this.updateState({ inventory: [...this.state.inventory, item] });
    }
    this.addLog(`Obtained: ${item.name}`, 'reward');
  }

  updateQuestStatus(id: string, status: Quest['status']) {
    const quests = this.state.quests.map(q => q.id === id ? { ...q, status } : q);
    this.updateState({ quests });
    this.addLog(`Quest Updated: ${quests.find(q => q.id === id)?.title}`, 'quest');
  }

  private loadFromStorage() {
    const savedState = localStorage.getItem('nightshade_game_state');
    if (savedState) {
      try {
        const loaded = JSON.parse(savedState);
        const maxHealth = Math.min(loaded.maxHealth ?? INITIAL_STATE.maxHealth, 5);
        const health = Math.max(0, Math.min(loaded.health ?? INITIAL_STATE.health, maxHealth));
        this.state = { ...INITIAL_STATE, ...loaded, maxHealth, health };
      } catch (e) {
        console.error('Failed to load save data', e);
      }
    }
    const savedSettings = localStorage.getItem('nightshade_settings');
    if (savedSettings) {
      try {
        this.settings = { ...INITIAL_SETTINGS, ...JSON.parse(savedSettings) };
      } catch (e) {
        console.error('Failed to load settings data', e);
      }
    }
  }

  private saveToStorage() {
    localStorage.setItem('nightshade_game_state', JSON.stringify(this.state));
    localStorage.setItem('nightshade_settings', JSON.stringify(this.settings));
  }

  private generateMockLogs() {
    const players = ['ShadowWalker', 'Raven_King', 'BloodMoon', 'Ghost99', 'Hexblade'];
    const actions = ['joined the area', 'completed a contract', 'gained level 2!', 'is looking for a group'];
    
    setInterval(() => {
      const player = players[Math.floor(Math.random() * players.length)];
      const action = actions[Math.floor(Math.random() * actions.length)];
      this.addLog(`${player} ${action}`, 'chat');
    }, 15000);
  }
}

export const gameStore = new GameStore();
