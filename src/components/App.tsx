import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import AutoCommit from "./AutoCommit.js";
import { Config } from "../config.js";
import { AIService } from "../services/aiServiceFactory.js";
import ConfigDisplay from "./ConfigDisplay.js";

// Define the props interface for the App component
interface AppProps {
  aiService: AIService;
  config: Config;
  initialCommand: string | null;
}

const App: React.FC<AppProps> = ({ aiService, config, initialCommand }) => {
  const [command, setCommand] = useState<string | null>(initialCommand);
  const [summary, setSummary] = useState<string[]>([]);

  const handleStepComplete = (step: string, details?: string) => {
    setSummary((prev) => [...prev, `${step}${details ? `: ${details}` : ""}`]);
  };

  if (command === "commit") {
    return (
      <AutoCommit
        aiService={aiService}
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
      <Text>Git AI Tool</Text>
      <ConfigDisplay config={config} />
      {/* Rest of your UI components */}
    </Box>
  );
};

export default App;
