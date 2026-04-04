"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getAllWordProgress, setWordProgress, createWordProgressFromSeed } from "@/lib/firebase";
import { WordProgress, Domain, WordState, DOMAIN_CONFIG, MASTERY_LABELS, OVERALL_MASTERY_LABELS, SeedWord } from "@/lib/types";
import Navbar from "@/components/layout/Navbar";
import DomainTag from "@/components/ui/DomainTag";
import Button from "@/components/ui/Button";

export default function WordsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [words, setWords] = useState<WordProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<Domain | null>(null);
  const [stateFilter, setStateFilter] = useState<WordState | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [expandedWord, setExpandedWord] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [leechFilter, setLeechFilter] = useState(false);

  // Add word form
  const [newWord, setNewWord] = useState("");
  const [newTranslation, setNewTranslation] = useState("");
  const [newDomain, setNewDomain] = useState<Domain>("smalltalk");
  const [newLevel, setNewLevel] = useState<"B1" | "B2" | "C1">("B1");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const allWords = await getAllWordProgress(user.uid);
        setWords(allWords);
      } catch (err) {
        console.error("Failed to load words:", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user]);

  const filteredWords = useMemo(() => {
    return words.filter((word) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !word.word.toLowerCase().includes(q) &&
          !word.translation.toLowerCase().includes(q)
        )
          return false;
      }
      if (domainFilter && word.domain !== domainFilter) return false;
      if (stateFilter && word.state !== stateFilter) return false;
      if (levelFilter && word.level !== levelFilter) return false;
      if (leechFilter && !word.isLeech) return false;
      return true;
    });
  }, [words, searchQuery, domainFilter, stateFilter, levelFilter, leechFilter]);

  const handleAddWord = async () => {
    if (!user || !newWord.trim() || !newTranslation.trim()) return;

    const seedWord: SeedWord = {
      word: newWord.trim(),
      translation: newTranslation.trim(),
      partOfSpeech: "noun",
      level: newLevel,
      frequency: 5,
      tags: [],
    };

    const wp = createWordProgressFromSeed(seedWord, newDomain);
    wp.source = "manual";

    try {
      await setWordProgress(user.uid, wp);
      setWords((prev) => [wp, ...prev]);
      setShowAddModal(false);
      setNewWord("");
      setNewTranslation("");
    } catch (err) {
      console.error("Failed to add word:", err);
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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-6"
          >
            <h1 className="text-3xl font-heading text-text-primary">Słowa</h1>
            <span className="text-sm text-text-secondary font-body">
              {filteredWords.length} / {words.length}
            </span>
          </motion.div>

          {/* Search */}
          <div className="relative mb-4">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj po angielsku lub polsku..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-bg-surface border border-border text-text-primary font-body
                placeholder:text-text-secondary/50 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-hide">
            {/* Domain filters */}
            {(Object.keys(DOMAIN_CONFIG) as Domain[]).map((domain) => (
              <button
                key={domain}
                onClick={() =>
                  setDomainFilter(domainFilter === domain ? null : domain)
                }
                className={`px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all border ${
                  domainFilter === domain
                    ? "opacity-100"
                    : "opacity-50 hover:opacity-75"
                }`}
                style={{
                  backgroundColor: `${DOMAIN_CONFIG[domain].color}20`,
                  color: DOMAIN_CONFIG[domain].color,
                  borderColor: `${DOMAIN_CONFIG[domain].color}40`,
                }}
              >
                {DOMAIN_CONFIG[domain].labelPL}
              </button>
            ))}

            <span className="w-px h-6 bg-border self-center mx-1 flex-shrink-0" />

            {/* State filters */}
            {(Object.keys(MASTERY_LABELS) as WordState[]).map((state) => (
              <button
                key={state}
                onClick={() =>
                  setStateFilter(stateFilter === state ? null : state)
                }
                className={`px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all border ${
                  stateFilter === state
                    ? "opacity-100"
                    : "opacity-50 hover:opacity-75"
                }`}
                style={{
                  backgroundColor: `${MASTERY_LABELS[state].color}20`,
                  color: MASTERY_LABELS[state].color,
                  borderColor: `${MASTERY_LABELS[state].color}40`,
                }}
              >
                {MASTERY_LABELS[state].label}
              </button>
            ))}

            <span className="w-px h-6 bg-border self-center mx-1 flex-shrink-0" />

            {/* Level filters */}
            {["B1", "B2", "C1"].map((level) => (
              <button
                key={level}
                onClick={() =>
                  setLevelFilter(levelFilter === level ? null : level)
                }
                className={`px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all border ${
                  levelFilter === level
                    ? "bg-accent-muted text-accent border-accent/40"
                    : "bg-bg-surface text-text-secondary border-border hover:text-text-primary"
                }`}
              >
                {level}
              </button>
            ))}

            <span className="w-px h-6 bg-border self-center mx-1 flex-shrink-0" />

            {/* Leech filter */}
            <button
              onClick={() => setLeechFilter(!leechFilter)}
              className={`px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all border ${
                leechFilter
                  ? "bg-error/20 text-error border-error/40"
                  : "bg-bg-surface text-text-secondary border-border hover:text-text-primary opacity-50 hover:opacity-75"
              }`}
            >
              🔴 Pijawki
            </button>
          </div>

          {/* Word list */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="glass-card p-4 animate-pulse">
                  <div className="h-4 bg-bg-surface-hover rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : filteredWords.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <p className="text-4xl mb-4">🔍</p>
              <p className="text-text-secondary font-body">
                {words.length === 0
                  ? "Brak słów. Rozpocznij sesję lub dodaj własne słowo."
                  : "Brak wyników dla podanych filtrów."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredWords.map((word) => (
                <motion.div
                  key={word.wordId}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <button
                    onClick={() =>
                      setExpandedWord(
                        expandedWord === word.wordId ? null : word.wordId
                      )
                    }
                    className="w-full text-left glass-card-hover p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-base font-body font-medium text-text-primary truncate">
                          {word.word}
                        </span>
                        <span className="text-sm text-text-secondary truncate hidden sm:inline">
                          {word.translation}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <DomainTag domain={word.domain} />
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-body"
                          style={{
                            backgroundColor: `${MASTERY_LABELS[word.state].color}20`,
                            color: MASTERY_LABELS[word.state].color,
                          }}
                        >
                          {MASTERY_LABELS[word.state].label}
                        </span>
                        {word.totalAttempts > 0 && (
                          <span
                            className="text-xs font-body font-bold"
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
                        )}
                        {/* V2: Leech badge */}
                        {word.isLeech && (
                          <span className="text-xs" title="Pijawka">
                            🔴
                          </span>
                        )}
                        {/* V2: Exercise level */}
                        {word.exerciseLevel > 1 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent font-mono">
                            L{word.exerciseLevel}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {expandedWord === word.wordId && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-2 space-y-3 border-t border-border/30 mt-1">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-text-secondary">Tłumaczenie</p>
                              <p className="text-sm text-text-primary font-body">{word.translation}</p>
                            </div>
                            <div>
                              <p className="text-xs text-text-secondary">Część mowy</p>
                              <p className="text-sm text-text-primary font-mono">{word.partOfSpeech}</p>
                            </div>
                            <div>
                              <p className="text-xs text-text-secondary">Poziom</p>
                              <p className="text-sm text-text-primary font-body">{word.level}</p>
                            </div>
                            <div>
                              <p className="text-xs text-text-secondary">Próby</p>
                              <p className="text-sm text-text-primary font-body">
                                {word.correctAttempts}/{word.totalAttempts}
                              </p>
                            </div>
                          </div>

                          {/* V2: Dual-track progress bars */}
                          {word.tracks && (
                            <div className="space-y-2 mt-2">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-text-secondary">EN → PL (rozpoznawanie)</span>
                                  <span className="text-xs text-blue-400 font-mono">
                                    {Math.round(word.tracks.recognition.accuracy * 100)}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-blue-400 transition-all"
                                    style={{ width: `${word.tracks.recognition.accuracy * 100}%` }}
                                  />
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-text-secondary">PL → EN (produkcja)</span>
                                  <span className="text-xs text-purple-400 font-mono">
                                    {Math.round(word.tracks.production.accuracy * 100)}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-purple-400 transition-all"
                                    style={{ width: `${word.tracks.production.accuracy * 100}%` }}
                                  />
                                </div>
                              </div>
                              {/* Overall mastery badge */}
                              {word.overallMastery && (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-text-secondary">Opanowanie:</span>
                                  <span
                                    className="text-xs px-2 py-0.5 rounded-full font-body"
                                    style={{
                                      backgroundColor: `${OVERALL_MASTERY_LABELS[word.overallMastery].color}20`,
                                      color: OVERALL_MASTERY_LABELS[word.overallMastery].color,
                                    }}
                                  >
                                    {OVERALL_MASTERY_LABELS[word.overallMastery].label}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {word.exampleSentences.length > 0 && (
                            <div>
                              <p className="text-xs text-text-secondary mb-1">Przykłady:</p>
                              {word.exampleSentences.map((ex, i) => (
                                <p key={i} className="text-sm text-text-primary font-body italic">
                                  &ldquo;{ex}&rdquo;
                                </p>
                              ))}
                            </div>
                          )}
                          {word.mnemonic && (
                            <div>
                              <p className="text-xs text-text-secondary mb-1">Mnemotechnika:</p>
                              <p className="text-sm text-accent font-body">{word.mnemonic}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Floating add button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-24 md:bottom-8 right-6 w-14 h-14 rounded-full bg-accent hover:bg-accent-hover text-white shadow-xl shadow-accent/30 flex items-center justify-center z-40 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </motion.button>

      {/* Add word modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-md"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md glass-card p-6"
            >
              <h3 className="text-xl font-heading text-text-primary mb-4">
                Dodaj nowe słowo
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-text-secondary font-body block mb-1">
                    Słowo (EN)
                  </label>
                  <input
                    type="text"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    placeholder="np. contribute"
                    className="w-full px-4 py-2.5 rounded-xl bg-bg-surface border border-border text-text-primary font-body
                      placeholder:text-text-secondary/50 focus:outline-none focus:border-accent transition-all"
                  />
                </div>

                <div>
                  <label className="text-sm text-text-secondary font-body block mb-1">
                    Tłumaczenie (PL)
                  </label>
                  <input
                    type="text"
                    value={newTranslation}
                    onChange={(e) => setNewTranslation(e.target.value)}
                    placeholder="np. przyczyniać się"
                    className="w-full px-4 py-2.5 rounded-xl bg-bg-surface border border-border text-text-primary font-body
                      placeholder:text-text-secondary/50 focus:outline-none focus:border-accent transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-text-secondary font-body block mb-1">
                      Domena
                    </label>
                    <select
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value as Domain)}
                      className="w-full px-4 py-2.5 rounded-xl bg-bg-surface border border-border text-text-primary font-body
                        focus:outline-none focus:border-accent transition-all"
                    >
                      {(Object.keys(DOMAIN_CONFIG) as Domain[]).map((d) => (
                        <option key={d} value={d}>
                          {DOMAIN_CONFIG[d].labelPL}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-text-secondary font-body block mb-1">
                      Poziom
                    </label>
                    <select
                      value={newLevel}
                      onChange={(e) =>
                        setNewLevel(e.target.value as "B1" | "B2" | "C1")
                      }
                      className="w-full px-4 py-2.5 rounded-xl bg-bg-surface border border-border text-text-primary font-body
                        focus:outline-none focus:border-accent transition-all"
                    >
                      <option value="B1">B1</option>
                      <option value="B2">B2</option>
                      <option value="C1">C1</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1"
                >
                  Anuluj
                </Button>
                <Button
                  onClick={handleAddWord}
                  disabled={!newWord.trim() || !newTranslation.trim()}
                  className="flex-1"
                >
                  Dodaj
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
