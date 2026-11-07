import {useEffect,useState} from 'react';
import {BookOpen,Sword,Trophy,Ranking} from '@phosphor-icons/react';
import './coming-soon.css';

const previews=[
  {title:'STORY MODE',line:'A journey beyond the arena.',chapter:'THE FRACTURED VEIL',image:'previews/story.webp',Icon:BookOpen},
  {title:'MORE FIGHTERS',line:'New faces. New ways to fight.',chapter:'THE NEXT WAVE',image:'previews/fighters.webp',Icon:Sword},
  {title:'ACHIEVEMENTS',line:'Every great feat leaves a mark.',chapter:'PROVE YOUR LEGEND',image:'previews/achievements.webp',Icon:Trophy},
  {title:'LEADERBOARDS',line:'Rise among the oathbound.',chapter:'CLAIM YOUR PLACE',image:'previews/leaderboards.webp',Icon:Ranking},
] as const;

export function ComingSoon({active=true}:{active?:boolean}){
  const [index,setIndex]=useState(0),[hover,setHover]=useState(false);
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  useEffect(()=>{if(!active||hover||reduced)return;const timer=window.setInterval(()=>setIndex(i=>(i+1)%previews.length),10000);return()=>clearInterval(timer);},[active,hover,reduced]);
  return <section className="lobby-coming" tabIndex={0} aria-label="Coming soon previews" aria-roledescription="carousel" onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onFocusCapture={()=>setHover(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setHover(false);}}>
    <div className="coming-slides" aria-live={hover?'polite':'off'}>
      {previews.map((preview,i)=><article key={preview.title} className={'coming-slide '+(i===index?'is-current':'')} aria-hidden={i!==index} aria-label={`${i+1} of ${previews.length}: ${preview.title}`}>
        <img src={import.meta.env.BASE_URL+'images/'+preview.image} alt=""/><div className="coming-art-shade"/>
        <span className="coming-stamp">COMING SOON</span><preview.Icon className="coming-emblem" size={46} weight="duotone"/>
        <div className="coming-copy"><small>{preview.chapter}</small><h2>{preview.title}</h2><p>{preview.line}</p></div>
      </article>)}
    </div>
  </section>;
}
