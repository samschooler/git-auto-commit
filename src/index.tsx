#!/usr/bin/env node
import { render } from "ink";
import React from "react";
import App from "./components/App.js";
import { Command } from "commander";
import { Config, defaultConfig } from "./config.js";
import { createAIService } from "./services/aiServiceFactory.js";

let initialCommand: string | null = null;

// Set up the command line interface
const program = new Command();

program
  .version("1.0.5")
  .description("A CLI tool to automate git commit and push")
  .option(
    "-p, --provider <provider>",
    "AI provider to use (openai or ollama)",
    "openai"
  )
  .option("--openai-api-key <key>", "OpenAI API key")
  .option("--openai-model <model>", "OpenAI model to use", "gpt-3.5-turbo")
  .option("--ollama-host <host>", "Ollama host URL", "http://127.0.0.1:11434")
  .option("--ollama-model <model>", "Ollama model to use", "llama3.1");

// Add the commit command
program
  .command("commit")
  .description("Commit changes to the local git repository")
  .action(() => {
    // This will be handled in the React app
    initialCommand = "commit";
  });

// Parse arguments
program.parse(process.argv);

// If no command was matched and no arguments provided, show help
if (!program.args.length) {
  program.help();
}

const options = program.opts();
initialCommand = program.args[0] || null;

// Create configuration
const config: Config = {
  ...defaultConfig,
  aiProvider: options.provider as "openai" | "ollama",
  openai: {
    ...defaultConfig.openai,
    apiKey: options.openaiApiKey || defaultConfig.openai?.apiKey || "",
    model: options.openaiModel || defaultConfig.openai?.model || "",
  },
  ollama: {
    ...defaultConfig.ollama,
    host: options.ollamaHost || defaultConfig.ollama?.host || "",
    model: options.ollamaModel || defaultConfig.ollama?.model || "",
  },
};

// Create the appropriate AI service
const aiService = createAIService(config);

// Pass the aiService, config, and initialCommand to the App component
render(
  <App aiService={aiService} config={config} initialCommand={initialCommand} />
);
