export interface Config {
  aiProvider: "openai" | "ollama";
  openai?: {
    apiKey: string;
    model: string;
  };
  ollama?: {
    host: string;
    model: string;
  };
  // other config options
}

// Default configuration
export const defaultConfig: Config = {
  aiProvider: "openai",
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: "gpt-3.5-turbo",
  },
  ollama: {
    host: "http://127.0.0.1:11434",
    model: "llama3.1",
  },
  // other default config options
};
