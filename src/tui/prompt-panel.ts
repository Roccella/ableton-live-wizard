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
  cursorVisible?: boolean;
  cursorIndex?: number;
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
  cursorVisible = true,
  cursorIndex,
}: BuildPromptPanelContentParams): string[] => {
  const lines: string[] = [];

  if (question) {
    lines.push(`{bold}${question}{/bold}`);
  }

  if (helperText && (options.length === 0 || isPromptOpen)) {
    lines.push(`{gray-fg}${helperText}{/gray-fg}`);
  }

  options.forEach((option, index) => {
    lines.push(renderOptionLine(option, index, selectedIndex, highlightSelection));
  });

  if (isPromptOpen || options.length === 0 || promptDraft.length > 0) {
    const draftLines = promptDraft.length > 0 ? promptDraft.split("\n") : [""];
    if (lines.length > 0 && isPromptOpen) {
      lines.push("");
    }
    if (isPromptOpen) {
      const normalizedCursorIndex = clamp(cursorIndex ?? promptDraft.length, 0, promptDraft.length);
      const cursorLineIndex = promptDraft.slice(0, normalizedCursorIndex).split("\n").length - 1;
      const cursorColumn = promptDraft.slice(0, normalizedCursorIndex).split("\n").at(-1)?.length ?? 0;

      draftLines.forEach((line, index) => {
        let renderedLine = line;
        if (index === cursorLineIndex) {
          if (cursorColumn >= line.length) {
            renderedLine = `${line}${cursorVisible ? "█" : " "}`;
          } else if (cursorVisible) {
            renderedLine = `${line.slice(0, cursorColumn)}█${line.slice(cursorColumn + 1)}`;
          }
        }
        lines.push(index === 0 ? `> ${renderedLine}` : `  ${renderedLine}`);
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
