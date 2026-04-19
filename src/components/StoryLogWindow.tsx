import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ScrollText, History } from 'lucide-react';
import { type HistoryEntry } from '../game/storyTypes';

interface StoryLogWindowProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
}

const SCALE = 1.1;
const FRAME_W = 1561 * 0.5 * SCALE;
const FRAME_H = 1138 * 0.5 * SCALE;
const CROP_TOP = (3 * 16) + 7; // 3rem + 7px crop
const CONTENT_SIDE = 42 * SCALE;
const CONTENT_TOP = 76 * SCALE;
const CONTENT_BOTTOM = 56 * SCALE;

export const StoryLogWindow: React.FC<StoryLogWindowProps> = ({ isOpen, onClose, history }) => {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimateIn, setIsAnimateIn] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollData, setScrollData] = useState({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 });

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
    let renderTimer: ReturnType<typeof setTimeout> | undefined;
    let animateTimer: ReturnType<typeof setTimeout> | undefined;
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;

    if (isOpen) {
      renderTimer = setTimeout(() => setShouldRender(true), 0);
      animateTimer = setTimeout(() => setIsAnimateIn(true), 10);
      scrollTimer = setTimeout(() => {
        updateScrollData();
        // Scroll to bottom on open
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 50);
    } else {
      animateTimer = setTimeout(() => setIsAnimateIn(false), 0);
      renderTimer = setTimeout(() => setShouldRender(false), 200);
    }

    return () => {
      if (renderTimer) clearTimeout(renderTimer);
      if (animateTimer) clearTimeout(animateTimer);
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      updateScrollData();
    }
  }, [history, isOpen]);

  if (!shouldRender) return null;

  // The content area needs to be sized and positioned to fit exactly in the frame hole
  const holeTop = CONTENT_TOP * SCALE;
  const holeBottom = (FRAME_H - CONTENT_BOTTOM);
  const holeHeight = holeBottom - holeTop;

  const contentTop = holeTop - CROP_TOP + (4 * SCALE) + (2 * 16); // 2rem down
  const contentHeight = holeHeight - (8 * SCALE) + (1.5 * 16); // 1.5rem bigger height

  const canScroll = scrollData.scrollHeight > scrollData.clientHeight;
  const thumbHeightRatio = canScroll ? Math.max(0.15, scrollData.clientHeight / scrollData.scrollHeight) : 1;
  const scrollTrackH = contentHeight - 24 * SCALE;
  const thumbH = scrollTrackH * thumbHeightRatio;
  const maxScrollTop = scrollData.scrollHeight - scrollData.clientHeight;
  const scrollProgress = canScroll && maxScrollTop > 0 ? scrollData.scrollTop / maxScrollTop : 0;
  const thumbTop = scrollProgress * (scrollTrackH - thumbH);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center"
      style={{ 
        background: 'rgba(0,0,0,0.7)',
        opacity: isAnimateIn ? 1 : 0,
        transition: 'opacity 0.2s ease-out',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ 
        position: 'relative', width: FRAME_W, height: FRAME_H - CROP_TOP,
        overflow: 'hidden',
        transform: isAnimateIn ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(12px)',
        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>

        {/* ── Header ── */}
        <div style={{ 
          position: 'absolute', top: (34 * SCALE) - (CROP_TOP * 0.4) + (2 * 16), left: '50%', transform: 'translateX(-50%)',
          zIndex: 30, display: 'flex', alignItems: 'center', gap: 12 * SCALE,
          fontFamily: "'Press Start 2P', monospace", fontSize: 16 * SCALE,
          color: '#f0e0a0', textShadow: '2px 2px 0 #3a2000',
          letterSpacing: '0.1em'
        }}>
          <History size={20 * SCALE} />
          STORY LOG
        </div>

        {/* ── Wooden frame ── */}
        <img src="/settings-sprite-frame.webp" alt="" draggable={false} style={{
          position: 'absolute', top: -CROP_TOP, left: 0,
          width: FRAME_W, height: FRAME_H, zIndex: 20, pointerEvents: 'none',
          imageRendering: 'pixelated',
        }}/>

        {/* ── Content area ── */}
        <div style={{
          position: 'absolute',
          top: contentTop,
          left: CONTENT_SIDE,
          right: CONTENT_SIDE,
          height: contentHeight,
          zIndex: 10, display: 'flex', overflow: 'hidden',
          borderRadius: '4px',
        }}>
          {/* Darkened bg inside the hole */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(12,8,4,0.85)' }}/>

          {/* Scrollable content */}
          <div 
            ref={scrollRef}
            onScroll={updateScrollData}
            style={{
              position: 'relative', zIndex: 2, flex: 1, overflowY: 'auto',
              scrollbarWidth: 'none',
              padding: `${24 * SCALE}px ${36 * SCALE}px ${24 * SCALE}px ${32 * SCALE}px`,
              display: 'flex', flexDirection: 'column', gap: 20 * SCALE,
            }}
          >
            {history.length === 0 ? (
              <div style={{ 
                height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6a4a28', fontFamily: "'Press Start 2P', monospace", fontSize: 12 * SCALE,
                opacity: 0.5, textAlign: 'center'
              }}>
                The chronicles are empty...
              </div>
            ) : (
              history.map((entry, i) => (
                <div key={i} style={{ 
                  display: 'flex', flexDirection: 'column', gap: 6 * SCALE,
                  borderLeft: entry.type === 'dialogue' ? '2px solid rgba(212, 160, 96, 0.3)' : '2px solid rgba(106, 74, 40, 0.2)',
                  paddingLeft: 16 * SCALE,
                }}>
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: 8 * SCALE,
                    fontFamily: "'Press Start 2P', monospace", fontSize: 10 * SCALE,
                    color: entry.type === 'dialogue' ? '#d4a060' : '#8a6838',
                    textTransform: 'uppercase', opacity: 0.8
                  }}>
                    {entry.type === 'dialogue' ? <Sparkles size={10 * SCALE} /> : <ScrollText size={10 * SCALE} />}
                    {entry.speaker}
                  </div>
                  <p style={{ 
                    fontFamily: "'VT323', monospace", fontSize: 22 * SCALE,
                    color: entry.type === 'dialogue' ? '#ddd0b0' : '#b0a080',
                    lineHeight: 1.4, margin: 0, whiteSpace: 'pre-wrap'
                  }}>
                    {entry.text}
                  </p>
                </div>
              ))
            )}
            <div style={{ height: 20 * SCALE }} /> {/* Bottom padding */}
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

        {/* ── Close button ── */}
        <button onClick={onClose} style={{
          position: 'absolute', bottom: -2 * SCALE + 3, left: '50%',
          transform: 'translateX(-50%)', zIndex: 30,
          width: 372 * SCALE, height: 68 * SCALE,
          backgroundImage: "url('/settings-sprite-button-right-2.webp')",
          backgroundSize: '100% 100%', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 * SCALE,
          fontFamily: "'Press Start 2P', monospace", fontSize: 12.5 * SCALE,
          color: '#ffe0a0', textShadow: '2px 2px 0 #3a2000', letterSpacing: '0.06em',
          imageRendering: 'pixelated',
          transition: 'filter 0.15s ease',
        }}
          onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)'; }}
        >
          CLOSE CHRONICLES
        </button>
      </div>
    </div>
  );
};
