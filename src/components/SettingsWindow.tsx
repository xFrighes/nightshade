import React, { useState, useEffect, useRef } from 'react';
import { gameStore, type SettingsState } from '../store/gameStore';

type Tab = 'AUDIO' | 'VIDEO' | 'GAMEPLAY' | 'CONTROLS';

interface SettingsWindowProps {
  isOpen: boolean;
  onClose: () => void;
  isGameStarted?: boolean;
}

const SCALE = 1.1;
const FRAME_W = 1561 * 0.5 * SCALE;
const FRAME_H = 1138 * 0.5 * SCALE;
const TAB_H = 63 * SCALE;
const TAB_W = 167 * SCALE;
const TAB_SLOTS_X = [45 * SCALE, 218 * SCALE, 392 * SCALE, 566 * SCALE];
const TAB_GAP = 6 * SCALE;
const CONTENT_SIDE = 42 * SCALE;
const CONTENT_TOP = 76 * SCALE;
const CONTENT_BOTTOM = 56 * SCALE;

const TABS: Tab[] = ['AUDIO', 'VIDEO', 'GAMEPLAY', 'CONTROLS'];

export const SettingsWindow: React.FC<SettingsWindowProps> = ({ isOpen, onClose, isGameStarted = false }) => {
  const [activeTab, setActiveTab] = useState<Tab>('AUDIO');
  const [settings, setSettings] = useState<SettingsState>(gameStore.getSettings());
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
  
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimateIn, setIsAnimateIn] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollData, setScrollData] = useState({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 });

  useEffect(() => {
    const handleSettingsChange = (event: Event) => {
      setSettings((event as CustomEvent<SettingsState>).detail);
    };
    gameStore.addEventListener('settingsChange', handleSettingsChange);
    return () => gameStore.removeEventListener('settingsChange', handleSettingsChange);
  }, []);

  const updateScrollData = () => {
    if (scrollRef.current) {
      setScrollData({
        scrollTop: scrollRef.current.scrollTop,
        scrollHeight: scrollRef.current.scrollHeight,
        clientHeight: scrollRef.current.clientHeight,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      const renderTimer = setTimeout(() => setShouldRender(true), 0);
      setTimeout(() => setIsAnimateIn(true), 10);
      setTimeout(updateScrollData, 30);
      return () => clearTimeout(renderTimer);
    } else {
      const animationTimer = setTimeout(() => setIsAnimateIn(false), 0);
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => {
        clearTimeout(animationTimer);
        clearTimeout(timer);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      setTimeout(updateScrollData, 10);
    }
    const timer = setTimeout(() => setHighlightedRow(null), 0);
    return () => clearTimeout(timer);
  }, [activeTab]);

  if (!shouldRender) return null;

  const handleUpdate = <K extends keyof SettingsState>(category: K, updates: Partial<SettingsState[K]>) => {
    gameStore.updateSettings(category, updates);
  };

  const contentHeight = (FRAME_H - CONTENT_TOP - CONTENT_BOTTOM);
  const canScroll = scrollData.scrollHeight > scrollData.clientHeight;
  const thumbHeightRatio = canScroll ? Math.max(0.15, scrollData.clientHeight / scrollData.scrollHeight) : 1;
  const scrollTrackH = contentHeight - 24 * SCALE;
  const thumbH = scrollTrackH * thumbHeightRatio;
  const maxScrollTop = scrollData.scrollHeight - scrollData.clientHeight;
  const scrollProgress = canScroll && maxScrollTop > 0 ? scrollData.scrollTop / maxScrollTop : 0;
  const thumbTop = scrollProgress * (scrollTrackH - thumbH);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ 
        background: 'rgba(0,0,0,0.6)',
        opacity: isAnimateIn ? 1 : 0,
        transition: 'opacity 0.2s ease-out',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ 
        position: 'relative', width: FRAME_W, height: FRAME_H + TAB_H,
        transform: isAnimateIn ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(12px)',
        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>

        {/* ── Tab buttons ── */}
        <div style={{ position: 'absolute', top: 54 * SCALE, left: TAB_SLOTS_X[0], display: 'flex', gap: TAB_GAP, zIndex: 30 }}>
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              width: TAB_W, height: TAB_H,
              backgroundImage: `url('/settings-sprite-tab-${activeTab === tab ? 'active' : 'inactive'}.png')`,
              backgroundSize: '100% 100%', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11 * SCALE, fontFamily: "'Press Start 2P', monospace",
              color: activeTab === tab ? '#f0e0a0' : '#907060',
              textShadow: activeTab === tab ? '1px 1px 0 #3a2000,0 0 8px rgba(240,200,80,0.4)' : '1px 1px 0 #1a0800',
              letterSpacing: '0.06em', padding: 0,
              zIndex: activeTab === tab ? 35 : 28,
              marginBottom: activeTab === tab ? -2 * SCALE : 0,
              clipPath: 'inset(0 0 3px 0)',
              transition: 'color 0.12s',
            }}>{tab}</button>
          ))}
        </div>

        {/* ── Wooden frame ── */}
        <img src="/settings-sprite-frame.png" alt="" draggable={false} style={{
          position: 'absolute', top: TAB_H - 2 * SCALE, left: 0,
          width: FRAME_W, height: FRAME_H, zIndex: 20, pointerEvents: 'none',
          imageRendering: 'pixelated',
        }}/>

        {/* ── Content area (inside the frame hole) ── */}
        <div style={{
          position: 'absolute',
          top: TAB_H + CONTENT_TOP,
          left: CONTENT_SIDE,
          right: CONTENT_SIDE,
          height: contentHeight,
          zIndex: 10, display: 'flex', overflow: 'hidden',
        }}>
          {/* Darkened bg inside the hole */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(12,8,4,0.72)' }}/>

          {/* Scrollable content */}
          <div 
            ref={scrollRef}
            onScroll={updateScrollData}
            style={{
              position: 'relative', zIndex: 2, flex: 1, overflowY: 'auto',
              scrollbarWidth: 'none',
              padding: `${24 * SCALE}px ${36 * SCALE}px ${24 * SCALE}px ${24 * SCALE}px`,
            }}
          >
            {activeTab === 'AUDIO' && (
              <AudioTab 
                settings={settings.audio} scale={SCALE} 
                highlightedRow={highlightedRow} onHighlight={setHighlightedRow}
                onUpdate={(updates) => handleUpdate('audio', updates)}
              />
            )}
            {activeTab === 'VIDEO' && (
              <VideoTab 
                settings={settings.video} scale={SCALE} 
                highlightedRow={highlightedRow} onHighlight={setHighlightedRow}
                onUpdate={(updates) => handleUpdate('video', updates)}
              />
            )}
            {activeTab === 'GAMEPLAY' && (
              <GameplayTab 
                settings={settings.gameplay} scale={SCALE} 
                highlightedRow={highlightedRow} onHighlight={setHighlightedRow}
                onUpdate={(updates) => handleUpdate('gameplay', updates)}
              />
            )}
            {activeTab === 'CONTROLS' && (
              <ControlsTab 
                settings={settings.controls} scale={SCALE} 
                highlightedRow={highlightedRow} onHighlight={setHighlightedRow}
                onUpdate={(updates) => handleUpdate('controls', updates)}
              />
            )}
          </div>

          {/* Right scrollbar */}
          {canScroll && (
            <div style={{
              position: 'absolute', right: 10 * SCALE, top: 12 * SCALE, bottom: 12 * SCALE, width: 14 * SCALE,
              background: 'rgba(12,8,4,0.4)', border: '1px solid rgba(74,48,32,0.3)',
              borderRadius: 4 * SCALE,
              display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 3,
            }}>
              <div style={{ flex: 1, position: 'relative', width: '100%' }}>
                <div style={{
                  position: 'absolute', top: thumbTop, left: '20%', right: '20%', height: thumbH,
                  background: 'linear-gradient(90deg,#7a5a30 0%,#4a3020 100%)',
                  borderRadius: 3 * SCALE, border: '1px solid #8a6838', pointerEvents: 'none',
                  boxShadow: '0 0 6px rgba(0,0,0,0.3)',
                }}/>
              </div>
            </div>
          )}
        </div>

        {/* ── Back to Menu button ── */}
        <button onClick={onClose} style={{
          position: 'absolute', bottom: 6 * SCALE, left: '50%',
          transform: 'translateX(-50%)', zIndex: 30,
          width: 372 * SCALE, height: 68 * SCALE,
          backgroundImage: "url('/settings-sprite-button-right-2.png')",
          backgroundSize: '100% 100%', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 * SCALE,
          fontFamily: "'Press Start 2P', monospace", fontSize: 12.5 * SCALE,
          color: '#ffe0a0', textShadow: '2px 2px 0 #3a2000', letterSpacing: '0.06em',
          imageRendering: 'pixelated',
          transition: 'filter 0.15s ease',
        }}
          onMouseEnter={e => {
            e.currentTarget.style.filter = 'brightness(1.15)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.filter = 'brightness(1)';
          }}
          onMouseDown={e => {
            e.currentTarget.style.filter = 'brightness(0.9)';
          }}
        >
          <span style={{ fontSize: 16 * SCALE, lineHeight: 1, marginTop: -2 * SCALE }}>«</span>
          {isGameStarted ? 'BACK TO GAME' : 'BACK TO MENU'}
        </button>
      </div>
    </div>
  );
};

