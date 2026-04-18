import React from 'react';
import { Shield } from 'lucide-react';
import type { PlayerState } from '../store/gameStore';

interface HUDProps {
  player: PlayerState;
}

export const HUD: React.FC<HUDProps> = ({ player }) => {
  const hpPercent = (player.health / player.maxHealth) * 100;
  const xpPercent = (player.xp / 1000) * 100;
  
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {/* Portrait Slot (Top-Left) */}
      <div className="absolute top-[4.8%] left-[3.5%] w-[6.5%] h-[11.5%] flex items-center justify-center">
        <div className="w-full h-full bg-game-shadow/30 flex items-center justify-center overflow-hidden border border-game-accent/20">
          <Shield className="text-game-accent animate-pulse" size={48} />
        </div>
      </div>

      {/* Name & LVL */}
      <div className="absolute top-[6.8%] left-[10.5%] w-[16%] flex justify-between items-end">
        <span className="text-game-accent font-bold text-base leading-none uppercase tracking-widest drop-shadow-md">{player.name}</span>
        <span className="text-[10px] text-game-accent/80 font-black">LVL {player.level}</span>
      </div>

      {/* Health Bar (Upper bar) */}
      <div className="absolute top-[10.1%] left-[10.5%] w-[15.8%] h-[2.2%] overflow-hidden bg-black/40">
        <div 
          className="h-full bg-red-800 transition-all duration-300 relative" 
          style={{ width: `${hpPercent}%` }} 
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-black tracking-widest drop-shadow-sm">
          {player.health} / {player.maxHealth}
        </div>
      </div>

      {/* XP Bar (Lower bar) */}
      <div className="absolute top-[14.2%] left-[10.5%] w-[14.8%] h-[1.8%] overflow-hidden bg-black/40">
        <div 
          className="h-full bg-blue-800 transition-all duration-300 relative" 
          style={{ width: `${xpPercent}%` }} 
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center text-[8px] text-white font-black tracking-widest drop-shadow-sm">
          XP {player.xp}
        </div>
      </div>
    </div>
  );
};
