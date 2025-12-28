import { useMemo } from 'react';

interface MarketSparklineProps {
  changePercent: number;
  width?: number;
  height?: number;
}

export function MarketSparkline({ changePercent, width = 100, height = 32 }: MarketSparklineProps) {
  const pathData = useMemo(() => {
    // Generate sparkline path based on trend direction
    const points = Array.from({ length: 24 }, (_, i) => {
      const base = 50;
      const variance = Math.sin(i * 0.4) * 20 + (Math.random() - 0.5) * 10;
      return base + variance + (changePercent > 0 ? i * 0.5 : -i * 0.3);
    });
    
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - ((p - min) / range) * height;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [changePercent, width, height]);

  const isPositive = changePercent >= 0;
  const strokeColor = isPositive ? '#22c55e' : '#ef4444';

  return (
    <svg 
      width={width} 
      height={height} 
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <path
        d={pathData}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
    </svg>
  );
}
