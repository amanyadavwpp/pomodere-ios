let appActive = true;

export function isAppActive(): boolean {
  return appActive && !document.hidden;
}

export function setAppActive(active: boolean): void {
  appActive = active;
  document.documentElement.classList.toggle('app-inactive', !active);
  window.dispatchEvent(new Event(active ? 'pomodere:resume' : 'pomodere:lock'));
}