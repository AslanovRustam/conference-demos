import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { BETS } from '../config';
import { formatCredits } from '../core/format';
import { RISKS, ROWS_MAX, ROWS_MIN, type Rows } from '../core/types';
import { useSim } from '../sim/SimProvider';
import { useGame } from '../state/store';
import { S } from '../strings';

function Stepper(props: { label: string; value: string; testid: string; canDown: boolean; canUp: boolean; onDown(): void; onUp(): void }) {
  return (
    <div className="field">
      <span className="label">{props.label}</span>
      <div className="stepper">
        <button className="step" data-testid={`${props.testid}-minus`} disabled={!props.canDown} onClick={props.onDown} aria-label={`${props.label} down`}>
          −
        </button>
        <span className="step-value">{props.value}</span>
        <button className="step" data-testid={`${props.testid}-plus`} disabled={!props.canUp} onClick={props.onUp} aria-label={`${props.label} up`}>
          +
        </button>
      </div>
    </div>
  );
}

export function ControlPanel() {
  const { bus, controller, store } = useSim();
  const bet = useGame((s) => s.bet);
  const risk = useGame((s) => s.risk);
  const rows = useGame((s) => s.rows);
  const inFlight = useGame((s) => s.inFlight);
  const stepBet = useGame((s) => s.stepBet);
  const setRisk = useGame((s) => s.setRisk);
  const setRows = useGame((s) => s.setRows);
  const [raining, setRaining] = useState(controller.rainActive);
  const locked = inFlight > 0;
  const click = () => bus.emit('ui:click', {});
  // Берём текущее значение из стора: быстрые клики подряд не теряются
  const stepRows = (dir: 1 | -1) => {
    const next = store.getState().rows + dir;
    return next >= ROWS_MIN && next <= ROWS_MAX && setRows(next as Rows);
  };

  useEffect(() => {
    const a = bus.on('rain:start', () => setRaining(true));
    const b = bus.on('rain:end', () => setRaining(false));
    return () => {
      a();
      b();
    };
  }, [bus]);

  return (
    <div className="panel">
      <div className="panel-row">
        <Stepper
          label={S.bet}
          value={formatCredits(bet)}
          testid="bet"
          canDown={bet > BETS[0]}
          canUp={bet < BETS[BETS.length - 1]}
          onDown={() => {
            stepBet(-1);
            click();
          }}
          onUp={() => {
            stepBet(1);
            click();
          }}
        />
        <Stepper
          label={S.rows}
          value={String(rows)}
          testid="rows"
          canDown={!locked && rows > ROWS_MIN}
          canUp={!locked && rows < ROWS_MAX}
          onDown={() => {
            if (stepRows(-1)) click();
          }}
          onUp={() => {
            if (stepRows(1)) click();
          }}
        />
      </div>
      <div className="field">
        <span className="label">{S.risk}</span>
        <div className="segmented">
          {RISKS.map((r) => (
            <button
              key={r}
              className={`segment${r === risk ? ' active' : ''}`}
              data-testid={`risk-${r}`}
              disabled={locked}
              onClick={() => {
                if (setRisk(r)) click();
              }}
            >
              {S[r]}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-row actions">
        <motion.button
          className="rain-btn"
          data-testid="rain"
          disabled={raining}
          whileTap={{ scale: 0.94 }}
          onClick={() => {
            controller.rain({ mode: 'paid' });
            click();
          }}
        >
          {S.rain}
        </motion.button>
        <motion.button
          className="drop-btn ck-chamfer"
          data-testid="drop"
          whileTap={{ scale: 0.94 }}
          onClick={() => {
            controller.drop();
            click();
          }}
        >
          {S.drop}
        </motion.button>
      </div>
    </div>
  );
}
