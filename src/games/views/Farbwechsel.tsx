import { useState } from 'react';
import { buzz, sfx } from '../../arcade/engine';
import type { PlayProps } from '../../engine/game';
import { useGame } from '../../engine/useGame';
import { cls } from '../../lib/util';
import { Curtain, SeatStrip, Sheet, useOnChange } from '../../ui/parts';
import { farbwechselDef, FW_COLOR_NAME, FW_COLORS, fwLabel, fwName, fwPlayable, fwTop, type FwCard, type FwColor, type FwState } from '../rules/farbwechsel';
import { nameOf, turnHint } from './Classic';

export function ColorCard({ card, onClick, can, disabled }: { card: FwCard | null; onClick?: () => void; can?: boolean; disabled?: boolean }) {
  if (!card) return <span className="fwcard back" aria-label="verdeckte Karte" role="img" />;
  const label = fwLabel(card);
  const body = (
    <>
      <span className="fw-corner">{label}</span>
      <span className="fw-face">
        <b>{label}</b>
      </span>
    </>
  );
  const className = cls('fwcard', `fw-${card.c}`, can && 'can');
  if (!onClick)
    return (
      <span className={className} role="img" aria-label={fwName(card)}>
        {body}
      </span>
    );
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled} aria-label={fwName(card)}>
      {body}
    </button>
  );
}

export function Farbwechsel(props: PlayProps) {
  const { seats } = props;
  const g = useGame(farbwechselDef, props);
  const s: FwState = g.s;
  const [colorFor, setColorFor] = useState<number | null>(null);
  const me = g.view;
  const hand = s.hands[me] ?? [];
  const top = fwTop(s);
  const myMove = g.myTurn && s.turn === me;

  useOnChange(s.pile.length, () => {
    sfx.flip();
    buzz(10);
  });
  useOnChange(s.last, (_, last) => {
    if (last?.kind === 'draw' || last?.penalty) sfx.take();
  });

  const play = (c: FwCard) => {
    if (!myMove || !fwPlayable(s, c)) return;
    if (c.c === 'w') setColorFor(c.id);
    else g.act({ t: 'play', id: c.id });
  };

  let note = '';
  if (s.last?.kind === 'play' && s.last.card) {
    note = `${seats[s.last.by].name} legt ${fwName(s.last.card)}`;
    if (s.last.penalty && s.last.hit !== undefined) note += ` – ${seats[s.last.hit].name} zieht ${s.last.penalty}`;
    else if (s.last.hit !== undefined) note += ` – ${seats[s.last.hit].name} setzt aus`;
    else if (s.last.card.v === 'R') note += ' – andersherum!';
  } else if (s.last?.kind === 'draw') note = `${seats[s.last.by].name} zieht eine Karte`;

  let hint = turnHint(g, seats, '');
  if (!hint && !g.outcome) {
    if (myMove) hint = s.drawn !== null ? 'Die gezogene Karte passt! Legen oder weiter?' : 'Leg eine passende Karte oder zieh eine';
    else hint = `${nameOf(seats, s.turn)} ist dran`;
  }

  return (
    <div className="g-col">
      <SeatStrip seats={seats} active={g.turn} scores={s.hands.map((h) => (h.length === 1 ? 'nur noch 1!' : `${h.length} Karten`))} />
      <div className="table-row">
        <button type="button" className="fwcard back" disabled={!myMove || s.drawn !== null} onClick={() => g.act({ t: 'draw' })} aria-label="Karte ziehen" />
        <ColorCard card={top} />
        <div className="col" style={{ gap: 6, minWidth: 90, alignItems: 'center' }}>
          <span className={cls('fw-now', `fw-${s.color}`)} aria-label={`Farbe: ${FW_COLOR_NAME[s.color]}`}>
            {FW_COLOR_NAME[s.color]}
          </span>
          {s.n > 2 && (
            <span className="pill sm" aria-label={s.dir === 1 ? 'Richtung: im Uhrzeigersinn' : 'Richtung: andersherum'}>
              {s.dir === 1 ? '↻' : '↺'}
            </span>
          )}
        </div>
      </div>
      <p className="game-hint">{note}</p>
      <div className="hand-row" aria-label="Deine Karten">
        {hand.map((c) => {
          const can = myMove && fwPlayable(s, c);
          return <ColorCard key={c.id} card={c} can={can} disabled={!can} onClick={() => play(c)} />;
        })}
      </div>
      {myMove && s.drawn !== null && (
        <button type="button" className="btn secondary small" onClick={() => g.act({ t: 'pass' })}>
          Weiter
        </button>
      )}
      <p className="game-hint big">{s.winner !== undefined ? `Keine Karten mehr! ${seats[s.winner].name} gewinnt!` : hint}</p>
      {g.curtain !== null && <Curtain seat={seats[g.curtain]} note={note} onReveal={g.reveal} />}
      {colorFor !== null && (
        <Sheet title="Welche Farbe soll es sein?" onClose={() => setColorFor(null)}>
          <div className="wish">
            {FW_COLORS.map((c: FwColor) => (
              <button
                key={c}
                type="button"
                className={`fw-pick fw-${c}`}
                onClick={() => {
                  g.act({ t: 'play', id: colorFor, color: c });
                  setColorFor(null);
                }}
                aria-label={FW_COLOR_NAME[c]}
              />
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
