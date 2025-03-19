import React, { useState, useEffect, useCallback } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import SelectInput from "ink-select-input";
import { execSync } from "child_process";
import chalk from "chalk";
import { AIService } from "../services/aiServiceFactory.js";

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

// Function to generate commit message using AI service
const generateCommitMessage = async (
  aiService: AIService,
  gitStatus: string,
  gitDiff: string
): Promise<string> => {
  const diff = `Git status:\n${gitStatus}\n\nGit diff:\n${gitDiff}`;
  const message = await aiService.generateCommitMessage(diff);

  // Check if the message indicates an error from either service
  if (
    message.startsWith("Ollama service had an issue:") ||
    message.startsWith("OpenAI service had an issue:")
  ) {
    // Extract the actual error message
    const errorMessage = message
      .replace(/^(Ollama|OpenAI) service had an issue:/, "")
      .trim();
    throw new Error(errorMessage);
  }

  return message;
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
  aiService: AIService;
  onStepComplete: (step: string, details?: string) => void;
  onFinish: () => void;
}

const AutoCommit: React.FC<AutoCommitProps> = ({
  aiService,
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
  const [gitStatus, setGitStatus] = useState<string>("");
  const [gitDiff, setGitDiff] = useState<string>("");

  // Use useCallback to memoize these functions to prevent infinite loops
  const reportStep = useCallback(
    (step: string, details?: string) => {
      onStepComplete(step, details);
    },
    [onStepComplete]
  );

  // Function to run initial checks and set up the component state
  const runInitialChecks = useCallback(async () => {
    try {
      // Check if we're in a git repository
      if (!isGitRepo()) {
        setStep("error");
        setError("Not inside a Git repository.");
        return;
      }

      // Get git status
      const gitStatus = execCommand("git status --porcelain");

      // If there are no changes, show an error
      if (!gitStatus.trim()) {
        setStep("error");
        setError("No changes to commit.");
        return;
      }

      // Parse the status to identify staged and unstaged changes
      const lines = gitStatus.trim().split("\n");
      const stagedChanges: string[] = [];
      const unstagedChanges: string[] = [];

      lines.forEach((line) => {
        const status = line.substring(0, 2);
        const file = line.substring(3);

        // First character represents staged changes
        if (status[0] !== " " && status[0] !== "?") {
          stagedChanges.push(file);
        }

        // Second character represents unstaged changes
        if (status[1] !== " " && status[1] !== "?") {
          unstagedChanges.push(file);
        }

        // Untracked files
        if (status === "??") {
          unstagedChanges.push(file);
        }
      });

      // Set the status information
      setGitStatus(gitStatus);
      setStagedChanges(stagedChanges.join("\n"));
      setUnstagedChanges(unstagedChanges.join("\n"));

      // If there are unstaged changes but no staged changes, prompt to stage them
      if (unstagedChanges.length > 0) {
        setStep("stageChanges");
        return;
      }

      // If there are staged changes, proceed with commit
      if (stagedChanges.length > 0) {
        // Get the diff for staged changes
        const gitDiff = execCommand("git diff --staged");
        setGitDiff(gitDiff);

        // Get branch and repo information
        setBranchName(execCommand("git branch --show-current").trim());
        setRepoUrl(
          execCommand(
            "git remote get-url origin 2>/dev/null || echo 'No remote'"
          )
            .trim()
            .replace(/\.git$/, "")
        );
        setDiffStat(execCommand("git diff --staged --stat | tail -n 1").trim());

        // Proceed to generating commit message
        setStep("generating");
        proceedWithCommit();
      } else {
        // No changes are staged
        setStep("stageChanges");
      }
    } catch (error) {
      setStep("error");
      setError((error as Error).message);
    }
  }, []);

  useEffect(() => {
    runInitialChecks();
  }, [runInitialChecks]);

  const proceedWithCommit = async () => {
    const gitStatus = execCommand("git status --short");
    const gitDiff = execCommand("git diff --cached");

    if (!gitDiff) {
      setError("No changes to commit after staging");
      setStep("error");
      return;
    }

    try {
      const message = await generateCommitMessage(
        aiService,
        gitStatus,
        gitDiff
      );
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
      reportStep("Staged changes", "All files staged");
    } else {
      reportStep("Staging skipped", "Proceeding with already staged changes");
    }

    // Get the diff for staged changes
    const gitDiff = execCommand("git diff --staged");
    setGitDiff(gitDiff);

    // If there are no staged changes after user's decision, abort
    if (!gitDiff.trim()) {
      setError("No changes to commit");
      setStep("error");
      return;
    }

    // Get branch and repo information
    setBranchName(execCommand("git branch --show-current").trim());
    setRepoUrl(
      execCommand("git remote get-url origin 2>/dev/null || echo 'No remote'")
        .trim()
        .replace(/\.git$/, "")
    );
    setDiffStat(execCommand("git diff --staged --stat | tail -n 1").trim());

    // Proceed with commit regardless of staging choice
    setStep("generating");
    await proceedWithCommit();
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