/* ── UI Helpers ────────────────────────────────────────────── */

const SettingRow: React.FC<{
  label: string; idx: number; highlightedRow: number | null; 
  onHighlight: (i: number) => void; scale: number; children: React.ReactNode;
}> = ({ label, idx, highlightedRow, onHighlight, scale, children }) => (
  <div
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: `${18 * scale}px ${24 * scale}px`, marginBottom: 1,
      background: highlightedRow === idx ? 'rgba(190,150,60,0.25)' : 'transparent',
      cursor: 'pointer',
      borderLeft: highlightedRow === idx ? `3px solid rgba(230,190,80,0.65)` : '3px solid transparent',
      transition: 'background 0.1s',
    }}
    onClick={() => onHighlight(idx)}
  >
    <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 13 * scale, color: '#ddd0b0', letterSpacing: '0.03em' }}>
      {label}
    </span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 * scale }}>
      {children}
    </div>
  </div>
);

type ValueCyclerProps<T extends string | boolean> = {
  value: T;
  options: T[];
  labels?: string[];
  onChange: (value: T) => void;
  scale: number;
};

const ValueCycler = <T extends string | boolean>({ value, options, labels, onChange, scale }: ValueCyclerProps<T>) => {
  const valueIdx = options.indexOf(value);
  const displayIdx = valueIdx >= 0 ? valueIdx : 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (displayIdx + 1) % options.length;
    onChange(options[nextIdx]);
  };
  
  const displayValue = valueIdx >= 0
    ? (labels ? labels[displayIdx] : String(value))
    : String(value);

  return (
    <span 
      onClick={handleClick} 
      style={{ 
        fontFamily: "'Press Start 2P', monospace", fontSize: 13 * scale, 
        color: '#b0a080', letterSpacing: '0.03em', cursor: 'pointer', userSelect: 'none' 
      }}
      onMouseEnter={e => (e.currentTarget.style.color = '#e8d8a0')}
      onMouseLeave={e => (e.currentTarget.style.color = '#b0a080')}
    >
      &lt; {displayValue} &gt;
    </span>
  );
};

