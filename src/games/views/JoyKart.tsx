import { useEffect, useRef } from 'react';
import { hum, tone, noise, unlockAudio } from '../../arcade/engine';
import { soundEnabled } from '../../lib/settings';
import type { PlayProps } from '../../engine/game';
import track from '../../../prototypes/joy-kart/dist/Joy-Kart-PC.html?url';

type Input = { steer: number; turbo: boolean };
interface Kart {
  phase: 'countdown' | 'running' | 'finished'; time: number; countdown?: number; s: number; v?: number; boost?: number; grounded?: boolean;
  gateChain?: number; blocked?: number; slow?: number; item?: string | null; roll?: number; sun?: number; lap?: number;
  impact?: { item: string; time: number; blocked: boolean } | null;
  stats?: { lapEnds?: Record<number, number>; lines?: number; itemUses?: Record<string, number>; drafts?: number; startBoost?: number };
}
type Seat = Input | null | { ghost: Kart | null };
type Grid = [Kart | null, Kart | null];
interface Race {
  input(): Input;
  begin(countdown?: number): void;
  restore(states: (Kart | null | undefined)[]): void;
  advance(dt: number, inputs: Seat[]): Grid;
  wire(k: Kart): Kart;
  show(states: Grid, seat: number): void;
  stop(): void;
}
/** Was ein Gerät laufend meldet: die Karts, die es gerade selbst fährt (das eigene, als Gastgeber auch Robos). */
interface Live { n: number; ready?: boolean; go?: number; karts?: Record<string, Kart> }
const isKart = (k: unknown): k is Kart => !!k && Number.isFinite((k as Kart).s) && Number.isFinite((k as Kart).time);
const asLive = (value: unknown): Live | null => (value && typeof value === 'object' && Number.isFinite((value as Live).n) ? (value as Live) : null);
const kartOf = (live: Live | null, seat: number) => (isKart(live?.karts?.[seat]) ? live!.karts![seat] : null);
/** Zielzeit auf vier Stellen: So rechnen beide Geräte mit derselben Zahl. */
const official = (t: number) => Math.round(t * 1e4) / 1e4;

