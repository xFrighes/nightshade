import React, { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { GameScene } from '../game/GameScene';
import type { GameAction, StoryState } from '../game/storyTypes';

interface PhaserGameProps {
  storyState: StoryState;
  onGameAction: (action: GameAction) => void;
  onGameReady?: (game: Phaser.Game) => void;
}

export const PhaserGame: React.FC<PhaserGameProps> = ({ storyState, onGameAction, onGameReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const actionRef = useRef(onGameAction);

  useEffect(() => {
    actionRef.current = onGameAction;
  }, [onGameAction]);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    try {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: window.innerWidth,
        height: window.innerHeight,
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

  return <div ref={containerRef} className="fixed inset-0 w-full h-full z-0" />;
};