/* ── Tabs ──────────────────────────────────────────────────── */

const AudioTab: React.FC<{
  settings: SettingsState['audio'], scale: number, 
  highlightedRow: number | null, onHighlight: (i: number) => void, onUpdate: (u: Partial<SettingsState['audio']>) => void
}> = ({ settings, scale, highlightedRow, onHighlight, onUpdate }) => {
  const valStyle = { fontFamily: "'Press Start 2P', monospace", fontSize: 13 * scale, color: '#b0a080', letterSpacing: '0.03em' };
  
  return (
    <div style={{ padding: `${8 * scale}px 0` }}>
      <SettingRow label="Master Volume" idx={0} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
        <AcornSlider value={settings.masterVolume} onChange={v => onUpdate({ masterVolume: v })} scale={scale}/>
        <span style={{ ...valStyle, minWidth: 54 * scale, textAlign: 'right' }}>{Math.round(settings.masterVolume * 100)}%</span>
      </SettingRow>
      <SettingRow label="Music Volume" idx={1} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
        <AcornSlider value={settings.musicVolume} onChange={v => onUpdate({ musicVolume: v })} scale={scale}/>
        <span style={{ ...valStyle, minWidth: 54 * scale, textAlign: 'right' }}>{Math.round(settings.musicVolume * 100)}%</span>
      </SettingRow>
      <SettingRow label="Voice Acting" idx={2} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
        <PixelCheckbox checked={settings.voiceActing} onChange={v => onUpdate({ voiceActing: v })} scale={scale}/>
      </SettingRow>
      <SettingRow label="Audio Quality" idx={3} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
        <ValueCycler value={settings.audioQuality} options={['Low', 'Medium', 'High', 'Ultra']} onChange={v => onUpdate({ audioQuality: v })} scale={scale} />
      </SettingRow>
      <SettingRow label="Subtitles" idx={4} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
        <ValueCycler value={settings.subtitles} options={[true, false]} labels={['On', 'Off']} onChange={v => onUpdate({ subtitles: v })} scale={scale} />
      </SettingRow>
      <SettingRow label="Language" idx={5} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
        <ValueCycler value={settings.language} options={['English', 'French', 'German', 'Spanish']} onChange={v => onUpdate({ language: v })} scale={scale} />
      </SettingRow>
    </div>
  );
};

