export type PromptPanelOption = {
  label: string;
  enabled: boolean;
};

type BuildPromptPanelContentParams = {
  question?: string;
  helperText?: string;
  options: PromptPanelOption[];
  selectedIndex: number;
  highlightSelection: boolean;
  promptDraft: string;
  isPromptOpen: boolean;
  promptChoiceLabel?: string;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

const renderOptionLine = (
  option: PromptPanelOption,
  index: number,
  selectedIndex: number,
  highlightSelection: boolean,
  muted = false,
): string => {
  const prefix = `${index + 1}.`;
  const label = option.enabled ? option.label : `${option.label} (disabled)`;

  if (highlightSelection && index === selectedIndex) {
    return `{black-fg}{cyan-bg}${prefix} ${label}{/cyan-bg}{/black-fg}`;
  }

  if (!option.enabled) {
    return `{gray-fg}${prefix} ${label}{/gray-fg}`;
  }

  if (muted) {
    return `{cyan-fg}${prefix}{/cyan-fg} {gray-fg}${label}{/gray-fg}`;
  }

  return `{cyan-fg}${prefix}{/cyan-fg} ${label}`;
};

export const buildPromptPanelLines = ({
  question,
  helperText,
  options,
  selectedIndex,
  highlightSelection,
  promptDraft,
  isPromptOpen,
  promptChoiceLabel = "Type something else",
}: BuildPromptPanelContentParams): string[] => {
  const lines: string[] = [];

  if (question) {
    lines.push(`{bold}${question}{/bold}`);
  }

  if (helperText && options.length === 0) {
    lines.push(`{gray-fg}${helperText}{/gray-fg}`);
  }

  options.forEach((option, index) => {
    lines.push(renderOptionLine(option, index, selectedIndex, highlightSelection));
  });

  const promptIndex = options.length;
  const promptPrefix = `${promptIndex + 1}.`;

  if (options.length > 0) {
    if (isPromptOpen) {
      const draftLines = promptDraft.length > 0 ? promptDraft.split("\n") : [""];
      const lastIndex = draftLines.length - 1;
      draftLines.forEach((line, index) => {
        if (index === 0) {
          lines.push(`${promptPrefix} ${index === lastIndex ? `${line}█` : line}`);
          return;
        }
        lines.push(`   ${index === lastIndex ? `${line}█` : line}`);
      });
    } else {
      lines.push(
        renderOptionLine(
          { label: promptChoiceLabel, enabled: true },
          promptIndex,
          selectedIndex,
          highlightSelection,
          true,
        ),
      );
    }
  } else {
    const draftLines = promptDraft.length > 0 ? promptDraft.split("\n") : [""];
    if (lines.length > 0) {
      lines.push("");
    }
    if (isPromptOpen) {
      const lastIndex = draftLines.length - 1;
      draftLines.forEach((line, index) => {
        lines.push(index === lastIndex ? `${line}█` : line);
      });
    } else if (promptDraft.length > 0) {
      draftLines.forEach((line) => lines.push(line));
    } else {
      lines.push("");
    }
  }

  return lines;
};

export const buildPromptPanelContent = (params: BuildPromptPanelContentParams): string =>
  buildPromptPanelLines(params).join("\n");

export const measurePromptPanelHeight = (
  params: BuildPromptPanelContentParams,
  minHeight: number,
  maxHeight: number,
): number => {
  const lines = buildPromptPanelLines(params).length;
  return clamp(lines + 4, minHeight, maxHeight);
};
