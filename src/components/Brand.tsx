export function TomatoMark({ className = '', small = false }: { className?: string; small?: boolean }) {
  return (
    <svg className={className} width={small ? 18 : 35} height={small ? 18 : 35} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M20 12C11.5 8.5 4 15.1 5.2 24.1C6.3 32.7 12.8 36 20 35.1C27.2 36 33.7 32.7 34.8 24.1C36 15.1 28.5 8.5 20 12Z" fill="currentColor" />
      <path d="M20.2 14.3C17.4 10.5 13.4 9.4 10 9.7L15.8 15.7L10.5 17.6C14.6 19.1 17.9 17.1 20 15.7C22.2 18.1 26.2 19.1 29.6 17.2L24.1 15.2L30 10.1C25.7 9.7 22.6 11 20.2 14.3Z" fill="#697451" />
      <path d="M20 13.7C19.5 9.8 20.4 7 23 4.5" stroke="#697451" strokeWidth="2.7" strokeLinecap="round" />
      {!small && <path d="M10.3 22.3C10 24.4 10.6 26.9 11.9 28.3" stroke="#F7C9B3" strokeWidth="1.7" strokeLinecap="round" />}
    </svg>
  );
}

export function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button className="brand" onClick={onClick} aria-label="Pomodere, go to focus space">
      <TomatoMark />
      <span>pomodere<span className="brand-period">.</span></span>
    </button>
  );
}