import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CHAT_MAX, chatProblem, chatText, freeChat, isSticker, QUICK_SENTENCES, STICKER_FROM } from '../lib/chat';
import type { AvatarKind } from '../lib/names';
import { useData, type Profile } from '../lib/store';
import { cls } from '../lib/util';
import { sendChat, useRoom } from '../net/room';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { Joy } from '../ui/Joy';
import { Sheet } from '../ui/parts';

/**
 * Chat im Spielzimmer: oben die Nachrichten als bunte Sprechblasen, darunter Sticker und fertige
 * Sätze zum Antippen (gehen sofort raus) und – wenn die Eltern es erlauben – ein Feld zum
 * Selbstschreiben mit Wortfilter.
 */

/** Ist der Chat gerade als Fenster im Spiel offen? (Dann keine Hinweise für neue Nachrichten) */
let sheets = 0;
export const chatSheetOpen = () => sheets > 0;

export interface ChatLine {
  id: string;
  mine: boolean;
  name: string;
  avatar: AvatarKind;
  color: string;
  text: string;
}

const SENTENCES = QUICK_SENTENCES.map((q, i) => ({ q, i })).filter((x) => x.i < STICKER_FROM);
const STICKERS = QUICK_SENTENCES.map((q, i) => ({ q, i })).filter((x) => x.i >= STICKER_FROM);

/** Die Ansicht ohne Netz – bekommt fertige Zeilen und meldet, was das Kind schicken will. */
export function ChatView({ lines, free, busy, hint, compact, onSend }: { lines: ChatLine[]; free: boolean; busy: boolean; hint: string | null; compact?: boolean; onSend: (text: string, quick?: number) => Promise<boolean> }) {
  const [text, setText] = useState('');
  const log = useRef<HTMLDivElement>(null);
  const lastId = lines[lines.length - 1]?.id;

  // Neue Nachricht → nach unten scrollen
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  const typed = text.trim();
  const live = typed ? chatProblem(typed) : null;
  const problem = hint ?? live;

  return (
    <section className={cls('chat', compact && 'compact')} aria-label="Chat">
      <div className="chat-log" ref={log} role="log" aria-live="polite">
        {lines.length === 0 ? (
          <div className="chat-empty">
            <Joy size={64} mood="cheer" />
            <p className="display">Sag Hallo!</p>
            <p className="small">Tipp unten auf ein Bild oder einen Satz.</p>
          </div>
        ) : (
          lines.map((l, i) => {
            const sticker = isSticker(l.text);
            // Mehrere Nachrichten vom selben Kind hintereinander: Name und Bild nur einmal
            const first = lines[i - 1]?.mine !== l.mine || lines[i - 1]?.name !== l.name;
            return (
              <div key={l.id} className={cls('chat-msg', l.mine && 'mine', !first && 'follow')} style={{ '--who': l.color } as CSSProperties}>
                {!l.mine && <span className="chat-face">{first && <Avatar kind={l.avatar} size={40} bg={l.color} />}</span>}
                <div className="chat-body">
                  {!l.mine && first && <b className="chat-name">{l.name}</b>}
                  {sticker ? <span className="chat-sticker">{l.text}</span> : <span className="chat-bubble">{l.text}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="chat-stickers" role="group" aria-label="Sticker">
        {STICKERS.map(({ q, i }) => (
          <button key={i} type="button" className="chat-sticker-btn" disabled={busy} aria-label={`Sticker ${q}`} onClick={() => void onSend(q, i)}>
            {q}
          </button>
        ))}
      </div>
      <div className="chat-quick" role="group" aria-label="Fertige Sätze">
        {SENTENCES.map(({ q, i }) => (
          <button key={i} type="button" className="chat-chip" disabled={busy} onClick={() => void onSend(q, i)}>
            {q}
          </button>
        ))}
      </div>
      {free ? (
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed && !live) void onSend(typed).then((ok) => ok && setText(''));
          }}
        >
          <input className="input" value={text} maxLength={CHAT_MAX} placeholder="Schreib etwas Nettes …" aria-label="Nachricht schreiben" enterKeyHint="send" autoComplete="off" onChange={(e) => setText(e.target.value)} />
          <button type="submit" className="icon-btn send" aria-label="Senden" disabled={busy || !typed || !!live}>
            <Icon name="send" />
          </button>
        </form>
      ) : (
        <p className="chat-note small">
          <Icon name="lock" size={16} stroke={2.6} />
          Hier gibt es Bilder und fertige Sätze. Das haben deine Eltern so eingestellt.
        </p>
      )}
      {problem && (
        <p className="chat-problem small" role="alert">
          {problem}
        </p>
      )}
    </section>
  );
}

export function ChatPanel({ profile, compact }: { profile: Profile; compact?: boolean }) {
  const room = useRoom();
  const data = useData();
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lines: ChatLine[] = [];
  for (const m of room.chat) {
    const text = chatText(m, room.uid, data.settings);
    if (text !== null) lines.push({ id: m.id, mine: m.by === room.uid, name: m.name, avatar: m.avatar, color: m.color, text });
  }

  const send = async (t: string, quick?: number) => {
    setBusy(true);
    setHint(null);
    const problem = await sendChat(profile, t, quick);
    setBusy(false);
    setHint(problem);
    return !problem;
  };

  return <ChatView lines={lines} free={freeChat(data.settings)} busy={busy} hint={hint} compact={compact} onSend={send} />;
}

/** Chat während der Runde (aus dem Spiel heraus) */
export function ChatSheet({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  useEffect(() => {
    sheets++;
    return () => {
      sheets--;
    };
  }, []);
  return (
    <Sheet title="Chat" onClose={onClose}>
      <ChatPanel profile={profile} compact />
    </Sheet>
  );
}
