import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ChevronRight, KeyRound, Loader2, Package, RotateCcw, Shield, Sparkles, Wallet, X } from 'lucide-react';
import { PhaserGame } from './components/PhaserGame';
import { SettingsWindow } from './components/SettingsWindow';
import { StoryLogWindow } from './components/StoryLogWindow';
import { GeminiService } from './services/GeminiService';
import { SolanaService } from './services/SolanaService';
import { gameStore, type SettingsState } from './store/gameStore';
import {
  ALL_ASSET_URLS,
  GAME_SHELL_ASSET_URLS,
  MENU_ASSET_URLS,
  preloadBrowserAssets,
  warmBrowserAssetCache,
} from './game/assetManifest';
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
  kaelenMax: number;
  elara: number;
  elaraMax: number;
  message: string;
};

const DIFFICULTY_RULES: Record<string, { kaelenHealth: number; strikeDamage: number; counterDamage: number; guardHeal: number }> = {
  Story: { kaelenHealth: 4, strikeDamage: 3, counterDamage: 0, guardHeal: 2 },
  Easy: { kaelenHealth: 5, strikeDamage: 3, counterDamage: 1, guardHeal: 2 },
  Normal: { kaelenHealth: 6, strikeDamage: 2, counterDamage: 1, guardHeal: 1 },
  Hard: { kaelenHealth: 8, strikeDamage: 2, counterDamage: 2, guardHeal: 1 },
  Nightmare: { kaelenHealth: 10, strikeDamage: 1, counterDamage: 2, guardHeal: 1 },
};

const getDifficultyRules = (difficulty: string) => DIFFICULTY_RULES[difficulty] ?? DIFFICULTY_RULES.Normal;

const getMusicVolume = (settings: SettingsState) => settings.audio.masterVolume * settings.audio.musicVolume;

