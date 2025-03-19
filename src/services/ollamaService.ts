import axios from "axios";

interface OllamaConfig {
  host?: string;
  model: string;
}

export class OllamaService {
  private host: string;
  private model: string;

  constructor(config: OllamaConfig) {
    this.host = config.host || "http://127.0.0.1:11434";
    this.model = config.model || "llama3.1";
  }

  async generateCommitMessage(diff: string): Promise<string> {
    // First check if the model exists
    try {
      await this.checkModelExists();
    } catch (modelError) {
      // If model doesn't exist, provide a helpful error message
      const errorMessage =
        modelError instanceof Error ? modelError.message : String(modelError);
      return `Ollama service had an issue: ${errorMessage}`;
    }

    try {
      // Proceed with generating the commit message
      const response = await axios.post(
        `${this.host}/api/chat`,
        {
          model: this.model,
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that generates concise and descriptive git commit messages based on code diffs changed lines (+/-). Always start a line with conventional commits example: 'fix: issue with the login page' [fix, feat, chore, refactor, perf, test, style, ci, docs, build, revert]. If there are multiple unrelated changes, return a list of commit messages with new lines. The user will provide a diff. Return the commit message only, no other text.",
            },
            {
              role: "user",
              content: `\n\n${diff}`,
            },
          ],
          stream: false,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.message.content.trim();
    } catch (error) {
      // Handle axios errors
      let errorMessage = "Failed to generate commit message";

      if (axios.isAxiosError(error)) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          const errorData = error.response.data;
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } else if (error.request) {
          // The request was made but no response was received
          errorMessage = "Server not responding. Is Ollama running?";
        } else {
          // Something happened in setting up the request
          errorMessage = error.message;
        }
      }

      // For non-axios errors or if we couldn't extract a specific error message
      console.error("Error generating commit message with Ollama:", error);
      return `Ollama service had an issue: ${errorMessage}`;
    }
  }

  // Helper method to check if the model exists
  private async checkModelExists(): Promise<void> {
    try {
      const response = await axios.get(`${this.host}/api/tags`);

      // Check if our model is in the list of available models
      const models = response.data.models || [];

      // Check if the model exists, accounting for tags like ":latest"
      const modelExists = models.some((model: any) => {
        // Check if the model name matches exactly or starts with our model name followed by ":"
        return (
          model.name === this.model ||
          model.name.startsWith(`${this.model}:`) ||
          // Also check the model field which might not include the tag
          model.model === this.model ||
          model.model?.startsWith(`${this.model}:`)
        );
      });

      if (!modelExists) {
        throw new Error(
          `Model "${this.model}" not found. Please pull it first with: ollama pull ${this.model}`
        );
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(
            `Failed to check models: ${
              error.response.data.error || error.message
            }`
          );
        } else if (error.request) {
          throw new Error("Server not responding. Is Ollama running?");
        } else {
          throw new Error(`Request error: ${error.message}`);
        }
      }
      throw error;
    }
  }
}
