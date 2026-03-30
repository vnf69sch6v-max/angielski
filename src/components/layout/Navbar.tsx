"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const navItems = [
  {
    href: "/",
    label: "Start",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/learn",
    label: "Nauka",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    href: "/stats",
    label: "Statystyki",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: "/words",
    label: "Słowa",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Ustawienia",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function Navbar() {
  const pathname = usePathname();

  // Don't show navbar on learn page (distraction-free)
  if (pathname === "/learn") return null;

  return (
    <>
      {/* Mobile: Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="bg-bg-surface/95 backdrop-blur-xl border-t border-border">
          <div className="flex items-center justify-around px-2 py-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="touch-target relative flex flex-col items-center justify-center py-2 px-3"
                >
                  <span
                    className={`transition-colors duration-200 ${
                      isActive ? "text-accent" : "text-text-secondary"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span
                    className={`text-[10px] font-body mt-0.5 transition-colors duration-200 ${
                      isActive ? "text-accent font-medium" : "text-text-secondary"
                    }`}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator-mobile"
                      className="absolute -top-0.5 w-8 h-0.5 rounded-full bg-accent"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
        {/* Safe area for mobile */}
        <div className="h-[env(safe-area-inset-bottom)] bg-bg-surface/95" />
      </nav>

      {/* Desktop: Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 flex-col bg-bg-surface border-r border-border z-50">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-border">
          <h1 className="text-2xl font-heading">
            <span className="text-text-primary">Fluent</span>
            <span className="text-accent italic">Flow</span>
          </h1>
          <p className="text-xs font-body text-text-secondary mt-1">
            Nauka angielskiego
          </p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  relative flex items-center gap-3 px-4 py-3 rounded-xl font-body text-sm
                  transition-all duration-200
                  ${
                    isActive
                      ? "bg-accent-muted text-accent font-medium"
                      : "text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary"
                  }
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator-desktop"
                    className="absolute left-0 w-1 h-8 rounded-r-full bg-accent"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <p className="text-xs text-text-secondary font-body">
            FluentFlow v1.0
          </p>
        </div>
      </aside>
    </>
  );
}
