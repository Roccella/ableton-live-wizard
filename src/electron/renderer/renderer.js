const state = {
  snapshot: null,
  pending: false,
  focusMode: "input",
  optionIndex: 0,
  header: null,
};

const elements = {
  header: document.getElementById("app-header"),
  chatFeed: document.getElementById("chat-feed"),
  composerForm: document.getElementById("composer-form"),
  promptInput: document.getElementById("prompt-input"),
};

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const activePromptState = () =>
  state.snapshot?.promptState ?? {
    messageId: undefined,
    options: [],
  };

const hasOptions = () => activePromptState().options.length > 0;

const clampOptionIndex = () => {
  const optionCount = activePromptState().options.length;
  if (optionCount === 0) {
    state.optionIndex = 0;
    state.focusMode = "input";
    return;
  }
  state.optionIndex = Math.max(0, Math.min(state.optionIndex, optionCount - 1));
};

const syncFocus = () => {
  requestAnimationFrame(() => {
    if (state.focusMode === "options" && hasOptions()) {
      const button = elements.chatFeed.querySelector(`[data-choice-index="${state.optionIndex}"]`);
      if (button instanceof HTMLButtonElement) {
        button.focus();
        return;
      }
    }
    elements.promptInput.focus();
  });
};

const getOptionVariant = (optionId) => {
  if (optionId === "back" || optionId === "guided_undo") return "ghost";
  if (optionId === "prepare_clear") return "danger";
  return "action";
};

const renderHeader = () => {
  if (!state.header) {
    elements.header.innerHTML = `
      <div class="header-status">
        <span class="status-dot is-disconnected"></span>
        <span>Connecting</span>
      </div>
    `;
    return;
  }

  const { connection, bpm, trackCount } = state.header;
  const isConnected = Boolean(connection);

  elements.header.innerHTML = `
    <div class="header-status">
      <span class="status-dot${isConnected ? "" : " is-disconnected"}"></span>
      <span>${isConnected ? "Connected" : "Disconnected"}</span>
    </div>
    <div class="header-meta">
      <span class="meta-value">${bpm}</span> BPM
      ${trackCount > 0 ? `<span class="meta-value">${trackCount}</span> tracks` : ""}
    </div>
  `;
};

const renderOptionsGroup = () => {
  const promptState = activePromptState();
  if (promptState.options.length === 0) return "";

  return `<div class="options-group" role="listbox" aria-label="Suggestions">${promptState.options
    .map((option, index) => {
      const variant = getOptionVariant(option.id);
      const selectedClass = state.focusMode === "options" && state.optionIndex === index ? " is-selected" : "";
      const variantClass = variant !== "action" ? ` option-${variant}` : "";
      const disabled = state.pending || !option.enabled ? "disabled" : "";
      return `<button
        class="option${variantClass}${selectedClass}"
        type="button"
        role="option"
        data-option-id="${escapeHtml(option.id)}"
        data-choice-index="${index}"
        ${disabled}
      >${escapeHtml(option.label)}</button>`;
    })
    .join("")}</div>`;
};

const updateOptionSelection = () => {
  for (const button of elements.chatFeed.querySelectorAll("[data-choice-index]")) {
    const index = parseInt(button.dataset.choiceIndex, 10);
    button.classList.toggle("is-selected", state.focusMode === "options" && index === state.optionIndex);
  }
};

