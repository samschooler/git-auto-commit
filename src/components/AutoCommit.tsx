import React, { useState, useEffect, useCallback } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import axios from "axios";
import { execSync } from "child_process";
import chalk from "chalk";

// Helper function to execute shell commands
const execCommand = (command: string): string => {
  try {
    return execSync(command, { encoding: "utf-8" });
  } catch (error) {
    console.error(chalk.red(`❌ Error: ${(error as Error).message}`));
    process.exit(1);
  }
};

// Function to check if we are inside a Git repository
const isGitRepo = (): boolean => {
  try {
    execCommand("git rev-parse --is-inside-work-tree");
    return true;
  } catch {
    console.error(chalk.red("❌ Error: Not inside a Git repository."));
    process.exit(1);
  }
};

// Function to generate commit message using OpenAI API
const generateCommitMessage = async (
  gitStatus: string,
  gitDiff: string
): Promise<string> => {
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are an AI that writes clear, professional, and semantic Git commit messages following the conventional commit format. Only return the commit message, nothing else.",
        },
        {
          role: "user",
          content: `Generate a concise, semantic Git commit message using the conventional commit format (e.g., feat: add new feature, fix: resolve bug, refactor: improve code). The message should be professional, clear, and informative.

Git status:
${gitStatus}

Git diff:
${gitDiff}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 50,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.choices[0].message.content.trim();
};

// Function to commit changes
const commitChanges = (commitMessage: string): void => {
  execCommand(`git commit -m "${commitMessage}"`);
};

// Function to check if a PR exists or can be created
const checkPullRequestStatus = (
  repoUrl: string,
  branchName: string
): string | null => {
  try {
    // Check if there's an existing PR
    const remoteUrl = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!remoteUrl || remoteUrl.length < 3) return null;

    const [_, owner, repo] = remoteUrl;
    const prUrl = `${repoUrl}/pull/new/${branchName}`;

    // Check if there's an existing PR for this branch
    try {
      const existingPRs = execCommand(
        `curl -s -H "Authorization: token ${process.env.GITHUB_TOKEN}" https://api.github.com/repos/${owner}/${repo}/pulls?head=${owner}:${branchName}`
      );

      const prs = JSON.parse(existingPRs);
      if (prs && prs.length > 0) {
        return prs[0].html_url;
      }
    } catch (e) {
      // If we can't check for existing PRs, just return the new PR URL
    }

    return prUrl;
  } catch (e) {
    return null;
  }
};

interface AutoCommitProps {
  onStepComplete: (step: string, details?: string) => void;
  onFinish: () => void;
}

