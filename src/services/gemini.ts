import { GoogleGenAI } from "@google/genai";
import { BioSynthError, BioSynthErrorType } from "../lib/error-handler";

const apiKey = process.env.GEMINI_API_KEY;

export const getGeminiModel = (modelName: string) => {
  if (!apiKey) {
    throw new BioSynthError(
      BioSynthErrorType.API_KEY_MISSING,
      "GEMINI_API_KEY is not configured in the environment."
    );
  }
  const genAI = new GoogleGenAI({ apiKey });
  return genAI;
};

export const MODELS = {
  FLASH: "gemini-3-flash-preview",
  PRO: "gemini-3.1-pro-preview",
  LITE: "gemini-flash-lite-latest",
  FLASH_2_5: "gemini-2.5-flash",
};
