import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface BusyRange {
  start_date: string | null;
  end_date: string | null;
}

interface RangePickerProps {
  busyRanges: BusyRange[];
  startDate: string;  // YYYY-MM-DD or ''
  endDate: string;    // YYYY-MM-DD or ''
  onChange: (start: string, end: string) => void;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function shiftDate(ds: string, n: number): string {
  const d = new Date(ds + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return fmt(d);
}

export const RangePicker: React.FC<RangePickerProps> = ({ busyRanges, startDate, endDate, onChange }) => {
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(() => startDate ? parseInt(startDate.slice(0,4)) : now.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => startDate ? parseInt(startDate.slice(5,7)) - 1 : now.getMonth());
  const [hover, setHover] = useState<string | null>(null);

  const valid = useMemo(
    () => busyRanges.filter(r => r.start_date && r.end_date) as { start_date: string; end_date: string }[],
    [busyRanges],
  );

  const isBusy = (ds: string) => valid.some(r => ds >= r.start_date && ds <= r.end_date);

  // Earliest busy day strictly between startDate and `to`
  const firstBusyBetween = (from: string, to: string): string | null => {
    const dayAfter = shiftDate(from, 1);
    let first: string | null = null;
    for (const r of valid) {
      if (r.end_date < dayAfter || r.start_date > to) continue;
      const hit = r.start_date >= dayAfter ? r.start_date : dayAfter;
      if (!first || hit < first) first = hit;
    }
    return first;
  };

  const handleClick = (ds: string) => {
    if (isBusy(ds)) return;
    // If no start yet, or both already set → begin new selection
    if (!startDate || (startDate && endDate)) {
      onChange(ds, '');
      return;
    }
    // If clicked on or before current start → restart
    if (ds <= startDate) {
      onChange(ds, '');
      return;
    }
    // Setting end date: clamp to just before the first busy day in range
    const fb = firstBusyBetween(startDate, ds);
    if (fb) {
      const clamped = shiftDate(fb, -1);
      onChange(startDate, clamped > startDate ? clamped : '');
    } else {
      onChange(startDate, ds);
    }
  };

  // Build the 6-week grid
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: { ds: string; cur: boolean }[] = [];

  for (let i = firstDow - 1; i >= 0; i--)
    cells.push({ ds: fmt(new Date(viewYear, viewMonth, 0 - i)), cur: false });
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ ds: fmt(new Date(viewYear, viewMonth, d)), cur: true });
  for (let d = 1; cells.length < 42; d++)
    cells.push({ ds: fmt(new Date(viewYear, viewMonth + 1, d)), cur: false });

  // Range highlighting — use hover as live preview when only start is set
  const pickingEnd   = Boolean(startDate && !endDate);
  const previewEnd   = pickingEnd && hover && hover > startDate ? hover : null;
  const effectiveEnd = endDate || previewEnd || '';

  const navPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const navNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const todayDs = fmt(now);

  return (
    <div className="select-none font-mono">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={navPrev}
          className="p-1 rounded hover:bg-cyber-slate/40 text-slate-400 hover:text-slate-200 transition-colors">
          <ChevronLeft size={13} />
        </button>
        <span className="text-xs font-bold text-slate-200 tracking-wider">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={navNext}
          className="p-1 rounded hover:bg-cyber-slate/40 text-slate-400 hover:text-slate-200 transition-colors">
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[9px] text-slate-500 font-bold pb-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map(({ ds, cur }) => {
          const busy    = isBusy(ds);
          const isStart = ds === startDate;
          const isEnd   = ds === effectiveEnd && effectiveEnd !== '';
          const inRange = effectiveEnd && startDate && ds > startDate && ds < effectiveEnd;
          const isToday = ds === todayDs;
          const dayNum  = parseInt(ds.slice(8));

          let base = 'relative h-8 flex items-center justify-center rounded text-[11px] transition-all ';
          if (!cur)               base += 'opacity-20 pointer-events-none ';
          else if (busy)          base += 'text-cyber-magenta/40 bg-cyber-magenta/5 cursor-not-allowed ';
          else if (isStart || isEnd) base += 'bg-cyber-cyan text-cyber-dark font-bold cursor-pointer ring-1 ring-cyber-cyan ';
          else if (inRange && endDate)  base += 'bg-cyber-cyan/20 text-cyber-cyan cursor-pointer ';
          else if (inRange && !endDate) base += 'bg-cyber-cyan/10 text-cyber-cyan/70 cursor-pointer ';
          else                    base += 'text-slate-300 hover:bg-cyber-slate/40 cursor-pointer ';

          return (
            <button
              key={ds}
              type="button"
              disabled={busy || !cur}
              onClick={() => handleClick(ds)}
              onMouseEnter={() => setHover(ds)}
              onMouseLeave={() => setHover(null)}
              className={base}
            >
              {dayNum}
              {/* today indicator */}
              {isToday && !isStart && !isEnd && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyber-cyan/60" />
              )}
              {/* busy indicator */}
              {busy && cur && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyber-magenta/50" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-cyber-slate/20 text-[8px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-cyber-cyan inline-block shrink-0" /> Selected
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-cyber-cyan/20 inline-block shrink-0" /> Range
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-cyber-magenta/20 inline-block shrink-0" /> Busy
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-cyber-cyan/60 inline-block shrink-0" /> Today
        </span>
      </div>

      {/* Phase hint / selection summary */}
      <p className="text-[9px] text-slate-500 mt-2 font-sans">
        {!startDate
          ? 'Click a day to set the start date.'
          : !endDate
          ? `Start: ${startDate} — now click the end date.`
          : `${startDate}  →  ${endDate}`}
      </p>

      {/* Clear button */}
      {(startDate || endDate) && (
        <button
          type="button"
          onClick={() => onChange('', '')}
          className="mt-2 text-[9px] font-mono text-cyber-magenta/70 hover:text-cyber-magenta underline underline-offset-2 transition-colors"
        >
          Clear selection
        </button>
      )}
    </div>
  );
};
