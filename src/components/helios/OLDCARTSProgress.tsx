/**
 * OLDCARTS Progress Indicator
 * Visual progress indicator showing symptom collection completeness
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface OLDCARTSItem {
  value: string | number | null;
  complete: boolean;
  partial?: boolean;
}

export interface OLDCARTSData {
  onset: OLDCARTSItem;
  location: OLDCARTSItem;
  duration: OLDCARTSItem;
  character: OLDCARTSItem;
  aggravating: OLDCARTSItem;
  relieving: OLDCARTSItem;
  timing: OLDCARTSItem;
  severity: OLDCARTSItem;
}

export interface OLDCARTSProgressProps {
  oldcarts: OLDCARTSData;
  minimal?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  className?: string;
}

export interface ComponentBreakdown {
  component: keyof OLDCARTSData;
  label: string;
  weight: number;
  complete: boolean;
  partial: boolean;
  contribution: number;
}

export interface CompletenessResult {
  percentage: number;
  breakdown: ComponentBreakdown[];
}

// ============================================================================
// Constants
// ============================================================================

const OLDCARTS_WEIGHTS: Record<keyof OLDCARTSData, number> = {
  onset: 15,
  location: 15,
  severity: 15,
  character: 12,
  duration: 12,
  timing: 12,
  aggravating: 9.5,
  relieving: 9.5,
};

const OLDCARTS_LABELS: Record<keyof OLDCARTSData, string> = {
  onset: 'Onset',
  location: 'Location',
  duration: 'Duration',
  character: 'Character',
  aggravating: 'Aggravating',
  relieving: 'Relieving',
  timing: 'Timing',
  severity: 'Severity',
};

// Order for display (follows OLDCARTS acronym)
const OLDCARTS_ORDER: (keyof OLDCARTSData)[] = [
  'onset',
  'location',
  'duration',
  'character',
  'aggravating',
  'relieving',
  'timing',
  'severity',
];

const COLORS = {
  complete: {
    fill: '#22C55E',
    stroke: '#16A34A',
    bg: 'bg-green-500',
  },
  partial: {
    fill: '#EAB308',
    stroke: '#CA8A04',
    bg: 'bg-yellow-500',
  },
  missing: {
    fill: '#D1D5DB',
    stroke: '#9CA3AF',
    bg: 'bg-gray-300',
  },
};

const SIZES = {
  sm: { ring: 60, stroke: 4, gap: 2, fontSize: 'text-xs', innerRadius: 20 },
  md: { ring: 100, stroke: 6, gap: 3, fontSize: 'text-sm', innerRadius: 32 },
  lg: { ring: 140, stroke: 8, gap: 4, fontSize: 'text-lg', innerRadius: 45 },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate weighted completeness of OLDCARTS data
 */
export function calculateWeightedCompleteness(
  oldcarts: OLDCARTSData
): CompletenessResult {
  const breakdown: ComponentBreakdown[] = OLDCARTS_ORDER.map((key) => {
    const item = oldcarts[key];
    const weight = OLDCARTS_WEIGHTS[key];
    const complete = item?.complete ?? false;
    const partial = item?.partial ?? false;

    // Calculate contribution: full weight if complete, half if partial, 0 if missing
    let contribution = 0;
    if (complete) {
      contribution = weight;
    } else if (partial) {
      contribution = weight * 0.5;
    }

    return {
      component: key,
      label: OLDCARTS_LABELS[key],
      weight,
      complete,
      partial,
      contribution,
    };
  });

  const percentage = Math.round(
    breakdown.reduce((sum, item) => sum + item.contribution, 0)
  );

  return { percentage, breakdown };
}

// ============================================================================
// Segment Path Generator
// ============================================================================

function createArcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = {
    x: cx + radius * Math.cos(startAngle),
    y: cy + radius * Math.sin(startAngle),
  };
  const end = {
    x: cx + radius * Math.cos(endAngle),
    y: cy + radius * Math.sin(endAngle),
  };

  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

// ============================================================================
// Full View Component (Circular Progress Ring)
// ============================================================================

interface CircularProgressProps {
  completeness: CompletenessResult;
  size: 'sm' | 'md' | 'lg';
  showPercentage: boolean;
}