export function JoyKart(props: PlayProps) {
  const course = ((props.level === 1 ? 1 : 0) + props.starter) % 2 === 1 ? 'kap' : 'bucht';
  const againstRobo = props.seats.some(seat => seat.robo);
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    let began = false, ended = false;
    let lastFrame = performance.now(), sentAt = 0, lastReady = -2000, sends = 0, go = 0;
    // Zu zweit: Wer fährt gerade das andere Kart? Und kommt vom anderen Gerät noch etwas an?
    let robo = false, adopted = false, peerN = -1, peerAt = 0, shown: Kart | null = null, sentFinal = false, drove = false;
    let motor: ReturnType<typeof hum> = null;
    let heard: Kart | undefined, heardRival: Kart | null = null;
    function silence() {
      motor?.stop();
      motor = null;
    }
    function raceAudio(k: Kart, rival: Kart | null) {
      if (document.hidden || !soundEnabled() || k.phase !== 'running') {
        silence(); heard = k; heardRival = rival; return;
      }
      motor ??= hum();
      motor?.set(42 + (k.v ?? 0) * 1.6 + (k.boost ? 12 : 0) + (k.sun ? 8 : 0), k.grounded === false ? .009 : .023);
      if (heard) {
        const used = Object.keys(k.stats?.itemUses ?? {}).find(i => (k.stats!.itemUses![i] ?? 0) > (heard!.stats?.itemUses?.[i] ?? 0));
        if (heard.phase === 'countdown') { tone(660, 160, 'triangle'); if (k.stats?.startBoost) tone(880, 260, 'sawtooth', .05, 1760); }
        else if ((k.stats?.lines ?? 0) > (heard.stats?.lines ?? 0)) tone(660, 220, 'triangle', .065, 1320);
        // Jedes Item hat seinen eigenen Klang
        else if (used === 'turbo') tone(300, 260, 'sawtooth', .05, 900);
        else if (used === 'rocket') { noise(260, .07, 2400, 500); tone(520, 240, 'square', .035, 1400); }
        else if (used === 'banana') tone(700, 130, 'sine', .06, 260);
        else if (used === 'shield') tone(520, 220, 'sine', .06, 1040);
        else if (used === 'magnet') tone(240, 240, 'square', .035, 480);
        else if (used === 'wave') noise(380, .08, 300, 1800);
        else if (used === 'gulls') { tone(1500, 110, 'triangle', .05, 1100); window.setTimeout(() => tone(1650, 130, 'triangle', .045, 1150), 130); }
        else if (used === 'gust') noise(420, .07, 1600, 400);
        else if (used === 'crab') { tone(900, 60, 'square', .04); window.setTimeout(() => tone(900, 60, 'square', .04), 110); }
        else if (used === 'spring') tone(260, 230, 'sine', .07, 1040);
        else if (used === 'ice') tone(2100, 300, 'sine', .04, 1300);
        else if (used === 'sun') { tone(523, 120, 'triangle', .06); window.setTimeout(() => tone(659, 120, 'triangle', .06), 110); window.setTimeout(() => tone(784, 220, 'triangle', .06), 220); }
        else if ((k.stats?.drafts ?? 0) > (heard.stats?.drafts ?? 0)) tone(400, 200, 'sawtooth', .04, 800);
        else if ((k.gateChain ?? 0) > (heard.gateChain ?? 0)) tone(k.gateChain === 1 ? 440 : 554, 115, 'sine', .07);
        else if (k.impact && k.impact.time !== heard.impact?.time) {
          if (k.impact.blocked) tone(940, 145, 'sine', .055, 520);
          else { noise(170, .09, 900, 200); navigator.vibrate?.(k.impact.item === 'gulls' ? 40 : 120); }
        }
        else if (rival?.impact && heardRival && rival.impact.time !== heardRival.impact?.time && !rival.impact.blocked) tone(784, 130, 'triangle', .05, 1175);
        else if ((heard.roll ?? 0) > 0 && !(k.roll ?? 0) && k.item) tone(880, 90, 'triangle', .05, 1320);
        else if ((k.roll ?? 0) > 0 && Math.floor((k.roll ?? 0) * 9) !== Math.floor((heard.roll ?? 0) * 9)) tone(500 + Math.random() * 500, 35, 'square', .02);
        else if ((k.lap ?? 1) > (heard.lap ?? 1)) tone(587, 150, 'triangle', .06, k.lap === 3 ? 1175 : 880);
        else if (heard.grounded === false && k.grounded) noise(80, .055, 640, 190);
      }
      heard = k; heardRival = rival;
    }
    const visibility = () => { if (document.hidden) silence(); };
    document.addEventListener('visibilitychange', visibility);
    let resultTimer: number | undefined;
    function finish(grid: Grid, api: Race) {
      if (ended || grid.some(k => k?.phase !== 'finished')) return;
      ended = true;
      silence();
      const karts = grid as [Kart, Kart];
      const times = karts.map(k => official(k.time));
      const kart = karts.map(k => {
        const ends = k.stats?.lapEnds ?? {};
        const laps = [1, 2, 3].map(n => ends[n] - (n === 1 ? 0 : ends[n - 1])).filter(t => Number.isFinite(t) && t > 0);
        return { bestLap: laps.length ? Math.min(...laps) : undefined, lines: k.stats?.lines ?? 0 };
      });
      resultTimer = window.setTimeout(() => {
        api.stop();
        latest.current.onEnd({ scores: times, kart, kartRoboCourse: againstRobo && !latest.current.net ? course : undefined, places: times.map(t => t > Math.min(...times) + .0001 ? 2 : 1) });
      }, 1200);
    }
    /** Mehrere Schritte nachholen, wenn die App kurz im Hintergrund war: Die Rennuhr läuft für beide Geräte weiter. */
    function advance(api: Race, seconds: number, inputs: Seat[], me: number): Grid {
      let grid = api.advance(Math.min(.25, seconds), inputs);
      const idle = inputs.map((seat, i) => (i === me ? { steer: 0, turbo: false } : seat));
      for (let rest = Math.min(300, seconds) - .25; rest > 0; rest -= .25) grid = api.advance(Math.min(.25, rest), idle);
      return grid;
    }
    const interval = window.setInterval(() => {
      const api = (frame.current?.contentWindow as (Window & { joyKartRace?: Race }) | null)?.joyKartRace;
      if (!api || ended) return;
      const { net, seats } = latest.current;
      const now = performance.now(), elapsed = (now - lastFrame) / 1000;
      lastFrame = now;
      const me = net?.me ?? 0, other = 1 - me, local = api.input();
      const link = net?.live;
      if (!net || !link) {
        // Ein Gerät: gegen Robo. Im Hintergrund pausiert das Rennen.
        if (!began) { api.begin(); began = true; }
        const grid = api.advance(Math.min(.25, elapsed), me === 0 ? [local, null] : [null, local]);
        api.show(grid, me);
        if (grid[me]) raceAudio(grid[me]!, grid[other]);
        finish(grid, api);
        return;
      }
      const peer = asLive(link.peer(other));
      if (peer && peer.n !== peerN) { peerN = peer.n; peerAt = now; }
      const peerAlive = !!peer && now - peerAt < 4000;
      const otherRobo = !!seats[other]?.robo;
      const peerKart = kartOf(peer, other);
      // Das andere Gerät ist für mich eingesprungen (ich war kurz weg): dessen Stand ist jetzt meiner.
      const driven = kartOf(peer, me);
      if (!began) {
        const before = asLive(link.mine()), saved = kartOf(before, me);
        if (driven || saved) {
          const mine = (driven ?? saved)!;
          // War dieses Gerät Gastgeber und fuhr auch das andere Kart, geht das ebenfalls weiter.
          const ridden = net.host ? kartOf(before, other) : null;
          api.restore(me === 0 ? [mine, ridden] : [ridden, mine]);
          adopted = !!driven;
          robo = !!ridden && !otherRobo;
          shown = ridden;
          // Nach dem Neuladen bis zur Rennuhr des anderen Karts aufholen
          const behind = !driven && mine.phase === 'running' && peerKart?.phase === 'running' ? peerKart.time - mine.time : 0;
          if (behind > .3) advance(api, behind, me === 0 ? [{ steer: 0, turbo: false }, { ghost: peerKart }] : [{ ghost: peerKart }, { steer: 0, turbo: false }], me);
        } else if (net.host) {
          // Erst starten, wenn auch das andere Gerät die Strecke geladen hat
          if (!otherRobo && !net.absent.includes(other) && !peer?.ready && !peerKart) {
            if (now - lastReady > 1500) { link.send({ n: ++sends, ready: true }); lastReady = now; }
            return;
          }
          api.begin();
          go = link.now() + 3000;
        } else {
          if (!peerKart) {
            if (now - lastReady > 1500) { link.send({ n: ++sends, ready: true }); lastReady = now; }
            return;
          }
          // Gleicher Startschuss: der Gastgeber nennt die Serverzeit, zu der es losgeht
          const fromHost = peerKart.phase === 'countdown' ? peerKart.countdown ?? 3 : 0;
          const fromClock = peer?.go ? (peer.go - link.now()) / 1000 : fromHost;
          if (peerKart.phase === 'finished') api.begin(.05);
          else api.begin(Math.abs(fromClock - fromHost) < .8 ? Math.max(.05, fromClock) : Math.max(.05, fromHost));
        }
        began = true;
        lastFrame = now;
        return;
      }
      if (driven && !adopted) { api.restore(me === 0 ? [driven, null] : [null, driven]); adopted = true; }
      else if (!driven) adopted = false;
      // Gastgeber: Robo fährt für einen Robo-Platz oder für ein Gerät, von dem nichts mehr kommt.
      const away = net.host && !otherRobo && net.absent.includes(other) && !peerAlive;
      // Ein Kind hat mitten im Rennen Robos Platz übernommen: weiterfahren, bis sein Gerät meldet.
      if (net.host && !otherRobo && drove && !robo && !(peerAlive && peerKart)) robo = true;
      if (net.host && !otherRobo) {
        // Robo übernimmt dort, wo das Kart zuletzt zu sehen war (oder an der Startlinie).
        if (!robo && away) { if (shown) api.restore(other === 0 ? [shown, null] : [null, shown]); robo = true; }
        // Zurückgeben, sobald das andere Gerät wieder meldet und mit seiner Rennuhr aufgeschlossen hat
        else if (robo && peerAlive && peerKart && shown && (peerKart.phase !== 'running' || Math.abs(peerKart.time - shown.time) < 3)) robo = false;
      } else robo = false;
      const drivesOther = net.host && (otherRobo || robo);
      drove = drivesOther;
      const rival: Seat = drivesOther ? null : { ghost: peerKart };
      const grid = advance(api, elapsed, me === 0 ? [local, rival] : [rival, local], me);
      if (grid[other]) shown = grid[other];
      api.show(grid, me);
      const mine = grid[me];
      if (mine) raceAudio(mine, grid[other]);
      const over = mine?.phase === 'finished';
      // Etwa zehnmal pro Sekunde melden; im Ziel sofort und danach nur noch zur Sicherheit.
      if (mine && (over ? !sentFinal || now - sentAt >= 1000 : now - sentAt >= 100)) {
        const karts: Record<string, Kart> = { [me]: api.wire(mine) };
        if (drivesOther && grid[other]) karts[other] = api.wire(grid[other]!);
        link.send({ n: ++sends, go, karts });
        sentAt = now;
        if (over) sentFinal = true;
      }
      // Ist das andere Kind nach dem Zieleinlauf schon gegangen, zählt sein letzter Stand.
      finish(grid[other] || shown?.phase !== 'finished' ? grid : (me === 0 ? [grid[0], shown] : [shown, grid[1]]), api);
    }, 16);
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
