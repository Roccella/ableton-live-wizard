export type AgentPanelOption = {
  label: string;
  enabled: boolean;
};

type BuildAgentPanelContentParams = {
  conversationLines: string[];
  viewportHeight: number;
};

export const buildAgentPanelContent = ({
  conversationLines,
  viewportHeight,
}: BuildAgentPanelContentParams): string => {
  const safeViewportHeight = Math.max(1, viewportHeight);
  const visibleConversation = conversationLines.slice(-safeViewportHeight);
  return visibleConversation.join("\n");
};
