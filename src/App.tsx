import React, { useState, useEffect, useRef } from 'react';
import { Sword, Volume2, Volume1, VolumeX, ArrowLeft } from 'lucide-react';
import { PhaserGame } from './components/PhaserGame';
import { HUD } from './components/HUD';
import { WorldFeed } from './components/WorldFeed';
import { DialogBox } from './components/DialogBox';
import { Inventory } from './components/Inventory';
import { gameStore } from './store/gameStore';
import type { PlayerState, WorldLogEntry } from './store/gameStore';
import './App.css';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<PlayerState>(gameStore.getState());
  const [logs, setLogs] = useState<WorldLogEntry[]>(gameStore.getLogs());
  const [activeNpc, setActiveNpc] = useState<{ id: string; name: string } | null>(null);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [needsFocus, setNeedsFocus] = useState(false);
  const [gameInstance, setGameInstance] = useState<Phaser.Game | null>(null);
  const [volume, setVolume] = useState(0.4);
  const [isMuted, setIsMuted] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'AUDIO' | 'VIDEO' | 'GAMEPLAY' | 'CONTROLS'>('AUDIO');
  const [voiceActing, setVoiceActing] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/soundtrack.mp3');
      audioRef.current.loop = true;
    }

    const currentAudio = audioRef.current;
    currentAudio.volume = isMuted ? 0 : volume;

    const playAudio = () => {
      if (!isGameStarted && currentAudio.paused) {
        currentAudio.play().catch(() => {
          // Silent catch for autoplay blocks
        });
      }
    };

    if (!isGameStarted) {
      playAudio();
      window.addEventListener('mousedown', playAudio);
      window.addEventListener('keydown', playAudio);
    } else {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    return () => {
      window.removeEventListener('mousedown', playAudio);
      window.removeEventListener('keydown', playAudio);
    };
  }, [isGameStarted, volume, isMuted]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (val > 0) setIsMuted(false);
    else setIsMuted(true);
  };

  useEffect(() => {
    const handleStateChange = (e: any) => setGameState({ ...e.detail });
    const handleLogChange = () => setLogs([...gameStore.getLogs()]);

    gameStore.addEventListener('change', handleStateChange);
    gameStore.addEventListener('log', handleLogChange);

    return () => {
      gameStore.removeEventListener('change', handleStateChange);
      gameStore.removeEventListener('log', handleLogChange);
    };
  }, []);

  const handleStartGame = () => {
    setIsGameStarted(true);
    setNeedsFocus(true);
  };

  const handleFocusGame = () => {
    if (gameInstance) {
      gameInstance.canvas.focus();
    }
    setNeedsFocus(false);
  };

  if (!isGameStarted) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center p-8 bg-cover bg-center bg-no-repeat font-pixel"
        style={{ backgroundImage: "url('/starting-screen.png')" }}
      >
        <div className="absolute inset-0 bg-black/10" />

        {!isSettingsOpen && (
          <div className="w-full max-w-lg flex flex-col items-center gap-6 relative z-10 mt-[32rem] font-['Press_Start_2P']">
            <button
              onClick={handleStartGame}
              className="group relative flex items-center justify-center text-white text-2xl uppercase cursor-pointer transition-all hover:scale-105"
              style={{ textShadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}
            >
              <span className="absolute -left-10 group-hover:opacity-100 opacity-0 transition-opacity">{">"}</span>
              START GAME
            </button>

            <button
              className="text-white/80 text-xl uppercase cursor-not-allowed opacity-60 hover:opacity-100 transition-opacity"
              style={{ textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}
            >
              [LOAD GAME]
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-white/80 text-xl uppercase cursor-pointer hover:opacity-100 transition-opacity"
              style={{ textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}
            >
              [SETTINGS]
            </button>

            <button
              className="text-white/80 text-xl uppercase cursor-not-allowed opacity-60 hover:opacity-100 transition-opacity"
              style={{ textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}
            >
              [QUIT]
            </button>
          </div>
        )}

        {/* Settings Overlay - 1:1 Matching settings.png using cut-out assets */}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            {/* Background scene matches the image */}
            <div 
              className="absolute inset-0 bg-cover bg-center grayscale-20 opacity-40 mix-blend-multiply"
              style={{ backgroundImage: "url('/bg.png')" }}
            />

            <div className="relative w-[1364px] h-[768px] scale-[0.8]">
              {/* Raven Banner Area (Top) */}
              <div 
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[150px] bg-no-repeat bg-contain"
                style={{ 
                  backgroundImage: "url('/settings-assets.png')",
                  backgroundPosition: 'center top',
                  clipPath: 'inset(0 0 80% 0)' 
                }}
              />

              {/* Main Frame Container */}
              <div 
                className="absolute inset-0 bg-no-repeat bg-contain flex items-center justify-center"
                style={{ 
                  backgroundImage: "url('/settings-assets.png')",
                  backgroundPosition: 'center center'
                }}
              >
                <div className="relative w-[860px] h-[520px] translate-y-[20px]">
                  {/* Internal Scrollable Content */}
                  <div className="absolute inset-0 top-[20px] left-[50px] right-[50px] bottom-[20px] p-[40px] font-pixel overflow-y-auto custom-scrollbar">
                    {activeTab === 'AUDIO' && (
                      <div className="space-y-8 text-[#e6ccb2] text-3xl">
                        <div className="flex items-center justify-between group">
                          <label className="cursor-pointer group-hover:text-white transition-colors">Master Volume</label>
                          <div className="flex items-center gap-6 w-[450px]">
                            <input 
                              type="range" min="0" max="1" step="0.01" 
                              value={volume} onChange={handleVolumeChange}
                              className="pixel-slider flex-1" 
                            />
                            <span className="w-20 text-right">{Math.round(volume * 100)}%</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between group">
                          <label className="cursor-pointer group-hover:text-white transition-colors">Music Volume</label>
                          <div className="flex items-center gap-6 w-[450px]">
                            <input 
                              type="range" min="0" max="1" step="0.01" 
                              value={volume} onChange={handleVolumeChange}
                              className="pixel-slider flex-1" 
                            />
                            <span className="w-20 text-right">{Math.round(volume * 100)}%</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between group">
                          <label className="cursor-pointer group-hover:text-white transition-colors">Voice Acting</label>
                          <div 
                            onClick={() => setVoiceActing(!voiceActing)}
                            className={`w-8 h-8 border-4 border-[#3e2723] bg-black/40 flex items-center justify-center cursor-pointer transition-colors ${voiceActing ? 'bg-[#d4a373]' : ''}`}
                          >
                            {voiceActing && <div className="w-4 h-4 bg-black"></div>}
                          </div>
                        </div>

                        <div className="flex items-center justify-between group">
                          <label className="cursor-pointer group-hover:text-white transition-colors">Audio Quality</label>
                          <span className="text-[#d4a373]">Medium / High</span>
                        </div>

                        <div className="flex items-center justify-between group">
                          <label className="cursor-pointer group-hover:text-white transition-colors">Subtitles</label>
                          <span className="text-[#d4a373]">On / Off</span>
                        </div>

                        <div className="flex items-center justify-between group">
                          <label className="cursor-pointer group-hover:text-white transition-colors">Language</label>
                          <span className="text-[#d4a373]">English/French/German</span>
                        </div>

                        <div className="flex items-center justify-between group">
                          <label className="cursor-pointer group-hover:text-white transition-colors">Type</label>
                          <span className="text-[#d4a373]">English</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tab Hit Areas (Clickable regions over the visual tabs) */}
                  <div className="absolute top-[-55px] left-[50px] right-[50px] h-[55px] flex justify-center gap-[10px]">
                     {(['AUDIO', 'VIDEO', 'GAMEPLAY', 'CONTROLS'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`flex-1 font-pixel text-2xl transition-all cursor-pointer flex items-center justify-center ${activeTab === tab ? 'text-[#e6ccb2] -translate-y-2' : 'text-[#8d6e63]'}`}
                        >
                          {tab}
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              {/* Functional Back Button Area */}
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="absolute bottom-[20px] left-1/2 -translate-x-1/2 w-[400px] h-[80px] font-pixel text-[#e6ccb2] text-2xl flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
              >
                 BACK TO MAIN MENU
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-game-bg select-none font-pixel">
      {/* Phaser Game Layer */}
      <PhaserGame
        onNpcInteract={setActiveNpc}
        onGameReady={setGameInstance}
      />

      {/* Focus Overlay */}
      {needsFocus && (
        <div
          onClick={handleFocusGame}
          className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md cursor-pointer animate-in fade-in duration-500"
        >
          <div className="flex flex-col items-center gap-6 animate-pulse">
            <div className="w-24 h-24 border-8 border-game-accent rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(243,156,18,0.5)]">
              <Sword className="text-game-accent" size={40} />
            </div>
            <span className="text-game-accent text-5xl uppercase tracking-[0.4em] font-black drop-shadow-[0_0_15px_rgba(243,156,18,0.8)]">
              Click to Begin
            </span>
          </div>
          <p className="mt-12 text-white/60 text-lg uppercase tracking-[0.2em] font-bold">
            Keyboard controls activate on click
          </p>
        </div>
      )}

      {/* Main UI Overlay (the frame) */}
      <img
        src="/UI.png"
        className="fixed inset-0 w-screen h-screen z-[50] pointer-events-none object-fill opacity-100"
        alt="UI Frame"
      />

      {/* UI Elements Layer - Aligned to the frame slots */}
      <div className="absolute inset-0 z-[60] pointer-events-none">
        {/* HUD - Top Left Area */}
        <HUD player={gameState} />

        {/* World Feed - Bottom Left Area */}
        <WorldFeed logs={logs} />

        {/* Dialog Box - Above Action Bar */}
        <DialogBox
          npc={activeNpc}
          onClose={() => setActiveNpc(null)}
        />

        {/* Menu Buttons - Top Right Area Slot */}
        <div className="absolute top-[calc(28.0%+0.66vw)] right-[calc(2.6%+2.64vw)] flex gap-[0.5rem] pointer-events-auto">
          <button
            onClick={() => setIsInventoryOpen(true)}
            className="w-[2.64vw] h-[2.64vw] hover:bg-white/10 rounded-sm transition-colors group relative"
            title="I - Inventory"
          >
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-white text-[10px] opacity-0 group-hover:opacity-100 whitespace-nowrap font-bold">Inventory (I)</span>
          </button>
          <button
            disabled
            className="w-[2.64vw] h-[2.64vw] opacity-0 cursor-not-allowed group relative"
          />
          <button
            disabled
            className="w-[2.64vw] h-[2.64vw] opacity-0 cursor-not-allowed group relative"
          />
          <button
            disabled
            className="w-[2.64vw] h-[2.64vw] opacity-0 cursor-not-allowed group relative"
          />
        </div>

        {/* Action Bar - Bottom Center Area */}
        <div className="absolute bottom-[4.8%] left-[50%] -translate-x-1/2 flex gap-[1%] px-[0.5%] pointer-events-auto w-[47.4%] h-[7.8%]">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 h-full flex items-center justify-center text-[1.25vw] text-game-accent font-black hover:bg-white/5 cursor-pointer border border-transparent hover:border-game-accent/30 transition-all drop-shadow-[0_2px_2px_rgba(0,0,0,1)]"
            >
              {i === 9 ? 0 : i + 1}
            </div>
          ))}
        </div>
      </div>

      <Inventory
        player={gameState}
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
      />

      {/* Overlay vignette */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]" />
    </div>
  );

};

export default App;
