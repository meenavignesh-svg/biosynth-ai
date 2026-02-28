import * as webllm from "@mlc-ai/web-llm";
import { BioSynthError, BioSynthErrorType } from "../lib/error-handler";

export class LocalAIService {
  private engine: webllm.MLCEngine | null = null;
  private selectedModel = "Llama-3-8B-Instruct-q4f32_1-MLC";

  async init(onProgress: (report: webllm.InitProgressReport) => void) {
    if (this.engine) return;
    
    try {
      this.engine = await webllm.CreateMLCEngine(this.selectedModel, {
        initProgressCallback: onProgress,
      });
    } catch (error) {
      throw new BioSynthError(
        BioSynthErrorType.LOCAL_AI_INIT_FAILED,
        "Failed to initialize Local AI. Ensure your browser supports WebGPU.",
        error
      );
    }
  }

  async generate(prompt: string, onUpdate?: (text: string) => void) {
    if (!this.engine) {
      throw new BioSynthError(
        BioSynthErrorType.LOCAL_AI_INIT_FAILED,
        "Local AI not initialized. Please load the model first."
      );
    }

    try {
      const chunks = await this.engine.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        stream: true,
      });

      let fullText = "";
      for await (const chunk of chunks) {
        const content = chunk.choices[0]?.delta?.content || "";
        fullText += content;
        if (onUpdate) onUpdate(fullText);
      }
      return fullText;
    } catch (error) {
      throw new BioSynthError(
        BioSynthErrorType.UNKNOWN,
        "Local AI generation failed.",
        error
      );
    }
  }

  isLoaded() {
    return !!this.engine;
  }
}

export const localAI = new LocalAIService();
