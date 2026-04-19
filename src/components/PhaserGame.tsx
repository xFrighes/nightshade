import React, { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { GameScene } from '../game/GameScene';
import type { GameAction, StoryState } from '../game/storyTypes';
import type { SettingsState } from '../store/gameStore';

interface PhaserGameProps {
  storyState: StoryState;
  settings: SettingsState;
  uiVisible?: boolean;
  onGameAction: (action: GameAction) => void;
  onToggleUI?: () => void;
  onToggleInventory?: () => void;
  onStaminaUpdate?: (percent: number) => void;
  onInteractionPrompt?: (prompt: string) => void;
  onAssetProgress?: (progress: number) => void;
  onAssetsReady?: () => void;
  onAssetError?: (asset: string) => void;
  onGameReady?: (game: Phaser.Game) => void;
}

export const PhaserGame: React.FC<PhaserGameProps> = ({ 
  storyState, 
  settings,
  uiVisible = true, 
  onGameAction, 
  onToggleUI,
  onToggleInventory,
  onStaminaUpdate,
  onInteractionPrompt,
  onAssetProgress,
  onAssetsReady,
  onAssetError,
  onGameReady 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const actionRef = useRef(onGameAction);
  const toggleUIRef = useRef(onToggleUI);
  const toggleInventoryRef = useRef(onToggleInventory);
  const staminaUpdateRef = useRef(onStaminaUpdate);
  const interactionPromptRef = useRef(onInteractionPrompt);
  const assetProgressRef = useRef(onAssetProgress);
  const assetsReadyRef = useRef(onAssetsReady);
  const assetErrorRef = useRef(onAssetError);

  useEffect(() => {
    actionRef.current = onGameAction;
    toggleUIRef.current = onToggleUI;
    toggleInventoryRef.current = onToggleInventory;
    staminaUpdateRef.current = onStaminaUpdate;
    interactionPromptRef.current = onInteractionPrompt;
    assetProgressRef.current = onAssetProgress;
    assetsReadyRef.current = onAssetsReady;
    assetErrorRef.current = onAssetError;
  }, [onGameAction, onToggleUI, onToggleInventory, onStaminaUpdate, onInteractionPrompt, onAssetProgress, onAssetsReady, onAssetError]);

  useEffect(() => {
    if (!gameRef.current) return;
    gameRef.current.events.emit('ui_visibility', uiVisible);
  }, [uiVisible]);

  useEffect(() => {
    if (!gameRef.current) return;
    gameRef.current.registry.set('settings', settings);
    gameRef.current.events.emit('settings_update', settings);
    gameRef.current.canvas.style.imageRendering = settings.video.antiAliasing === 'Off' ? 'pixelated' : 'auto';
  }, [settings]);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    try {
      const parent = containerRef.current;
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: parent,
        width: parent.clientWidth || window.innerWidth,
        height: parent.clientHeight || window.innerHeight,
        render: {
          antialias: settings.video.antiAliasing !== 'Off',
          pixelArt: settings.video.antiAliasing === 'Off',
        },
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 920 },
            debug: false,
          },
        },
        backgroundColor: '#08060d',
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      };

      const game = new Phaser.Game(config);
      gameRef.current = game;
      game.registry.set('story_state', storyState);
      game.registry.set('settings', settings);
      game.canvas.style.imageRendering = settings.video.antiAliasing === 'Off' ? 'pixelated' : 'auto';
      onGameReady?.(game);

      game.events.on('game_action', (action: GameAction) => {
        actionRef.current(action);
      });

      game.events.on('toggle_ui', () => {
        toggleUIRef.current?.();
      });

      game.events.on('toggle_inventory', () => {
        toggleInventoryRef.current?.();
      });

      game.events.on('stamina_update', (percent: number) => {
        staminaUpdateRef.current?.(percent);
      });

      game.events.on('interaction_prompt', (prompt: string) => {
        interactionPromptRef.current?.(prompt);
      });

      game.events.on('asset_load_progress', (progress: number) => {
        assetProgressRef.current?.(progress);
      });

      game.events.once('asset_load_complete', () => {
        assetProgressRef.current?.(1);
        assetsReadyRef.current?.();
      });

      game.events.on('asset_load_error', (asset: string) => {
        assetErrorRef.current?.(asset);
      });

      game.scene.add('GameScene', GameScene, true, { storyState, settings });
    } catch (e) {
      console.error('CRITICAL: Phaser failed to initialize.', e);
      assetErrorRef.current?.(e instanceof Error ? e.message : 'Phaser failed to initialize.');
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
    // Phaser owns its lifecycle after creation; story updates are bridged by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!gameRef.current) return;
    gameRef.current.registry.set('story_state', storyState);
    gameRef.current.events.emit('story_update', storyState);
  }, [storyState]);

  return <div ref={containerRef} className="game-container" />;
};
