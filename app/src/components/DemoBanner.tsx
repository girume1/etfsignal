interface DemoBannerProps {
  onDismiss?: () => void;
}

/**
 * Transparent notice shown on the dashboard whenever we're serving mock data.
 * — just with the SoSoValue feed in pending-key mode.
 */
export function DemoBanner({ onDismiss }: DemoBannerProps) {
  return (
    <div
      style={{ background: 'rgba(0,194,255,0.08)', borderBottom: '1px solid rgba(0,194,255,0.25)' }}
      className="px-6 py-2.5 flex items-center justify-between gap-4 text-sm"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          style={{ background: 'rgba(0,194,255,0.2)', border: '1px solid rgba(0,194,255,0.4)' }}
          className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded text-cyan-300 shrink-0"
        >
          Demo Mode
        </span>
        <p className="text-slate-300 truncate">
          <span className="text-white font-medium">SoSoValue API access pending</span>
          <span className="text-slate-500"> — showing representative BTC/ETH ETF data so the AI pipeline stays fully interactive. Claude analysis and SoDEX signing are real.</span>
        </p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-slate-500 hover:text-white text-lg leading-none shrink-0"
          aria-label="Dismiss demo notice"
        >
          ✕
        </button>
      )}
    </div>
  );
}
