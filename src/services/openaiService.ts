import axios from "axios";

interface OpenAIConfig {
  apiKey: string;
  model: string;
}

export class OpenAIService {
  private apiKey: string;
  private model: string;

  constructor(config: OpenAIConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || "gpt-3.5-turbo";
  }

  async generateCommitMessage(diff: string): Promise<string> {
    // Check if API key is provided
    if (!this.apiKey || this.apiKey.trim() === "") {
      return "OpenAI service had an issue: API key is missing. Please provide an API key with --openai-api-key";
    }

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
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
              content: `${diff}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 100,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      // Handle axios errors
      let errorMessage = "Failed to generate commit message";

      if (axios.isAxiosError(error)) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          const status = error.response.status;

          if (status === 401) {
            errorMessage = "Invalid API key or unauthorized access";
          } else if (status === 429) {
            errorMessage = "Rate limit exceeded. Please try again later";
          } else if (error.response.data && error.response.data.error) {
            errorMessage =
              error.response.data.error.message || error.response.data.error;
          }
        } else if (error.request) {
          // The request was made but no response was received
          errorMessage =
            "OpenAI server not responding. Please check your internet connection";
        } else {
          // Something happened in setting up the request
          errorMessage = error.message;
        }
      }

      console.error("Error generating commit message with OpenAI:", error);
      return `OpenAI service had an issue: ${errorMessage}`;
    }
  }
}
