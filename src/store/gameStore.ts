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
  health: 10,
  maxHealth: 10,
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

class GameStore extends EventTarget {
  private state: PlayerState = { ...INITIAL_STATE };
  private worldLogs: WorldLogEntry[] = [];

  constructor() {
    super();
    this.loadFromStorage();
    this.generateMockLogs();
  }

  getState() { return this.state; }
  getLogs() { return this.worldLogs; }

  updateState(update: Partial<PlayerState>) {
    this.state = { ...this.state, ...update };
    this.saveToStorage();
    this.dispatchEvent(new CustomEvent('change', { detail: this.state }));
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
    const saved = localStorage.getItem('nightshade_game_state');
    if (saved) {
      try {
        this.state = { ...INITIAL_STATE, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to load save data', e);
      }
    }
  }

  private saveToStorage() {
    localStorage.setItem('nightshade_game_state', JSON.stringify(this.state));
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
