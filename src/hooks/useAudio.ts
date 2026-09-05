import { useCallback, useEffect, useRef, useState } from 'react';
import type { AmbientSound } from '../lib/model';
import { isAppActive } from '../lib/lifecycle';

export function useAmbientAudio(sound: AmbientSound, volume: number) {
  const audioRef = useRef<{ context: AudioContext; gain: GainNode } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    if (sound === 'off') {
      setError(null);
      return;
    }
    let context: AudioContext | undefined;
    try {
      context = new AudioContext();
      const length = context.sampleRate * 6;
      const buffer = context.createBuffer(2, length, context.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        let last = 0;
        for (let index = 0; index < length; index++) {
          const white = Math.random() * 2 - 1;
          if (sound === 'brown') {
            last = (last + 0.02 * white) / 1.02;
            data[index] = last * 3.5;
          } else data[index] = white;
        }
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = sound === 'brown' ? 650 : 2400;
      const gain = context.createGain();
      gain.gain.value = volumeRef.current * (sound === 'brown' ? 0.6 : 0.22);
      source.connect(filter).connect(gain).connect(context.destination);
      source.start();
      audioRef.current = { context, gain };
      void context.resume().catch(() => setError('Your browser could not start audio. Try selecting a sound again.'));
      setError(null);
    } catch {
      setError('Ambient audio is not available in this browser. Your timer still works normally.');
    }
    const pauseWhenInactive = () => {
      if (!isAppActive() && context?.state === 'running') void context.suspend().catch(() => undefined);
    };
    const resumeWhenActive = () => {
      if (isAppActive() && context?.state === 'suspended') void context.resume().catch(() => setError('Select Off, then choose your sound again to resume audio.'));
    };
    window.addEventListener('pomodere:lock', pauseWhenInactive);
    window.addEventListener('pomodere:resume', resumeWhenActive);
    return () => {
      window.removeEventListener('pomodere:lock', pauseWhenInactive);
      window.removeEventListener('pomodere:resume', resumeWhenActive);
      audioRef.current = null;
      if (context && context.state !== 'closed') void context.close().catch(() => undefined);
    };
  }, [sound]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.gain.gain.setTargetAtTime(volume * (sound === 'brown' ? 0.6 : 0.22), audio.context.currentTime, 0.1);
  }, [volume, sound]);

  return error;
}

export function useChime() {
  const contextRef = useRef<AudioContext | null>(null);

  const unlock = useCallback(() => {
    try {
      if (!contextRef.current || contextRef.current.state === 'closed') contextRef.current = new AudioContext();
      if (contextRef.current.state === 'suspended') void contextRef.current.resume().catch(() => undefined);
    } catch {
      // A visible session notification remains available without audio support.
    }
  }, []);

  const play = useCallback(() => {
    const context = contextRef.current;
    if (!context || context.state !== 'running') return;
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.23;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 1.1);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 1.2);
    });
  }, []);

  useEffect(() => () => {
    if (contextRef.current && contextRef.current.state !== 'closed') void contextRef.current.close().catch(() => undefined);
  }, []);

  return { unlock, play };
}