const VideoTab: React.FC<{
  settings: SettingsState['video'], scale: number, 
  highlightedRow: number | null, onHighlight: (i: number) => void, onUpdate: (u: Partial<SettingsState['video']>) => void
}> = ({ settings, scale, highlightedRow, onHighlight, onUpdate }) => {
  return (
    <div style={{ padding: `${8 * scale}px 0` }}>
      <SettingRow label="Resolution" idx={0} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
        <ValueCycler value={settings.resolution} options={['1280x720', '1920x1080', '2560x1440', '3840x2160']} onChange={v => onUpdate({ resolution: v })} scale={scale} />
      </SettingRow>
      <SettingRow label="Fullscreen" idx={1} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
        <PixelCheckbox checked={settings.fullscreen} onChange={v => onUpdate({ fullscreen: v })} scale={scale}/>
      </SettingRow>
      <SettingRow label="V-Sync" idx={2} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
        <PixelCheckbox checked={settings.vsync} onChange={v => onUpdate({ vsync: v })} scale={scale}/>
      </SettingRow>
      <SettingRow label="Anti-Aliasing" idx={3} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
        <ValueCycler value={settings.antiAliasing} options={['Off', 'FXAA', 'SMAA', 'TAA']} onChange={v => onUpdate({ antiAliasing: v })} scale={scale} />
      </SettingRow>
      <SettingRow label="Texture Quality" idx={4} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
        <ValueCycler value={settings.textureQuality} options={['Low', 'Medium', 'High', 'Ultra']} onChange={v => onUpdate({ textureQuality: v })} scale={scale} />
      </SettingRow>
    </div>
  );
};

const GameplayTab: React.FC<{
  settings: SettingsState['gameplay'], scale: number, 
  highlightedRow: number | null, onHighlight: (i: number) => void, onUpdate: (u: Partial<SettingsState['gameplay']>) => void
}> = ({ settings, scale, highlightedRow, onHighlight, onUpdate }) => {
  return (
    <div style={{ padding: `${8 * scale}px 0` }}>
      <SettingRow label="Difficulty" idx={0} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
        <ValueCycler value={settings.difficulty} options={['Story', 'Easy', 'Normal', 'Hard', 'Nightmare']} onChange={v => onUpdate({ difficulty: v })} scale={scale} />
      </SettingRow>
      <SettingRow label="Camera Shake" idx={1} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
        <PixelCheckbox checked={settings.cameraShake} onChange={v => onUpdate({ cameraShake: v })} scale={scale}/>
      </SettingRow>
      <SettingRow label="Tutorial Tooltips" idx={2} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
        <PixelCheckbox checked={settings.tutorialTooltips} onChange={v => onUpdate({ tutorialTooltips: v })} scale={scale}/>
      </SettingRow>
      <SettingRow label="Auto Save" idx={3} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
        <PixelCheckbox checked={settings.autoSave} onChange={v => onUpdate({ autoSave: v })} scale={scale}/>
      </SettingRow>
    </div>
  );
};

