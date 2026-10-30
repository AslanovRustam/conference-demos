import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { BigWinOverlay } from './BigWinOverlay';
import { ControlPanel } from './ControlPanel';
import { History } from './History';
import { hudInsets, orientationOf, readSafeArea, uiScale } from './layoutMetrics';
import { TopBar } from './TopBar';
import { useGame } from '../state/store';
import './ui.css';

function useViewport() {
  const [v, setV] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setV({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return v;
}

export function Hud({ logoProps, children }: { logoProps?: React.HTMLAttributes<HTMLImageElement>; children?: ReactNode }) {
  const v = useViewport();
  const mode = useGame((s) => s.mode);
  const orientation = orientationOf(v);
  const ins = hudInsets(v, readSafeArea());
  const style = {
    '--inset-top': `${ins.top}px`,
    '--inset-right': `${ins.right}px`,
    '--inset-bottom': `${ins.bottom}px`,
    '--inset-left': `${ins.left}px`,
    '--u': `${uiScale(v)}px`,
  } as CSSProperties;

  return (
    <div className={`hud ${orientation}${mode === 'splash' ? ' hud-hidden' : ''}`} data-mode={mode} style={style}>
      {orientation === 'portrait' ? (
        <>
          <header className="hud-top">
            <TopBar onLogoProps={logoProps} />
          </header>
          <div className="hud-history">
            <History />
          </div>
          <footer className="hud-bottom">
            <ControlPanel />
          </footer>
        </>
      ) : (
        <>
          <aside className="hud-left">
            <TopBar onLogoProps={logoProps} />
            <ControlPanel />
          </aside>
          <aside className="hud-right">
            <History />
          </aside>
        </>
      )}
      <BigWinOverlay />
      {children}
    </div>
  );
}
