import { InstrumentRole } from "../types.js";

export interface InstrumentSearchProfile {
  role: InstrumentRole;
  roots: string[];
  include: string[];
  exclude: string[];
  maxDepth: number;
}

export const INSTRUMENT_ROLE_CATALOG: Record<InstrumentRole, InstrumentSearchProfile> = {
  bass: {
    role: "bass",
    roots: ["sounds", "instruments"],
    include: ["bass", "sub", "mono"],
    exclude: ["drum", "rack", "pad", "lead"],
    maxDepth: 3,
  },
  lead: {
    role: "lead",
    roots: ["sounds", "instruments"],
    include: ["lead", "synth", "mono"],
    exclude: ["bass", "drum", "pad"],
    maxDepth: 3,
  },
  pad: {
    role: "pad",
    roots: ["sounds", "instruments"],
    include: ["pad", "atmos", "string"],
    exclude: ["drum", "bass", "lead"],
    maxDepth: 3,
  },
  pluck: {
    role: "pluck",
    roots: ["sounds", "instruments"],
    include: ["pluck", "plucked", "mallet"],
    exclude: ["drum", "bass", "pad"],
    maxDepth: 3,
  },
  keys: {
    role: "keys",
    roots: ["sounds", "instruments"],
    include: ["keys", "piano", "electric piano", "ep"],
    exclude: ["drum", "bass"],
    maxDepth: 3,
  },
  drums: {
    role: "drums",
    roots: ["drums", "sounds"],
    include: ["drum", "kit", "rack", "808"],
    exclude: ["bass", "lead", "pad"],
    maxDepth: 3,
  },
  fx: {
    role: "fx",
    roots: ["sounds", "instruments"],
    include: ["fx", "noise", "sweep", "impact"],
    exclude: ["drum", "bass"],
    maxDepth: 3,
  },
};

export const isInstrumentRole = (value: string): value is InstrumentRole =>
  Object.prototype.hasOwnProperty.call(INSTRUMENT_ROLE_CATALOG, value);

export const getInstrumentSearchProfile = (role: InstrumentRole): InstrumentSearchProfile =>
  INSTRUMENT_ROLE_CATALOG[role];
