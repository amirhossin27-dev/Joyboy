import type { GameDef } from '../../engine/game';
import type { Level } from '../../lib/store';
import { shuffle, type Rnd } from '../../lib/util';

/**
 * Farbwechsel (nach Artas Uno, eigener Name) für 2–4 Kinder: Leg eine Karte gleicher Farbe oder
 * gleicher Zahl bzw. gleichen Zeichens. Aussetzen, Richtungswechsel und +2 gibt es in jeder Farbe,
 * dazu Farbwahl und +4 (wünscht ebenfalls eine Farbe). Wer zuerst keine Karten mehr hat, gewinnt.
 * Leicht: 5 Karten auf der Hand und ohne +4.
 */

export type FwColor = 'r' | 'y' | 'g' | 'b';
/** 0–9, S = Aussetzen, R = Richtungswechsel, D = +2, W = Farbwahl, F = +4 */
export type FwValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'S' | 'R' | 'D' | 'W' | 'F';

export interface FwCard {
  id: number;
  /** 'w' = Farbwahl-Karte (schwarz) */
  c: FwColor | 'w';
  v: FwValue;
}

export const FW_COLORS: FwColor[] = ['r', 'y', 'g', 'b'];
export const FW_COLOR_NAME: Record<FwColor, string> = { r: 'Rot', y: 'Gelb', g: 'Grün', b: 'Blau' };

export const fwHand = (level: Level) => (level === 0 ? 5 : 7);

/** Das ganze Blatt: je Farbe eine 0, zwei 1–9 und je zwei Aussetzen, Richtungswechsel, +2; dazu 4 Farbwahl und 4 × +4. */
export function fwDeck(level: Level): FwCard[] {
  const cards: FwCard[] = [];
  let id = 0;
  for (const c of FW_COLORS) {
    cards.push({ id: id++, c, v: '0' });
    for (const v of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'S', 'R', 'D'] as FwValue[]) {
      cards.push({ id: id++, c, v });
      cards.push({ id: id++, c, v });
    }
  }
  for (let k = 0; k < 4; k++) {
    cards.push({ id: id++, c: 'w', v: 'W' });
    if (level > 0) cards.push({ id: id++, c: 'w', v: 'F' });
  }
  return cards;
}

export const fwLabel = (card: FwCard) => ({ S: '⊘', R: '⇄', D: '+2', W: '★', F: '+4' })[card.v as 'S'] ?? card.v;

export function fwName(card: FwCard): string {
  const v = { S: 'Aussetzen', R: 'Richtungswechsel', D: 'plus 2', W: 'Farbwahl', F: 'plus 4' }[card.v as 'S'] ?? card.v;
  return card.c === 'w' ? v : `${FW_COLOR_NAME[card.c]} ${v}`;
}

export interface FwState {
  n: number;
  draw: FwCard[];
  pile: FwCard[];
  hands: FwCard[][];
  turn: number;
  /** 1 = im Uhrzeigersinn, -1 = andersherum */
  dir: 1 | -1;
  /** Aktuelle Farbe (nach Farbwahl die gewünschte) */
  color: FwColor;
  /** Gerade gezogene Karte, die noch gelegt werden darf */
  drawn: number | null;
  last: { by: number; kind: 'play' | 'draw' | 'pass'; card?: FwCard; got?: number; hit?: number; penalty?: number } | null;
  winner?: number;
}

export type FwAction = { t: 'play'; id: number; color?: FwColor } | { t: 'draw' } | { t: 'pass' };

export const fwTop = (s: FwState) => s.pile[s.pile.length - 1];

export function fwPlayable(s: FwState, card: FwCard): boolean {
  if (s.drawn !== null && card.id !== s.drawn) return false;
  if (card.c === 'w') return true;
  const top = fwTop(s);
  return card.c === s.color || (top.c !== 'w' && card.v === top.v);
}

const step = (s: FwState, seat: number, k = 1) => (((seat + s.dir * k) % s.n) + s.n) % s.n;

/** Zieht Karten; ist der Stapel leer, wird die Ablage (ohne oberste Karte) neu gemischt. */
function take(s: FwState, seat: number, n: number, rnd: Rnd): { s: FwState; got: FwCard[] } {
  let draw = s.draw;
  let pile = s.pile;
  const got: FwCard[] = [];
  for (let k = 0; k < n; k++) {
    if (!draw.length && pile.length > 1) {
      draw = shuffle(pile.slice(0, -1), rnd);
      pile = pile.slice(-1);
    }
    const card = draw[draw.length - 1];
    if (!card) break;
    draw = draw.slice(0, -1);
    got.push(card);
  }
  const hands = s.hands.map((h, i) => (i === seat ? [...h, ...got] : h));
  return { s: { ...s, draw, pile, hands }, got };
}

