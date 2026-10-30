import { brandLogo } from '@brand/tokens';
import { useState } from 'react';
import { isEmbed, postExit } from '../platform/embed';
import { canFullscreen, toggleFullscreen } from '../platform/fullscreen';
import { S } from '../strings';
import { useSim } from '../sim/SimProvider';
import { useGame } from '../state/store';
import { BalanceCounter } from './BalanceCounter';

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
      {muted ? (
        <>
          <path d="m16 9 5 6" />
          <path d="m21 9-5 6" />
        </>
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}

export function TopBar({ onLogoProps }: { onLogoProps?: React.HTMLAttributes<HTMLImageElement> }) {
  const { bus } = useSim();
  const muted = useGame((s) => s.muted);
  const setMuted = useGame((s) => s.setMuted);
  const [fullscreen] = useState(canFullscreen);
  const [embedded] = useState(() => isEmbed(location.search));

  return (
    <div className="topbar">
      <img className="logo" src={brandLogo.red} alt="Clickable" draggable={false} {...onLogoProps} />
      <BalanceCounter />
      <div className="icons">
        <button
          className="icon-btn"
          data-testid="mute"
          aria-label={muted ? 'Unmute' : 'Mute'}
          onClick={() => {
            setMuted(!muted);
            bus.emit('ui:click', {});
          }}
        >
          <SpeakerIcon muted={muted} />
        </button>
        {embedded && (
          <button className="exit-btn" onClick={() => postExit()}>
            {S.exit}
          </button>
        )}
        {fullscreen && (
          <button className="icon-btn" aria-label="Fullscreen" onClick={() => void toggleFullscreen()}>
            <FullscreenIcon />
          </button>
        )}
      </div>
    </div>
  );
}
