export type StorySceneId = 'cell' | 'market' | 'cathedral' | 'gate' | 'outskirts';

export type StoryItemId = 'bread' | 'iron_dagger' | 'rusted_key' | 'coin_pouch' | 'gate_pass' | 'purple_rune';

export type StoryItem = {
  id: StoryItemId;
  name: string;
  description: string;
  icon: string;
};

export type StoryFlags = {
  ratDistracted: boolean;
  daggerFound: boolean;
  coinFound: boolean;
  silasChoice: 'none' | 'paid' | 'threatened' | 'owed_favor';
  silasAlive: boolean;
  runeTaken: boolean;
  kaelenMood: 'guarded' | 'honorable' | 'hostile' | 'merciful';
  gateOutcome: 'none' | 'persuaded' | 'fought' | 'rune' | 'secret';
};

export type StoryState = {
  scene: StorySceneId;
  inventory: StoryItemId[];
  gold: number;
  health: number;
  maxHealth: number;
  flags: StoryFlags;
  log: string[];
  dialogueHistory: string[];
  legacySummary?: string;
};

export type GameAction =
  | { type: 'interact'; target: string }
  | { type: 'collect'; target: string }
  | { type: 'scene_complete'; scene: StorySceneId };

export const STORY_ITEMS: Record<StoryItemId, StoryItem> = {
  bread: {
    id: 'bread',
    name: 'Bread',
    description: 'A hard prison loaf. Useful enough to eat, trade, or distract something hungry.',
    icon: 'B',
  },
  iron_dagger: {
    id: 'iron_dagger',
    name: 'Iron Dagger',
    description: 'A serviceable guard blade, left close enough to the bars to be a decision.',
    icon: 'D',
  },
  rusted_key: {
    id: 'rusted_key',
    name: 'Rusted Key',
    description: 'Kaelen trusted you with this. It opens old locks and older doubts.',
    icon: 'K',
  },
  coin_pouch: {
    id: 'coin_pouch',
    name: 'Coin Pouch',
    description: 'A small purse found behind a market crate. Heavy enough to change a bargain.',
    icon: 'C',
  },
  gate_pass: {
    id: 'gate_pass',
    name: 'Gate Pass',
    description: 'Silas stamped it in violet wax. It smells of smoke and debt.',
    icon: 'P',
  },
  purple_rune: {
    id: 'purple_rune',
    name: 'Purple Rune',
    description: 'A cursed sigil that lifts your body and stains the world around it.',
    icon: 'R',
  },
};

export const INITIAL_STORY_STATE: StoryState = {
  scene: 'cell',
  inventory: ['bread'],
  gold: 0,
  health: 6,
  maxHealth: 6,
  flags: {
    ratDistracted: false,
    daggerFound: false,
    coinFound: false,
    silasChoice: 'none',
    silasAlive: true,
    runeTaken: false,
    kaelenMood: 'guarded',
    gateOutcome: 'none',
  },
  log: [
    'Elara wakes in the Iron Cell with only Bread and a city full of rot above her.',
  ],
  dialogueHistory: [],
};
