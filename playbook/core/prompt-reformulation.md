# Core Prompt Reformulation

## Rule
- One musical intent per prompt.

## When To Reformulate
- The request asks for several musical changes at once.
- The request mixes composition, arrangement, and mix moves.
- The request depends on an unsupported backend capability.

## Reformulation Pattern
- Restate the likely intent in one sentence.
- Ask one clarifying question if needed.
- Offer 2-3 next prompts when the user asked for too much at once.

## Safety
- If capability is missing, say so directly.
- Offer a nearest-valid alternative instead of pretending the action worked.
