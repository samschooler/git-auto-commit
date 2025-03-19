import React from "react";
import { Box, Text } from "ink";
import { Config } from "../config.js";

interface ConfigDisplayProps {
  config: Config;
}

export const ConfigDisplay: React.FC<ConfigDisplayProps> = ({ config }) => {
  return (
    <Box flexDirection="column">
      <Text>AI Provider: {config.aiProvider}</Text>

      {config.aiProvider === "openai" && (
        <Box flexDirection="column" marginLeft={2}>
          <Text>Model: {config.openai?.model}</Text>
          <Text>API Key: {config.openai?.apiKey ? "********" : "Not set"}</Text>
        </Box>
      )}

      {config.aiProvider === "ollama" && (
        <Box flexDirection="column" marginLeft={2}>
          <Text>Host: {config.ollama?.host}</Text>
          <Text>Model: {config.ollama?.model}</Text>
        </Box>
      )}
    </Box>
  );
};

export default ConfigDisplay;
