import { describe, expect, it } from 'vitest';
import type { GameDef, InitCtx } from '../engine/game';
import { defFor, isOnlineGame } from '../games/defs';
import { MOVE_ROUNDS, MOVES, bewegungDef, moveAmount, type BewegungAction, type BewegungState } from '../games/rules/bewegung';
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
const act = (s: BewegungState, a: BewegungAction, by: number) => bewegungDef.apply(s, a, by, seeded(7))!;

describe('Bewegungs-Würfel', () => {
  it('hat sechs Übungen mit Bild und kindgerechten Mengen, die jede Runde wachsen', () => {
    expect(MOVES).toHaveLength(6);
    for (const m of MOVES) expect(m.emoji.length).toBeGreaterThan(0);
    // Leicht: höchstens 6 Hampelmänner beim Start, Sekunden immer in Fünferschritten
    expect(moveAmount(0, 6, 0, 0)).toBe(6);
    expect(moveAmount(2, 1, 0, 0)).toBe(5);
    expect(moveAmount(2, 6, 3, 2) % 5).toBe(0);
    expect(moveAmount(0, 4, 4, 2)).toBeGreaterThan(moveAmount(0, 4, 0, 2));
  });

  it('reihum: würfeln, machen, der Nächste ist dran', () => {
    let s = bewegungDef.init(ctx(3));
    expect(bewegungDef.turn(s)).toBe(0);
    expect(bewegungDef.apply(s, { t: 'done' }, 0, seeded(1))).toBeNull(); // erst würfeln
    expect(bewegungDef.apply(s, { t: 'roll' }, 1, seeded(1))).toBeNull(); // nicht dran
    s = act(s, { t: 'roll' }, 0);
    expect(s.dice).not.toBeNull();
    s = act(s, { t: 'done' }, 0);
    expect(s.done).toEqual([1, 0, 0]);
    expect(s.turn).toBe(1);
  });

  it('wer nicht mehr kann, ist raus; der Letzte gewinnt sofort', () => {
    let s = bewegungDef.init(ctx(3));
    s = act(act(s, { t: 'roll' }, 0), { t: 'done' }, 0);
    s = act(act(s, { t: 'roll' }, 1), { t: 'quit' }, 1);
    expect(s.out).toEqual([false, true, false]);
    expect(s.turn).toBe(2);
    expect(bewegungDef.outcome(s)).toBeNull();
    s = act(act(s, { t: 'roll' }, 2), { t: 'quit' }, 2);
    const o = bewegungDef.outcome(s)!;
    expect(o.places).toEqual([1, 2, 2]);
    // Platz 2 vor Platz 3: wer länger durchhält, liegt vorn
    let t = bewegungDef.init(ctx(3));
    t = act(act(t, { t: 'roll' }, 0), { t: 'done' }, 0);
    t = act(act(t, { t: 'roll' }, 1), { t: 'done' }, 1);
    t = act(act(t, { t: 'roll' }, 2), { t: 'quit' }, 2);
    t = act(act(t, { t: 'roll' }, 0), { t: 'done' }, 0);
    t = act(act(t, { t: 'roll' }, 1), { t: 'quit' }, 1);
    expect(bewegungDef.outcome(t)!.places).toEqual([1, 2, 3]);
  });

  it('halten alle alle Runden durch, gewinnen alle', () => {
    let s = bewegungDef.init(ctx(2, 0));
    for (let r = 0; r < MOVE_ROUNDS[0]; r++)
      for (const p of [0, 1]) s = act(act(s, { t: 'roll' }, p), { t: 'done' }, p);
    expect(bewegungDef.turn(s)).toBeNull();
    expect(bewegungDef.outcome(s)!.places).toEqual([1, 1]);
  });

  it('allein zählen die geschafften Runden als Rekord', () => {
    let s = bewegungDef.init(ctx(1));
    for (let r = 0; r < 3; r++) s = act(act(s, { t: 'roll' }, 0), { t: 'done' }, 0);
    expect(s.turn).toBe(0);
    s = act(act(s, { t: 'roll' }, 0), { t: 'quit' }, 0);
    expect(bewegungDef.outcome(s)!.solo).toEqual({ score: 3 });
  });

  it('Robo gegen Robo endet auf jeder Stufe und übersteht den Weg über die Datenbank (JSON)', () => {
    expect(isOnlineGame('bewegung')).toBe(true);
    const def = defFor('bewegung', [true, true, true, true]) as GameDef<unknown, unknown>;
    for (const level of [0, 1, 2] as const) {
      const rnd = seeded(10 + level);
      let s = def.init(ctx(4, level));
      let k = 0;
      for (; k < 200 && !def.outcome(s); k++) {
        const seat = def.turn(s) as number;
        s = def.apply(JSON.parse(JSON.stringify(s)), def.robo!(s, seat, level, rnd), seat, rnd)!;
        expect(s).not.toBeNull();
      }
      expect(def.outcome(s)).not.toBeNull();
    }
  });
});
