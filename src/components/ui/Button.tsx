"use client";

import React from "react";
import { motion } from "framer-motion";

interface ButtonProps {
  variant?: "primary" | "secondary" | "success" | "error" | "warning" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit" | "reset";
}

const variantStyles: Record<string, string> = {
  primary:
    "bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20",
  secondary:
    "bg-bg-surface hover:bg-bg-surface-hover text-text-primary border border-border",
  success:
    "bg-success hover:bg-success/90 text-white shadow-lg shadow-success/20",
  error:
    "bg-error hover:bg-error/90 text-white shadow-lg shadow-error/20",
  warning:
    "bg-warning hover:bg-warning/90 text-black shadow-lg shadow-warning/20",
  ghost:
    "bg-transparent hover:bg-bg-surface-hover text-text-secondary hover:text-text-primary",
};

const sizeStyles: Record<string, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-5 py-2.5 text-base rounded-xl",
  lg: "px-8 py-4 text-lg rounded-2xl",
};

export default function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  icon,
  children,
  className = "",
  disabled,
  onClick,
  type = "button",
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={`
        touch-target inline-flex items-center justify-center gap-2
        font-body font-medium transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </motion.button>
  );
}
