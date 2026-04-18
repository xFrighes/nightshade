import React from 'react';
import { Package, X } from 'lucide-react';
import type { PlayerState } from '../store/gameStore';

interface InventoryProps {
  player: PlayerState;
  isOpen: boolean;
  onClose: () => void;
}

export const Inventory: React.FC<InventoryProps> = ({ player, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-8">
      <div className="w-full max-w-3xl bg-game-bg mmo-panel border-4 border-game-shadow animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6 border-b border-game-shadow pb-2">
          <div className="flex items-center gap-2">
            <Package className="text-game-accent" size={32} />
            <h2 className="text-2xl text-game-accent uppercase tracking-widest font-bold">Backpack</h2>
          </div>
          <button onClick={onClose} className="hover:text-game-accent"><X size={32} /></button>
        </div>

        <div className="grid grid-cols-4 gap-6 max-h-[600px] overflow-y-auto pr-2">
          {player.inventory.map((item, i) => (
            <div key={i} className="group relative">
              <div className="w-full aspect-square bg-game-shadow/30 border-2 border-game-shadow p-4 flex items-center justify-center text-6xl group-hover:bg-game-accent/10 group-hover:border-game-accent/50 transition-all cursor-help">
                {item.icon}
                {item.count > 1 && (
                  <span className="absolute bottom-2 right-2 text-sm bg-game-accent text-game-bg font-bold px-1.5 leading-none border border-game-bg">
                    {item.count}
                  </span>
                )}
              </div>
              {/* Tooltip */}
              <div className="absolute top-full left-0 mt-2 w-48 bg-game-bg border border-game-accent/50 p-2 text-xs z-10 invisible group-hover:visible shadow-2xl">
                <div className="font-bold text-game-accent mb-1">{item.name}</div>
                <div className="text-game-muted italic">{item.description}</div>
              </div>
            </div>
          ))}
          {/* Empty slots */}
          {Array.from({ length: Math.max(0, 12 - player.inventory.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="w-full aspect-square bg-game-shadow/10 border border-game-shadow/20" />
          ))}
        </div>

        <div className="mt-6 flex justify-between items-center text-xs text-game-muted border-t border-game-shadow pt-4">
          <span>Capacity: {player.inventory.length} / 20</span>
          <span>{player.gold} Gold</span>
        </div>
      </div>
    </div>
  );
};