const ControlsTab: React.FC<{
  settings: SettingsState['controls'], scale: number, 
  highlightedRow: number | null, onHighlight: (i: number) => void, onUpdate: (u: Partial<SettingsState['controls']>) => void
}> = ({ settings, scale, highlightedRow, onHighlight, onUpdate }) => {
  const [listeningFor, setListeningFor] = useState<string | null>(null);
  const valStyle = { fontFamily: "'Press Start 2P', monospace", fontSize: 13 * scale, color: '#b0a080', letterSpacing: '0.03em' };

  useEffect(() => {
    if (!listeningFor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        setListeningFor(null);
        return;
      }

      onUpdate({
        keyBindings: {
          ...settings.keyBindings,
          [listeningFor]: normalizeBindingKey(event),
        },
      });
      setListeningFor(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [listeningFor, onUpdate, settings.keyBindings]);

  return (
    <div style={{ padding: `${8 * scale}px 0` }}>
      <SettingRow label="Invert Y-Axis" idx={0} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
        <PixelCheckbox checked={settings.invertY} onChange={v => onUpdate({ invertY: v })} scale={scale}/>
      </SettingRow>
      <SettingRow label="Mouse Sensitivity" idx={1} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
        <AcornSlider value={settings.mouseSensitivity} onChange={v => onUpdate({ mouseSensitivity: v })} scale={scale}/>
        <span style={{ ...valStyle, minWidth: 54 * scale, textAlign: 'right' }}>{Math.round(settings.mouseSensitivity * 100)}</span>
      </SettingRow>
      <div style={{ padding: `${20 * scale}px 24px`, color: '#6a4a28', fontFamily: "'Press Start 2P', monospace", fontSize: 12 * scale, borderBottom: '1px solid rgba(106, 74, 40, 0.3)', marginBottom: 4 * scale }}>
        KEY BINDINGS
      </div>
      {Object.entries(settings.keyBindings).map(([action, key], i) => (
        <SettingRow key={action} label={action.replace(/([A-Z])/g, ' $1').toUpperCase()} idx={i + 2} highlightedRow={highlightedRow} onHighlight={onHighlight} scale={scale}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setListeningFor(action);
            }}
            style={{ 
            background: '#1a1008', border: '1px solid #4a3020', padding: `${8 * scale}px ${16 * scale}px`,
            color: listeningFor === action ? '#ffe0a0' : '#d4c0a0', fontFamily: 'monospace', fontSize: 14 * scale,
            minWidth: 78 * scale, textAlign: 'center', cursor: 'pointer',
          }}>
            {listeningFor === action ? '...' : key}
          </button>
        </SettingRow>
      ))}
    </div>
  );
};

const normalizeBindingKey = (event: KeyboardEvent) => {
  if (event.code === 'Space') return 'Space';
  if (event.key.startsWith('Arrow')) return event.key;
  if (event.key.length === 1) return event.key.toUpperCase();
  return event.key;
};


/* ── Acorn Slider ──────────────────────────────────────────── */
const AcornSlider: React.FC<{ value: number; onChange: (v: number) => void; scale: number }> = ({ value, onChange, scale }) => {
  const trackW = 185 * scale;
  const trackH = 7 * scale;
  const thumbW = 20 * scale;
  const thumbH = thumbW * (367 / 287);
  const thumbPos = value * (trackW - thumbW);

  return (
    <div 
      style={{ position: 'relative', width: trackW, height: thumbH, display: 'flex', alignItems: 'center', userSelect: 'none' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{
        position: 'absolute', left: thumbW / 2, right: thumbW / 2, height: trackH,
        background: 'linear-gradient(180deg,#221208 0%,#38240e 50%,#221208 100%)',
        border: '1.5px solid #6a4a28', borderRadius: trackH / 2, pointerEvents: 'none'
      }}/>
      <div style={{
        position: 'absolute', left: thumbW / 2, width: thumbPos, height: trackH,
        background: 'linear-gradient(180deg,#8a6838 0%,#c09050 50%,#8a6838 100%)',
        borderRadius: trackH / 2, pointerEvents: 'none'
      }}/>
      <img src="/settings-sprite-acorn.png" alt="" draggable={false} style={{
        position: 'absolute', left: thumbPos, width: thumbW, height: thumbH,
        imageRendering: 'pixelated', pointerEvents: 'none',
        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.7))',
      }}/>
      <input type="range" min={0} max={1} step={0.01} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', margin: 0 }}
      />
    </div>
  );
};

/* ── Pixel Checkbox ────────────────────────────────────────── */
const PixelCheckbox: React.FC<{ checked: boolean; onChange: (v: boolean) => void; scale: number }> = ({ checked, onChange, scale }) => (
  <div onClick={(e) => { e.stopPropagation(); onChange(!checked); }} style={{
    width: 22 * scale, height: 22 * scale, border: '2px solid #7a5a32',
    background: checked ? '#261408' : '#160c04', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.7)',
  }}>
    {checked && <span style={{ color: '#d4a060', fontSize: 14 * scale, lineHeight: 1, fontWeight: 'bold', fontFamily: 'monospace' }}>✓</span>}
  </div>
);

export default SettingsWindow;
