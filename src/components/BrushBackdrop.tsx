import { useEffect, useRef, useState } from 'react';
import '../styles/brush-flow.css';

type BrushSource = 'book-month' | 'read' | 'discussion' | 'journal' | 'authors' | 'sections' | 'calendar' | 'editorial';

/** Two contrasting pigment accents, composed around each section's content. */
export default function BrushBackdrop({ source, rightOnly = false }: { source: BrushSource; rightOnly?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!('IntersectionObserver' in window)) { setActive(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setActive(true); observer.disconnect(); }
    }, { rootMargin: '480px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const base = `${import.meta.env.BASE_URL}brand/ui-polish-v4/`;
  const secondaryColor = ['discussion', 'authors', 'calendar'].includes(source) ? 'violet' : 'white';
  return (
    <span ref={ref} className="brush-backdrop" data-brush-source={source} data-brush-right-only={rightOnly || undefined} aria-hidden="true">
      {active && <>
        <img className={`brush-backdrop__accent brush-backdrop__accent--secondary brush-backdrop__accent--${secondaryColor}`} src={`${base}orange-stroke.webp`} alt="" decoding="async" />
        <img className="brush-backdrop__accent brush-backdrop__accent--orange" src={`${base}orange-stroke.webp`} alt="" decoding="async" />
      </>}
    </span>
  );
}
