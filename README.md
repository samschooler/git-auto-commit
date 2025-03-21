# git-ai-tool

A CLI tool to automate git commit and push using a React Terminal interface.

## Features

- 🤖 **AI-Powered Commit Messages**: Generates semantic commit messages using OpenAI or Ollama
- 🖥️ **Interactive UI**: Beautiful terminal interface built with React Ink
- 🔍 **Smart Change Detection**: Automatically detects staged and unstaged changes
- 🔄 **Streamlined Workflow**: Guides you through the commit and push process
- 🔗 **PR Integration**: Provides pull request URLs after pushing
- 📊 **Operation Summary**: Shows a summary of all actions taken

## Installation

```bash
# Install globally
npm install -g git-ai-tool

# Set required environment variables for OpenAI
export OPENAI_API_KEY="your-openai-api-key"
export GITHUB_TOKEN="your-github-token" # Optional, for PR detection
```

## Usage

Navigate to any Git repository and run:

```bash
git-ai-tool commit
```

By default, the tool uses OpenAI. To use Ollama instead:

```bash
git-ai-tool commit --provider ollama
```

The interactive terminal UI will guide you through:

1. Reviewing staged and unstaged changes
2. Staging changes if needed
3. Generating and confirming a commit message
4. Pushing changes to remote
5. Providing a PR URL if applicable

## Command Line Options

```
Options:
  -V, --version                 output the version number
  -p, --provider <provider>     AI provider to use (openai or ollama) (default: "openai")
  --openai-api-key <key>        OpenAI API key
  --openai-model <model>        OpenAI model to use (default: "gpt-3.5-turbo")
  --ollama-host <host>          Ollama host URL (default: "http://127.0.0.1:11434")
  --ollama-model <model>        Ollama model to use (default: "llama3.1")
  -h, --help                    display help for command
```

## Requirements

- Node.js 16.0.0 or higher
- Git installed and configured
- OpenAI API key (if using OpenAI provider)
- Ollama running locally or remotely (if using Ollama provider)
- GitHub token (optional) for PR detection

## Environment Variables

| Variable         | Required   | Description                                        |
| ---------------- | ---------- | -------------------------------------------------- |
| `OPENAI_API_KEY` | For OpenAI | Your OpenAI API key for generating commit messages |
| `GITHUB_TOKEN`   | No         | GitHub token for detecting existing PRs            |

You can set these in your shell profile or use a tool like `direnv` to manage them per project.

## Using Ollama

To use Ollama instead of OpenAI:

1. Make sure you have [Ollama](https://ollama.ai/) installed and running
2. Run the tool with the `--provider ollama` flag
3. Optionally specify a different model with `--ollama-model <model>` (default is llama3.1)
4. Optionally specify a different host with `--ollama-host <host>` (default is http://127.0.0.1:11434)

Example:

```bash
git-ai-tool commit --provider ollama --ollama-model codellama
```

## Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/samschooler/git-ai-tool.git
cd git-ai-tool
npm install
```

Run in development mode:

```bash
npm run dev
```

Build the project:

```bash
npm run build
```

## How It Works

1. **Repository Check**: Verifies you're in a valid Git repository
2. **Change Detection**: Identifies staged and unstaged changes
3. **AI Generation**: Uses OpenAI or Ollama to create a semantic commit message
4. **Commit Process**: Commits changes with the generated message
5. **Push Handling**: Pushes to remote and checks for PR opportunities
6. **Summary**: Provides a summary of all actions taken

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Ink](https://github.com/vadimdemedes/ink) - React for CLIs
- [OpenAI](https://openai.com/) - AI-powered commit message generation
- [Ollama](https://ollama.ai/) - Local AI models
- [Commander.js](https://github.com/tj/commander.js/) - Command-line interface

---

Made with ❤️ by Sam
