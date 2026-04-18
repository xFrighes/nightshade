import React, { useEffect, useMemo, useState } from 'react';
import type * as Phaser from 'phaser';
import { ChevronRight, Heart, KeyRound, Package, RotateCcw, ScrollText, Shield, Sparkles, X } from 'lucide-react';
import { PhaserGame } from './components/PhaserGame';
import { SettingsWindow } from './components/SettingsWindow';
import { GeminiService } from './services/GeminiService';
import {
  INITIAL_STORY_STATE,
  STORY_ITEMS,
  type GameAction,
  type StoryItemId,
  type StorySceneId,
  type StoryState,
} from './game/storyTypes';
import './App.css';

type DialogOption = {
  label: string;
  action: () => void;
  disabled?: boolean;
};

type DialogState = {
  speaker: string;
  text: string;
  options: DialogOption[];
};

type CombatState = {
  kaelen: number;
  elara: number;
  message: string;
};

const sceneObjectives: Record<StorySceneId, string> = {
  cell: 'Use Bread, win Kaelen over, and escape the Iron Cell.',
  market: 'Climb for the Coin Pouch, then bargain with Silas for a gate pass.',
  cathedral: 'Reach the rooftops and decide whether to accept the Purple Rune.',
  gate: 'Open the gate with mercy, a key, the Rune, or steel.',
  outskirts: 'Walk into the fog and learn what kind of legend Elara became.',
};

