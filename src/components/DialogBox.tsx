import React, { useCallback, useEffect, useState } from 'react';
import { X, ChevronRight, Sparkles } from 'lucide-react';
import { gameStore } from '../store/gameStore';

interface DialogBoxProps {
  npc: { id: string; name: string } | null;
  onClose: () => void;
}

export const DialogBox: React.FC<DialogBoxProps> = ({ npc, onClose }) => {
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<{ label: string; action: () => void }[]>([]);

  const generateGreeting = useCallback(async (targetNpc: { id: string; name: string }) => {
    setLoading(true);
    setText("");
    
    const playerState = gameStore.getState();
    const activeQuest = playerState.quests.find(q => q.status === 'active');

    const greeting = `${targetNpc.name}: The fog is thick tonight. Watch yourself.`;
    void activeQuest;

    let current = "";
    for (const char of greeting) {
      current += char;
      setText(current);
      await new Promise(r => setTimeout(r, 20));
    }

    setLoading(false);
    
    // Set options based on NPC and Quest State
    if (targetNpc.id === 'guide' && activeQuest?.id === 'meet_guide') {
      setOptions([
        { 
          label: "I seek the Nightshade contact.", 
          action: () => {
            setText("Guard: The contact? You're looking for Silas. He's further down the street. Don't tell him I sent you.");
            gameStore.updateQuestStatus('meet_guide', 'completed');
            gameStore.addLog("Quest Completed: The Shadowy Guide", 'reward');
            gameStore.addItem({ id: 'city_pass', name: 'Rusted City Pass', description: 'Allows passage to the inner slums.', icon: '🎫', count: 1 });
            setOptions([{ label: "Thank you, veteran.", action: onClose }]);
          } 
        },
        { label: "Just passing through.", action: onClose }
      ]);
    } else {
      setOptions([{ label: "Farewell.", action: onClose }]);
    }
  }, [onClose]);

  useEffect(() => {
    if (npc) {
      const timer = setTimeout(() => void generateGreeting(npc), 0);
      return () => clearTimeout(timer);
    }
  }, [generateGreeting, npc]);

  if (!npc) return null;

  return (
    <div className="absolute inset-x-0 bottom-[14%] flex justify-center z-[80] animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto px-4">
      <div className="w-full max-w-2xl bg-game-bg/95 border-2 border-game-shadow p-6 relative pixel-border flex flex-col gap-4 shadow-2xl">
        {/* NPC Name Tag */}
        <div className="absolute -top-4 left-4 bg-game-shadow text-game-accent px-4 py-1 text-sm border border-game-accent/50 font-bold uppercase tracking-wider">
          {npc.name}
        </div>
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 text-game-muted hover:text-game-accent transition-colors"
        >
          <X size={16} />
        </button>

        {/* Text Content */}
        <div className="min-h-[60px] text-lg leading-relaxed text-white opacity-90 font-medium">
          {text}
          {loading && <span className="animate-pulse">_</span>}
        </div>

        {/* Options */}
        {!loading && (
          <div className="flex flex-wrap gap-3 mt-2 border-t border-game-shadow pt-4">
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={opt.action}
                className="btn-game flex items-center gap-2 group text-sm"
              >
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* AI Tag */}
        <div className="absolute bottom-1 right-2 text-[8px] flex items-center gap-1 opacity-20 hover:opacity-100 transition-opacity">
          <Sparkles size={8} className="text-game-accent" />
          <span>NARRATIVE ENGINE: GEMINI-3-FLASH</span>
        </div>
      </div>
    </div>
  );
};
