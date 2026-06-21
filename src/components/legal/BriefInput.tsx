"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BriefInputProps {
  value: string;
  onChange: (text: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  disabled?: boolean;
}

export default function BriefInput({
  value,
  onChange,
  onAnalyze,
  isAnalyzing,
  disabled = false,
}: BriefInputProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const scrollHeight = Math.max(200, Math.min(500, textarea.scrollHeight));
    textarea.style.height = `${scrollHeight}px`;
  }, [value]);

  const readFileAsText = useCallback(
    async (file: File) => {
      setFileError(null);

      const extension = file.name.split(".").pop()?.toLowerCase();

      if (!["pdf", "docx", "txt"].includes(extension || "")) {
        setFileError("Nieobsługiwany format pliku. Użyj PDF, DOCX lub TXT.");
        return;
      }

      try {
        if (extension === "txt") {
          const text = await file.text();
          onChange(text);
        } else if (extension === "pdf") {
          // Basic PDF text extraction – reads raw text from the file
          const text = await file.text();
          // Attempt to extract readable text fragments from PDF binary
          const extracted = text
            .replace(/[^\x20-\x7E\u00C0-\u024F\u0100-\u017F\n\r\t ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, " ")
            .replace(/\s{3,}/g, "\n")
            .trim();
          if (extracted.length < 50) {
            setFileError(
              "Nie udało się wyodrębnić tekstu z PDF. Spróbuj wkleić tekst ręcznie."
            );
            return;
          }
          onChange(extracted);
        } else if (extension === "docx") {
          // Basic DOCX text extraction – reads XML content from the zip
          const text = await file.text();
          const extracted = text
            .replace(/<[^>]+>/g, " ")
            .replace(/[^\x20-\x7E\u00C0-\u024F\u0100-\u017F\n\r\t ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, " ")
            .replace(/\s{3,}/g, "\n")
            .trim();
          if (extracted.length < 50) {
            setFileError(
              "Nie udało się wyodrębnić tekstu z DOCX. Spróbuj wkleić tekst ręcznie."
            );
            return;
          }
          onChange(extracted);
        }
      } catch {
        setFileError("Wystąpił błąd podczas odczytu pliku.");
      }
    },
    [onChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files?.[0];
      if (file) readFileAsText(file);
    },
    [readFileAsText]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) readFileAsText(file);
      // Reset so the same file can be selected again
      e.target.value = "";
    },
    [readFileAsText]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-bg-surface border border-border rounded-2xl backdrop-blur p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl text-text-primary">
          Pismo procesowe
        </h2>
        <span className="text-xs text-text-secondary font-mono">
          {value.length.toLocaleString("pl-PL")} znaków
        </span>
      </div>

      {/* Textarea + Drag zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-xl border-2 transition-colors duration-200 ${
          isDragOver
            ? "border-accent bg-accent-muted"
            : "border-border bg-bg/50"
        }`}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || isAnalyzing}
          placeholder="Wklej tutaj treść pisma procesowego, pozwu, odpowiedzi na pozew lub innego dokumentu prawnego...

Możesz również przeciągnąć i upuścić plik PDF, DOCX lub TXT."
          className="w-full bg-transparent text-text-primary font-body text-sm leading-relaxed
            placeholder:text-text-secondary/50 resize-none p-4 outline-none
            disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: 200, maxHeight: 500 }}
        />

        {/* Drag overlay */}
        <AnimatePresence>
          {isDragOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center rounded-xl
                bg-accent-muted backdrop-blur-sm z-10"
            >
              <div className="flex flex-col items-center gap-2">
                <svg
                  className="w-10 h-10 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3.75 3.75 0 013.572 5.326A4.5 4.5 0 0118 19.5H6.75z"
                  />
                </svg>
                <span className="text-accent font-body font-medium text-sm">
                  Upuść plik tutaj
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* File error */}
      <AnimatePresence>
        {fileError && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-error text-xs font-body mt-2"
          >
            {fileError}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 gap-3">
        {/* Left: file input */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border
              text-text-secondary text-sm font-body
              hover:bg-bg-surface-hover hover:text-text-primary
              transition-colors duration-200
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
              />
            </svg>
            Załącz plik
          </button>
        </div>

        {/* Right: clear + analyze */}
        <div className="flex items-center gap-3">
          {value.length > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              type="button"
              onClick={() => {
                onChange("");
                setFileError(null);
              }}
              disabled={disabled || isAnalyzing}
              className="px-4 py-2 rounded-lg border border-border
                text-text-secondary text-sm font-body
                hover:bg-bg-surface-hover hover:text-text-primary
                transition-colors duration-200
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Wyczyść
            </motion.button>
          )}

          <button
            type="button"
            onClick={onAnalyze}
            disabled={disabled || isAnalyzing || value.trim().length === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg
              bg-accent text-white text-sm font-body font-medium
              hover:bg-accent-hover
              transition-colors duration-200
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Analizuję...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                Analizuj wyroki
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
