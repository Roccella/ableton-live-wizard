import { LoopBuilderContext } from "../types.js";

const STEPS = [
  "note_seed",
  "single_chord",
  "chord_progression",
  "bassline",
  "lead_or_arp",
] as const;

type LoopStep = (typeof STEPS)[number];

export interface LoopBuilderState {
  active: boolean;
  context?: LoopBuilderContext;
  currentStepIndex: number;
}

export class LoopBuilderWorkflow {
  private state: LoopBuilderState = {
    active: false,
    currentStepIndex: 0,
  };

  start(context: LoopBuilderContext): string {
    this.state = {
      active: true,
      context,
      currentStepIndex: 0,
    };

    return [
      `Loop builder started (${context.genre}, key=${context.key}, bars=${context.bars})`,
      `Next step: ${STEPS[0]}`,
      `Suggestion: create one short motif and keep rhythmic space for bassline.`,
    ].join("\n");
  }

  next(): string {
    if (!this.state.active || !this.state.context) {
      return "Loop builder is not active. Use loop start <genre> <key> <bars>.";
    }

    const current = STEPS[this.state.currentStepIndex] as LoopStep;
    const hint = this.hintFor(current);

    if (this.state.currentStepIndex >= STEPS.length - 1) {
      this.state.active = false;
      return `Step: ${current}\nHint: ${hint}\nWorkflow complete. Ready to promote loop to arrangement.`;
    }

    this.state.currentStepIndex += 1;
    const upcoming = STEPS[this.state.currentStepIndex];
    return `Step: ${current}\nHint: ${hint}\nNext: ${upcoming}`;
  }

  status(): string {
    if (!this.state.active || !this.state.context) {
      return "Loop builder inactive";
    }

    return `Loop builder active: ${this.state.context.genre}/${this.state.context.key}, bars=${this.state.context.bars}, current=${STEPS[this.state.currentStepIndex]}`;
  }

  private hintFor(step: LoopStep): string {
    switch (step) {
      case "note_seed":
        return "Use 3-5 notes max and leave rhythmic headroom.";
      case "single_chord":
        return "Pick a chord that reinforces your motif center.";
      case "chord_progression":
        return "Try 4-chord progression with one tension chord before resolve.";
      case "bassline":
        return "Anchor root motion and avoid clashing with kick pattern.";
      case "lead_or_arp":
        return "Use contrast in register and density over bass/chords.";
      default:
        return "Keep it simple and musical.";
    }
  }
}
