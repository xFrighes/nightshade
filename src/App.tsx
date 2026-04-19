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
  guard: number;
  guardMax: number;
  elara: number;
  elaraMax: number;
  message: string;
};

const DIFFICULTY_RULES: Record<string, { guardHealth: number; strikeDamage: number; counterDamage: number; guardHeal: number }> = {
  Story: { guardHealth: 4, strikeDamage: 3, counterDamage: 0, guardHeal: 2 },
  Easy: { guardHealth: 5, strikeDamage: 3, counterDamage: 1, guardHeal: 2 },
  Normal: { guardHealth: 6, strikeDamage: 2, counterDamage: 1, guardHeal: 1 },
  Hard: { guardHealth: 8, strikeDamage: 2, counterDamage: 2, guardHeal: 1 },
  Nightmare: { guardHealth: 10, strikeDamage: 1, counterDamage: 2, guardHeal: 1 },
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

const formatGuardGeminiError = (err: unknown): string => {
  const message = err instanceof Error ? err.message : 'Gemini failed to answer.';
  return `Gemini could not answer as the Guard. ${message}`;
};

const guardCellGreeting = 'The Guard keeps one hand on the ring of keys. "Do not make me choose between orders and mercy tonight."';

const guardGateGreeting = 'The Guard blocks the bridge with his spear lowered but not leveled. "One more step and I have to become the kind of man this city pays me to be."';

const includesAny = (text: string, terms: string[]) => terms.some(term => text.includes(term));

const scoresGuardAppeal = (line: string, scene: 'cell' | 'gate'): boolean => {
  const text = line.toLowerCase();
  const threatening = includesAny(text, ['kill', 'cut you', 'stab', 'die', 'move or', 'threat', 'burn you']);
  if (threatening) return false;

  const honorAppeal = includesAny(text, ['oath', 'honor', 'honour', 'duty', 'conscience', 'mercy', 'merciful']);
  const peopleAppeal = includesAny(text, ['people', 'famil', 'child', 'children', 'innocent', 'city', 'protect']);
  const orderAppeal = includesAny(text, ['order', 'orders', 'watch', 'captain', 'not your enemy']);
  const peacefulPromise = includesAny(text, ['no blood', 'without blood', 'no names', 'never saw me', 'let me pass', 'step aside']);
  const corruptionAppeal = includesAny(text, ['silas', 'pass', 'coin', 'debt', 'selling']);
  const darknessAppeal = includesAny(text, ['rune', 'curse', 'darkness', 'burn']);

  if (scene === 'cell') {
    return (honorAppeal && (peopleAppeal || orderAppeal || peacefulPromise)) || (peopleAppeal && orderAppeal);
  }

  const score = [honorAppeal, peopleAppeal, peacefulPromise, corruptionAppeal, darknessAppeal]
    .filter(Boolean).length;
  return score >= 2;
};

const getGuardClue = (line: string, scene: 'cell' | 'gate', state: StoryState): string | null => {
  const text = line.toLowerCase();
  const asksQuestion = text.includes('?') || includesAny(text, [
    'why', 'what', 'who', 'tell me', 'ask', 'know', 'want', 'fear', 'afraid',
    'regret', 'orders', 'order', 'oath', 'duty', 'family', 'people', 'protect',
    'mercy', 'conscience', 'silas', 'pass', 'debt', 'rune', 'darkness',
  ]);

  if (!asksQuestion) return null;

  if (includesAny(text, ['kill', 'cut you', 'stab', 'die', 'move or'])) {
    return 'The Guard closes his fist around the keys. "Threats make this simple. I know what to do with threats."';
  }

  if (scene === 'cell') {
    if (includesAny(text, ['orders', 'order', 'captain', 'watch', 'who put me', 'why am i here'])) {
      return 'The Guard looks toward the corridor. "Orders came stamped and sealed. They did not say whether obeying them still made me honorable."';
    }
    if (includesAny(text, ['oath', 'honor', 'honour', 'duty'])) {
      return '"My oath was to keep families safe," he says. "Not to make cages look righteous."';
    }
    if (includesAny(text, ['family', 'families', 'child', 'children', 'people', 'innocent', 'protect'])) {
      return 'His jaw tightens. "Do not speak lightly of families. That was the word that made me take the badge."';
    }
    if (includesAny(text, ['mercy', 'conscience', 'regret', 'afraid', 'fear'])) {
      return '"Mercy is not a soft word here," the Guard says. "It costs a man his post, sometimes his name."';
    }
    return 'The Guard listens despite himself. "If you want the key, do not flatter me. Show me which oath I am breaking by keeping you here."';
  }

  if (includesAny(text, ['silas', 'pass', 'coin', 'debt', 'selling', 'broker'])) {
    return '"Silas sells papers while the Watch pretends the gate is pure," the Guard says. "Do not ask me to admire clean rules in a dirty city."';
  }
  if (includesAny(text, ['rune', 'curse', 'darkness', 'burn', 'city'])) {
    return 'The Guard glances back at the city smoke. "The Darkness grows while we arrest the desperate and salute the paid."';
  }
  if (includesAny(text, ['oath', 'honor', 'honour', 'duty', 'orders', 'order', 'watch'])) {
    return '"If I obey the order, I keep the bridge," he says. "If I obey the oath, I may have to open it."';
  }
  if (includesAny(text, ['family', 'families', 'child', 'children', 'people', 'innocent', 'protect'])) {
    return '"The Watch was meant to protect people," the Guard says. "Some nights I can still remember that."';
  }
  if (includesAny(text, ['mercy', 'conscience', 'regret', 'afraid', 'fear'])) {
    return '"I am afraid of making the wrong mercy," he says. "Blood follows easy choices."';
  }
  if (state.flags.kaelenMood === 'honorable' || state.flags.kaelenMood === 'merciful') {
    return 'The Guard recognizes you. "You already know where the crack is. Do not waste it on cleverness."';
  }
  return 'The Guard keeps the spear low. "Ask me about the order, the oath, or the city. Those are the only things left arguing in me."';
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
      localStorage.setItem('nightshade_story', JSON.stringify(story));
    }
  }, [story, settings.gameplay.autoSave]);

  // Opening monologue — fires once after the Phaser intro fades
  useEffect(() => {
    if (!isGameStarted || openingShown) return;
    if (story.scene !== 'cell' || story.dialogueHistory.length > 0) return;
    const timer = setTimeout(() => {
      setOpeningShown(true);
      const text = 'Cold stone. Iron bars. My breath fogs the dark. Nothing in my hands.\n\nGuard is on watch through the bars. There has to be a way out of here.';
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

  const recordDialogueLine = (state: StoryState, speaker: string, text: string): StoryState => ({
    ...state,
    fullHistory: [...(state.fullHistory || []), {
      speaker,
      text,
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
      guard: openGuardCell,
      rat: interactRat,
      cell_exit: () => {
        setDialog({
          speaker: 'SYSTEM',
          text: 'CONGRATULATIONS! You have successfully escaped the Iron Cell. This concludes the Alpha preview of Nightshade.',
          options: [{ 
            label: 'RETURN TO MENU', 
            action: () => {
              resetGame();
              setIsGameStarted(false);
            } 
          }],
        });
      },
      silas: openSilas,
      market_exit: () => goToScene('cathedral', 'Gate pass in hand, Elara climbs into the Cathedral Ward.'),
      envoy: openEnvoy,
      cathedral_exit: () => goToScene('gate', 'The fortified bridge rises ahead. Guard waits under torchlight.'),
      guard_gate: openGateGuard,
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
        text: 'The rat has gone. Only the faint smell of coin remains.',
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

  function grantCellKey(choice: string, guardLine: string) {
    updateStory(state => {
      const next = recordChoice({
        ...state,
        flags: { ...state.flags, kaelenMood: 'honorable' },
      }, choice);
      return addItem(addLog(
        recordDialogueLine(next, 'Guard', guardLine),
        'Guard chooses mercy and passes over the Rusted Key.',
      ), 'rusted_key');
    });
    setDialog({
      speaker: 'Guard',
      text: guardLine,
      options: [{ label: 'Take the key', action: () => setDialog(null) }],
    });
  }

  async function handleCellGuardInput(playerLine: string) {
    setIsAiLoading(true);
    setDialog(prev => prev ? { ...prev, text: '...', options: [], inputMode: false } : null);
    try {
      if (scoresGuardAppeal(playerLine, 'cell')) {
        grantCellKey(
          playerLine,
          'Guard studies you for a long breath, then slides the key through the bars. "That is the first honest thing this prison has heard all week."',
        );
        return;
      }

      const clue = getGuardClue(playerLine, 'cell', storyRef.current);
      if (clue) {
        updateStory(state => recordDialogueLine(recordChoice(state, playerLine), 'Guard', clue));
        setDialog({
          speaker: 'Guard',
          text: clue,
          options: [{ label: 'Back away', action: () => setDialog(null) }],
          inputMode: true,
          onInput: handleCellGuardInput,
        });
        return;
      }

      if (!GeminiService.isConfigured()) {
        updateStory(state => recordChoice(state, playerLine));
        setDialog({
          speaker: 'Guard',
          text: 'Guard does not move for that. "Ask what my orders cost, or what my oath was meant to protect. Then choose your words."',
          options: [{ label: 'Back away', action: () => setDialog(null) }],
          inputMode: true,
          onInput: handleCellGuardInput,
        });
        return;
      }

      const { line, escaped } = await GeminiService.generateGuardResponse(
        playerLine, storyRef.current.dialogueHistory,
      );
      updateStory(state => recordChoice(state, playerLine));
      const npcLine = line || "Guard slides a key under the bars without a word.";
      updateStory(state => ({
        ...state,
        fullHistory: [...(state.fullHistory || []), {
          speaker: 'Guard',
          text: npcLine,
          timestamp: Date.now(),
          type: 'dialogue'
        }]
      }));

      if (escaped) {
        updateStory(state => addItem(addLog({
          ...state, flags: { ...state.flags, kaelenMood: 'merciful' },
        }, 'Guard slides the key under the bars.'), 'rusted_key'));
        setDialog({
          speaker: 'Guard',
          text: npcLine,
          options: [{ label: 'Take the key', action: () => setDialog(null) }],
        });
      } else {
        updateStory(state => ({ ...state, flags: { ...state.flags, kaelenMood: 'hostile' } }));
        setDialog({
          speaker: 'Guard',
          text: line,
          options: [{ label: 'Walk away', action: () => setDialog(null) }],
          inputMode: true,
          onInput: handleCellGuardInput,
        });
      }
    } catch (err: unknown) {
      setDialog({
        speaker: 'Guard',
        text: `${guardCellGreeting} (${formatGuardGeminiError(err)})`,
        options: [{ label: 'Step back', action: () => setDialog(null) }],
        inputMode: true,
        onInput: handleCellGuardInput,
      });
    } finally {
      setIsAiLoading(false);
    }
  }

  const openGuardCell = async () => {
    if (!GeminiService.isConfigured()) {
      setDialog({
        speaker: 'Guard',
        text: guardCellGreeting,
        options: [{ label: 'Back away', action: () => setDialog(null) }],
        inputMode: true,
        onInput: handleCellGuardInput,
      });
      return;
    }

    setIsAiLoading(true);
    setDialog({ speaker: 'Guard', text: '...', options: [] });

    try {
      const line = await GeminiService.generateGuardGreeting('cell', storyRef.current);
      updateStory(state => ({
        ...state,
        fullHistory: [...(state.fullHistory || []), {
          speaker: 'Guard',
          text: line,
          timestamp: Date.now(),
          type: 'dialogue'
        }]
      }));
      setDialog({
        speaker: 'Guard',
        text: line,
        options: [{ label: 'Back away', action: () => setDialog(null) }],
        inputMode: true,
        onInput: handleCellGuardInput,
      });
    } catch (err: unknown) {
      setDialog({
        speaker: 'Guard',
        text: `${guardCellGreeting} (${formatGuardGeminiError(err)})`,
        options: [{ label: 'Back away', action: () => setDialog(null) }],
        inputMode: true,
        onInput: handleCellGuardInput,
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

  function persuadeGateOpen(choice: string, guardLine: string) {
    updateStory(state => {
      const next = recordChoice({
        ...state,
        flags: { ...state.flags, kaelenMood: 'merciful', gateOutcome: 'persuaded' },
      }, choice);
      return addLog(recordDialogueLine(next, 'Guard', guardLine), 'Guard lowers his spear and lets Elara pass.');
    });
    setDialog({
      speaker: 'Guard',
      text: guardLine,
      options: [{ label: 'Walk through the gate', action: () => goToScene('outskirts', 'Guard turns his back on the order and opens the way.') }],
    });
  }

  async function handleGateGuardInput(playerLine: string) {
    setIsAiLoading(true);
    setDialog(prev => prev ? { ...prev, text: '...', options: [], inputMode: false } : null);
    try {
      if (scoresGuardAppeal(playerLine, 'gate')) {
        persuadeGateOpen(
          playerLine,
          'Guard hears the shape of the choice before he answers. The spear lowers. "No blood. No names. Run."',
        );
        return;
      }

      const clue = getGuardClue(playerLine, 'gate', storyRef.current);
      if (clue) {
        updateStory(state => recordDialogueLine(recordChoice(state, playerLine), 'Guard', clue));
        setDialog({
          speaker: 'Guard',
          text: clue,
          options: [{ label: 'Draw steel', action: startCombat }],
          inputMode: true,
          onInput: handleGateGuardInput,
        });
        return;
      }

      if (!GeminiService.isConfigured()) {
        updateStory(state => recordChoice(state, playerLine));
        setDialog({
          speaker: 'Guard',
          text: 'Guard keeps the spear across the road. "Ask about the order, the oath, Silas, or the city. Then give me conscience, or give me steel."',
          options: [{ label: 'Draw steel', action: startCombat }],
          inputMode: true,
          onInput: handleGateGuardInput,
        });
        return;
      }

      const { line, escaped } = await GeminiService.generateGuardResponse(
        playerLine, storyRef.current.dialogueHistory,
      );
      updateStory(state => recordChoice(state, playerLine));
      if (escaped) {
        updateStory(state => addLog({
          ...state, flags: { ...state.flags, kaelenMood: 'merciful', gateOutcome: 'persuaded' },
        }, 'Guard lowers his spear and lets Elara pass.'));
        setDialog({
          speaker: 'Guard',
          text: line || "Guard steps aside. His eyes say he won't report this.",
          options: [{ label: 'Walk through the gate', action: () => goToScene('outskirts', 'Guard turns his back on the order and opens the way.') }],
        });
      } else {
        setDialog({
          speaker: 'Guard',
          text: line,
          options: [{ label: 'Draw steel', action: startCombat }],
          inputMode: true,
          onInput: handleGateGuardInput,
        });
      }
    } catch (err: unknown) {
      setDialog({
        speaker: 'Guard',
        text: formatGuardGeminiError(err),
        options: [{ label: 'Fight', action: startCombat }],
        inputMode: true,
        onInput: handleGateGuardInput,
      });
    } finally {
      setIsAiLoading(false);
    }
  }

  const openGateGuard = async () => {
    const baseOptions: DialogOption[] = [
      { label: 'Use the Rusted Key side-path', disabled: !hasItem('rusted_key'), action: useGateKey },
      { label: 'Blast the gate with the Purple Rune', disabled: !hasItem('purple_rune'), action: blastRuneGate },
      { label: 'Draw steel', action: startCombat },
    ];

    if (!GeminiService.isConfigured()) {
      setDialog({
        speaker: 'Guard',
        text: guardGateGreeting,
        options: baseOptions,
        inputMode: true,
        onInput: handleGateGuardInput,
      });
      return;
    }

    setIsAiLoading(true);
    setDialog({ speaker: 'Guard', text: '...', options: [] });

    try {
      const line = await GeminiService.generateGuardGreeting('gate', storyRef.current);
      setDialog({
        speaker: 'Guard',
        text: line,
        options: baseOptions,
        inputMode: true,
        onInput: handleGateGuardInput,
      });
    } catch (err: unknown) {
      setDialog({
        speaker: 'Guard',
        text: `${guardGateGreeting} (${formatGuardGeminiError(err)})`,
        options: baseOptions,
        inputMode: true,
        onInput: handleGateGuardInput,
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
    goToScene('outskirts', 'Elara slips beneath the Great Gate without spilling Guard blood.');
  };

  const useGreatGate = () => {
    if (hasItem('purple_rune')) {
      blastRuneGate();
      return;
    }
    openGateGuard();
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
      guard: rules.guardHealth,
      guardMax: rules.guardHealth,
      elara: story.health,
      elaraMax: story.maxHealth,
      message: 'Guard raises his shield. Time your strikes and guard when you are hurt.',
    });
  }

  const strikeGuard = () => {
    setCombat((current) => {
      if (!current) return current;
      const rules = getDifficultyRules(settings.gameplay.difficulty);
      const guard = Math.max(0, current.guard - rules.strikeDamage);
      const elara = guard <= 0 ? current.elara : Math.max(0, current.elara - rules.counterDamage);
      if (guard <= 0) {
        winCombat(elara);
        return null;
      }
      return { ...current, guard, elara, message: 'Your dagger finds a gap. Guard answers with the haft of his spear.' };
    });
  };

  const guardGuard = () => {
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
    }, 'Defeated Guard in combat'), 'Guard yields, wounded but alive. The bridge is open.'));
    goToScene('outskirts', 'Elara limps past Guard and into the fog.');
  };

  const retryCombat = () => {
    updateStory((state) => ({ ...state, health: state.maxHealth }));
    const rules = getDifficultyRules(settings.gameplay.difficulty);
    setCombat({
      guard: rules.guardHealth,
      guardMax: rules.guardHealth,
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
    localStorage.removeItem('nightshade_story');
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

  const hasSave = localStorage.getItem('nightshade_story') !== null;

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
          onStrike={strikeGuard}
          onGuard={guardGuard}
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
  const guardHP = (combat.guard / combat.guardMax) * 100;

  return (
    <div className="combat-overlay">
      <div className="combat-panel">
        <button className="dialog-close" onClick={onRetry}><X size={18} /></button>
        <h2>Guard's Order</h2>
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
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '12px', color: '#ffe0a0' }}>GUARD</span>
              <span style={{ fontSize: '14px', color: '#d4a373' }}>{combat.guard} / {combat.guardMax}</span>
            </div>
            <div style={{
              width: '100%', height: '12px',
              background: 'rgba(0,0,0,0.6)',
              border: '2px solid #4a3020',
              position: 'relative',
              boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
            }}>
              <div style={{
                width: `${guardHP}%`, height: '100%',
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
  const raw = localStorage.getItem('nightshade_story');
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
