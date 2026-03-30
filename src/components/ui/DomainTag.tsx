"use client";

import { Domain, DOMAIN_CONFIG } from "@/lib/types";

interface DomainTagProps {
  domain: Domain;
  size?: "sm" | "md";
  className?: string;
}

export default function DomainTag({
  domain,
  size = "sm",
  className = "",
}: DomainTagProps) {
  const config = DOMAIN_CONFIG[domain];

  return (
    <span
      className={`
        domain-tag font-body font-medium
        ${size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"}
        ${className}
      `}
      style={{
        backgroundColor: `${config.color}20`,
        color: config.color,
        border: `1px solid ${config.color}30`,
      }}
    >
      {config.labelPL}
    </span>
  );
}
