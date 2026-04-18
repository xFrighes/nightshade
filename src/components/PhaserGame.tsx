import React, { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { GameScene } from '../game/GameScene';

interface PhaserGameProps {
  onNpcInteract: (npc: { id: string; name: string }) => void;
  onGameReady: (game: Phaser.Game) => void;
}

export const PhaserGame: React.FC<PhaserGameProps> = ({ onNpcInteract, onGameReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

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
            gravity: { x: 0, y: 0 },
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
      onGameReady(game);

      // Bridge events via game emitter
      game.events.on('npc_near', (npc: { id: string; name: string }) => {
        onNpcInteract(npc);
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
  }, []);

  return <div ref={containerRef} className="fixed inset-0 w-full h-full z-0" />;
};