const renderChat = () => {
  const messages = state.snapshot?.messages ?? [];
  const promptState = activePromptState();

  let html = messages
    .map((message) => {
      let messageHtml = `<article class="message message-${message.role}">
        <div class="message-bubble">${escapeHtml(message.text)}</div>
      </article>`;

      if (message.id === promptState.messageId && promptState.options.length > 0) {
        messageHtml += renderOptionsGroup();
      }

      return messageHtml;
    })
    .join("");

  if (state.pending) {
    html += `<div class="loading-indicator">
      <div class="loading-dots">
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
      </div>
      <span>Working</span>
    </div>`;
  }

  elements.chatFeed.innerHTML = html;

  for (const button of elements.chatFeed.querySelectorAll("[data-option-id]")) {
    button.addEventListener("click", async () => {
      await handleChooseOption(button.dataset.optionId ?? "");
    });

    button.addEventListener("keydown", async (event) => {
      if (!hasOptions()) return;

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        state.optionIndex = Math.min(state.optionIndex + 1, activePromptState().options.length - 1);
        updateOptionSelection();
        syncFocus();
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        state.optionIndex = Math.max(state.optionIndex - 1, 0);
        updateOptionSelection();
        syncFocus();
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        state.focusMode = "input";
        syncFocus();
        return;
      }

      if ((event.key === "Enter" || event.key === " ") && !state.pending) {
        event.preventDefault();
        await handleChooseOption(button.dataset.optionId ?? "");
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        state.focusMode = "input";
        syncFocus();
        return;
      }

      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        state.focusMode = "input";
        elements.promptInput.value += event.key;
        syncFocus();
      }
    });
  }

  elements.chatFeed.scrollTop = elements.chatFeed.scrollHeight;
};

const applySnapshot = (snapshot) => {
  state.snapshot = snapshot;
  clampOptionIndex();

  const hasPromptOptions = snapshot.promptState.options.length > 0;
  if (!hasPromptOptions) {
    state.focusMode = "input";
  }

  elements.promptInput.placeholder = hasPromptOptions
    ? "Write a prompt, or press Tab to focus the suggestions."
    : snapshot.inputPlaceholder;

  renderChat();
  syncFocus();
};

const setPending = (pending) => {
  state.pending = pending;
  elements.promptInput.disabled = pending;
  renderChat();
};

const handleSubmit = async () => {
  const input = elements.promptInput.value.trim();
  if (!input) return;

  setPending(true);
  try {
    const snapshot = await window.wizardDesktop.submitPrompt(input);
    elements.promptInput.value = "";
    applySnapshot(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fallback = state.snapshot ?? { connection: "", messages: [], promptState: { options: [] }, inputPlaceholder: "" };
    applySnapshot({
      ...fallback,
      messages: [...fallback.messages, { id: `system-${Date.now()}`, role: "system", text: `Prompt error: ${message}` }],
    });
  } finally {
    setPending(false);
  }
};

const handleChooseOption = async (optionId) => {
  if (!optionId || state.pending) return;

  setPending(true);
  try {
    const snapshot = await window.wizardDesktop.chooseOption(optionId);
    applySnapshot(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fallback = state.snapshot ?? { connection: "", messages: [], promptState: { options: [] }, inputPlaceholder: "" };
    applySnapshot({
      ...fallback,
      messages: [...fallback.messages, { id: `system-${Date.now()}`, role: "system", text: `Choice error: ${message}` }],
    });
  } finally {
    setPending(false);
  }
};

elements.composerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.pending) await handleSubmit();
});

elements.promptInput.addEventListener("keydown", async (event) => {
  if (state.pending) return;

  if (event.key === "Tab" && hasOptions()) {
    event.preventDefault();
    state.focusMode = "options";
    clampOptionIndex();
    updateOptionSelection();
    syncFocus();
    return;
  }

  if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    await handleSubmit();
    return;
  }

  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    await handleSubmit();
  }
});

renderHeader();

window.wizardDesktop
  .bootstrap()
  .then((data) => {
    state.header = {
      connection: data.connection,
      bpm: data.state?.transport?.bpm ?? 0,
      trackCount: data.state?.trackCount ?? 0,
      sceneCount: data.state?.sceneCount ?? 0,
    };
    renderHeader();
    applySnapshot(data);
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    state.header = { connection: "", bpm: 0, trackCount: 0, sceneCount: 0 };
    renderHeader();
    applySnapshot({
      connection: "",
      inputPlaceholder: "Write a prompt.",
      promptState: { options: [] },
      messages: [{ id: "bootstrap-error", role: "system", text: `Bootstrap failed: ${message}` }],
    });
  });
