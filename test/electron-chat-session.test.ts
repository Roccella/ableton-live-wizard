import assert from "node:assert/strict";
import test from "node:test";
import { LocalWizardCompanionService } from "../src/companion/local-service.js";
import { WizardMcpServer } from "../src/mcp/server.js";
import { ElectronChatSession } from "../src/electron/chat-session.js";

test("electron chat session boots into the guided starter", async () => {
  const session = new ElectronChatSession(new LocalWizardCompanionService(new WizardMcpServer()));

  const snapshot = await session.bootstrap("local:mock");

  assert.equal(snapshot.messages.at(-1)?.text, "How do you want to start?");
  assert.deepEqual(
    snapshot.promptState.options.map((option) => option.id),
    ["prepare_clear", "prepare_keep"],
  );
});

test("electron chat session advances through guided setup into build options", async () => {
  const session = new ElectronChatSession(new LocalWizardCompanionService(new WizardMcpServer()));

  await session.bootstrap("local:mock");
  await session.chooseOption("prepare_keep", "local:mock");
  await session.chooseOption("genre_house", "local:mock");
  await session.chooseOption("scale_minor", "local:mock");
  const snapshot = await session.chooseOption("key_A", "local:mock");

  const tailMessages = snapshot.messages.slice(-3).map((message) => message.text);
  assert.ok(tailMessages.includes("Key A selected."));
  assert.ok(tailMessages.includes("House: what should we build next?"));
  assert.ok(snapshot.promptState.options.some((option) => option.id === "foundation_drums"));
  assert.ok(snapshot.promptState.options.some((option) => option.id === "foundation_bassline"));
});

test("electron chat session supports freeform prompts while guided options stay available", async () => {
  const service = new LocalWizardCompanionService(new WizardMcpServer());
  const session = new ElectronChatSession(service);

  await session.bootstrap("local:mock");
  const snapshot = await session.submitFreeform("create track Pads", "local:mock");

  assert.equal(snapshot.messages.at(-1)?.role, "assistant");
  assert.match(snapshot.messages.at(-1)?.text ?? "", /create_track|create/i);
  assert.equal(snapshot.promptState.options.length > 0, true);
});
