import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Wraps wide content in a horizontal scroller and adds a synced scrollbar
 * that sticks to the bottom of the scrolling viewport — so you can scroll
 * horizontally without first scrolling to the very end of a tall table.
 */
export default function StickyXScroll({ children, className }: { children: ReactNode; className?: string }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [scrollW, setScrollW] = useState(0);
  const [clientW, setClientW] = useState(0);
  const syncing = useRef(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => { setScrollW(el.scrollWidth); setClientW(el.clientWidth); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: true, attributes: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, []);

  const needsBar = scrollW > clientW + 1;

  const onContentScroll = () => {
    if (syncing.current || !barRef.current || !contentRef.current) return;
    syncing.current = true;
    barRef.current.scrollLeft = contentRef.current.scrollLeft;
    syncing.current = false;
  };
  const onBarScroll = () => {
    if (syncing.current || !barRef.current || !contentRef.current) return;
    syncing.current = true;
    contentRef.current.scrollLeft = barRef.current.scrollLeft;
    syncing.current = false;
  };

  return (
    <div className={className}>
      <div ref={contentRef} onScroll={onContentScroll} className="overflow-x-auto no-scrollbar">
        {children}
      </div>
      {needsBar && (
        <div
          ref={barRef}
          onScroll={onBarScroll}
          className="sticky bottom-0 z-20 overflow-x-auto scrollbar-visible
            bg-background/80 backdrop-blur-sm border-t border-border rounded-b-lg"
          aria-hidden="true"
        >
          <div style={{ width: scrollW, height: 1 }} />
        </div>
      )}
    </div>
  );
}
