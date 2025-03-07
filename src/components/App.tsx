import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { Command } from "commander";
import AutoCommit from "./AutoCommit.js";

const program = new Command();

const App: React.FC = () => {
  const [command, setCommand] = useState<string | null>(null);
  const [summary, setSummary] = useState<string[]>([]);

  useEffect(() => {
    program
      .name("auto-commit")
      .description("A CLI tool to automate git commit and push")
      .version("1.0.0");

    program
      .command("commit")
      .description("Commit changes to the local git repository")
      .action(() => {
        setCommand("commit");
      });

    program.parse(process.argv);

    // If no command was matched, show help
    if (!program.args.length) {
      program.help();
    }
  }, []);

  const handleStepComplete = (step: string, details?: string) => {
    setSummary((prev) => [...prev, `${step}${details ? `: ${details}` : ""}`]);
  };

  if (command === "commit") {
    return (
      <AutoCommit
        onStepComplete={handleStepComplete}
        onFinish={() => setCommand("summary")}
      />
    );
  }

  if (command === "summary") {
    return (
      <Box flexDirection="column" borderStyle="round" padding={1}>
        {summary.map((step, index) => (
          <Text key={index}>• {step}</Text>
        ))}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>Loading...</Text>
    </Box>
  );
};

export default App;
