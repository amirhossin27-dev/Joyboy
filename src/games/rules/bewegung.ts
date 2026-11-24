import type { GameDef } from '../../engine/game';
import type { Level } from '../../lib/store';
import { placesFromScores } from '../../lib/util';

/**
 * Bewegungs-Würfel (nach dem Fitness-Würfel aus Arta) für 1–4 Kinder: Ein Würfel zeigt die Übung,
 * der zweite die Menge. Reihum würfeln und mitmachen – jede geschaffte Runde bringt ein Viertel mehr.
 * Wer nicht mehr kann, scheidet aus. Wer am Ende noch dabei ist, gewinnt (alle zusammen, wenn alle
 * durchhalten). Allein zählt, wie viele Runden man schafft.
 */

export interface Move {
  name: string;
  emoji: string;
  /** Wiederholungen bzw. Sekunden pro Würfelauge (auf „Schwer“) */
  per: number;
  unit: 'x' | 's';
  how: string;
}

export const MOVES: Move[] = [
  { name: 'Hampelmänner', emoji: '⭐', per: 2, unit: 'x', how: 'Springen, Arme hoch, Beine auseinander.' },
  { name: 'Froschsprünge', emoji: '🐸', per: 1, unit: 'x', how: 'In die Hocke und hoch wie ein Frosch.' },
  { name: 'Flamingo', emoji: '🦩', per: 3, unit: 's', how: 'Auf einem Bein stehen und nicht wackeln.' },
  { name: 'Auf der Stelle rennen', emoji: '🏃', per: 3, unit: 's', how: 'Knie hoch, so schnell du kannst.' },
  { name: 'Hasenhüpfer', emoji: '🐰', per: 2, unit: 'x', how: 'Mit beiden Beinen zusammen hüpfen.' },
  { name: 'Adler-Kreise', emoji: '🦅', per: 2, unit: 'x', how: 'Arme weit ausbreiten und große Kreise machen.' },
];

/** Runden pro Kind je Stufe – danach ist die Partie zu Ende. */
export const MOVE_ROUNDS: Record<Level, number> = { 0: 5, 1: 6, 2: 8 };
/** Kleinere Kinder bekommen weniger Wiederholungen. */
const SCALE: Record<Level, number> = { 0: 0.5, 1: 0.75, 2: 1 };

export interface BewegungState {
  n: number;
  level: Level;
  turn: number;
  /** Würfel des aktuellen Zugs: Übung (0–5) und Augen (1–6) */
  dice: { ex: number; pips: number } | null;
  /** Geschaffte Runden je Platz */
  done: number[];
  /** Wer nicht mehr konnte */
  out: boolean[];
  last: { by: number; ex: number; amount: number; ok: boolean } | null;
}

export type BewegungAction = { t: 'roll' } | { t: 'done' } | { t: 'quit' };

/** Menge für diese Runde: steigt mit jeder geschafften Runde um ein Viertel. */
export function moveAmount(ex: number, pips: number, round: number, level: Level): number {
  const m = MOVES[ex];
  const raw = m.per * pips * SCALE[level] * (1 + 0.25 * round);
  return m.unit === 's' ? Math.max(5, Math.round(raw / 5) * 5) : Math.max(1, Math.round(raw));
}

export const moveLabel = (ex: number, amount: number) => {
  const m = MOVES[ex];
  return m.unit === 's' ? `${amount} Sekunden ${m.name}` : `${amount} ${m.name}`;
};

export const moveCurrent = (s: BewegungState) => (s.dice ? moveAmount(s.dice.ex, s.dice.pips, s.done[s.turn], s.level) : 0);

const playing = (s: BewegungState, p: number) => !s.out[p] && s.done[p] < MOVE_ROUNDS[s.level];

export function bewegungOver(s: BewegungState): boolean {
  if (s.n === 1) return !playing(s, 0);
  const left = s.out.filter((o) => !o).length;
  // Nur noch einer dabei: Der hat gewonnen, die Runde muss nicht zu Ende gespielt werden.
  if (left <= 1) return true;
  return s.out.every((o, p) => o || !playing(s, p));
}

function nextSeat(s: BewegungState, from: number): number {
  for (let k = 1; k <= s.n; k++) {
    const p = (from + k) % s.n;
    if (playing(s, p)) return p;
  }
  return from;
}

export const bewegungDef: GameDef<BewegungState, BewegungAction> = {
  init: ({ n, starter, level }) => ({
    n,
    level,
    turn: starter % n,
    dice: null,
    done: Array.from({ length: n }, () => 0),
    out: Array.from({ length: n }, () => false),
    last: null,
  }),
  turn: (s) => (bewegungOver(s) ? null : s.turn),
  apply(s, a, by, rnd) {
    if (bewegungOver(s) || by !== s.turn) return null;
    if (a.t === 'roll') {
      if (s.dice) return null;
      return { ...s, dice: { ex: Math.floor(rnd() * MOVES.length), pips: 1 + Math.floor(rnd() * 6) } };
    }
    if (a.t === 'quit') {
      const out = s.out.map((o, p) => o || p === by);
      const last = s.dice ? { by, ex: s.dice.ex, amount: moveCurrent(s), ok: false } : s.last;
      const next = { ...s, out, dice: null, last };
      return { ...next, turn: nextSeat(next, by) };
    }
    if (a.t !== 'done' || !s.dice) return null;
    const done = s.done.map((d, p) => (p === by ? d + 1 : d));
    const next = { ...s, done, dice: null, last: { by, ex: s.dice.ex, amount: moveCurrent(s), ok: true } };
    return { ...next, turn: nextSeat(next, by) };
  },
  outcome(s) {
    if (!bewegungOver(s)) return null;
    // Wer noch dabei ist, liegt vorn; unter den Ausgeschiedenen zählt, wer länger durchgehalten hat.
    const scores = s.done.map((d, p) => d + (s.out[p] ? 0 : 100));
    return { places: placesFromScores(scores), scores: s.done, solo: s.n === 1 ? { score: s.done[0] } : undefined };
  },
  robo(s, seat, level, rnd) {
    if (bewegungOver(s) || s.turn !== seat) return null;
    if (!s.dice) return { t: 'roll' };
    // Robo hält eine Weile durch – auf „Leicht“ wird er schneller müde.
    const tired = [0.1, 0.06, 0.03][level] + s.done[seat] * [0.1, 0.08, 0.06][level];
    return rnd() < tired ? { t: 'quit' } : { t: 'done' };
  },
  roboDelay: (s) => (s.dice ? 2600 : 900),
  endDelay: 1800,
};
