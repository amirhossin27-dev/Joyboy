import { useEffect, useState, type CSSProperties } from 'react';
import { buzz, sfx, tone } from '../../arcade/engine';
import type { PlayProps } from '../../engine/game';
import { useGame } from '../../engine/useGame';
import { cls } from '../../lib/util';
import { Die, SeatStrip, useOnChange } from '../../ui/parts';
import { MOVE_ROUNDS, MOVES, bewegungDef, moveCurrent, moveLabel, type BewegungState } from '../rules/bewegung';
import { nameOf } from './Classic';

/** Countdown für Übungen mit Sekunden (Flamingo, Rennen) */
function HoldTimer({ seconds }: { seconds: number }) {
  const [end, setEnd] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (end === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(t);
  }, [end]);
  const left = end === null ? seconds : Math.max(0, Math.ceil((end - now) / 1000));
  useOnChange(left, (_, v) => {
    if (end === null) return;
    if (v === 0) {
      sfx.point();
      buzz([60, 60, 60]);
    } else if (v <= 3) tone(880, 70, 'triangle', 0.04);
  });
  return (
    <button type="button" className={cls('btn soft move-timer', end !== null && 'running', left === 0 && 'over')} onClick={() => setEnd(Date.now() + seconds * 1000)} disabled={end !== null && left > 0}>
      {end === null ? `⏱️ Uhr starten (${seconds} Sek.)` : left > 0 ? `⏱️ noch ${left}` : 'Zeit um – stark! 💪'}
    </button>
  );
}

/** Zum Mitzählen: ein Punkt je Wiederholung, antippen hakt ab. */
function CountDots({ amount }: { amount: number }) {
  const [count, setCount] = useState(0);
  if (amount > 30) return null;
  return (
    <button type="button" className="move-dots" onClick={() => {
      setCount((c) => Math.min(amount, c + 1));
      sfx.tap();
    }} aria-label={`Mitzählen: ${count} von ${amount}`}>
      {Array.from({ length: amount }, (_, i) => <i key={i} className={cls(i < count && 'on')} />)}
    </button>
  );
}

export function Bewegung(props: PlayProps) {
  const { seats } = props;
  const g = useGame(bewegungDef, props);
  const s: BewegungState = g.s;
  const solo = seats.length === 1;
  const max = MOVE_ROUNDS[s.level];
  const who = s.turn;
  const [rolling, setRolling] = useState(false);
  const move = s.dice ? MOVES[s.dice.ex] : null;
  const amount = moveCurrent(s);
  const round = Math.min(s.done[who] + 1, max);

  useOnChange(s.dice ? `${s.dice.ex}-${s.dice.pips}-${s.turn}-${s.done[s.turn]}` : null, (_, v) => {
    if (!v) return;
    setRolling(true);
    sfx.dice();
    buzz(15);
    window.setTimeout(() => setRolling(false), 420);
  });
  useOnChange(s.last, (_, l) => {
    if (!l) return;
    if (l.ok) {
      sfx.point();
      buzz(20);
    } else sfx.miss();
  });

  let hint = '';
  if (g.outcome) {
    const left = seats.filter((_, p) => !s.out[p]);
    if (solo) hint = s.out[0] ? `Stark: ${s.done[0]} Runden geschafft!` : `Alle ${max} Runden geschafft – super!`;
    else if (left.length === 1) hint = `${left[0].name} hält am längsten durch und gewinnt!`;
    else hint = 'Ihr habt alle durchgehalten – alle gewinnen!';
  } else if (g.thinking) hint = s.dice ? `${nameOf(seats, who)} macht ${moveLabel(s.dice.ex, amount)} …` : `${nameOf(seats, who)} würfelt …`;
  else if (!g.myTurn) hint = s.dice ? `${nameOf(seats, who)} macht ${moveLabel(s.dice.ex, amount)}. Feuer an!` : `${nameOf(seats, who)} ist dran`;
  else if (!s.dice) hint = solo ? `Runde ${round}: Würfeln!` : `${nameOf(seats, who)}: Würfeln!`;
  else hint = 'Los geht’s! Fertig? Dann tippe auf „Geschafft“.';

  const scores = seats.map((_, p) => (s.out[p] ? 'kann nicht mehr' : `${s.done[p]} von ${max}`));

  return (
    <div className="g-col move-game">
      {!solo && <SeatStrip seats={seats} active={g.outcome ? null : g.turn} scores={scores} done={seats.map((_, p) => !s.out[p] && s.done[p] >= max)} />}
      <div className="move-round">
        <span>
          Runde {round} von {max}
        </span>
        <span className="move-bar">
          <span style={{ '--p': `${(s.done[who] / max) * 100}%` } as CSSProperties} />
        </span>
      </div>
      <div className="move-dice">
        <div className={cls('move-ex-die', rolling && 'rolling')} aria-label={move ? move.name : 'Übungswürfel'}>
          {move ? move.emoji : '❔'}
        </div>
        <Die value={s.dice?.pips ?? 0} rolling={rolling} label={s.dice ? `Würfel ${s.dice.pips}` : 'Würfel'} />
      </div>
      {move && s.dice && (
        <div className="move-card" style={{ '--pc': seats[who].color } as CSSProperties}>
          <span className="move-emoji" aria-hidden="true">
            {move.emoji}
          </span>
          <b className="move-amount">{moveLabel(s.dice.ex, amount)}</b>
          <p className="muted">{move.how}</p>
          {g.myTurn && (move.unit === 's' ? <HoldTimer key={`${who}-${s.done[who]}`} seconds={amount} /> : <CountDots key={`${who}-${s.done[who]}`} amount={amount} />)}
        </div>
      )}
      {g.myTurn && !s.dice && (
        <button type="button" className="btn primary big block" onClick={() => g.act({ t: 'roll' })}>
          🎲 Würfeln
        </button>
      )}
      {g.myTurn && s.dice && (
        <div className="move-actions">
          <button type="button" className="btn primary big block" onClick={() => g.act({ t: 'done' })}>
            ✅ Geschafft!
          </button>
          <button type="button" className="btn ghost block" onClick={() => g.act({ t: 'quit' })}>
            😮‍💨 Ich kann nicht mehr
          </button>
        </div>
      )}
      <p className="game-hint">{hint}</p>
      <div className="move-faces" aria-label="Die sechs Übungen">
        {MOVES.map((m, k) => (
          <span key={k} className={cls(s.dice?.ex === k && 'on')}>
            <b aria-hidden="true">{m.emoji}</b> {m.name}
          </span>
        ))}
      </div>
    </div>
  );
}
