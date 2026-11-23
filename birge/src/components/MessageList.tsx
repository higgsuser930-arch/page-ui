import { useEffect, useRef, type ReactNode } from 'react';

/** Scroll container that sticks to the bottom when new messages arrive (unless the user scrolled up). */
export function MessageList({ children, count, className = '' }: { children: ReactNode; count: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [count]);
  return (
    <div
      ref={ref}
      className={`msg-list ${className}`}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
    >
      {children}
    </div>
  );
}

export function timeOf(ts?: { toDate(): Date }) {
  if (!ts) return '';
  const d = ts.toDate();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
