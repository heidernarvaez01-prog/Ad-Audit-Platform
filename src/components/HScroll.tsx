import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Horizontal scroll container with a FLOATING scrollbar that always sits at the
 * bottom edge of the table's *visible* area — pinned to the screen, synced both
 * ways. So you can scroll left/right at any vertical scroll position without
 * hunting for the bar at the very bottom of the content.
 */
export default function HScroll({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [bar, setBar] = useState({ visible: false, left: 0, width: 0, top: 0, scrollW: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const BAR_H = 14;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const hasOverflow = el.scrollWidth > el.clientWidth + 1;
      const vh = window.innerHeight;
      const inView = rect.top < vh && rect.bottom > 0;
      // Bottom of the table that's currently on screen
      const visibleBottom = Math.min(vh, rect.bottom);
      const top = visibleBottom - BAR_H;
      // Only show while the bar would land within the table's own area
      const visible = hasOverflow && inView && top > rect.top + 20;
      setBar({ visible, left: Math.round(rect.left), width: Math.round(el.clientWidth), top: Math.round(top), scrollW: Math.round(el.scrollWidth) });
      if (barRef.current && !syncing.current) {
        syncing.current = true;
        barRef.current.scrollLeft = el.scrollLeft;
        syncing.current = false;
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true, attributes: true });
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect(); mo.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, []);

  const onContentScroll = () => {
    if (syncing.current || !barRef.current || !ref.current) return;
    syncing.current = true;
    barRef.current.scrollLeft = ref.current.scrollLeft;
    syncing.current = false;
  };
  const onBarScroll = () => {
    if (syncing.current || !barRef.current || !ref.current) return;
    syncing.current = true;
    ref.current.scrollLeft = barRef.current.scrollLeft;
    syncing.current = false;
  };

  return (
    <>
      <div ref={ref} onScroll={onContentScroll} className={`overflow-x-auto no-scrollbar ${className ?? ''}`}>
        {children}
      </div>
      {bar.visible && createPortal(
        <div
          ref={barRef}
          onScroll={onBarScroll}
          style={{ position: 'fixed', top: bar.top, left: bar.left, width: bar.width, zIndex: 45 }}
          className="overflow-x-auto scrollbar-visible bg-background/90 backdrop-blur-sm border-t border-border rounded-b-md"
          aria-hidden="true"
        >
          <div style={{ width: bar.scrollW, height: 1 }} />
        </div>,
        document.body,
      )}
    </>
  );
}