const AutoCommit: React.FC<AutoCommitProps> = ({
  onStepComplete,
  onFinish,
}) => {
  const [step, setStep] = useState<
    | "checking"
    | "stageChanges"
    | "generating"
    | "confirmCommit"
    | "confirmPush"
    | "pushing"
    | "complete"
    | "error"
  >("checking");
  const [unstagedChanges, setUnstagedChanges] = useState<string>("");
  const [stagedChanges, setStagedChanges] = useState<string>("");
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [branchName, setBranchName] = useState<string>("");
  const [diffStat, setDiffStat] = useState<string>("");
  const [repoUrl, setRepoUrl] = useState<string>("");
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialChecksDone, setInitialChecksDone] = useState<boolean>(false);

  // Use useCallback to memoize these functions to prevent infinite loops
  const reportStep = useCallback(
    (step: string, details?: string) => {
      onStepComplete(step, details);
    },
    [onStepComplete]
  );

  useEffect(() => {
    const runInitialChecks = async () => {
      if (initialChecksDone) return;

      try {
        // Check if we're in a git repo
        if (!isGitRepo()) {
          setError("Not inside a Git repository");
          setStep("error");
          return;
        }
        reportStep("Repository check", "Valid Git repository");

        // Check for unstaged and staged changes
        const status = execCommand("git status --porcelain");

        // Parse status to separate staged and unstaged changes
        const lines = status.split("\n").filter((line) => line.trim());
        const staged = lines
          .filter((line) => line[0] !== " " && line[0] !== "?")
          .map((line) => line.substring(3))
          .join("\n");

        const unstaged = lines
          .filter((line) => line[0] === " " || line[0] === "?")
          .map((line) => line.substring(3))
          .join("\n");

        setStagedChanges(staged);
        setUnstagedChanges(unstaged);

        if (staged) {
          reportStep(
            "Staged changes",
            `${
              staged.split("\n").filter((line) => line.trim()).length
            } files staged`
          );
        }

        if (unstaged) {
          reportStep(
            "Unstaged changes",
            `${
              unstaged.split("\n").filter((line) => line.trim()).length
            } files not staged`
          );
          setStep("stageChanges");
        } else if (staged) {
          // If we have staged changes but no unstaged changes, go directly to generating commit message
          setStep("generating");
          proceedWithCommit();
        } else {
          setError("No changes to commit");
          setStep("error");
        }

        // Get branch name for later use
        const branch = execCommand("git rev-parse --abbrev-ref HEAD").trim();
        setBranchName(branch);
        reportStep("Current branch", branch);

        // Get repo URL for later use
        const url = execCommand("git remote get-url origin")
          .trim()
          .replace(/git@github.com:/, "https://github.com/")
          .replace(/.git$/, "");
        setRepoUrl(url);

        setInitialChecksDone(true);
      } catch (err) {
        setError((err as Error).message);
        setStep("error");
      }
    };

    runInitialChecks();
  }, [reportStep, initialChecksDone]);

  const proceedWithCommit = async () => {
    const gitStatus = execCommand("git status --short");
    const gitDiff = execCommand("git diff --cached");

    if (!gitDiff) {
      setError("No changes to commit after staging");
      setStep("error");
      return;
    }

    try {
      const message = await generateCommitMessage(gitStatus, gitDiff);
      setCommitMessage(message);
      setStep("confirmCommit");
      reportStep("Generated commit message", message);
    } catch (err) {
      setError(`Failed to generate commit message: ${(err as Error).message}`);
      setStep("error");
    }
  };

  const handleStageChanges = async (stageAll: boolean) => {
    if (stageAll) {
      execCommand("git add -A");
      setStep("generating");
      reportStep("Staged changes", "All files staged");

      await proceedWithCommit();
    } else {
      setError("Commit aborted");
      setStep("error");
      reportStep("Staging aborted", "User chose not to stage changes");
    }
  };

  const handleCommit = (confirm: boolean) => {
    if (confirm) {
      commitChanges(commitMessage);
      reportStep("Committed changes", commitMessage);

      try {
        const remoteBranch = execCommand(
          `git ls-remote --heads origin ${branchName}`
        );
        if (remoteBranch) {
          const diff = execCommand(
            `git diff --shortstat origin/${branchName}...HEAD`
          );
          setDiffStat(diff);
          setStep("confirmPush");
        } else {
          setStep("complete");
          onFinish();
        }
      } catch (err) {
        // No remote branch, just complete
        setStep("complete");
        onFinish();
      }
    } else {
      setError("Commit aborted");
      setStep("error");
      reportStep("Commit aborted", "User chose not to commit");
    }
  };

  const handlePush = (confirm: boolean) => {
    if (confirm) {
      try {
        setStep("pushing");

        // Execute git push and capture any errors
        try {
          execCommand(`git push origin ${branchName}`);
          reportStep("Pushed changes", `Branch: ${branchName}`);

          // Check for PR URL
          const pullRequestUrl = checkPullRequestStatus(repoUrl, branchName);
          if (pullRequestUrl) {
            setPrUrl(pullRequestUrl);
            reportStep("Pull request", pullRequestUrl);
          }
        } catch (err) {
          const errorMessage = (err as Error).message;
          setError(`Failed to push: ${errorMessage}`);
          reportStep("Push failed", errorMessage);
          setStep("error");
          return;
        }

        setStep("complete");
        onFinish();
      } catch (err) {
        setError(`Failed to push: ${(err as Error).message}`);
        reportStep("Push failed", (err as Error).message);
        setStep("error");
      }
    } else {
      reportStep("Push skipped", "Changes committed but not pushed");
      setStep("complete");
      onFinish();
    }
  };

  // Render different UI based on current step
  switch (step) {
    case "checking":
      return (
        <Box>
          <Text>
            <Text color="blue">
              <Spinner type="dots" />
            </Text>{" "}
            Checking git repository...
          </Text>
        </Box>
      );

    case "stageChanges":
      return (
        <Box flexDirection="column">
          {stagedChanges && (
            <>
              <Text color="green">✓ Staged changes:</Text>
              <Box borderStyle="single" padding={1} marginY={1}>
                <Text>{stagedChanges}</Text>
              </Box>
            </>
          )}

          <Text color="yellow">⚠️ Unstaged changes detected:</Text>
          <Box borderStyle="single" padding={1} marginY={1}>
            <Text>{unstagedChanges}</Text>
          </Box>
          <Text>Do you want to stage all changes?</Text>
          <SelectInput
            items={[
              { label: "Yes", value: true },
              { label: "No", value: false },
            ]}
            onSelect={({ value }: { value: boolean }) =>
              handleStageChanges(value)
            }
          />
        </Box>
      );

    case "generating":
      return (
        <Box>
          <Text>
            <Text color="blue">
              <Spinner type="dots" />
            </Text>{" "}
            Generating commit message...
          </Text>
        </Box>
      );

    case "confirmCommit":
      return (
        <Box flexDirection="column">
          <Text>Commit with the following message?</Text>
          <Box borderStyle="single" padding={1} marginY={1}>
            <Text color="green">{commitMessage}</Text>
          </Box>
          <SelectInput
            items={[
              { label: "Yes", value: true },
              { label: "No", value: false },
            ]}
            onSelect={({ value }: { value: boolean }) => handleCommit(value)}
          />
        </Box>
      );

    case "confirmPush":
      return (
        <Box flexDirection="column">
          <Text>
            Branch: {branchName} | Changes: {diffStat}
          </Text>
          <Text>Remote: {`${repoUrl}/tree/${branchName}`}</Text>
          <Text>Do you want to push these changes to remote?</Text>
          <SelectInput
            items={[
              { label: "Yes", value: true },
              { label: "No", value: false },
            ]}
            onSelect={({ value }: { value: boolean }) => handlePush(value)}
          />
        </Box>
      );

    case "pushing":
      return (
        <Box>
          <Text>
            <Text color="blue">
              <Spinner type="dots" />
            </Text>{" "}
            Pushing changes to remote...
          </Text>
        </Box>
      );

    case "complete":
      return (
        <Box flexDirection="column">
          <Text color="green">✓ Operation completed successfully!</Text>
          {prUrl && (
            <Box marginTop={1}>
              <Text>Pull Request URL: </Text>
              <Text color="blue">{prUrl}</Text>
            </Box>
          )}
        </Box>
      );

    case "error":
      return (
        <Box>
          <Text color="red">❌ Error: {error}</Text>
        </Box>
      );

    default:
      return null;
  }
};

export default AutoCommit;
