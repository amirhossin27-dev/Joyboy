import { pathPoints, resample, type Pt } from './path';

/**
 * Strich-Daten zum Nachspuren. Jedes Zeichen steht in einem Feld von 100 × 100 (y nach unten)
 * und besteht aus Strichen in Schreibreihenfolge. Jeder Strich ist ein SVG-Pfad mit absoluten
 * Befehlen. Ziffern nach der Druckschrift der Grundschule: oben anfangen, Bögen gegen den
 * Uhrzeigersinn, wo es die Schule so lehrt.
 */

export interface Glyph {
  /** Striche in Schreibreihenfolge (SVG-Pfade) */
  d: string[];
}

export const DIGITS: Record<string, Glyph> = {
  '0': { d: ['M 50 8 C 36.7 8 26 26.8 26 50 C 26 73.2 36.7 92 50 92 C 63.3 92 74 73.2 74 50 C 74 26.8 63.3 8 50 8'] },
  '1': { d: ['M 32 30 L 58 8 L 58 92'] },
  '2': { d: ['M 28 28 C 28 15 38 8 50 8 C 63 8 72 16 72 28 C 72 42 60 54 28 92 L 74 92'] },
  '3': { d: ['M 29 19 C 35 11 43 8 51 8 C 63 8 71 15 71 27 C 71 39 61 47 47 47 C 63 47 74 56 74 69 C 74 83 63 92 50 92 C 41 92 33 88 27 81'] },
  '4': { d: ['M 52 8 L 24 64 L 78 64', 'M 64 38 L 64 92'] },
  '5': { d: ['M 34 8 L 31 45 C 37 41 43 39 50 39 C 64 39 74 49 74 65 C 74 81 63 92 49 92 C 40 92 33 88 27 81', 'M 34 8 L 71 8'] },
  '6': { d: ['M 69 13 C 63 9 57 8 51 8 C 36 8 27 26 27 56 C 27 78 37 92 51 92 C 64 92 73 82 73 70 C 73 57 64 48 51 48 C 40 48 31 55 28 65'] },
  '7': { d: ['M 28 8 L 72 8 L 40 92'] },
  '8': { d: ['M 66 20 C 64 12 58 8 50 8 C 40 8 33 14 33 26 C 33 38 44 44 50 48 C 58 53 70 58 70 72 C 70 85 61 92 50 92 C 39 92 30 85 30 72 C 30 58 42 53 50 48 C 57 43 67 35 66 20'] },
  '9': { d: ['M 72 27 C 72 15 63 8 51 8 C 39 8 30 16 30 28 C 30 40 39 47 51 47 C 63 47 72 40 72 27 L 72 92'] },
};