/** Die Farbe, von der man die meisten Karten hat. */
export function fwBestColor(hand: FwCard[], rnd: Rnd = Math.random): FwColor {
  const count = (c: FwColor) => hand.filter((h) => h.c === c).length;
  const max = Math.max(...FW_COLORS.map(count));
  const best = FW_COLORS.filter((c) => count(c) === max);
  return best[Math.floor(rnd() * best.length)];
}

export const farbwechselDef: GameDef<FwState, FwAction> = {
  init({ n, starter, level, rnd }) {
    const deck = shuffle(fwDeck(level), rnd);
    const hands = Array.from({ length: n }, () => deck.splice(0, fwHand(level)));
    // Erste Karte: eine Zahl, damit niemand gleich aussetzen muss.
    const first = deck.findIndex((c) => /\d/.test(c.v));
    const [top] = deck.splice(first, 1);
    return { n, draw: deck, pile: [top], hands, turn: starter % n, dir: 1, color: top.c as FwColor, drawn: null, last: null };
  },
  turn: (s) => (s.winner !== undefined ? null : s.turn),
  apply(s, a, by, rnd) {
    if (s.winner !== undefined || by !== s.turn) return null;
    if (a.t === 'draw') {
      if (s.drawn !== null) return null;
      const { s: next, got } = take(s, by, 1, rnd);
      const card = got[0];
      const last = { by, kind: 'draw' as const, got: got.length };
      if (card && fwPlayable({ ...next, drawn: card.id }, card)) return { ...next, drawn: card.id, last };
      return { ...next, turn: step(next, by), drawn: null, last };
    }
    if (a.t === 'pass') {
      if (s.drawn === null) return null;
      return { ...s, turn: step(s, by), drawn: null, last: { by, kind: 'pass' } };
    }
    const card = s.hands[by].find((c) => c.id === a.id);
    if (!card || !fwPlayable(s, card)) return null;
    if (card.c === 'w' && (!a.color || !FW_COLORS.includes(a.color))) return null;
    // Zu zweit wirkt der Richtungswechsel wie Aussetzen.
    const dir: 1 | -1 = card.v === 'R' && s.n > 2 ? (s.dir === 1 ? -1 : 1) : s.dir;
    let next: FwState = {
      ...s,
      dir,
      hands: s.hands.map((h, i) => (i === by ? h.filter((c) => c.id !== card.id) : h)),
      pile: [...s.pile, card],
      color: card.c === 'w' ? a.color! : card.c,
      drawn: null,
      last: { by, kind: 'play', card },
    };
    if (!next.hands[by].length) return { ...next, winner: by };
    const victim = step(next, by);
    const penalty = card.v === 'D' ? 2 : card.v === 'F' ? 4 : 0;
    if (penalty) next = { ...take(next, victim, penalty, rnd).s, last: { by, kind: 'play', card, hit: victim, penalty } };
    else if (card.v === 'S' || (card.v === 'R' && s.n === 2)) next = { ...next, last: { by, kind: 'play', card, hit: victim } };
    const skip = penalty > 0 || card.v === 'S' || (card.v === 'R' && s.n === 2);
    return { ...next, turn: skip ? step(next, by, 2) : victim };
  },
  outcome(s) {
    if (s.winner === undefined) return null;
    // Platz nach Anzahl der übrigen Karten
    const left = s.hands.map((h) => h.length);
    return { places: left.map((x) => 1 + left.filter((o) => o < x).length), scores: left };
  },
  robo(s, seat, level, rnd) {
    if (s.winner !== undefined || s.turn !== seat) return null;
    const hand = s.hands[seat];
    const playable = hand.filter((c) => fwPlayable(s, c));
    if (!playable.length) return s.drawn !== null ? { t: 'pass' } : { t: 'draw' };
    const nextCards = s.hands[step(s, seat)].length;
    const sloppy = [4, 1.5, 0][level as Level];
    const score = (c: FwCard) => {
      let v = c.c === 'w' ? -10 : /\d/.test(c.v) ? Number(c.v) / 2 : 3;
      if (c.v === 'F') v = nextCards <= 2 ? 12 : -14;
      if ((c.v === 'D' || c.v === 'S' || c.v === 'R') && nextCards <= 3) v += 8;
      // Farbe behalten, von der man viele hat
      if (c.c !== 'w') v += hand.filter((h) => h.c === c.c).length * 0.8;
      if (hand.length === 1) v += 20;
      return v + rnd() * sloppy * 3;
    };
    const card = playable.map((c) => ({ c, v: score(c) })).reduce((x, y) => (y.v > x.v ? y : x)).c;
    return card.c === 'w' ? { t: 'play', id: card.id, color: fwBestColor(hand.filter((c) => c.id !== card.id), rnd) } : { t: 'play', id: card.id };
  },
  roboDelay: () => 900 + Math.random() * 400,
  viewer: (s) => (s.winner !== undefined ? null : s.turn),
  endDelay: 1400,
};
