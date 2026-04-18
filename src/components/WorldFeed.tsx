import React from 'react';
import type { WorldLogEntry } from '../store/gameStore';

interface WorldFeedProps {
  logs: WorldLogEntry[];
}

export const WorldFeed: React.FC<WorldFeedProps> = ({ logs }) => {
  return (
    <div className="absolute bottom-[18%] left-[1.5%] w-72 h-36 bg-black/20 p-3 overflow-hidden pointer-events-none flex flex-col-reverse rounded">
      <div className="flex flex-col gap-1 overflow-y-auto pr-1 text-[11px] uppercase tracking-tighter scrollbar-hide">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
            <span className="text-game-muted opacity-70 shrink-0 font-bold">
              [{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
            </span>
            <span className={
              log.type === 'chat' ? 'text-game-muted font-bold' :
              log.type === 'reward' ? 'text-yellow-500 font-black' :
              log.type === 'quest' ? 'text-game-accent font-black' :
              'text-white font-bold opacity-90'
            }>
              {log.text}
            </span>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-game-accent font-black mb-2 border-b border-game-accent/30 pb-1 flex justify-between items-center">
        <span>WORLD FEED</span>
        <span className="opacity-50">v0.1.0</span>
      </div>
    </div>
  );
};
