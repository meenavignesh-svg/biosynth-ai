export enum BioSynthErrorType {
  API_KEY_MISSING = "API_KEY_MISSING",
  NETWORK_ERROR = "NETWORK_ERROR",
  SAFETY_FILTER = "SAFETY_FILTER",
  RATE_LIMIT = "RATE_LIMIT",
  LOCAL_AI_UNSUPPORTED = "LOCAL_AI_UNSUPPORTED",
  LOCAL_AI_INIT_FAILED = "LOCAL_AI_INIT_FAILED",
  UNKNOWN = "UNKNOWN"
}

export class BioSynthError extends Error {
  constructor(
    public type: BioSynthErrorType,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "BioSynthError";
  }
}

export const handleError = (error: any): BioSynthError => {
  console.error("[BioSynth Error Log]:", {
    timestamp: new Date().toISOString(),
    error: error,
    stack: error instanceof Error ? error.stack : undefined
  });

  if (error instanceof BioSynthError) return error;

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("GEMINI_API_KEY")) {
    return new BioSynthError(
      BioSynthErrorType.API_KEY_MISSING,
      "The Gemini API key is missing or invalid. Please check your environment configuration."
    );
  }

  if (message.includes("fetch") || message.includes("network")) {
    return new BioSynthError(
      BioSynthErrorType.NETWORK_ERROR,
      "Network connection failed. Please check your internet connection and try again."
    );
  }

  if (message.includes("safety") || message.includes("blocked")) {
    return new BioSynthError(
      BioSynthErrorType.SAFETY_FILTER,
      "The request was blocked by safety filters. Please refine your query."
    );
  }

  if (message.includes("429") || message.includes("quota")) {
    return new BioSynthError(
      BioSynthErrorType.RATE_LIMIT,
      "API rate limit exceeded. Please wait a moment before trying again."
    );
  }

  if (message.includes("WebGPU") || message.includes("not supported")) {
    return new BioSynthError(
      BioSynthErrorType.LOCAL_AI_UNSUPPORTED,
      "Local AI requires WebGPU support, which is not available in your current browser."
    );
  }

  return new BioSynthError(
    BioSynthErrorType.UNKNOWN,
    `An unexpected error occurred: ${message}`,
    error
  );
};
