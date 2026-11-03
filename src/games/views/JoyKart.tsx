import { useEffect, useRef } from 'react';
import { hum, tone, noise, unlockAudio } from '../../arcade/engine';
import { soundEnabled } from '../../lib/settings';
import type { PlayProps } from '../../engine/game';
import track from '../../../prototypes/joy-kart/dist/Joy-Kart-PC.html?url';

type Input = { steer: number; turbo: boolean };
interface Kart { phase: 'countdown' | 'running' | 'finished'; time: number; s: number; v?: number; boost?: number; grounded?: boolean; gateChain?: number; blocked?: number; slow?: number; stats?: { lapEnds?: Record<number, number>; lines?: number } }
type Grid = [Kart, Kart];
interface Race {
  input(): Input;
  begin(): void;
  restore(states: Grid): void;
  advance(dt: number, inputs: (Input | null)[]): Grid;
  show(states: Grid, seat: number): void;
  stop(): void;
}
function raceState(value: unknown): Grid | null {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(k => k && Number.isFinite(k.s) && Number.isFinite(k.time))) return null;
  return value as Grid;
}

export function JoyKart(props: PlayProps) {
  const course = ((props.level === 1 ? 1 : 0) + props.starter) % 2 === 1 ? 'kap' : 'bucht';
  const againstRobo = props.seats.some(seat => seat.robo);
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    let began = false, ended = false, guestReady = false;
    let sequence = -1, lastFrame = performance.now(), sentAt = 0, lastReady = -2000;
    let lastSteer = 0, remoteSteer = 0, remoteBoost = false;
    const ack: Record<string, number> = {};
    let motor: ReturnType<typeof hum> = null;
    let heard: Kart | undefined;
    function silence() {
      motor?.stop();
      motor = null;
    }
    function raceAudio(k: Kart) {
      if (document.hidden || !soundEnabled() || k.phase !== 'running') {
        silence(); heard = k; return;
      }
      motor ??= hum();
      motor?.set(42 + (k.v ?? 0) * 1.6 + (k.boost ? 12 : 0), k.grounded === false ? .009 : .023);
      if (heard) {
        if (heard.phase === 'countdown') tone(660, 160, 'triangle');
        else if ((k.stats?.lines ?? 0) > (heard.stats?.lines ?? 0)) tone(660, 220, 'triangle', .065, 1320);
        else if ((k.gateChain ?? 0) > (heard.gateChain ?? 0)) tone(k.gateChain === 1 ? 440 : 554, 115, 'sine', .07);
        else if ((k.blocked ?? 0) > (heard.blocked ?? 0)) tone(940, 145, 'sine', .055, 520);
        else if ((k.slow ?? 0) > (heard.slow ?? 0)) noise(150, .08, 900, 220);
        else if (heard.grounded === false && k.grounded) noise(80, .055, 640, 190);
      }
      heard = k;
    }
    const visibility = () => { if (document.hidden) silence(); };
    document.addEventListener('visibilitychange', visibility);
    let resultTimer: number | undefined;
    function finish(grid: Grid, api: Race) {
      if (ended || grid.some(k => k.phase !== 'finished')) return;
      ended = true;
      silence();
      const times = grid.map(k => k.time);
      const kart = grid.map(k => {
        const ends = k.stats?.lapEnds ?? {};
        const laps = [1, 2, 3].map(n => ends[n] - (n === 1 ? 0 : ends[n - 1])).filter(t => Number.isFinite(t) && t > 0);
        return { bestLap: laps.length ? Math.min(...laps) : undefined, lines: k.stats?.lines ?? 0 };
      });
      resultTimer = window.setTimeout(() => {
        api.stop();
        latest.current.onEnd({ scores: times, kart, kartRoboCourse: againstRobo && !latest.current.net ? course : undefined, places: times.map(t => t > Math.min(...times) + .0001 ? 2 : 1) });
      }, 1200);
    }
    const interval = window.setInterval(() => {
      const api = (frame.current?.contentWindow as (Window & { joyKartRace?: Race }) | null)?.joyKartRace;
      if (!api || ended) return;
      const { net, seats } = latest.current;
      const now = performance.now(), dt = Math.min(.25, (now - lastFrame) / 1000);
      lastFrame = now;
      const me = net?.me ?? 0, other = 1 - me, local = api.input();
      if (net && !net.host) {
        const grid = raceState(net.shared.st);
        if (!grid && now - lastReady > 1500) { net.push({ ready: true }); lastReady = now; }
        if (grid && net.shared.seq > sequence) {
          sequence = net.shared.seq;
          api.show(grid, me);
          raceAudio(grid[me]);
          finish(grid, api);
        }
        const steer = Math.round(local.steer * 10) / 10;
        if (grid && (local.turbo || (steer !== lastSteer && now - sentAt >= 90))) {
          net.push({ steer, turbo: local.turbo }); lastSteer = steer; sentAt = now;
        }
        return;
      }
      if (!began && net) Object.assign(ack, net.shared.ack);
      for (const act of net?.acts ?? []) {
        if (act.seat !== other || act.n <= (ack[other] ?? 0)) continue;
        ack[other] = act.n;
        const a = act.a as Partial<Input> & { ready?: boolean } | null;
        if (a?.ready) guestReady = true;
        if (typeof a?.steer === 'number' && Number.isFinite(a.steer)) remoteSteer = Math.max(-1, Math.min(1, a.steer));
        if (a?.turbo === true) remoteBoost = true;
      }
      const computer = seats[other]?.robo || net?.absent.includes(other);
      if (!began) {
        const saved = raceState(net?.shared.st);
        if (net && !saved && !computer && !guestReady) return;
        if (saved) api.restore(saved); else api.begin();
        began = true; sequence = net?.shared.seq ?? 0;
      }
      const inputs = [0, 1].map(i => i === me ? local : computer ? null : { steer: remoteSteer, turbo: remoteBoost });
      const grid = api.advance(dt, inputs);
      remoteBoost = false;
      api.show(grid, me);
      raceAudio(grid[me]);
      if (net && (now - sentAt >= 150 || grid.every(k => k.phase === 'finished'))) {
        net.publish(++sequence, grid, { ...ack }); sentAt = now;
      }
      finish(grid, api);
    }, 32);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(resultTimer);
      document.removeEventListener('visibilitychange', visibility);
      silence();
    };
  }, []);
  return <iframe ref={frame} title="Joy-Kart · Sonnenküste" src={track + (againstRobo ? '#joyboy-robo-' : '#joyboy-') + course} onLoad={() => {
      frame.current?.focus();
      const doc = frame.current?.contentDocument;
      doc?.addEventListener('pointerdown', unlockAudio, { passive: true });
      doc?.addEventListener('keydown', unlockAudio);
    }}
    style={{ display: 'block', border: 0, width: '100%', height: '100%', minHeight: 180, background: '#102637' }} />;
}
