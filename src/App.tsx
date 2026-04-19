import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, KeyRound, Loader2, Package, RotateCcw, Shield, Sparkles, Wallet, X } from 'lucide-react';
import { PhaserGame } from './components/PhaserGame';
import { SettingsWindow } from './components/SettingsWindow';
import { GeminiService } from './services/GeminiService';
import { SolanaService } from './services/SolanaService';
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
  inputMode?: boolean;
  onInput?: (text: string) => void;
};

type CombatState = {
  kaelen: number;
  elara: number;
  message: string;
};

const formatKaelenGeminiError = (err: unknown): string => {
  const message = err instanceof Error ? err.message : 'Gemini failed to answer.';
  return `Gemini could not answer as Kaelen. ${message}`;
};

const App: React.FC = () => {
  const [isGameStarted, setIsGameStarted] = useState(() => new URLSearchParams(window.location.search).has('autostart'));
  const [isLoading, setIsLoading] = useState(false);
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [story, setStory] = useState<StoryState>(() => loadStory());
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [openingShown, setOpeningShown] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [hudKey, setHudKey] = useState(0);
  const storyRef = React.useRef(story);
  storyRef.current = story;

  useEffect(() => {
    const images = ['/starting-screen.png', '/bg.png', '/UI.png'];
    let loadedCount = 0;
    images.forEach(src => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        loadedCount++;
        if (loadedCount === images.length) setIsPreloaded(true);
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === images.length) setIsPreloaded(true);
      };
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('shadow_toll_story', JSON.stringify(story));
  }, [story]);

  // Opening monologue — fires once after the Phaser intro fades
  useEffect(() => {
    if (!isGameStarted || openingShown) return;
    if (story.scene !== 'cell' || story.dialogueHistory.length > 0) return;
    const timer = setTimeout(() => {
      setOpeningShown(true);
      setDialog({
        speaker: 'Elara',
        text: 'Cold stone. Iron bars. My breath fogs the dark. Nothing in my hands.\n\nKaelen is on watch through the bars. There has to be a way out of here.',
        options: [{ label: 'Look for a way out', action: () => setDialog(null) }],
      });
    }, 4000);
    return () => clearTimeout(timer);
  }, [isGameStarted, openingShown, story.scene, story.dialogueHistory.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
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
      rat: interactRat,
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

  const interactRat = () => {
    if (story.flags.ratPaid) {
      setDialog({
        speaker: 'Guard-rat',
        text: 'The rat has gone. Only scratch marks and the smell of coin remain.',
        options: [{ label: 'Step away', action: () => setDialog(null) }],
      });
      return;
    }

    setDialog({
      speaker: 'Guard-rat',
      text: 'The rat fixes you with one glassy eye. It knows something. It wants coin.',
      options: [
        {
          label: walletAddress ? 'Slip it 0.01 SOL (Devnet)' : 'Connect wallet to bribe the rat',
          disabled: isAiLoading,
          action: async () => {
            if (!walletAddress) {
              try {
                const addr = await SolanaService.connect();
                setWalletAddress(addr);
                setDialog({
                  speaker: 'Guard-rat',
                  text: 'Wallet connected. Try again to pay the rat.',
                  options: [{ label: 'Understood', action: () => setDialog(null) }],
                });
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Unknown wallet error.';
                setDialog({
                  speaker: 'Guard-rat',
                  text: `*Squeak*... no wallet found. ${msg}`,
                  options: [{ label: 'Back away', action: () => setDialog(null) }],
                });
              }
              return;
            }

            setIsAiLoading(true);
            setDialog({ speaker: 'Guard-rat', text: '*Squeak*... counting the coin...', options: [] });

            try {
              await SolanaService.sendBribe(walletAddress);
              const hint = await GeminiService.generateRatHint();
              updateStory((state) => addLog({
                ...state,
                flags: { ...state.flags, ratPaid: true },
              }, `Rat hint: ${hint}`));
              setDialog({
                speaker: 'Guard-rat',
                text: hint,
                options: [{ label: 'Remember the hint', action: () => setDialog(null) }],
              });
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Transaction failed.';
              setDialog({
                speaker: 'Guard-rat',
                text: `*Squeak*... the coin bounced back. ${msg}`,
                options: [{ label: 'Back away', action: () => setDialog(null) }],
              });
            } finally {
              setIsAiLoading(false);
            }
          },
        },
        { label: 'Back away', action: () => setDialog(null) },
      ],
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleCellKaelenInput = React.useCallback(async (playerLine: string) => {
    setIsAiLoading(true);
    setDialog(prev => prev ? { ...prev, text: '...', options: [], inputMode: false } : null);
    try {
      const { line, escaped } = await GeminiService.generateKaelenResponse(
        playerLine, storyRef.current.dialogueHistory,
      );
      updateStory(state => recordChoice(state, playerLine));
      if (escaped) {
        updateStory(state => addItem(addLog({
          ...state, flags: { ...state.flags, kaelenMood: 'merciful' },
        }, 'Kaelen slides the key under the bars.'), 'rusted_key'));
        setDialog({
          speaker: 'Kaelen',
          text: line || "Kaelen slides a key under the bars without a word.",
          options: [{ label: 'Take the key', action: () => setDialog(null) }],
        });
      } else {
        updateStory(state => ({ ...state, flags: { ...state.flags, kaelenMood: 'hostile' } }));
        setDialog({
          speaker: 'Kaelen',
          text: line,
          options: [{ label: 'Walk away', action: () => setDialog(null) }],
          inputMode: true,
          onInput: handleCellKaelenInput,
        });
      }
    } catch (err: unknown) {
      const canRetry = GeminiService.isConfigured();
      setDialog({
        speaker: 'Kaelen',
        text: formatKaelenGeminiError(err),
        options: [{ label: 'Step back', action: () => setDialog(null) }],
        inputMode: canRetry,
        onInput: canRetry ? handleCellKaelenInput : undefined,
      });
    } finally {
      setIsAiLoading(false);
    }
  }, []); // stable — reads fresh story via storyRef

  const openKaelenCell = async () => {
    setIsAiLoading(true);
    setDialog({ speaker: 'Kaelen', text: '...', options: [] });

    try {
      const line = await GeminiService.generateKaelenGreeting('cell', storyRef.current);
      setDialog({
        speaker: 'Kaelen',
        text: line,
        options: [{ label: 'Back away', action: () => setDialog(null) }],
        inputMode: true,
        onInput: handleCellKaelenInput,
      });
    } catch (err: unknown) {
      const canRetry = GeminiService.isConfigured();
      setDialog({
        speaker: 'Kaelen',
        text: formatKaelenGeminiError(err),
        options: [{ label: 'Back away', action: () => setDialog(null) }],
        inputMode: canRetry,
        onInput: canRetry ? handleCellKaelenInput : undefined,
      });
    } finally {
      setIsAiLoading(false);
    }
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleGateKaelenInput = React.useCallback(async (playerLine: string) => {
    setIsAiLoading(true);
    setDialog(prev => prev ? { ...prev, text: '...', options: [], inputMode: false } : null);
    try {
      const { line, escaped } = await GeminiService.generateKaelenResponse(
        playerLine, storyRef.current.dialogueHistory,
      );
      updateStory(state => recordChoice(state, playerLine));
      if (escaped) {
        updateStory(state => addLog(recordChoice({
          ...state, flags: { ...state.flags, kaelenMood: 'merciful', gateOutcome: 'persuaded' },
        }, playerLine), 'Kaelen lowers his spear and lets Elara pass.'));
        setDialog({
          speaker: 'Kaelen',
          text: line || "Kaelen steps aside. His eyes say he won't report this.",
          options: [{ label: 'Walk through the gate', action: () => goToScene('outskirts', 'Kaelen turns his back on the order and opens the way.') }],
        });
      } else {
        setDialog({
          speaker: 'Kaelen',
          text: line,
          options: [{ label: 'Draw steel', action: startCombat }],
          inputMode: true,
          onInput: handleGateKaelenInput,
        });
      }
    } catch (err: unknown) {
      const canRetry = GeminiService.isConfigured();
      setDialog({
        speaker: 'Kaelen',
        text: formatKaelenGeminiError(err),
        options: [{ label: 'Fight', action: startCombat }],
        inputMode: canRetry,
        onInput: canRetry ? handleGateKaelenInput : undefined,
      });
    } finally {
      setIsAiLoading(false);
    }
  }, []); // stable — reads fresh story via storyRef

  const openGateKaelen = async () => {
    setIsAiLoading(true);
    setDialog({ speaker: 'Kaelen', text: '...', options: [] });

    try {
      const line = await GeminiService.generateKaelenGreeting('gate', storyRef.current);
      setDialog({
        speaker: 'Kaelen',
        text: line,
        options: [
          { label: 'Use the Rusted Key side-path', disabled: !hasItem('rusted_key'), action: useGateKey },
          { label: 'Blast the gate with the Purple Rune', disabled: !hasItem('purple_rune'), action: blastRuneGate },
          { label: 'Draw steel', action: startCombat },
        ],
        inputMode: true,
        onInput: handleGateKaelenInput,
      });
    } catch (err: unknown) {
      const canRetry = GeminiService.isConfigured();
      setDialog({
        speaker: 'Kaelen',
        text: formatKaelenGeminiError(err),
        options: [
          { label: 'Use the Rusted Key side-path', disabled: !hasItem('rusted_key'), action: useGateKey },
          { label: 'Blast the gate with the Purple Rune', disabled: !hasItem('purple_rune'), action: blastRuneGate },
          { label: 'Draw steel', action: startCombat },
        ],
        inputMode: canRetry,
        onInput: canRetry ? handleGateKaelenInput : undefined,
      });
    } finally {
      setIsAiLoading(false);
    }
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
    setOpeningShown(false);
  };

  const handleStartGame = () => {
    resetGame();
    setIsGameStarted(true);
    setIsLoading(true);
  };

  const handleLoadGame = () => {
    setIsGameStarted(true);
    setIsLoading(true);
  };

  const handleLoadingComplete = () => {
    setIsLoading(false);
    setShowReveal(true);
    setHudKey(k => k + 1);
    setTimeout(() => setShowReveal(false), 1500);
  };

  const hasSave = useMemo(() => localStorage.getItem('shadow_toll_story') !== null, [isGameStarted]);

  if (!isGameStarted) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-8 font-pixel bg-[#08060d]">
        <img 
          src="/starting-screen.png" 
          className="absolute inset-0 w-full h-full object-cover -z-10" 
          alt=""
          style={{ opacity: isPreloaded ? 1 : 0, transition: 'opacity 0.8s ease' }}
          loading="eager"
          // @ts-ignore - fetchpriority is a new attribute
          fetchpriority="high"
        />
        <div className="absolute inset-0 bg-black/10" />

        {isPreloaded && !isSettingsOpen && (
          <div 
            className="w-full max-w-lg flex flex-col items-center gap-6 relative z-10 mt-[32rem] font-['Press_Start_2P']"
            style={{ animation: 'fadeIn 0.5s ease-out forwards' }}
          >
            <button
              onClick={handleStartGame}
              className="group relative flex items-center justify-center text-white text-2xl uppercase cursor-pointer transition-all hover:scale-105"
              style={{ textShadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}
            >
              <span className="absolute -left-10 group-hover:opacity-100 opacity-0 transition-opacity">{">"}</span>
              START GAME
            </button>

            <button
              onClick={hasSave ? handleLoadGame : undefined}
              className={`group relative flex items-center justify-center text-white/80 text-xl uppercase transition-all ${
                hasSave ? 'cursor-pointer hover:opacity-100 hover:scale-105' : 'cursor-not-allowed opacity-60'
              }`}
              style={{ textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}
            >
              <span className="absolute -left-10 group-hover:opacity-100 opacity-0 transition-opacity">{">"}</span>
              [LOAD GAME]
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="group relative flex items-center justify-center text-white/80 text-xl uppercase cursor-pointer transition-all hover:opacity-100 hover:scale-105"
              style={{ textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}
            >
              <span className="absolute -left-10 group-hover:opacity-100 opacity-0 transition-opacity">{">"}</span>
              [SETTINGS]
            </button>

            <button
              className="group relative flex items-center justify-center text-white/80 text-xl uppercase cursor-not-allowed opacity-60 transition-all hover:opacity-100 hover:scale-105"
              style={{ textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}
            >
              <span className="absolute -left-10 group-hover:opacity-100 opacity-0 transition-opacity">{">"}</span>
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
      <div style={{ visibility: isLoading ? 'hidden' : 'visible' }}>
        <PhaserGame 
          storyState={story} 
          uiVisible={uiVisible} 
          onGameAction={handleGameAction} 
          onToggleUI={() => setUiVisible(v => !v)}
          onToggleInventory={() => setInventoryOpen(v => !v)}
        />
      </div>

      {isLoading && <LoadingScreen onComplete={handleLoadingComplete} />}

      {showReveal && <div className="game-reveal-overlay" />}

      {!isLoading && uiVisible && (
        <React.Fragment key={hudKey}>
          <img src="/UI.png" className="game-frame-overlay" alt="" />

          {/* Top-left: character portrait */}
          <div className="ui-portrait">
            <img src="/portrait.png" className="ui-portrait-img" alt="Character" />
          </div>

          {/* Top-left: HP bars to the right of portrait */}
          <div className="ui-hp-section">
            <div className="ui-char-name">ELARA</div>
            <div className="ui-hp-bar ui-hp-bar--health">
              <div className="ui-hp-fill" style={{ width: `${(story.health / story.maxHealth) * 100}%` }} />
            </div>
            <div className="ui-hp-bar ui-hp-bar--stamina">
              <div className="ui-hp-fill ui-hp-fill--secondary" style={{ width: '100%' }} />
            </div>
          </div>

          {/* Gold display – bottom of left panel */}
          <div className="ui-gold">
            <KeyRound size={13} />
            <span>{story.gold}</span>
          </div>

          {/* Story log – left side below character panel */}
          <div className="ui-story-log">
            {story.log.slice(0, 5).map((entry, index) => (
              <p key={`${entry}-${index}`}>{entry}</p>
            ))}
          </div>

          {/* Top-right: action buttons */}
          <div className="ui-action-buttons">
            <button className="ui-icon-btn" onClick={() => setInventoryOpen(true)} title="Inventory">
              <Package size={20} />
            </button>
            <button
              className="ui-icon-btn"
              title={walletAddress ? `Connected: ${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}` : 'Connect Phantom wallet'}
              onClick={async () => {
                if (walletAddress) return;
                try {
                  const addr = await SolanaService.connect();
                  setWalletAddress(addr);
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : 'Wallet error';
                  console.warn('Wallet connect failed:', msg);
                }
              }}
              style={{ opacity: walletAddress ? 1 : 0.6 }}
            >
              <Wallet size={20} />
            </button>
            <button className="ui-icon-btn" onClick={resetGame} title="Reset story">
              <RotateCcw size={20} />
            </button>
          </div>

          {/* Bottom: 10-slot hotbar */}
          <div className="ui-hotbar">
            {Array.from({ length: 10 }).map((_, i) => {
              const item = inventory[i];
              return (
                <div
                  key={i}
                  className={`ui-slot${item?.id === 'purple_rune' ? ' cursed' : ''}`}
                  title={item?.description}
                >
                  {item && <span className="ui-slot-icon">{item.icon}</span>}
                  <small className="ui-slot-num">{i + 1}</small>
                </div>
              );
            })}
          </div>
        </React.Fragment>
      )}

      {dialog && <DialogOverlay dialog={dialog} isLoading={isAiLoading} onClose={() => !isAiLoading && setDialog(null)} />}
      {inventoryOpen && <InventoryOverlay items={inventory} gold={story.gold} onClose={() => setInventoryOpen(false)} />}
      {combat && (
        <CombatOverlay
          combat={combat}
          onStrike={strikeKaelen}
          onGuard={guardKaelen}
          onRetry={retryCombat}
        />
      )}

      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]" />
    </div>
  );
};

const DialogOverlay: React.FC<{ dialog: DialogState; isLoading?: boolean; onClose: () => void }> = ({ dialog, isLoading, onClose }) => {
  const [inputText, setInputText] = React.useState('');

  const handleSubmit = () => {
    const trimmed = inputText.trim();
    if (!trimmed || isLoading || !dialog.onInput) return;
    setInputText('');
    dialog.onInput(trimmed);
  };

  return (
    <div className="dialog-shell">
      <div className="dialog-panel">
        <button className="dialog-close" onClick={onClose} disabled={isLoading}><X size={18} /></button>
        <div className="speaker">
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {dialog.speaker}
        </div>
        <p>{dialog.text}</p>

        {dialog.inputMode && (
          <div className="dialog-input-row">
            <input
              type="text"
              className="dialog-input"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleSubmit(); }}
              placeholder="What do you say..."
              disabled={isLoading}
              autoFocus
            />
            <button
              className="dialog-send"
              onClick={handleSubmit}
              disabled={isLoading || !inputText.trim()}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        <div className="dialog-options">
          {dialog.options.map((option) => (
            <button key={option.label} onClick={option.action} disabled={option.disabled || isLoading}>
              <ChevronRight size={16} />
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

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
      <div className="inventory-gold">
        <KeyRound size={20} className="inline mr-2" />
        {gold} GOLD
      </div>
    </div>
  </div>
);

const CombatOverlay: React.FC<{
  combat: CombatState;
  onStrike: () => void;
  onGuard: () => void;
  onRetry: () => void;
}> = ({ combat, onStrike, onGuard, onRetry }) => {
  const defeated = combat.elara <= 0;
  const elaraHP = (combat.elara / 6) * 100;
  const kaelenHP = (combat.kaelen / 6) * 100;

  return (
    <div className="combat-overlay">
      <div className="combat-panel">
        <button className="dialog-close" onClick={onRetry}><X size={18} /></button>
        <h2>Kaelen's Order</h2>
        <p>{defeated ? 'Elara falls to one knee. The bridge blurs. Try the duel again.' : combat.message}</p>
        
        <div className="flex flex-col gap-6 mt-8">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '12px', color: '#ffe0a0' }}>ELARA</span>
              <span style={{ fontSize: '14px', color: '#d4a373' }}>{Math.max(0, combat.elara)} / 6</span>
            </div>
            <div style={{
              width: '100%', height: '12px',
              background: 'rgba(0,0,0,0.6)',
              border: '2px solid #4a3020',
              position: 'relative',
              boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
            }}>
              <div style={{
                width: `${elaraHP}%`, height: '100%',
                background: 'linear-gradient(180deg, #8a6838 0%, #c09050 50%, #8a6838 100%)',
                transition: 'width 0.3s ease-out'
              }} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '12px', color: '#ffe0a0' }}>KAELEN</span>
              <span style={{ fontSize: '14px', color: '#d4a373' }}>{combat.kaelen} / 6</span>
            </div>
            <div style={{
              width: '100%', height: '12px',
              background: 'rgba(0,0,0,0.6)',
              border: '2px solid #4a3020',
              position: 'relative',
              boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
            }}>
              <div style={{
                width: `${kaelenHP}%`, height: '100%',
                background: 'linear-gradient(180deg, #581c1c 0%, #991b1b 50%, #581c1c 100%)',
                transition: 'width 0.3s ease-out'
              }} />
            </div>
          </div>
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
    return { ...INITIAL_STORY_STATE, ...JSON.parse(raw) };
  } catch {
    return INITIAL_STORY_STATE;
  }
};

export default App;

const LoadingScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let currentProgress = 0;
    let timer: ReturnType<typeof setTimeout>;

    const updateProgress = () => {
      const remaining = 100 - currentProgress;
      const increment = Math.random() * (remaining * 0.3) + 1.0;
      currentProgress = Math.min(currentProgress + increment, 99.9);
      setProgress(currentProgress);

      if (currentProgress < 99.9) {
        const delay = Math.random() * 300 + 50;
        timer = setTimeout(updateProgress, delay);
      } else {
        setTimeout(() => {
          setProgress(100);
          setTimeout(() => onCompleteRef.current(), 400);
        }, 400);
      }
    };

    const initialDelay = setTimeout(updateProgress, 200);
    return () => {
      clearTimeout(initialDelay);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-end pb-[15vh] font-pixel overflow-hidden z-[200]">
      <img 
        src="/starting-screen.png" 
        className="absolute inset-0 w-full h-full object-cover -z-10" 
        alt=""
        loading="eager"
        // @ts-ignore - fetchpriority is a new attribute
        fetchpriority="high"
      />
      <div className="w-full max-w-lg flex flex-col items-center gap-4 relative z-10 px-8">
        <div 
          style={{ 
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '1.5rem', /* text-2xl */
            color: '#fff',
            textShadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
            marginRight: '-1.5rem', /* Offset the three dots to center the word "LOADING" */
          }}
          className="animate-pulse mb-6 uppercase"
        >
          LOADING...
        </div>

        <div className="w-full relative">
          {/* Rounded Track */}
          <div style={{
            width: '100%', height: '14px',
            background: 'rgba(0,0,0,0.6)',
            border: '2px solid #4a3020',
            borderRadius: '10px',
            overflow: 'visible', /* Changed to visible to let the acorn hang over */
            boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
            position: 'relative'
          }}>
            {/* Rounded Progress Fill */}
            <div style={{
              width: `${progress}%`, height: '100%',
              background: 'linear-gradient(180deg, #8a6838 0%, #c09050 50%, #8a6838 100%)',
              transition: 'width 0.4s ease-out',
              borderRadius: '10px'
            }} />
            
            {/* Acorn Indicator */}
            <img 
               src="/settings-sprite-acorn.png" 
               alt="" 
               draggable={false}
               style={{
                  position: 'absolute',
                  left: `calc(${progress}% - 12px)`,
                  top: '-10px',
                  width: '24px',
                  height: `${24 * (367/287)}px`,
                  imageRendering: 'pixelated',
                  transition: 'left 0.4s ease-out',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
                  zIndex: 25
               }}
             />
          </div>

          {/* Percentage */}
          <div style={{
            position: 'absolute', top: '22px', right: '4px',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '10px', color: '#f0e0a0',
            textShadow: '1px 1px 0 #000'
          }}>
            {Math.floor(progress)}%
          </div>
        </div>
      </div>
    </div>
  );
};
