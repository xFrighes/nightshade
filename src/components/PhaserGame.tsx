import React, { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { GameScene } from '../game/GameScene';
import type { GameAction, StoryState } from '../game/storyTypes';

interface PhaserGameProps {
  storyState: StoryState;
  uiVisible?: boolean;
  onGameAction: (action: GameAction) => void;
  onToggleUI?: () => void;
  onToggleInventory?: () => void;
  onGameReady?: (game: Phaser.Game) => void;
}

export const PhaserGame: React.FC<PhaserGameProps> = ({ 
  storyState, 
  uiVisible = true, 
  onGameAction, 
  onToggleUI,
  onToggleInventory,
  onGameReady 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const actionRef = useRef(onGameAction);
  const toggleUIRef = useRef(onToggleUI);
  const toggleInventoryRef = useRef(onToggleInventory);

  useEffect(() => {
    actionRef.current = onGameAction;
    toggleUIRef.current = onToggleUI;
    toggleInventoryRef.current = onToggleInventory;
  }, [onGameAction, onToggleUI, onToggleInventory]);

  useEffect(() => {
    if (!gameRef.current) return;
    gameRef.current.events.emit('ui_visibility', uiVisible);
  }, [uiVisible]);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    try {
      const parent = containerRef.current;
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: parent,
        width: parent.clientWidth || window.innerWidth,
        height: parent.clientHeight || window.innerHeight,
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 920 },
            debug: false,
          },
        },
        scene: [GameScene],
        backgroundColor: '#08060d',
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      };

      const game = new Phaser.Game(config);
      gameRef.current = game;
      game.registry.set('story_state', storyState);
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
    } catch (e) {
      console.error('CRITICAL: Phaser failed to initialize.', e);
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
