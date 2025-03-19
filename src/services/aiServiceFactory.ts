import { Config } from "../config.js";
import { OpenAIService } from "./openaiService.js";
import { OllamaService } from "./ollamaService.js";

export interface AIService {
  generateCommitMessage(diff: string): Promise<string>;
}

export function createAIService(config: Config): AIService {
  if (config.aiProvider === "ollama" && config.ollama) {
    return new OllamaService({
      host: config.ollama.host,
      model: config.ollama.model,
    });
  } else if (config.aiProvider === "openai" && config.openai) {
    return new OpenAIService({
      apiKey: config.openai.apiKey,
      model: config.openai.model,
    });
  } else {
    throw new Error("Invalid AI provider configuration");
  }
}