function CircularProgress({
  completeness,
  size,
  showPercentage,
}: CircularProgressProps) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const config = SIZES[size];

  const { ring, stroke, gap, fontSize, innerRadius } = config;
  const cx = ring / 2;
  const cy = ring / 2;
  const radius = (ring - stroke) / 2;

  // Calculate segment angles (8 segments with gaps)
  const totalGapAngle = (gap * 8 * Math.PI) / 180; // Convert gap to radians
  const availableAngle = 2 * Math.PI - totalGapAngle;
  const gapAngle = (gap * Math.PI) / 180;

  // Calculate segment sizes based on weights
  const totalWeight = Object.values(OLDCARTS_WEIGHTS).reduce((a, b) => a + b, 0);
  const segments = completeness.breakdown.map((item, index) => {
    const segmentAngle = (item.weight / totalWeight) * availableAngle;
    return {
      ...item,
      angle: segmentAngle,
      index,
    };
  });

  // Calculate start angles
  let currentAngle = -Math.PI / 2; // Start from top
  const segmentPaths = segments.map((segment) => {
    const startAngle = currentAngle;
    const endAngle = currentAngle + segment.angle;
    currentAngle = endAngle + gapAngle;

    const status = segment.complete
      ? 'complete'
      : segment.partial
        ? 'partial'
        : 'missing';

    return {
      ...segment,
      startAngle,
      endAngle,
      status,
      path: createArcPath(cx, cy, radius, startAngle, endAngle),
    };
  });

  return (
    <TooltipProvider delayDuration={100}>
      <div className="relative inline-flex items-center justify-center">
        {/* Pulse animation when updating */}
        <AnimatePresence>
          {completeness.percentage > 0 && completeness.percentage < 100 && (
            <motion.div
              className="absolute rounded-full bg-primary/20"
              style={{ width: ring + 8, height: ring + 8 }}
              initial={{ scale: 1, opacity: 0.2 }}
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.2, 0.1, 0.2],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}
        </AnimatePresence>

        <svg width={ring} height={ring} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={stroke}
            opacity={0.3}
          />

          {/* Segment arcs */}
          {segmentPaths.map((segment) => (
            <Tooltip key={segment.component}>
              <TooltipTrigger asChild>
                <motion.path
                  d={segment.path}
                  fill="none"
                  stroke={COLORS[segment.status].fill}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: 1,
                    opacity: 1,
                    strokeWidth:
                      hoveredSegment === segment.component
                        ? stroke + 2
                        : stroke,
                  }}
                  transition={{
                    pathLength: { duration: 0.5, delay: segment.index * 0.05 },
                    opacity: { duration: 0.3 },
                    strokeWidth: { duration: 0.15 },
                  }}
                  onMouseEnter={() => setHoveredSegment(segment.component)}
                  onMouseLeave={() => setHoveredSegment(null)}
                  className="cursor-pointer"
                  style={{ filter: hoveredSegment === segment.component ? 'brightness(1.1)' : 'none' }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="z-50">
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{segment.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {segment.complete
                      ? 'Complete'
                      : segment.partial
                        ? 'Partial'
                        : 'Missing'}
                  </span>
                  <span className="text-xs">Weight: {segment.weight}%</span>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </svg>

        {/* Center content */}
        {showPercentage && (
          <div className="absolute flex flex-col items-center justify-center">
            <motion.span
              className={cn('font-bold text-foreground', fontSize)}
              key={completeness.percentage}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              {completeness.percentage}%
            </motion.span>
            {size !== 'sm' && (
              <span className="text-xs text-muted-foreground">Complete</span>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// Minimal View Component (Horizontal Progress Bar)
// ============================================================================

interface MinimalProgressProps {
  completeness: CompletenessResult;
  className?: string;
}

function MinimalProgress({ completeness, className }: MinimalProgressProps) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2', className)}>
            {/* Progress bar */}
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <motion.div
                className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-primary to-green-500"
                initial={{ width: 0 }}
                animate={{ width: `${completeness.percentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>

            {/* Percentage text */}
            <motion.span
              className="min-w-[3rem] text-sm font-medium text-foreground"
              key={completeness.percentage}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {completeness.percentage}%
            </motion.span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="w-64">
          <div className="space-y-2">
            <p className="font-medium">OLDCARTS Progress</p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {completeness.breakdown.map((item) => (
                <div
                  key={item.component}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-muted-foreground">{item.label}</span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-xs font-medium',
                      item.complete
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : item.partial
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    )}
                  >
                    {item.complete ? 'Done' : item.partial ? 'Partial' : '-'}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t pt-1 text-xs text-muted-foreground">
              Weighted total: {completeness.percentage}%
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function OLDCARTSProgress({
  oldcarts,
  minimal = false,
  size = 'md',
  showPercentage = true,
  className,
}: OLDCARTSProgressProps) {
  const completeness = useMemo(
    () => calculateWeightedCompleteness(oldcarts),
    [oldcarts]
  );

  if (minimal) {
    return <MinimalProgress completeness={completeness} className={className} />;
  }

  return (
    <div className={className}>
      <CircularProgress
        completeness={completeness}
        size={size}
        showPercentage={showPercentage}
      />
    </div>
  );
}

// ============================================================================
// Legend Component (Optional companion)
// ============================================================================

interface OLDCARTSLegendProps {
  completeness: CompletenessResult;
  className?: string;
}

export function OLDCARTSLegend({ completeness, className }: OLDCARTSLegendProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-2 text-sm', className)}>
      {completeness.breakdown.map((item) => (
        <div
          key={item.component}
          className="flex items-center gap-2"
        >
          <div
            className={cn(
              'h-3 w-3 rounded-full',
              item.complete
                ? COLORS.complete.bg
                : item.partial
                  ? COLORS.partial.bg
                  : COLORS.missing.bg
            )}
          />
          <span className="text-muted-foreground">{item.label}</span>
          <span className="ml-auto text-xs font-medium">{item.weight}%</span>
        </div>
      ))}
    </div>
  );
}

export default OLDCARTSProgress;
