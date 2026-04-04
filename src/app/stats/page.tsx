"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getUserStats, getAllSessions, getAllWordProgress } from "@/lib/firebase";
import { UserStats, Session, WordProgress, DOMAIN_CONFIG, Domain } from "@/lib/types";
import Navbar from "@/components/layout/Navbar";
import {
  getIntelligenceMetrics,
  AlgorithmIntelligenceMetrics,
} from "@/lib/algorithm/intelligence";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function StatsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [, setStats] = useState<UserStats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allWords, setAllWords] = useState<WordProgress[]>([]);
  const [, setIsLoading] = useState(true);
  const [intelligence, setIntelligence] = useState<AlgorithmIntelligenceMetrics | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [s, sess, words] = await Promise.all([
          getUserStats(user.uid),
          getAllSessions(user.uid),
          getAllWordProgress(user.uid),
        ]);
        setStats(s);
        setSessions(sess);
        setAllWords(words);
      } catch (err) {
        console.error("Failed to load stats:", err);
      } finally {
        setIsLoading(false);
      }

      // V3.1: Load intelligence metrics
      try {
        const intel = await getIntelligenceMetrics(user.uid);
        if (intel) setIntelligence(intel);
      } catch { /* no metrics yet */ }
    };
    load();
  }, [user]);

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

  // Build heatmap data (last 90 days)
  const heatmapData = (() => {
    const days: { date: string; count: number }[] = [];
    const now = new Date();
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const sessionsOnDay = sessions.filter((s) => {
        const sDate = s.date.toDate().toISOString().split("T")[0];
        return sDate === dateStr;
      });
      days.push({
        date: dateStr,
        count: sessionsOnDay.reduce((sum, s) => sum + s.wordsReviewed, 0),
      });
    }
    return days;
  })();

  // Domain breakdown
  const domainData = (Object.keys(DOMAIN_CONFIG) as Domain[]).map((domain) => ({
    name: DOMAIN_CONFIG[domain].labelPL,
    value: allWords.filter((w) => w.domain === domain).length,
    color: DOMAIN_CONFIG[domain].color,
  }));

  // Accuracy trend (last 30 sessions)
  const accuracyTrend = sessions
    .slice(0, 30)
    .reverse()
    .map((s, i) => ({
      sesja: i + 1,
      celność: Math.round(s.accuracyOverall * 100),
    }));

  // Mastered words over time
  const masteredOverTime = (() => {
    let cumulative = 0;
    return sessions
      .slice()
      .reverse()
      .map((s) => {
        cumulative += s.wordsReviewed;
        return {
          date: s.date.toDate().toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" }),
          słowa: cumulative,
        };
      });
  })();

  // Weakest words
  const weakestWords = allWords
    .filter((w) => w.totalAttempts > 0)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 10);

  const getHeatmapColor = (count: number) => {
    if (count === 0) return "#1C1C1F";
    if (count <= 5) return "#22C55E30";
    if (count <= 15) return "#22C55E60";
    if (count <= 25) return "#22C55E90";
    return "#22C55E";
  };

  const hasData = sessions.length > 0 || allWords.length > 0;

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="md:ml-64 pb-24 md:pb-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-heading text-text-primary mb-8"
          >
            Statystyki
          </motion.h1>

          {!hasData ? (
            <div className="glass-card p-8 text-center">
              <p className="text-4xl mb-4">📊</p>
              <h3 className="text-xl font-heading text-text-primary mb-2">
                Brak danych
              </h3>
              <p className="text-sm text-text-secondary font-body">
                Statystyki pojawią się po pierwszej sesji nauki.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Activity Heatmap */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4 sm:p-6"
              >
                <h3 className="text-sm font-body text-text-secondary mb-4">
                  Aktywność (90 dni)
                </h3>
                <div className="flex flex-wrap gap-[3px]">
                  {heatmapData.map((day) => (
                    <div
                      key={day.date}
                      className="w-3 h-3 rounded-[2px] transition-colors"
                      style={{ backgroundColor: getHeatmapColor(day.count) }}
                      title={`${day.date}: ${day.count} słów`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-text-secondary">Mniej</span>
                  {[0, 5, 15, 25, 35].map((v) => (
                    <div
                      key={v}
                      className="w-3 h-3 rounded-[2px]"
                      style={{ backgroundColor: getHeatmapColor(v) }}
                    />
                  ))}
                  <span className="text-xs text-text-secondary">Więcej</span>
                </div>
              </motion.div>

              {/* Charts grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mastered over time */}
                {masteredOverTime.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-card p-4 sm:p-6"
                  >
                    <h3 className="text-sm font-body text-text-secondary mb-4">
                      Słowa powtórzone
                    </h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={masteredOverTime}>
                        <defs>
                          <linearGradient id="colorMastered" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" tick={{ fill: "#A1A1AA", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#141416", border: "1px solid #27272A", borderRadius: 12, color: "#FAFAFA", fontSize: 12 }}
                        />
                        <Area type="monotone" dataKey="słowa" stroke="#22C55E" fill="url(#colorMastered)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </motion.div>
                )}

                {/* Domain breakdown */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="glass-card p-4 sm:p-6"
                >
                  <h3 className="text-sm font-body text-text-secondary mb-4">
                    Podział wg domeny
                  </h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={domainData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {domainData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#141416", border: "1px solid #27272A", borderRadius: 12, color: "#FAFAFA", fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {domainData.map((d) => (
                      <div key={d.name} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-xs text-text-secondary">{d.name} ({d.value})</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>

              {/* Accuracy trend */}
              {accuracyTrend.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="glass-card p-4 sm:p-6"
                >
                  <h3 className="text-sm font-body text-text-secondary mb-4">
                    Trend celności (ostatnie sesje)
                  </h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={accuracyTrend}>
                      <XAxis dataKey="sesja" tick={{ fill: "#A1A1AA", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: "#A1A1AA", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#141416", border: "1px solid #27272A", borderRadius: 12, color: "#FAFAFA", fontSize: 12 }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={((value: any) => [`${value}%`, "Celność"]) as any}
                      />
                      <Line type="monotone" dataKey="celność" stroke="#6366F1" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {/* Weakest words */}
              {weakestWords.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="glass-card p-4 sm:p-6"
                >
                  <h3 className="text-sm font-body text-text-secondary mb-4">
                    Najsłabsze słowa
                  </h3>
                  <div className="space-y-2">
                    {weakestWords.map((word) => (
                      <div
                        key={word.wordId}
                        className="flex items-center justify-between p-3 rounded-xl bg-bg/50 border border-border/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-base font-body font-medium text-text-primary">
                            {word.word}
                          </span>
                          <span className="text-sm text-text-secondary">
                            {word.translation}
                          </span>
                        </div>
                        <span
                          className="text-sm font-body font-bold"
                          style={{
                            color:
                              word.accuracy >= 0.8
                                ? "#22C55E"
                                : word.accuracy >= 0.5
                                ? "#F59E0B"
                                : "#EF4444",
                          }}
                        >
                          {Math.round(word.accuracy * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>

          {/* V3.1: Algorithm Intelligence Section */}
          {intelligence && (
            <div className="mt-8">
              <h2 className="text-lg font-heading text-text-primary mb-4">🧠 Jak działa algorytm</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Retention */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-4"
                >
                  <h3 className="text-xs font-heading text-text-secondary mb-2">📊 Retention</h3>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-text-secondary">1 dzień</span>
                    <span className="text-lg font-heading text-text-primary">
                      {Math.round(intelligence.retention1d * 100)}%
                      <span className={`text-xs ml-1 ${intelligence.retention1dTrend >= 0 ? 'text-success' : 'text-error'}`}>
                        {intelligence.retention1dTrend >= 0 ? '↑' : '↓'}{Math.abs(Math.round(intelligence.retention1dTrend * 100))}%
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-secondary">7 dni</span>
                    <span className="text-lg font-heading text-text-primary">
                      {Math.round(intelligence.retention7d * 100)}%
                      <span className={`text-xs ml-1 ${intelligence.retention7dTrend >= 0 ? 'text-success' : 'text-error'}`}>
                        {intelligence.retention7dTrend >= 0 ? '↑' : '↓'}{Math.abs(Math.round(intelligence.retention7dTrend * 100))}%
                      </span>
                    </span>
                  </div>
                </motion.div>

                {/* Enjoyment */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="glass-card p-4"
                >
                  <h3 className="text-xs font-heading text-text-secondary mb-2">😊 Przyjemność sesji</h3>
                  <div className="text-3xl font-heading text-accent">
                    {intelligence.enjoymentScore.toFixed(1)}
                    <span className="text-base text-text-secondary">/10</span>
                  </div>
                  <span className={`text-xs ${intelligence.enjoymentTrend >= 0 ? 'text-success' : 'text-error'}`}>
                    {intelligence.enjoymentTrend >= 0 ? '↑' : '↓'}{Math.abs(intelligence.enjoymentTrend).toFixed(1)} vs wcześniej
                  </span>
                </motion.div>

                {/* Strategy */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="glass-card p-4"
                >
                  <h3 className="text-xs font-heading text-text-secondary mb-2">🎯 Strategia trudności</h3>
                  <div className="text-lg font-heading text-accent capitalize">
                    {intelligence.bestStrategy}
                  </div>
                  <div className="text-xs text-text-secondary mt-1">
                    Retention: {Math.round(intelligence.bestStrategyRetention * 100)}%
                    ({intelligence.strategyTrials} prób)
                  </div>
                </motion.div>

                {/* Domains */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="glass-card p-4"
                >
                  <h3 className="text-xs font-heading text-text-secondary mb-2">💪 Silne/słabe obszary</h3>
                  <div className="text-sm">
                    <div className="flex justify-between">
                      <span className="text-success">✅ {intelligence.strongestDomain}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-error">⚠️ {intelligence.weakestDomain}</span>
                    </div>
                    {intelligence.productionGap > 0.1 && (
                      <div className="text-xs text-warning mt-2">
                        Luka produkcji: {Math.round(intelligence.productionGap * 100)}%
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Optimal time */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="glass-card p-4"
                >
                  <h3 className="text-xs font-heading text-text-secondary mb-2">⏰ Optymalna pora</h3>
                  {intelligence.optimalTimeOfDay !== null ? (
                    <div className="text-2xl font-heading text-accent">
                      {intelligence.optimalTimeOfDay}:00
                    </div>
                  ) : (
                    <div className="text-sm text-text-secondary">Za mało danych (min 7 sesji)</div>
                  )}
                  {intelligence.optimalSessionLength && (
                    <div className="text-xs text-text-secondary mt-1">
                      Optymalnie ~{Math.round(intelligence.optimalSessionLength)} słów/sesję
                    </div>
                  )}
                </motion.div>

                {/* Efficiency */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="glass-card p-4"
                >
                  <h3 className="text-xs font-heading text-text-secondary mb-2">⚡ Efektywność</h3>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Do mastery:</span>
                      <span className="text-text-primary font-medium">
                        ~{Math.round(intelligence.wordsToMastery)} powtórek
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Eskalacja:</span>
                      <span className="text-text-primary font-medium">
                        lvl {intelligence.escalationSpeed.toFixed(1)} avg
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Dane:</span>
                      <span className="text-text-primary font-medium">
                        {intelligence.dataPoints} odpowiedzi, {intelligence.weeksOfData} tyg.
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          )}
      </main>
    </div>
  );
}