/** Großbuchstaben in Druckschrift, jeweils in Schreibreihenfolge. */
const LETTERS: Record<string, Glyph> = {
  A: { d: ['M 24 92 L 50 8 L 76 92', 'M 35 59 L 65 59'] },
  B: { d: ['M 28 8 L 28 92', 'M 28 8 L 50 8 C 77 8 77 49 50 49 L 28 49', 'M 50 49 C 82 49 82 92 50 92 L 28 92'] },
  C: { d: ['M 73 20 C 65 9 56 8 50 8 C 32 8 23 26 23 50 C 23 74 32 92 50 92 C 60 92 68 88 74 79'] },
  D: { d: ['M 28 8 L 28 92', 'M 28 8 L 45 8 C 68 8 77 27 77 50 C 77 73 68 92 45 92 L 28 92'] },
  E: { d: ['M 29 8 L 29 92 L 74 92', 'M 29 8 L 74 8', 'M 29 49 L 65 49'] },
  F: { d: ['M 29 8 L 29 92', 'M 29 8 L 74 8', 'M 29 49 L 65 49'] },
  G: { d: ['M 74 20 C 67 11 58 8 50 8 C 32 8 23 26 23 50 C 23 74 32 92 51 92 C 68 92 76 79 76 61 L 76 53 L 53 53'] },
  H: { d: ['M 25 8 L 25 92', 'M 75 8 L 75 92', 'M 25 50 L 75 50'] },
  I: { d: ['M 50 8 L 50 92', 'M 34 8 L 66 8', 'M 34 92 L 66 92'] },
  J: { d: ['M 68 8 L 68 69 C 68 84 60 92 47 92 C 35 92 27 84 27 73'] },
  K: { d: ['M 26 8 L 26 92', 'M 74 8 L 26 55', 'M 45 36 L 76 92'] },
  L: { d: ['M 29 8 L 29 92 L 74 92'] },
  M: { d: ['M 23 92 L 23 8 L 50 57 L 77 8 L 77 92'] },
  N: { d: ['M 25 92 L 25 8 L 75 92 L 75 8'] },
  O: { d: [DIGITS['0'].d[0]] },
  P: { d: ['M 28 8 L 28 92', 'M 28 8 L 52 8 C 81 8 81 52 52 52 L 28 52'] },
  Q: { d: [DIGITS['0'].d[0], 'M 54 69 L 77 94'] },
  R: { d: ['M 28 8 L 28 92', 'M 28 8 L 52 8 C 81 8 81 52 52 52 L 28 52', 'M 48 52 L 75 92'] },
  S: { d: ['M 71 19 C 63 7 46 4 35 14 C 21 27 28 42 49 49 C 72 57 80 72 67 85 C 57 96 37 94 27 81'] },
  T: { d: ['M 23 8 L 77 8', 'M 50 8 L 50 92'] },
  U: { d: ['M 25 8 L 25 64 C 25 82 34 92 50 92 C 66 92 75 82 75 64 L 75 8'] },
  V: { d: ['M 23 8 L 50 92 L 77 8'] },
  W: { d: ['M 20 8 L 34 92 L 50 38 L 66 92 L 80 8'] },
  X: { d: ['M 24 8 L 76 92', 'M 76 8 L 24 92'] },
  Y: { d: ['M 23 8 L 50 49 L 77 8', 'M 50 49 L 50 92'] },
  Z: { d: ['M 24 8 L 76 8 L 24 92 L 76 92'] },
  Ä: { d: ['M 24 92 L 50 24 L 76 92', 'M 35 63 L 65 63', 'M 37 6 L 37 14', 'M 63 6 L 63 14'] },
  Ö: { d: ['M 50 24 C 35 24 25 37 25 58 C 25 79 35 92 50 92 C 65 92 75 79 75 58 C 75 37 65 24 50 24', 'M 37 6 L 37 14', 'M 63 6 L 63 14'] },
  Ü: { d: ['M 25 24 L 25 65 C 25 82 34 92 50 92 C 66 92 75 82 75 65 L 75 24', 'M 37 6 L 37 14', 'M 63 6 L 63 14'] },
};

/** Abstand der Ziffern bei mehrstelligen Zahlen (Feld-Einheiten) */
export const DIGIT_ADVANCE = 64;

/** Dichte der Soll-Linien: ein Punkt etwa alle 1,5 Feld-Einheiten */
const DENSITY = 1.5;

export interface Layout {
  /** Was geschrieben wird (Zahl, Buchstabe oder Wort) */
  text: string;
  /** Breite der Zeichenfläche in Feld-Einheiten (Höhe immer 100) */
  w: number;
  /** Alle Striche in Schreibreihenfolge, schon an ihre Stelle geschoben, dicht abgetastet */
  strokes: Pt[][];
  /** Zu welchem Zeichen (Kästchen) gehört der Strich? */
  cellOf: number[];
  /** Linke Kante jedes Kästchens */
  cells: { x: number; w: number }[];
  /** Die SVG-Pfade, verschoben – zum Zeichnen der Vorlage */
  paths: { d: string; dx: number }[];
}

const cache = new Map<string, Pt[]>();
function sampled(d: string): Pt[] {
  let pts = cache.get(d);
  if (!pts) {
    const raw = pathPoints(d);
    let l = 0;
    for (let i = 1; i < raw.length; i++) l += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]);
    pts = resample(raw, Math.max(12, Math.round(l / DENSITY)));
    cache.set(d, pts);
  }
  return pts;
}

function glyphLayout(text: string, glyphs: Record<string, Glyph>, advance: number): Layout {
  const strokes: Pt[][] = [];
  const cellOf: number[] = [];
  const cells: { x: number; w: number }[] = [];
  const paths: { d: string; dx: number }[] = [];
  [...text].forEach((ch, i) => {
    const dx = i * advance;
    cells.push({ x: dx + 22, w: 56 });
    for (const d of glyphs[ch].d) {
      strokes.push(sampled(d).map(([x, y]) => [x + dx, y] as Pt));
      cellOf.push(i);
      paths.push({ d, dx });
    }
  });
  return { text, w: 100 + (text.length - 1) * advance, strokes, cellOf, cells, paths };
}

/** Eine Zahl wie „17“ als Zeichenfläche mit Kästchen je Ziffer. */
export function digitLayout(text: string): Layout {
  return glyphLayout(text, DIGITS, DIGIT_ADVANCE);
}

/** Buchstaben stehen nebeneinander und werden von links nach rechts geschrieben. */
export function letterLayout(text: string): Layout {
  return glyphLayout(text, LETTERS, 72);
}
