"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getUserStats, getDueWords, getRecentSessions, getAllWordProgress } from "@/lib/firebase";
import { UserStats, Session } from "@/lib/types";
import { generateWeeklyReport } from "@/lib/ai/gemini";
import Navbar from "@/components/layout/Navbar";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

export default function DashboardPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [dueWordsCount, setDueWordsCount] = useState(0);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [, setIsLoading] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        const [userStats, dueWords, sessions] = await Promise.all([
          getUserStats(user.uid),
          getDueWords(user.uid),
          getRecentSessions(user.uid, 7),
        ]);

        setStats(userStats);
        setDueWordsCount(dueWords.length);
        setRecentSessions(sessions);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  const handleGenerateReport = async () => {
    if (!user || isGeneratingReport) return;
    setIsGeneratingReport(true);
    try {
      const [allWords, sessions] = await Promise.all([
        getAllWordProgress(user.uid),
        getRecentSessions(user.uid, 7),
      ]);

      const totalReviewed = sessions.reduce((sum, s) => sum + s.wordsReviewed, 0);
      const avgAccuracy = sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.accuracyOverall, 0) / sessions.length
        : 0;
      const newWordsCount = sessions.reduce((sum, s) => sum + s.newWordsIntroduced, 0);
      const masteredCount = allWords.filter(w => w.state === "mastered").length;

      // Aggregate accuracy by domain
      const domainAcc: Record<string, { total: number; count: number }> = {};
      for (const s of sessions) {
        for (const [d, acc] of Object.entries(s.accuracyByDomain)) {
          if (!domainAcc[d]) domainAcc[d] = { total: 0, count: 0 };
          if (acc > 0) {
            domainAcc[d].total += acc;
            domainAcc[d].count++;
          }
        }
      }
      const accuracyByDomain: Record<string, number> = {};
      for (const [d, { total, count }] of Object.entries(domainAcc)) {
        accuracyByDomain[d] = count > 0 ? total / count : 0;
      }

      // Find weakest domain
      const weakestDomain = Object.entries(accuracyByDomain)
        .sort((a, b) => a[1] - b[1])[0]?.[0] || "finance";

      const report = await generateWeeklyReport({
        totalSessions: sessions.length,
        totalWordsReviewed: totalReviewed,
        averageAccuracy: avgAccuracy,
        accuracyByDomain,
        newWordsLearned: newWordsCount,
        masteredWords: masteredCount,
        streakDays: profile?.streakDays || 0,
        weakestDomain,
        knownWords: allWords.map(w => w.word),
      });

      if (report) {
        setWeeklyReport(report.summaryPL);
      }
    } catch (err) {
      console.error("Failed to generate weekly report:", err);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full"
        />
      </div>
    );
  }

  const today = new Date().toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const chartData = stats?.weeklyProgress?.slice(-7).map((wp) => ({
    date: new Date(wp.date).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" }),
    słowa: wp.wordsReviewed,
    celność: Math.round(wp.accuracy * 100),
  })) || [];

  const hasData = stats && (stats.totalWords > 0 || recentSessions.length > 0);

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

      <main className="md:ml-64 pb-24 md:pb-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-3xl sm:text-4xl font-heading text-text-primary">
                Cześć, {profile?.displayName?.split(" ")[0] || "Użytkowniku"}!
              </h1>
              {(profile?.streakDays || 0) > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.3 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning-muted border border-warning/30"
                >
                  <span className="text-lg">🔥</span>
                  <span className="text-sm font-body font-bold text-warning">
                    {profile?.streakDays} dni
                  </span>
                </motion.div>
              )}
            </div>
            <p className="text-sm font-body text-text-secondary">{today}</p>
          </motion.div>

          {/* Main CTA */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="mb-8"
          >
            <Link href="/learn">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 border border-indigo-400/30 p-8 sm:p-10 cursor-pointer group shadow-[0_0_40px_rgba(99,102,241,0.2)] hover:shadow-[0_0_80px_rgba(99,102,241,0.4)] transition-all duration-500">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 group-hover:translate-x-full transition-transform duration-700 ease-in-out" />

                <div className="relative z-10">
                  <h2 className="text-2xl sm:text-3xl font-heading text-white mb-2">
                    Rozpocznij sesję
                  </h2>
                  <p className="text-sm text-white/80 font-body mb-4">
                    {dueWordsCount > 0
                      ? `${dueWordsCount} słów czeka na powtórkę`
                      : "Zacznij naukę nowych słów"}
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white font-body font-medium text-sm">
                    Zaczynamy →
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>

          {hasData ? (
            <>
              {/* Stats cards */}
              <motion.div 
                className="grid grid-cols-3 gap-3 mb-8"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.1, delayChildren: 0.3 }
                  }
                }}
              >
                <StatCard
                  label="Opanowane"
                  value={stats?.masteredWords || 0}
                  color="#22C55E"
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
                <StatCard
                  label="Do powtórki"
                  value={dueWordsCount}
                  color="#F59E0B"
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
                <StatCard
                  label="Celność"
                  value={
                    stats
                      ? `${Math.round(
                          Object.values(stats.accuracyByDomain).reduce(
                            (a, b) => a + b,
                            0
                          ) /
                            Math.max(
                              Object.values(stats.accuracyByDomain).filter(
                                (v) => v > 0
                              ).length,
                              1
                            ) *
                            100
                        )}%`
                      : "—"
                  }
                  color="#6366F1"
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  }
                />
              </motion.div>

              {/* Mini chart */}
              {chartData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="glass-card p-4 sm:p-6"
                >
                  <h3 className="text-sm font-body text-text-secondary mb-4">
                    Ostatnie 7 dni
                  </h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorWords" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#A1A1AA", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#141416",
                          border: "1px solid #27272A",
                          borderRadius: 12,
                          color: "#FAFAFA",
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="słowa"
                        stroke="#6366F1"
                        fill="url(#colorWords)"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="celność"
                        stroke="#22C55E"
                        strokeWidth={2}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {/* Weekly AI Report */}
              {recentSessions.length >= 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="glass-card p-5 sm:p-6 mt-6"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-body text-text-secondary flex items-center gap-2">
                      <span className="text-lg">🤖</span>
                      Raport tygodniowy AI
                    </h3>
                    <Button
                      size="sm"
                      variant={weeklyReport ? "secondary" : "primary"}
                      onClick={handleGenerateReport}
                      disabled={isGeneratingReport}
                    >
                      {isGeneratingReport ? "Generuję..." : weeklyReport ? "Odśwież" : "Generuj"}
                    </Button>
                  </div>
                  {weeklyReport ? (
                    <p className="text-sm font-body text-text-primary leading-relaxed">
                      {weeklyReport}
                    </p>
                  ) : (
                    <p className="text-xs font-body text-text-secondary">
                      Gemini AI przeanalizuje Twoje postępy z ostatnich 7 dni i poda rekomendacje.
                    </p>
                  )}
                </motion.div>
              )}
            </>
          ) : (
            /* Empty state */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-8 text-center"
            >
              <div className="text-5xl mb-4">📚</div>
              <h3 className="text-xl font-heading text-text-primary mb-2">
                Zacznij swoją pierwszą sesję!
              </h3>
              <p className="text-sm font-body text-text-secondary mb-6 max-w-sm mx-auto">
                Mamy 40 słów z finansów, prawa, tech i codziennych rozmów
                gotowych do nauki. Kliknij przycisk powyżej, aby rozpocząć.
              </p>
              <div className="flex justify-center gap-2">
                {["Finanse", "Prawo", "Tech", "Rozmowa"].map((label, i) => (
                  <span
                    key={label}
                    className="px-3 py-1 rounded-full text-xs font-body"
                    style={{
                      backgroundColor: ["#3B82F620", "#8B5CF620", "#06B6D420", "#F9731620"][i],
                      color: ["#3B82F6", "#8B5CF6", "#06B6D4", "#F97316"][i],
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
