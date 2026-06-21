"use client";

import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import { getApps } from "firebase/app";

export function getGeminiModel() {
  const app = getApps()[0];
  if (!app) throw new Error("Firebase not initialized");

  const ai = getAI(app, { backend: new GoogleAIBackend() });
  return getGenerativeModel(ai, { model: "gemini-2.5-flash" });
}
