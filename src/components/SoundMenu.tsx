import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AudioLines, Check, CloudRain, Volume2, VolumeX, Waves } from 'lucide-react';
import type { AmbientSound } from '../lib/model';

interface SoundMenuProps {
  sound: AmbientSound;
  volume: number;
  error: string | null;
  onSoundChange: (sound: AmbientSound) => void;
  onVolumeChange: (volume: number) => void;
}

export function SoundMenu({ sound, volume, error, onSoundChange, onVolumeChange }: SoundMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sounds = [
    { value: 'off' as const, title: 'A little quiet', description: 'Just you and the moment.', Icon: VolumeX },
    { value: 'rain' as const, title: 'Soft rain', description: 'A gentle, steady rainfall.', Icon: CloudRain },
    { value: 'brown' as const, title: 'Brown noise', description: 'Warm, low, and grounding.', Icon: Waves },
  ];

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.focus();
    const onPointer = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return <div className="sound-menu-root" ref={rootRef}>
    <button ref={triggerRef} className={`sound-trigger ${sound !== 'off' ? 'sound-active' : ''}`} onClick={() => setOpen(!open)} aria-label="Choose ambient sound" aria-expanded={open} aria-haspopup="dialog"><AudioLines size={18} strokeWidth={1.6} /><span>{sound === 'off' ? 'Sound off' : sound === 'rain' ? 'Soft rain' : 'Brown noise'}</span>{sound !== 'off' && <span className="sound-playing-dot" />}</button>
    <AnimatePresence>{open && <motion.div className="sound-popover" role="dialog" aria-labelledby="sound-heading" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.17 }}>
      <h3 id="sound-heading">A little atmosphere.</h3><p>Find the sound of your focus.</p>
      <div className="sound-options">{sounds.map(({ value, title, description, Icon }) => <label key={value} className={`sound-option ${sound === value ? 'selected' : ''}`}><input className="sr-only" type="radio" name="ambient-sound" value={value} checked={sound === value} onChange={() => onSoundChange(value)} /><Icon size={20} strokeWidth={1.5} /><span>{title}<small>{description}</small></span>{sound === value && <Check size={15} />}</label>)}</div>
      <div className="sound-volume"><label htmlFor="ambient-volume"><Volume2 size={15} />Volume<span>{Math.round(volume * 100)}%</span></label><input id="ambient-volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => onVolumeChange(Number(event.target.value))} disabled={sound === 'off'} /></div>
      {error && <p className="sound-error" role="alert">{error}</p>}
    </motion.div>}</AnimatePresence>
  </div>;
}