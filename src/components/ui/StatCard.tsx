"use client";

import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  color?: string;
  className?: string;
}

export default function StatCard({
  label,
  value,
  icon,
  subtitle,
  trend,
  color,
  className = "",
}: StatCardProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
      }}
      className={`glass-card p-4 sm:p-5 hover:bg-white/[0.03] transition-colors ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-body text-text-secondary mb-1">{label}</p>
          <p
            className="text-2xl sm:text-3xl font-body font-bold"
            style={{ color: color || "#FAFAFA" }}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs font-body text-text-secondary mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div
            className="p-2 rounded-xl"
            style={{
              backgroundColor: color ? `${color}15` : "rgba(99,102,241,0.15)",
            }}
          >
            <span style={{ color: color || "#6366F1" }}>{icon}</span>
          </div>
        )}
      </div>
      {trend && (
        <div className="flex items-center mt-2">
          <span
            className={`text-xs font-medium ${
              trend === "up"
                ? "text-success"
                : trend === "down"
                ? "text-error"
                : "text-text-secondary"
            }`}
          >
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}{" "}
            {trend === "up" ? "Rośnie" : trend === "down" ? "Spada" : "Stabilnie"}
          </span>
        </div>
      )}
    </motion.div>
  );
}
