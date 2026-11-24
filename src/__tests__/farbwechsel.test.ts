import { describe, expect, it } from 'vitest';
import type { GameDef, InitCtx } from '../engine/game';
import { defFor, isOnlineGame } from '../games/defs';
import { farbwechselDef, fwDeck, fwPlayable, type FwCard, type FwState } from '../games/rules/farbwechsel';
import type { Level } from '../lib/store';

/** Reproduzierbarer Zufall */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ctx = (n: number, level: Level = 1, starter = 0): InitCtx => ({ n, starter, level, humans: 1, shared: false, rnd: seeded(1) });

let nextId = 1000;
const card = (c: FwCard['c'], v: FwCard['v']): FwCard => ({ id: nextId++, c, v });

/** Ein Tisch mit festen Händen und einer bestimmten obersten Karte */
function table(n: number, hands: FwCard[][], top: FwCard, dir: 1 | -1 = 1): FwState {
  const s = farbwechselDef.init(ctx(n));
  return { ...s, hands, pile: [top], color: top.c === 'w' ? 'r' : top.c, dir, turn: 0, drawn: null, last: null };
}

describe('Farbwechsel', () => {
  it('Blatt: 108 Karten, auf Leicht ohne +4 und 5 Karten auf der Hand', () => {
    expect(fwDeck(1)).toHaveLength(108);
    expect(fwDeck(0).some((c) => c.v === 'F')).toBe(false);
    expect(new Set(fwDeck(2).map((c) => c.id)).size).toBe(108);
    const s = farbwechselDef.init(ctx(4, 0));
    expect(s.hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
    expect(/\d/.test(s.pile[0].v)).toBe(true);
    expect(farbwechselDef.init(ctx(3, 2)).hands[0]).toHaveLength(7);
  });

  it('passt bei gleicher Farbe oder gleicher Zahl, Farbwahl passt immer', () => {
    const s = table(2, [[], []], card('b', '7'));
    expect(fwPlayable(s, card('b', '3'))).toBe(true);
    expect(fwPlayable(s, card('r', '7'))).toBe(true);
    expect(fwPlayable(s, card('r', '3'))).toBe(false);
    expect(fwPlayable(s, card('w', 'W'))).toBe(true);
  });

  it('Aussetzen überspringt, Richtungswechsel dreht um, +2 lässt ziehen und aussetzen', () => {
    const skip = card('r', 'S');
    let s = table(3, [[skip, card('g', '1')], [card('g', '2')], [card('g', '3')]], card('r', '5'));
    s = farbwechselDef.apply(s, { t: 'play', id: skip.id }, 0, seeded(2))!;
    expect(s.turn).toBe(2);

    const rev = card('r', 'R');
    s = table(4, [[rev, card('g', '1')], [card('g', '2')], [card('g', '3')], [card('g', '4')]], card('r', '5'));
    s = farbwechselDef.apply(s, { t: 'play', id: rev.id }, 0, seeded(2))!;
    expect(s.dir).toBe(-1);
    expect(s.turn).toBe(3);

    const plus = card('r', 'D');
    s = table(3, [[plus, card('g', '1')], [card('g', '2')], [card('g', '3')]], card('r', '5'));
    s = farbwechselDef.apply(s, { t: 'play', id: plus.id }, 0, seeded(2))!;
    expect(s.hands[1]).toHaveLength(3);
    expect(s.turn).toBe(2);
  });

  it('zu zweit wirkt der Richtungswechsel wie Aussetzen', () => {
    const rev = card('y', 'R');
    let s = table(2, [[rev, card('g', '1')], [card('g', '2')]], card('y', '5'));
    s = farbwechselDef.apply(s, { t: 'play', id: rev.id }, 0, seeded(2))!;
    expect(s.turn).toBe(0);
  });

  it('Farbwahl braucht eine Farbe, +4 lässt 4 ziehen', () => {
    const four = card('w', 'F');
    const s = table(2, [[four, card('g', '1')], [card('g', '2')]], card('y', '5'));
    expect(farbwechselDef.apply(s, { t: 'play', id: four.id }, 0, seeded(2))).toBeNull();
    const t = farbwechselDef.apply(s, { t: 'play', id: four.id, color: 'g' }, 0, seeded(2))!;
    expect(t.color).toBe('g');
    expect(t.hands[1]).toHaveLength(5);
    expect(t.turn).toBe(0);
  });

  it('wer die letzte Karte legt, gewinnt; die anderen nach Kartenzahl', () => {
    const lastCard = card('b', '9');
    const s = table(3, [[lastCard], [card('g', '2'), card('g', '3')], [card('g', '3')]], card('b', '5'));
    const t = farbwechselDef.apply(s, { t: 'play', id: lastCard.id }, 0, seeded(2))!;
    expect(t.winner).toBe(0);
    expect(farbwechselDef.outcome(t)!.places).toEqual([1, 3, 2]);
  });

  it('Robo gegen Robo endet zu zweit bis viert und übersteht den Weg über die Datenbank (JSON)', () => {
    expect(isOnlineGame('farbwechsel')).toBe(true);
    for (const n of [2, 3, 4])
      for (const level of [0, 1, 2] as const) {
        const def = defFor('farbwechsel', Array(n).fill(true)) as GameDef<unknown, unknown>;
        const rnd = seeded(n * 10 + level);
        let s = def.init({ ...ctx(n, level), rnd });
        for (let k = 0; k < 2000 && !def.outcome(s); k++) {
          const seat = def.turn(s) as number;
          s = def.apply(JSON.parse(JSON.stringify(s)), def.robo!(s, seat, level, rnd), seat, rnd)!;
          expect(s).not.toBeNull();
        }
        expect(def.outcome(s)).not.toBeNull();
      }
  });
});
