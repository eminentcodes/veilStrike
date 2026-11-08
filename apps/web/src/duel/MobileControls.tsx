import { memo, useEffect, useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { HandFist, Lightning, PersonSimpleRun, Sparkle, Sword, Wind } from '@phosphor-icons/react';
import './mobile-controls.css';

interface Props {
  enabled: boolean;
  move: (right: number, forward: number) => void;
  inject: (code: string, down: boolean) => void;
  special: { name: string; cooldown: number; duration: number; lowStamina: boolean };
  ultimate: { name: string; charge: number };
}

export function MobileControls({ enabled, move, inject, special, ultimate }: Props) {
  const specialReady = special.cooldown <= 0 && !special.lowStamina;
  return <div className="duel-touch" aria-label="Touch controls">
    <MovementJoystick enabled={enabled} move={move}/>
    <div className="duel-touch-actions" role="group" aria-label="Combat action buttons">
      <div className="duel-touch-abilities" role="group" aria-label="Fighter abilities">
        <TouchAction code="KeyI" label="ULTIMATE" name={'Ultimate: ' + ultimate.name} className="touch-ultimate" icon={<Lightning weight="fill"/>}
          disabled={!enabled || ultimate.charge < 1} inject={inject} progress={ultimate.charge} status={ultimate.charge >= 1 ? 'READY' : Math.round(ultimate.charge * 100) + '%'}/>
        <TouchAction code="KeyU" label="SPECIAL" name={'Signature: ' + special.name} className="touch-special" icon={<Sparkle weight="fill"/>}
          disabled={!enabled || !specialReady} inject={inject} progress={1 - special.cooldown / special.duration}
          status={special.cooldown > 0 ? special.cooldown.toFixed(1) + 's' : special.lowStamina ? 'LOW' : 'READY'}/>
      </div>
      <TouchAction code="KeyE" label="GRAB" className="touch-grab" icon={<HandFist/>} disabled={!enabled} inject={inject}/>
      <TouchAction code="KeyJ" label="ATTACK" className="touch-attack" icon={<Sword/>} disabled={!enabled} inject={inject}/>
      <TouchAction code="ShiftLeft" label="SPRINT" className="touch-sprint" icon={<PersonSimpleRun/>} disabled={!enabled} inject={inject}/>
      <TouchAction code="Space" label="DODGE" className="touch-dodge" icon={<Wind/>} disabled={!enabled} inject={inject}/>
      <small className="touch-attack-hint">Double tap Attack for heavy</small>
    </div>
  </div>;
}

const MovementJoystick = memo(function MovementJoystick({ enabled, move }: Pick<Props, 'enabled' | 'move'>) {
  const base = useRef<HTMLDivElement>(null), thumb = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = base.current, handle = thumb.current;
    if (!element || !handle) return;
    let pointer: number | null = null, centerX = 0, centerY = 0, reach = 1;
    const release = () => {
      const previous = pointer; pointer = null;
      move(0, 0);
      element.dataset.moving = 'false';
      handle.style.transform = 'translate3d(0, 0, 0)';
      if (previous !== null && element.hasPointerCapture(previous)) element.releasePointerCapture(previous);
    };
    const update = (event: PointerEvent) => {
      const dx = event.clientX - centerX, dy = event.clientY - centerY;
      const distance = Math.hypot(dx, dy), scale = distance > reach ? reach / distance : 1;
      handle.style.transform = `translate3d(${dx * scale}px, ${dy * scale}px, 0)`;
      // Keep a quiet center, then scale continuously from walking to full speed.
      const magnitude = Math.min(1, distance / reach), deadZone = .12;
      const strength = Math.max(0, (magnitude - deadZone) / (1 - deadZone));
      move(distance ? dx / distance * strength : 0, distance ? -dy / distance * strength : 0);
    };
    const down = (event: PointerEvent) => {
      if (!enabled || pointer !== null || event.button !== 0) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      centerX = rect.left + rect.width / 2; centerY = rect.top + rect.height / 2;
      reach = Math.max(1, (rect.width - handle.offsetWidth) / 2 - 4);
      pointer = event.pointerId;
      element.setPointerCapture(pointer);
      element.dataset.moving = 'true';
      update(event);
    };
    const drag = (event: PointerEvent) => { if (event.pointerId === pointer) { event.preventDefault(); update(event); } };
    const up = (event: PointerEvent) => { if (event.pointerId === pointer) release(); };
    const visibility = () => { if (document.hidden) release(); };
    release();
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', drag);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    element.addEventListener('lostpointercapture', up);
    window.addEventListener('blur', release);
    window.addEventListener('resize', release);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      release();
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', drag);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
      element.removeEventListener('lostpointercapture', up);
      window.removeEventListener('blur', release);
      window.removeEventListener('resize', release);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [enabled, move]);
  return <div className="duel-joystick-wrap">
    <div ref={base} className="duel-joystick" role="group" tabIndex={enabled ? 0 : -1} aria-label="Movement joystick" aria-disabled={!enabled}
      aria-describedby="joystick-instructions" data-moving="false">
      <i className="joystick-axis joystick-axis-x" aria-hidden="true"/><i className="joystick-axis joystick-axis-y" aria-hidden="true"/>
      <span ref={thumb} className="joystick-thumb" aria-hidden="true"><i/></span>
    </div>
    <span className="joystick-label">MOVE</span>
    <span id="joystick-instructions" className="touch-description">Drag in any direction to move. Drag further to move faster. Release to stop. Keyboard: W, A, S, D.</span>
  </div>;
});

function TouchAction({ code, label, name, className, icon, disabled, inject, progress, status }: {
  code: string; label: string; name?: string; className: string; icon: ReactNode; disabled: boolean;
  inject: Props['inject']; progress?: number; status?: string;
}) {
  const button = useRef<HTMLButtonElement>(null), pointer = useRef<number | null>(null);
  const release = () => {
    const previous = pointer.current; pointer.current = null;
    inject(code, false);
    if (button.current) {
      button.current.dataset.pressed = 'false';
      if (previous !== null && button.current.hasPointerCapture(previous)) button.current.releasePointerCapture(previous);
    }
  };
  const releaseRef = useRef(release); releaseRef.current = release;
  useEffect(() => {
    const clear = () => releaseRef.current();
    const visibility = () => { if (document.hidden) clear(); };
    if (disabled) clear();
    window.addEventListener('blur', clear); window.addEventListener('resize', clear);
    document.addEventListener('visibilitychange', visibility);
    return () => { clear(); window.removeEventListener('blur', clear); window.removeEventListener('resize', clear); document.removeEventListener('visibilitychange', visibility); };
  }, [disabled, code, inject]);
  const up = (event: ReactPointerEvent<HTMLButtonElement>) => { if (event.pointerId === pointer.current) release(); };
  return <button ref={button} type="button" className={'duel-touch-action ' + className} aria-label={name ?? label} title={name ?? label} disabled={disabled}
    style={progress === undefined ? undefined : { '--ability-fill': Math.max(0, Math.min(1, progress)) * 360 + 'deg' } as CSSProperties}
    onPointerDown={event => {
      if (disabled || pointer.current !== null || event.button !== 0) return;
      event.preventDefault(); pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.dataset.pressed = 'true'; inject(code, true);
    }} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}
    onClick={event => { if (event.detail === 0 && !disabled) { inject(code, true); inject(code, false); } }}>
    {icon}<span>{label}</span>{status && <small>{status}</small>}
  </button>;
}
