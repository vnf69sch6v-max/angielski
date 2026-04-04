"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { updateUserProfile, resetAllProgress, getAllWordProgress } from "@/lib/firebase";
import { Domain, DOMAIN_CONFIG, UserSettings, DEFAULT_SETTINGS } from "@/lib/types";
import Navbar from "@/components/layout/Navbar";
import Button from "@/components/ui/Button";

export default function SettingsPage() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (profile?.settings) {
      setSettings(profile.settings);
    }
  }, [profile]);

  const handleWeightChange = (domain: Domain, value: number) => {
    const newWeights = { ...settings.domainWeights, [domain]: value / 100 };
    // Normalize to sum to 1
    const sum = Object.values(newWeights).reduce((a, b) => a + b, 0);
    const normalized = Object.fromEntries(
      Object.entries(newWeights).map(([k, v]) => [k, v / sum])
    ) as Record<Domain, number>;

    setSettings((prev) => ({ ...prev, domainWeights: normalized }));
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateUserProfile(user.uid, {
        settings,
      } as Partial<import("@/lib/types").UserProfile>);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!user) return;
    try {
      await resetAllProgress(user.uid);
      setShowResetConfirm(false);
      router.push("/");
    } catch (err) {
      console.error("Failed to reset progress:", err);
    }
  };

  const handleExport = async () => {
    if (!user) return;
    try {
      const words = await getAllWordProgress(user.uid);
      const data = JSON.stringify({ profile, settings, words }, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fluentflow-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
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

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="md:ml-64 pb-24 md:pb-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-heading text-text-primary mb-8"
          >
            Ustawienia
          </motion.h1>

          <div className="space-y-6">
            {/* Domain weights */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6"
            >
              <h3 className="text-lg font-heading text-text-primary mb-1">
                Wagi domen
              </h3>
              <p className="text-sm text-text-secondary font-body mb-5">
                Ustaw jak często chcesz ćwiczyć słowa z danej domeny
              </p>

              <div className="space-y-4">
                {(Object.keys(DOMAIN_CONFIG) as Domain[]).map((domain) => (
                  <div key={domain}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: DOMAIN_CONFIG[domain].color }}
                        />
                        <span className="text-sm font-body text-text-primary">
                          {DOMAIN_CONFIG[domain].labelPL}
                        </span>
                      </div>
                      <span className="text-sm font-body font-medium text-text-secondary">
                        {Math.round((settings.domainWeights[domain] || 0.25) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={60}
                      value={Math.round(
                        (settings.domainWeights[domain] || 0.25) * 100
                      )}
                      onChange={(e) =>
                        handleWeightChange(domain, parseInt(e.target.value))
                      }
                      className="w-full h-2 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, ${DOMAIN_CONFIG[domain].color} 0%, ${DOMAIN_CONFIG[domain].color} ${
                          (settings.domainWeights[domain] || 0.25) * 100
                        }%, #27272A ${
                          (settings.domainWeights[domain] || 0.25) * 100
                        }%, #27272A 100%)`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Daily goal */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6"
            >
              <h3 className="text-lg font-heading text-text-primary mb-1">
                Dzienny cel
              </h3>
              <p className="text-sm text-text-secondary font-body mb-5">
                Ile nowych słów chcesz uczyć się dziennie
              </p>

              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={settings.dailyGoal}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      dailyGoal: parseInt(e.target.value),
                    }))
                  }
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #6366F1 0%, #6366F1 ${
                      ((settings.dailyGoal - 3) / 7) * 100
                    }%, #27272A ${
                      ((settings.dailyGoal - 3) / 7) * 100
                    }%, #27272A 100%)`,
                  }}
                />
                <span className="text-2xl font-body font-bold text-accent w-10 text-center">
                  {settings.dailyGoal}
                </span>
              </div>
            </motion.div>

            {/* V2: TTS Voice */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card p-6"
            >
              <h3 className="text-lg font-heading text-text-primary mb-1">
                Głos TTS
              </h3>
              <p className="text-sm text-text-secondary font-body mb-4">
                Wybierz akcent dla wymowy słów
              </p>
              <div className="flex gap-3">
                {(["en-US", "en-GB"] as const).map((voice) => (
                  <button
                    key={voice}
                    onClick={() =>
                      setSettings((prev) => ({ ...prev, ttsVoice: voice }))
                    }
                    className={`flex-1 py-3 rounded-xl font-body text-sm font-medium transition-all border ${
                      (settings.ttsVoice || "en-US") === voice
                        ? "bg-accent/15 text-accent border-accent/40"
                        : "bg-bg-surface text-text-secondary border-border hover:text-text-primary"
                    }`}
                  >
                    {voice === "en-US" ? "🇺🇸 Amerykański" : "🇬🇧 Brytyjski"}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* V2: Fatigue Sensitivity */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="glass-card p-6"
            >
              <h3 className="text-lg font-heading text-text-primary mb-1">
                Wykrywanie zmęczenia
              </h3>
              <p className="text-sm text-text-secondary font-body mb-4">
                Jak szybko system powinien wykrywać spadek efektywności
              </p>
              <div className="flex gap-3">
                {(["low", "medium", "high"] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() =>
                      setSettings((prev) => ({ ...prev, fatigueSensitivity: level }))
                    }
                    className={`flex-1 py-3 rounded-xl font-body text-sm font-medium transition-all border ${
                      (settings.fatigueSensitivity || "medium") === level
                        ? "bg-accent/15 text-accent border-accent/40"
                        : "bg-bg-surface text-text-secondary border-border hover:text-text-primary"
                    }`}
                  >
                    {level === "low" ? "Niska" : level === "medium" ? "Średnia" : "Wysoka"}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* V2: Daily New Word Cap */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-6"
            >
              <h3 className="text-lg font-heading text-text-primary mb-1">
                Dzienny limit nowych słów
              </h3>
              <p className="text-sm text-text-secondary font-body mb-5">
                Maksymalna liczba nowych słów w jednym dniu
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={10}
                  max={50}
                  step={5}
                  value={settings.dailyNewWordCap || 50}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      dailyNewWordCap: parseInt(e.target.value),
                    }))
                  }
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #6366F1 0%, #6366F1 ${
                      ((( settings.dailyNewWordCap || 50) - 10) / 40) * 100
                    }%, #27272A ${
                      (((settings.dailyNewWordCap || 50) - 10) / 40) * 100
                    }%, #27272A 100%)`,
                  }}
                />
                <span className="text-2xl font-body font-bold text-accent w-10 text-center">
                  {settings.dailyNewWordCap || 50}
                </span>
              </div>
            </motion.div>

            {/* Target retention */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card p-6"
            >
              <h3 className="text-lg font-heading text-text-primary mb-1">
                Docelowe zapamiętywanie
              </h3>
              <p className="text-sm text-text-secondary font-body">
                Algorytm FSRS dąży do 95% retencji. Wartość ta nie jest
                konfigurowalna w v1.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className="w-full h-2 rounded-full bg-bg-surface-hover overflow-hidden">
                  <div
                    className="h-full rounded-full bg-success"
                    style={{ width: "95%" }}
                  />
                </div>
                <span className="text-sm font-body font-bold text-success">
                  95%
                </span>
              </div>
            </motion.div>

            {/* Save button */}
            <Button onClick={handleSave} fullWidth disabled={isSaving}>
              {isSaving ? "Zapisuję..." : saved ? "✓ Zapisano!" : "Zapisz ustawienia"}
            </Button>

            {/* Account */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-6"
            >
              <h3 className="text-lg font-heading text-text-primary mb-4">
                Konto
              </h3>
              <div className="flex items-center gap-3 mb-4">
                {profile?.photoURL && (
                  <picture>
                    <img
                      src={profile.photoURL}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full border border-border"
                    />
                  </picture>
                )}
                <div>
                  <p className="text-sm font-body text-text-primary">
                    {profile?.displayName}
                  </p>
                  <p className="text-xs font-body text-text-secondary">
                    {profile?.email}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={signOut}
                fullWidth
              >
                Wyloguj się
              </Button>
            </motion.div>

            {/* Data management */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="glass-card p-6"
            >
              <h3 className="text-lg font-heading text-text-primary mb-4">
                Dane
              </h3>
              <div className="space-y-3">
                <Button
                  variant="secondary"
                  onClick={handleExport}
                  fullWidth
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                >
                  Eksportuj postępy (JSON)
                </Button>

                {!showResetConfirm ? (
                  <Button
                    variant="ghost"
                    onClick={() => setShowResetConfirm(true)}
                    fullWidth
                    className="!text-error hover:!bg-error-muted"
                  >
                    Resetuj wszystkie postępy
                  </Button>
                ) : (
                  <div className="p-4 rounded-xl bg-error-muted border border-error/30">
                    <p className="text-sm text-error font-body mb-3">
                      Czy na pewno chcesz usunąć wszystkie postępy? Tej operacji
                      nie można cofnąć.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setShowResetConfirm(false)}
                        className="flex-1"
                        size="sm"
                      >
                        Anuluj
                      </Button>
                      <Button
                        variant="error"
                        onClick={handleReset}
                        className="flex-1"
                        size="sm"
                      >
                        Tak, resetuj
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
