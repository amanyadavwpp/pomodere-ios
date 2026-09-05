import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { setAppActive } from '../lib/lifecycle';

export function useDeviceLifecycle() {
  useEffect(() => {
    const onVisibility = () => setAppActive(!document.hidden);
    const onPageHide = () => setAppActive(false);
    const onPageShow = () => setAppActive(!document.hidden);
    const onNativeState = (event: Event) => {
      const detail = (event as CustomEvent<{ isActive?: boolean }>).detail;
      if (typeof detail?.isActive === 'boolean') setAppActive(detail.isActive);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pomodere:native-state', onNativeState);
    const nativeListener = Capacitor.isNativePlatform()
      ? App.addListener('appStateChange', ({ isActive }) => setAppActive(isActive))
      : null;
    if (nativeListener) void nativeListener.catch(() => undefined);

    const updateViewport = () => {
      const viewport = window.visualViewport;
      document.documentElement.style.setProperty('--visual-height', `${viewport?.height ?? window.innerHeight}px`);
      document.documentElement.style.setProperty('--visual-top', `${viewport?.offsetTop ?? 0}px`);
    };
    updateViewport();
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pomodere:native-state', onNativeState);
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
      if (nativeListener) void nativeListener.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, []);
}