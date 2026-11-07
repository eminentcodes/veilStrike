import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from '@phosphor-icons/react';
import type { TourStop } from './tours';
import './tour.css';

interface Props {
  stops: TourStop[]; kind: 'lobby' | 'combat'; onComplete: () => void;
  values?: Record<string, string>; finalLabel?: string;
}
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high));

export function GuidedTour({ stops, kind, onComplete, values = {}, finalLabel = 'GOT IT' }: Props) {
  const [index, setIndex] = useState(0);
  const [bounds, setBounds] = useState({ left: 16, top: 16, width: 0, height: 0 });
  const [card, setCard] = useState({ left: 16, top: 100 });
  const dialog = useRef<HTMLDialogElement>(null), cardRef = useRef<HTMLElement>(null);
  const heading = useId(), description = useId();
  const stop = stops[index]!;
  const text = (value: string) => value.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? key);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const target = [...document.querySelectorAll<HTMLElement>(stop.target)].find(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
      });
      const rect = target?.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const width = Math.min(360, vw - 32), height = cardRef.current?.offsetHeight ?? 285;
      if (!rect) { setBounds({ left: 16, top: 16, width: 0, height: 0 }); setCard({ left: Math.max(16, (vw - width) / 2), top: Math.max(16, (vh - height) / 2) }); return; }
      setBounds({ left: Math.max(6, rect.left - 7), top: Math.max(6, rect.top - 7), width: Math.min(vw - 12, rect.width + 14), height: Math.min(vh - 12, rect.height + 14) });
      let left = rect.right + 24, top = rect.top + (rect.height - height) / 2;
      if (left + width > vw - 16) left = rect.left - width - 24;
      if (left < 16) { left = (vw - width) / 2; top = rect.bottom + 24; }
      if (vw < 768) { left = (vw - width) / 2; top = rect.top > vh / 2 ? Math.max(90, rect.top - height - 24) : rect.bottom + 24; }
      setCard({ left: clamp(left, 16, vw - width - 16), top: clamp(top, 16, vh - height - 16) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (cardRef.current) observer.observe(cardRef.current);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [stop.target, index]);

  const last = index === stops.length - 1;
  return <dialog ref={dialog} className={'guided-tour ' + kind + '-tour'} aria-labelledby={heading} aria-describedby={description}
    onCancel={event => { event.preventDefault(); onComplete(); }}>
    {bounds.width > 0 ? <div className="tour-spotlight" style={bounds} aria-hidden="true"/> : <div className="tour-dim" aria-hidden="true"/>}
    <section ref={cardRef} className="tour-card" style={card}>
      <header><span>{kind === 'lobby' ? 'YOUR LOBBY' : 'YOUR FIRST DUEL'}</span><button className="tour-close" aria-label="Skip tutorial" onClick={onComplete}><X size={19}/></button></header>
      <div className="tour-message" key={index}><h2 id={heading}>{text(stop.title)}</h2><p id={description}>{text(stop.body)}</p>
        {stop.keys && <div className="tour-keys">{stop.keys.map(key => <kbd key={key}>{key}</kbd>)}</div>}
      </div>
      {kind === 'combat' && <small className="tour-paused">Your Quick Match is paused while you learn.</small>}
      <div className="tour-progress" aria-label={`Tutorial stop ${index + 1} of ${stops.length}`}>
        {stops.map((item, i) => <span key={item.title} className={i <= index ? 'is-read' : ''}/>)}<small>{index + 1} / {stops.length}</small>
      </div>
      <footer><button className="tour-back" disabled={index === 0} onClick={() => setIndex(value => value - 1)}><ArrowLeft size={16}/>BACK</button>
        <button className="entry-primary tour-next" autoFocus onClick={() => last ? onComplete() : setIndex(value => value + 1)}>{last ? finalLabel : 'NEXT'}{last ? <Check size={17}/> : <ArrowRight size={17}/>}</button>
      </footer>
    </section>
  </dialog>;
}
