// Silver Fern Education Consultants logo mark, recreated as a scalable SVG so it
// stays crisp at any size and inherits the brand colour via `currentColor`.
// Set the colour with a text-* class (e.g. text-brand-700).

type LogoMarkProps = { className?: string; withText?: boolean };

// A single fern leaflet as a small almond/leaf shape from base→tip.
function leaf(bx: number, by: number, tx: number, ty: number, width: number): string {
  const dx = tx - bx;
  const dy = ty - by;
  const len = Math.hypot(dx, dy) || 1;
  // unit perpendicular
  const px = -dy / len;
  const py = dx / len;
  const mx = bx + dx * 0.5;
  const my = by + dy * 0.5;
  const c1x = mx + px * width;
  const c1y = my + py * width;
  const c2x = mx - px * width;
  const c2y = my - py * width;
  return `M${bx.toFixed(1)},${by.toFixed(1)} Q${c1x.toFixed(1)},${c1y.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)} Q${c2x.toFixed(1)},${c2y.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)} Z`;
}

function FernFrond() {
  const N = 9;
  const leaflets: string[] = [];
  for (let i = 0; i < N; i++) {
    const frac = i / (N - 1); // 0 bottom → 1 tip
    const y = 84 - frac * 60; // 84 → 24
    const stemX = 60 + Math.sin(frac * Math.PI) * -3; // gentle curve
    const len = 23 * (1 - frac) + 5; // longer at base, shorter at tip
    const up = 0.5; // upward tilt of leaflets
    // left leaflet
    leaflets.push(leaf(stemX, y, stemX - len, y - len * up, Math.max(1.6, len * 0.16)));
    // right leaflet
    leaflets.push(leaf(stemX, y, stemX + len, y - len * up, Math.max(1.6, len * 0.16)));
  }
  return (
    <g fill="currentColor">
      {/* rachis (central stem) */}
      <path d="M60,86 C56,66 57,44 60,22" stroke="currentColor" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      {/* terminal leaflet */}
      <path d={leaf(60, 24, 60, 14, 2)} />
      {leaflets.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  );
}

export function LogoMark({ className, withText = false }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Silver Fern Education Consultants">
      {/* outer ring */}
      <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth={withText ? 1.5 : 3} />
      {withText && (
        <>
          <circle cx="60" cy="60" r="44.5" fill="none" stroke="currentColor" strokeWidth={1} opacity={0.5} />
          {/* curved brand text around the ring */}
          <defs>
            <path id="sfedu-ring" d="M60,9 a51,51 0 1,1 -0.1,0" fill="none" />
          </defs>
          <text fill="currentColor" style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "2.2px" }}>
            <textPath href="#sfedu-ring" startOffset="2%">
              SILVER FERN EDUCATION CONSULTANTS
            </textPath>
          </text>
        </>
      )}
      {/* fern, scaled to sit inside the inner area */}
      <g transform={withText ? "translate(60 60) scale(0.66) translate(-60 -60)" : "translate(60 60) scale(0.82) translate(-60 -60)"}>
        <FernFrond />
      </g>
    </svg>
  );
}

// Full horizontal lockup: mark + wordmark. Inherits brand colour.
export function LogoLockup({ className }: { className?: string }) {
  return (
    <div className={"flex items-center gap-3 text-brand-700 " + (className ?? "")}>
      <LogoMark className="h-16 w-16 shrink-0" withText />
      <div className="leading-none">
        <div className="text-2xl font-extrabold tracking-tight">SILVER FERN</div>
        <div className="mt-1 text-[10px] font-semibold tracking-[0.25em] text-brand-600">
          EDUCATION CONSULTANTS
        </div>
      </div>
    </div>
  );
}