const syncMusicPlayback = (audio: HTMLAudioElement, settings: SettingsState, shouldPlay: boolean) => {
  const volume = getMusicVolume(settings);
  audio.volume = volume;
  audio.muted = volume <= 0;

  if (volume <= 0 || !shouldPlay) {
    audio.pause();
    return;
  }

  audio.play().catch(() => {
    console.log('Audio autoplay blocked, waiting for interaction');
  });
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
  const [isStoryLogOpen, setIsStoryLogOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
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
  const [staminaPercent, setStaminaPercent] = useState(1);
  const [interactionPrompt, setInteractionPrompt] = useState('');
  const [gameShellProgress, setGameShellProgress] = useState(0);
  const [gameShellReady, setGameShellReady] = useState(false);
  const [phaserProgress, setPhaserProgress] = useState(0);
  const [phaserAssetsReady, setPhaserAssetsReady] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsState>(() => gameStore.getSettings());
  const storyRef = React.useRef(story);

  useEffect(() => {
    storyRef.current = story;
  }, [story]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const applyFullscreenPreference = React.useCallback((enabled: boolean) => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      msFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void>;
      msExitFullscreen?: () => Promise<void>;
    };
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };
    const fullscreenElement = document.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement;

    if (enabled && !fullscreenElement) {
      const request = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
      request?.call(docEl)?.catch((err: Error) => {
        console.warn(`Error attempting to enable fullscreen mode: ${err.message}`);
      });
      return;
    }

    if (!enabled && fullscreenElement) {
      const exit = document.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
      exit?.call(document)?.catch((err: Error) => {
        console.warn(`Error attempting to exit fullscreen mode: ${err.message}`);
      });
    }
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/soundtrack.mp3');
      audioRef.current.loop = true;
    }
    syncMusicPlayback(audioRef.current, settings, isPreloaded);
  }, [isPreloaded, settings]);

  useEffect(() => {
    const handleSettingsChange = (event: Event) => {
      const nextSettings = (event as CustomEvent<SettingsState>).detail;
      setSettings(nextSettings);
      applyFullscreenPreference(nextSettings.video.fullscreen);
    };
    gameStore.addEventListener('settingsChange', handleSettingsChange);
    return () => {
      gameStore.removeEventListener('settingsChange', handleSettingsChange);
    };
  }, [applyFullscreenPreference]);

  useEffect(() => {
    let cancelled = false;

    preloadBrowserAssets(MENU_ASSET_URLS)
      .then(() => {
        if (cancelled) return;
        setIsPreloaded(true);
        void warmBrowserAssetCache(ALL_ASSET_URLS);
      })
      .catch((error: unknown) => {
        console.error('Failed to preload menu assets:', error);
        if (!cancelled) setIsPreloaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (settings.gameplay.autoSave) {
      localStorage.setItem('shadow_toll_story', JSON.stringify(story));
    }
  }, [story, settings.gameplay.autoSave]);

  // Opening monologue — fires once after the Phaser intro fades
  useEffect(() => {
    if (!isGameStarted || openingShown) return;
    if (story.scene !== 'cell' || story.dialogueHistory.length > 0) return;
    const timer = setTimeout(() => {
      setOpeningShown(true);
      const text = 'Cold stone. Iron bars. My breath fogs the dark. Nothing in my hands.\n\nKaelen is on watch through the bars. There has to be a way out of here.';
      updateStory(state => ({
        ...state,
        fullHistory: [...(state.fullHistory || []), {
          speaker: 'Elara',
          text,
          timestamp: Date.now(),
          type: 'dialogue'
        }]
      }));
      setDialog({
        speaker: 'Elara',
        text,
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

  const enterFullscreen = React.useCallback(() => {
    applyFullscreenPreference(settings.video.fullscreen);
  }, [applyFullscreenPreference, settings.video.fullscreen]);

  useEffect(() => {
    const handleInitialInteraction = () => {
      enterFullscreen();
      if (audioRef.current) {
        syncMusicPlayback(audioRef.current, settings, isPreloaded);
      }
      document.removeEventListener('mousedown', handleInitialInteraction);
      document.removeEventListener('keydown', handleInitialInteraction);
    };
    document.addEventListener('mousedown', handleInitialInteraction);
    document.addEventListener('keydown', handleInitialInteraction);
    return () => {
      document.removeEventListener('mousedown', handleInitialInteraction);
      document.removeEventListener('keydown', handleInitialInteraction);
    };
  }, [enterFullscreen, isPreloaded, settings]);

  const inventory = useMemo(() => story.inventory.map((id) => STORY_ITEMS[id]), [story.inventory]);

  const updateStory = (updater: (state: StoryState) => StoryState) => {
    setStory((current) => updater(current));
  };

  const addLog = (state: StoryState, entry: string): StoryState => ({
    ...state,
    log: [entry, ...state.log].slice(0, 8),
    fullHistory: [...(state.fullHistory || []), {
      speaker: 'System',
      text: entry,
      timestamp: Date.now(),
      type: 'system',
    }],
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

  const recordChoice = (state: StoryState, choice: string, speaker = 'Elara'): StoryState => ({
    ...state,
    dialogueHistory: [...state.dialogueHistory, choice].slice(-20),
    fullHistory: [...(state.fullHistory || []), {
      speaker,
      text: choice,
      timestamp: Date.now(),
      type: 'dialogue',
    }],
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

  async function handleCellKaelenInput(playerLine: string) {
    setIsAiLoading(true);
    setDialog(prev => prev ? { ...prev, text: '...', options: [], inputMode: false } : null);
    try {
      const { line, escaped } = await GeminiService.generateKaelenResponse(
        playerLine, storyRef.current.dialogueHistory,
      );
      updateStory(state => recordChoice(state, playerLine));
      const npcLine = line || "Kaelen slides a key under the bars without a word.";
      updateStory(state => ({
        ...state,
        fullHistory: [...(state.fullHistory || []), {
          speaker: 'Kaelen',
          text: npcLine,
          timestamp: Date.now(),
          type: 'dialogue'
        }]
      }));

      if (escaped) {
        updateStory(state => addItem(addLog({
          ...state, flags: { ...state.flags, kaelenMood: 'merciful' },
        }, 'Kaelen slides the key under the bars.'), 'rusted_key'));
        setDialog({
          speaker: 'Kaelen',
          text: npcLine,
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
  }

  const openKaelenCell = async () => {
    setIsAiLoading(true);
    setDialog({ speaker: 'Kaelen', text: '...', options: [] });

    try {
      const line = await GeminiService.generateKaelenGreeting('cell', storyRef.current);
      updateStory(state => ({
        ...state,
        fullHistory: [...(state.fullHistory || []), {
          speaker: 'Kaelen',
          text: line,
          timestamp: Date.now(),
          type: 'dialogue'
        }]
      }));
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

  async function handleGateKaelenInput(playerLine: string) {
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
  }

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

  function startCombat() {
    const rules = getDifficultyRules(settings.gameplay.difficulty);
    setDialog(null);
    setCombat({
      kaelen: rules.kaelenHealth,
      kaelenMax: rules.kaelenHealth,
      elara: story.health,
      elaraMax: story.maxHealth,
      message: 'Kaelen raises his shield. Time your strikes and guard when you are hurt.',
    });
  }

  const strikeKaelen = () => {
    setCombat((current) => {
      if (!current) return current;
      const rules = getDifficultyRules(settings.gameplay.difficulty);
      const kaelen = Math.max(0, current.kaelen - rules.strikeDamage);
      const elara = kaelen <= 0 ? current.elara : Math.max(0, current.elara - rules.counterDamage);
      if (kaelen <= 0) {
        winCombat(elara);
        return null;
      }
      return { ...current, kaelen, elara, message: 'Your dagger finds a gap. Kaelen answers with the haft of his spear.' };
    });
  };

  const guardKaelen = () => {
    setCombat((current) => {
      if (!current) return current;
      const rules = getDifficultyRules(settings.gameplay.difficulty);
      const elara = Math.min(current.elaraMax, current.elara + rules.guardHeal);
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
    const rules = getDifficultyRules(settings.gameplay.difficulty);
    setCombat({
      kaelen: rules.kaelenHealth,
      kaelenMax: rules.kaelenHealth,
      elara: story.maxHealth,
      elaraMax: story.maxHealth,
      message: 'You steady yourself and try the duel again.',
    });
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
    enterFullscreen();
    resetGame();
    setGameShellProgress(0);
    setGameShellReady(false);
    setPhaserProgress(0);
    setPhaserAssetsReady(false);
    setLoadingError(null);
    setIsGameStarted(true);
    setIsLoading(true);
  };

  const handleLoadGame = () => {
    enterFullscreen();
    setGameShellProgress(0);
    setGameShellReady(false);
    setPhaserProgress(0);
    setPhaserAssetsReady(false);
    setLoadingError(null);
    setIsGameStarted(true);
    setIsLoading(true);
  };

  const handleLoadingComplete = React.useCallback(() => {
    setIsLoading(false);
    setShowReveal(true);
    setHudKey(k => k + 1);
    setTimeout(() => setShowReveal(false), 1500);
  }, []);

  useEffect(() => {
    if (!isGameStarted || !isLoading) return;

    let cancelled = false;

    preloadBrowserAssets(GAME_SHELL_ASSET_URLS, ({ loaded, total }) => {
      if (!cancelled) setGameShellProgress(total === 0 ? 1 : loaded / total);
    })
      .then(() => {
        if (!cancelled) setGameShellReady(true);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to load game shell assets.';
        if (!cancelled) setLoadingError(message);
      });

    return () => {
      cancelled = true;
    };
  }, [isGameStarted, isLoading]);

  useEffect(() => {
    if (!isLoading || !gameShellReady || !phaserAssetsReady || loadingError) return;
    const timer = setTimeout(handleLoadingComplete, 0);
    return () => clearTimeout(timer);
  }, [gameShellReady, handleLoadingComplete, isLoading, loadingError, phaserAssetsReady]);

  const loadingProgress = Math.round(((gameShellProgress * 0.35) + (phaserProgress * 0.65)) * 100);

  const hasSave = localStorage.getItem('shadow_toll_story') !== null;

  if (!isGameStarted) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-8 font-pixel bg-[#08060d]">
        <img 
          src="/starting-screen.webp" 
          className="absolute inset-0 w-full h-full object-cover -z-10" 
          alt=""
          style={{ opacity: isPreloaded ? 1 : 0, transition: 'opacity 0.8s ease' }}
          loading="eager"
          // @ts-expect-error - fetchpriority is not in every React type bundle yet.
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

        <SettingsWindow isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} isGameStarted={isGameStarted} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-game-bg select-none font-pixel">
      <div style={{ visibility: isLoading ? 'hidden' : 'visible' }}>
        <PhaserGame 
          storyState={story} 
          settings={settings}
          uiVisible={uiVisible} 
          onGameAction={handleGameAction} 
          onToggleUI={() => setUiVisible(v => !v)}
          onToggleInventory={() => setInventoryOpen(v => !v)}
          onStaminaUpdate={(p) => setStaminaPercent(p)}
          onInteractionPrompt={(p) => setInteractionPrompt(p)}
          onAssetProgress={setPhaserProgress}
          onAssetsReady={() => setPhaserAssetsReady(true)}
          onAssetError={(asset) => setLoadingError(`Failed to load ${asset}`)}
        />
      </div>

      {isLoading && <LoadingScreen progress={loadingProgress} error={loadingError} />}

      {showReveal && <div className="game-reveal-overlay" />}

      {!isLoading && uiVisible && (
        <React.Fragment key={hudKey}>
          <img src="/UI.webp" className="game-frame-overlay" alt="" />

          {/* Top-left: character portrait */}
          <div className="ui-portrait">
            <img src="/portrait.webp" className="ui-portrait-img" alt="Character" />
          </div>

          {/* Top-left: HP bars to the right of portrait */}
          <div className="ui-hp-section">
            <div className="ui-char-name">ELARA</div>
            <div className="ui-hp-bar ui-hp-bar--health">
              <div className="ui-hp-fill" style={{ width: `${(story.health / story.maxHealth) * 100}%` }} />
            </div>
            <div className="ui-hp-bar ui-hp-bar--stamina">
              <div className="ui-hp-fill ui-hp-fill--secondary" style={{ width: `${staminaPercent * 100}%` }} />
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

          <button
            className="ui-settings-hitbox"
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
          />

          <button
            className="ui-inventory-hitbox"
            onClick={() => setInventoryOpen(true)}
            title="Inventory"
          />

          <button
            className="ui-story-log-hitbox"
            onClick={() => setIsStoryLogOpen(true)}
            title="Story Log"
          />

          <button
            className="ui-reset-hitbox"
            onClick={() => setIsResetConfirmOpen(true)}
            title="Reset Game"
          />

          {/* Interaction prompt */}
          {interactionPrompt && settings.gameplay.tutorialTooltips && !dialog && !inventoryOpen && !combat && !isStoryLogOpen && !isResetConfirmOpen && (
            <div className="ui-interaction-prompt">
              {interactionPrompt}
            </div>
          )}

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
      <SettingsWindow isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} isGameStarted={isGameStarted} />
      <StoryLogWindow isOpen={isStoryLogOpen} onClose={() => setIsStoryLogOpen(false)} history={story.fullHistory} />
      {isResetConfirmOpen && (
        <SystemConfirmModal 
          title="RESET DESTINY"
          message="Are you certain you wish to unravel the threads of this journey? All progress will be lost to the mists of time."
          onConfirm={() => { resetGame(); setIsResetConfirmOpen(false); }}
          onCancel={() => setIsResetConfirmOpen(false)}
          confirmLabel="RESET"
          cancelLabel="CANCEL"
        />
      )}

      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]" />
    </div>
  );
};

const SystemConfirmModal: React.FC<{
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
  cancelLabel: string;
}> = ({ title, message, onConfirm, onCancel, confirmLabel, cancelLabel }) => (
  <div className="dialog-shell" style={{ alignItems: 'center', zIndex: 120 }}>
    <div className="dialog-panel" style={{ width: '400px', textAlign: 'center' }}>
      <div style={{ 
        fontFamily: "'Press Start 2P', monospace", 
        fontSize: '14px', 
        color: '#f0e0a0', 
        marginBottom: '20px',
        textShadow: '2px 2px 0 #000'
      }}>
        {title}
      </div>
      <p style={{ marginBottom: '30px' }}>{message}</p>
      <div className="dialog-options" style={{ justifyContent: 'center', gap: '20px' }}>
        <button onClick={onConfirm} style={{ color: '#ffb4a0' }}>
          <RotateCcw size={16} />
          {confirmLabel}
        </button>
        <button onClick={onCancel}>
          <X size={16} />
          {cancelLabel}
        </button>
      </div>
    </div>
  </div>
);

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
  const elaraHP = (combat.elara / combat.elaraMax) * 100;
  const kaelenHP = (combat.kaelen / combat.kaelenMax) * 100;

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
              <span style={{ fontSize: '14px', color: '#d4a373' }}>{Math.max(0, combat.elara)} / {combat.elaraMax}</span>
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
              <span style={{ fontSize: '14px', color: '#d4a373' }}>{combat.kaelen} / {combat.kaelenMax}</span>
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

const LoadingScreen: React.FC<{ progress: number; error: string | null }> = ({ progress, error }) => {
  const safeProgress = Math.max(0, Math.min(100, progress));
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-end pb-[15vh] font-pixel overflow-hidden z-[200]">
      <img 
        src="/starting-screen.webp" 
        className="absolute inset-0 w-full h-full object-cover -z-10" 
        alt=""
        loading="eager"
        // @ts-expect-error - fetchpriority is not in every React type bundle yet.
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
          {error ? 'LOAD FAILED' : 'LOADING...'}
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
              width: `${safeProgress}%`, height: '100%',
              background: 'linear-gradient(180deg, #8a6838 0%, #c09050 50%, #8a6838 100%)',
              transition: 'width 0.4s ease-out',
              borderRadius: '10px'
            }} />
            
            {/* Acorn Indicator */}
            <img 
               src="/settings-sprite-acorn.webp" 
               alt="" 
               draggable={false}
               style={{
                  position: 'absolute',
                  left: `calc(${safeProgress}% - 12px)`,
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
            {Math.floor(safeProgress)}%
          </div>
          {error && (
            <div style={{
              marginTop: '44px',
              fontFamily: "'VT323', monospace",
              fontSize: '20px',
              color: '#ffb4a0',
              textShadow: '2px 2px 0 #000',
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
