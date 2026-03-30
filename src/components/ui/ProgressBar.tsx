"use client";

import { motion } from "framer-motion";

interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  height?: number;
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export default function ProgressBar({
  value,
  color = "#6366F1",
  height = 8,
  showLabel = false,
  label,
  className = "",
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={`w-full ${className}`}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && (
            <span className="text-sm font-body text-text-secondary">{label}</span>
          )}
          {showLabel && (
            <span className="text-sm font-body font-medium text-text-primary">
              {Math.round(clampedValue)}%
            </span>
          )}
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden bg-bg-surface-hover"
        style={{ height }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${clampedValue}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