const App: React.FC = () => {
  const [isGameStarted, setIsGameStarted] = useState(() => new URLSearchParams(window.location.search).has('autostart'));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [story, setStory] = useState<StoryState>(() => loadStory());
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [gameInstance, setGameInstance] = useState<Phaser.Game | null>(null);

  useEffect(() => {
    localStorage.setItem('shadow_toll_story', JSON.stringify(story));
  }, [story]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'i') setInventoryOpen((open) => !open);
      if (event.key === 'Escape') {
        setDialog(null);
        setInventoryOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const inventory = useMemo(() => story.inventory.map((id) => STORY_ITEMS[id]), [story.inventory]);

  const updateStory = (updater: (state: StoryState) => StoryState) => {
    setStory((current) => updater(current));
  };

  const addLog = (state: StoryState, entry: string): StoryState => ({
    ...state,
    log: [entry, ...state.log].slice(0, 8),
  });

  const hasItem = (id: StoryItemId) => story.inventory.includes(id);

  const addItem = (state: StoryState, id: StoryItemId): StoryState => {
    if (state.inventory.includes(id)) return state;
    return addLog({ ...state, inventory: [...state.inventory, id] }, `Obtained ${STORY_ITEMS[id].name}.`);
  };

  const removeItem = (state: StoryState, id: StoryItemId): StoryState => ({
    ...state,
    inventory: state.inventory.filter((item) => item !== id),
  });

  const recordChoice = (state: StoryState, choice: string): StoryState => ({
    ...state,
    dialogueHistory: [...state.dialogueHistory, choice].slice(-20),
  });

  const goToScene = (scene: StorySceneId, entry: string) => {
    updateStory((state) => addLog({ ...state, scene }, entry));
    setDialog(null);
  };

  const handleGameAction = (action: GameAction) => {
    if (combat) return;

    if (action.type === 'collect' && action.target === 'collect_dagger') {
      updateStory((state) => addItem({ ...state, flags: { ...state.flags, daggerFound: true } }, 'iron_dagger'));
      return;
    }

    if (action.type === 'collect' && action.target === 'collect_coin') {
      updateStory((state) => addItem({
        ...state,
        gold: 6,
        flags: { ...state.flags, coinFound: true },
      }, 'coin_pouch'));
      return;
    }

    if (action.type === 'scene_complete' && action.scene === 'outskirts') {
      finishLegacy();
      return;
    }

    if (action.type !== 'interact') return;

    const handlers: Record<string, () => void> = {
      kaelen: openKaelenCell,
      rat: distractRat,
      cell_exit: () => goToScene('market', 'Elara crawls through the drain into the lantern-lit Under-Market.'),
      silas: openSilas,
      market_exit: () => goToScene('cathedral', 'Gate pass in hand, Elara climbs into the Cathedral Ward.'),
      envoy: openEnvoy,
      cathedral_exit: () => goToScene('gate', 'The fortified bridge rises ahead. Kaelen waits under torchlight.'),
      kaelen_gate: openGateKaelen,
      gate_lock: useGateKey,
      great_gate: useGreatGate,
      envoy_final: openFinalEnvoy,
    };

    handlers[action.target]?.();
  };

  const distractRat = () => {
    if (!hasItem('bread')) {
      setDialog({
        speaker: 'Guard-rat',
        text: 'The rat bares yellow teeth. You have nothing it wants.',
        options: [{ label: 'Back away', action: () => setDialog(null) }],
      });
      return;
    }

    updateStory((state) => addLog({
      ...removeItem(state, 'bread'),
      flags: { ...state.flags, ratDistracted: true },
    }, 'The Bread skids into the dark. The guard-rat follows it, leaving the bars unwatched.'));
  };

  const openKaelenCell = () => {
    setDialog({
      speaker: 'Kaelen',
      text: 'The veteran guard keeps one hand on his spear. His eyes are tired, but not empty.',
      options: [
        {
          label: 'Appeal to his honor',
          action: () => {
            const result = GeminiService.judgeKaelenMood('honor');
            updateStory((state) => addItem(recordChoice({
              ...state,
              flags: { ...state.flags, kaelenMood: result.mood },
            }, 'Appealed to Kaelen honor'), 'rusted_key'));
            setDialog({
              speaker: 'Kaelen',
              text: result.line,
              options: [{ label: 'Take the key', action: () => setDialog(null) }],
            });
          },
        },
        {
          label: 'Demand he opens the cell',
          action: () => {
            const result = GeminiService.judgeKaelenMood('aggressive');
            updateStory((state) => recordChoice({
              ...state,
              flags: { ...state.flags, kaelenMood: result.mood },
            }, 'Threatened Kaelen in the cell'));
            setDialog({
              speaker: 'Kaelen',
              text: result.line,
              options: [{ label: 'Step back', action: () => setDialog(null) }],
            });
          },
        },
        {
          label: 'Ask about the rat and the bars',
          action: () => {
            const result = GeminiService.judgeKaelenMood('trade');
            updateStory((state) => recordChoice({
              ...state,
              flags: { ...state.flags, kaelenMood: result.mood },
            }, 'Asked Kaelen for practical help'));
            setDialog({
              speaker: 'Kaelen',
              text: result.line,
              options: [{ label: 'Use the Bread on the rat', action: () => setDialog(null) }],
            });
          },
        },
      ],
    });
  };

  const openSilas = () => {
    setDialog({
      speaker: 'Silas the Broker',
      text: 'Silas fans a violet-stamped pass between two fingers. "Every gate has a price. Yours is still being invented."',
      options: [
        {
          label: 'Pay with the Coin Pouch',
          disabled: !hasItem('coin_pouch'),
          action: () => resolveSilas('pay', false),
        },
        {
          label: 'Threaten him with the Iron Dagger',
          disabled: !hasItem('iron_dagger'),
          action: () => resolveSilas('threaten', false),
        },
        {
          label: 'Kill Silas and take the pass',
          disabled: !hasItem('iron_dagger'),
          action: () => resolveSilas('threaten', true),
        },
        {
          label: 'Accept the favor he demands',
          action: () => resolveSilas('pay', false, true),
        },
      ],
    });
  };

  const resolveSilas = (approach: 'pay' | 'threaten', lethal: boolean, forceFavor = false) => {
    const result = forceFavor
      ? { accepted: false, choice: 'owed_favor' as const, line: 'Silas grins and presses the pass into your palm. "A favor later, then. I always collect."' }
      : GeminiService.judgeSilasBargain(story, approach);

    updateStory((state) => {
      let next = recordChoice(state, lethal ? 'Killed Silas' : `Silas bargain: ${result.choice}`);
      if (result.choice === 'paid') {
        next = removeItem({ ...next, gold: 0 }, 'coin_pouch');
      }
      next = addItem(next, 'gate_pass');
      return addLog({
        ...next,
        flags: {
          ...next.flags,
          silasChoice: lethal ? 'threatened' : result.choice,
          silasAlive: !lethal,
        },
      }, lethal ? 'Silas falls behind the purple lanterns. The pass is yours.' : result.line);
    });

    setDialog({
      speaker: 'Silas the Broker',
      text: lethal ? 'Silas reaches for a hidden knife too slowly. The Under-Market goes quiet.' : result.line,
      options: [{ label: 'Leave for the Cathedral Ward', action: () => goToScene('cathedral', 'The pass opens a stairway toward the Cathedral Ward.') }],
    });
  };

  const openEnvoy = () => {
    const friendly = !story.flags.silasAlive;
    const line = GeminiService.envoyLine(story);
    setDialog({
      speaker: 'Nightshade Envoy',
      text: `${line} ${friendly ? 'The hooded figure offers the Rune like a reward.' : 'The Rune glows like a warning.'}`,
      options: [
        {
          label: 'Take the Purple Rune',
          action: () => {
            updateStory((state) => addItem(recordChoice({
              ...state,
              flags: { ...state.flags, runeTaken: true },
            }, 'Accepted the Purple Rune'), 'purple_rune'));
            setDialog({
              speaker: 'Nightshade Envoy',
              text: 'The Rune burns cold. Your legs feel lighter. The city behind the rooftops bends darker around you.',
              options: [{ label: 'Run for the Great Gate', action: () => goToScene('gate', 'Rune-lit rooftops carry Elara to the Great Gate.') }],
            });
          },
        },
        {
          label: 'Refuse the curse',
          action: () => {
            updateStory((state) => recordChoice(state, 'Refused the Purple Rune'));
            setDialog({
              speaker: 'Nightshade Envoy',
              text: 'The Envoy closes their hand. "Then climb with mortal bones, Elara."',
              options: [{ label: 'Continue without it', action: () => goToScene('gate', 'Elara leaves the Cathedral Ward without the Rune.') }],
            });
          },
        },
      ],
    });
  };

  const openGateKaelen = () => {
    const canPersuade = story.flags.kaelenMood === 'honorable' || story.flags.kaelenMood === 'guarded';
    setDialog({
      speaker: 'Kaelen',
      text: 'Kaelen blocks the bridge, helmet under one arm. "Orders say you stop here. My conscience has been less clear."',
      options: [
        {
          label: 'Ask him to remember his honor',
          action: () => {
            if (canPersuade) {
              updateStory((state) => addLog(recordChoice({
                ...state,
                flags: { ...state.flags, kaelenMood: 'merciful', gateOutcome: 'persuaded' },
              }, 'Persuaded Kaelen at the gate'), 'Kaelen lowers his spear and lets Elara pass.'));
              goToScene('outskirts', 'Kaelen turns his back on the order and opens the way.');
            } else {
              setDialog({
                speaker: 'Kaelen',
                text: '"You wanted threats. Now you have a soldier."',
                options: [{ label: 'Fight', action: startCombat }],
              });
            }
          },
        },
        {
          label: 'Use the Rusted Key side-path',
          disabled: !hasItem('rusted_key'),
          action: useGateKey,
        },
        {
          label: 'Blast the gate with the Purple Rune',
          disabled: !hasItem('purple_rune'),
          action: blastRuneGate,
        },
        {
          label: 'Draw steel',
          action: startCombat,
        },
      ],
    });
  };

  const useGateKey = () => {
    if (!hasItem('rusted_key')) {
      setDialog({
        speaker: 'Gate Lock',
        text: 'The side-path lock is old, but not broken. You need the Rusted Key.',
        options: [{ label: 'Return', action: () => setDialog(null) }],
      });
      return;
    }

    updateStory((state) => addLog({
      ...state,
      flags: { ...state.flags, gateOutcome: 'secret' },
    }, 'The Rusted Key opens a forgotten side-path under the bridge.'));
    goToScene('outskirts', 'Elara slips beneath the Great Gate without spilling Kaelen blood.');
  };

  const useGreatGate = () => {
    if (hasItem('purple_rune')) {
      blastRuneGate();
      return;
    }
    openGateKaelen();
  };

  const blastRuneGate = () => {
    updateStory((state) => addLog(recordChoice({
      ...state,
      flags: { ...state.flags, gateOutcome: 'rune' },
    }, 'Used the Purple Rune at the gate'), 'The Purple Rune tears a violet wound through the Great Gate.'));
    goToScene('outskirts', 'Elara escapes through smoke and violet fire.');
  };

  const startCombat = () => {
    setDialog(null);
    setCombat({ kaelen: 6, elara: story.health, message: 'Kaelen raises his shield. Time your strikes and guard when you are hurt.' });
  };

  const strikeKaelen = () => {
    setCombat((current) => {
      if (!current) return current;
      const kaelen = Math.max(0, current.kaelen - 2);
      const elara = kaelen <= 0 ? current.elara : Math.max(0, current.elara - 1);
      if (kaelen <= 0) {
        winCombat(elara);
        return null;
      }
      return { kaelen, elara, message: 'Your dagger finds a gap. Kaelen answers with the haft of his spear.' };
    });
  };

  const guardKaelen = () => {
    setCombat((current) => {
      if (!current) return current;
      const elara = Math.min(story.maxHealth, current.elara + 1);
      return { ...current, elara, message: 'You brace behind the dagger and catch your breath.' };
    });
  };

  const winCombat = (health: number) => {
    updateStory((state) => addLog(recordChoice({
      ...state,
      health: Math.max(1, health),
      flags: { ...state.flags, gateOutcome: 'fought' },
    }, 'Defeated Kaelen in combat'), 'Kaelen yields, wounded but alive. The bridge is open.'));
    goToScene('outskirts', 'Elara limps past Kaelen and into the fog.');
  };

  const retryCombat = () => {
    updateStory((state) => ({ ...state, health: state.maxHealth }));
    setCombat({ kaelen: 6, elara: story.maxHealth, message: 'You steady yourself and try the duel again.' });
  };

  const openFinalEnvoy = () => {
    const summary = GeminiService.legacySummary(story);
    updateStory((state) => ({ ...state, legacySummary: summary }));
    setDialog({
      speaker: 'Nightshade Envoy',
      text: `The Envoy looks back at the burning city. "${summary}"`,
      options: [{ label: 'Walk toward the horizon', action: finishLegacy }],
    });
  };

  const finishLegacy = () => {
    const summary = story.legacySummary ?? GeminiService.legacySummary(story);
    updateStory((state) => ({ ...state, legacySummary: summary }));
    setDialog({
      speaker: 'Legacy of Elara',
      text: summary,
      options: [{ label: 'Begin again', action: resetGame }],
    });
  };

  const resetGame = () => {
    localStorage.removeItem('shadow_toll_story');
    setStory(INITIAL_STORY_STATE);
    setDialog(null);
    setCombat(null);
    setInventoryOpen(false);
  };

  const sendVirtualInput = (key: 'left' | 'right' | 'jump', active: boolean) => {
    gameInstance?.events.emit('virtual_input', { key, active });
  };

  const sendVirtualInteract = () => {
    gameInstance?.events.emit('virtual_interact');
  };

  const handleStartGame = () => {
    setIsGameStarted(true);
  };

  if (!isGameStarted) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center p-8 bg-cover bg-center bg-no-repeat font-pixel"
        style={{ backgroundImage: "url('/starting-screen.png')" }}
      >
        <div className="absolute inset-0 bg-black/10" />

        {!isSettingsOpen && (
          <div className="w-full max-w-lg flex flex-col items-center gap-6 relative z-10 mt-[32rem] font-['Press_Start_2P']">
            <button
              onClick={handleStartGame}
              className="group relative flex items-center justify-center text-white text-2xl uppercase cursor-pointer transition-all hover:scale-105"
              style={{ textShadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}
            >
              <span className="absolute -left-10 group-hover:opacity-100 opacity-0 transition-opacity">{">"}</span>
              START GAME
            </button>

            <button
              className="text-white/80 text-xl uppercase cursor-not-allowed opacity-60 hover:opacity-100 transition-opacity"
              style={{ textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}
            >
              [LOAD GAME]
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-white/80 text-xl uppercase cursor-pointer hover:opacity-100 transition-opacity"
              style={{ textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}
            >
              [SETTINGS]
            </button>

            <button
              className="text-white/80 text-xl uppercase cursor-not-allowed opacity-60 hover:opacity-100 transition-opacity"
              style={{ textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}
            >
              [QUIT]
            </button>
          </div>
        )}

        <SettingsWindow isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-game-bg select-none font-pixel">
      <PhaserGame storyState={story} onGameAction={handleGameAction} onGameReady={setGameInstance} />

      <div className="game-hud">
        <div className="hud-card hero-status">
          <div className="hero-medallion"><Shield size={28} /></div>
          <div>
            <strong>Elara</strong>
            <span>{sceneObjectives[story.scene]}</span>
          </div>
          <div className="health-row">
            {Array.from({ length: story.maxHealth }).map((_, index) => (
              <Heart key={index} size={16} fill={index < story.health ? 'currentColor' : 'none'} />
            ))}
          </div>
        </div>

        <button className="hud-button" onClick={() => setInventoryOpen(true)} title="Inventory">
          <Package size={18} />
          <span>{inventory.length}</span>
        </button>

        <button className="hud-button" onClick={resetGame} title="Reset story">
          <RotateCcw size={18} />
        </button>
      </div>

      <div className="story-log">
        <div className="story-log-title"><ScrollText size={16} /> Chronicle</div>
        {story.log.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}
      </div>

      <div className="quick-inventory">
        {inventory.map((item) => (
          <div key={item.id} className={item.id === 'purple_rune' ? 'slot cursed' : 'slot'} title={item.description}>
            <span>{item.icon}</span>
            <small>{item.name}</small>
          </div>
        ))}
        <div className="gold"><KeyRound size={14} /> {story.gold} gold</div>
      </div>

      <div className="touch-controls" aria-label="Game controls">
        <button
          onPointerDown={() => sendVirtualInput('left', true)}
          onPointerUp={() => sendVirtualInput('left', false)}
          onPointerLeave={() => sendVirtualInput('left', false)}
        >
          Left
        </button>
        <button
          onPointerDown={() => sendVirtualInput('right', true)}
          onPointerUp={() => sendVirtualInput('right', false)}
          onPointerLeave={() => sendVirtualInput('right', false)}
        >
          Right
        </button>
        <button onPointerDown={() => sendVirtualInput('jump', true)}>Jump</button>
        <button className="interact" onClick={sendVirtualInteract}>Interact</button>
      </div>

      {dialog && <DialogOverlay dialog={dialog} onClose={() => setDialog(null)} />}
      {inventoryOpen && <InventoryOverlay items={inventory} gold={story.gold} onClose={() => setInventoryOpen(false)} />}
      {combat && (
        <CombatOverlay
          combat={combat}
          maxHealth={story.maxHealth}
          onStrike={strikeKaelen}
          onGuard={guardKaelen}
          onRetry={retryCombat}
        />
      )}

      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]" />
    </div>
  );
};

const DialogOverlay: React.FC<{ dialog: DialogState; onClose: () => void }> = ({ dialog, onClose }) => (
  <div className="dialog-shell">
    <div className="dialog-panel">
      <button className="dialog-close" onClick={onClose}><X size={18} /></button>
      <div className="speaker"><Sparkles size={16} /> {dialog.speaker}</div>
      <p>{dialog.text}</p>
      <div className="dialog-options">
        {dialog.options.map((option) => (
          <button key={option.label} onClick={option.action} disabled={option.disabled}>
            <ChevronRight size={16} />
            {option.label}
          </button>
        ))}
      </div>
    </div>
  </div>
);

const InventoryOverlay: React.FC<{
  items: Array<(typeof STORY_ITEMS)[StoryItemId]>;
  gold: number;
  onClose: () => void;
}> = ({ items, gold, onClose }) => (
  <div className="inventory-overlay">
    <div className="inventory-panel">
      <button className="dialog-close" onClick={onClose}><X size={18} /></button>
      <h2>Inventory</h2>
      <div className="inventory-grid">
        {items.map((item) => (
          <div key={item.id} className="inventory-item">
            <strong>{item.icon}</strong>
            <span>{item.name}</span>
            <p>{item.description}</p>
          </div>
        ))}
      </div>
      <div className="inventory-gold">{gold} gold</div>
    </div>
  </div>
);

const CombatOverlay: React.FC<{
  combat: CombatState;
  maxHealth: number;
  onStrike: () => void;
  onGuard: () => void;
  onRetry: () => void;
}> = ({ combat, maxHealth, onStrike, onGuard, onRetry }) => {
  const defeated = combat.elara <= 0;

  return (
    <div className="combat-overlay">
      <div className="combat-panel">
        <h2>Kaelen's Order</h2>
        <p>{defeated ? 'Elara falls to one knee. The bridge blurs. Try the duel again.' : combat.message}</p>
        <div className="combat-bars">
          <span>Elara {Math.max(0, combat.elara)} / {maxHealth}</span>
          <span>Kaelen {combat.kaelen} / 6</span>
        </div>
        <div className="dialog-options">
          {defeated ? (
            <button onClick={onRetry}><RotateCcw size={16} /> Retry duel</button>
          ) : (
            <>
              <button onClick={onStrike}><ChevronRight size={16} /> Strike</button>
              <button onClick={onGuard}><Shield size={16} /> Guard</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const loadStory = (): StoryState => {
  const raw = localStorage.getItem('shadow_toll_story');
  if (!raw) return INITIAL_STORY_STATE;

  try {
    const parsed = JSON.parse(raw);
    return { 
      ...INITIAL_STORY_STATE, 
      ...parsed,
      maxHealth: 5,
      health: Math.min(5, parsed.health ?? 5)
    };
  } catch {
    return INITIAL_STORY_STATE;
  }
};

export default App;
