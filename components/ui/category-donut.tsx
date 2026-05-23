import { formatMoney, getCurrency } from "@/lib/currencies";
import type { Category } from "@/lib/categories";

type Slice = {
  category: Category;
  amount: number;
};

type CategoryDonutProps = {
  slices: Slice[];
  totalAmount: number;
  currency: string;
  /** SVG outer size in pixels (square). Default 160. */
  size?: number;
};

const STROKE_FRACTION = 0.25; // ring thickness relative to radius
const GAP_DEG = 1.5; // tiny gap between segments for legibility

/**
 * Pure SVG donut chart of category totals. Zero deps. Center shows the
 * total amount; segment colors come from each category's `bg`.
 *
 * Segments are rendered as <circle> with stroke-dasharray/offset, rotated
 * so 0° is at the top. A small angular gap between segments keeps them
 * visually distinct without extra elements.
 */
export function CategoryDonut({
  slices,
  totalAmount,
  currency,
  size = 160,
}: CategoryDonutProps) {
  const half = size / 2;
  const radius = half * (1 - STROKE_FRACTION / 2) - 2;
  const strokeWidth = half * STROKE_FRACTION;
  const circumference = 2 * Math.PI * radius;

  // Convert each slice to angular fraction. Guard against empty/zero total.
  const safeTotal = totalAmount > 0 ? totalAmount : 1;
  const fractions = slices.map((s) => s.amount / safeTotal);

  let runningOffset = 0;
  // Convert the visual gap (in degrees) to a length on the circumference.
  const gapLen = (GAP_DEG / 360) * circumference;

  const currencyInfo = getCurrency(currency);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label="Структура расходов по категориям"
      >
        {/* Background ring — visible when there are no slices, also makes
            edges cleaner under the gaps between coloured arcs. */}
        <circle
          cx={half}
          cy={half}
          r={radius}
          fill="none"
          stroke="#F4F4F1"
          strokeWidth={strokeWidth}
        />
        {slices.map((slice, i) => {
          const frac = fractions[i];
          const arcLen = Math.max(frac * circumference - gapLen, 0);
          const dashArray = `${arcLen} ${circumference - arcLen}`;
          // Negative offset shifts the start; rotate handled below.
          const segment = (
            <circle
              key={slice.category.id}
              cx={half}
              cy={half}
              r={radius}
              fill="none"
              stroke={slice.category.bg}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={-runningOffset}
              transform={`rotate(-90 ${half} ${half})`}
              strokeLinecap="butt"
            />
          );
          runningOffset += frac * circumference;
          return segment;
        })}
        {/* Center label */}
        <text
          x={half}
          y={half - 4}
          textAnchor="middle"
          className="fill-muted"
          style={{ fontSize: size * 0.075, fontWeight: 600 }}
        >
          Всего
        </text>
        <text
          x={half}
          y={half + size * 0.1}
          textAnchor="middle"
          className="fill-ink font-mono"
          style={{ fontSize: size * 0.105, fontWeight: 700 }}
        >
          {currencyInfo?.symbol
            ? formatMoney(totalAmount, currency, { compact: true })
            : Math.round(totalAmount).toString()}
        </text>
      </svg>
    </div>
  );
}
