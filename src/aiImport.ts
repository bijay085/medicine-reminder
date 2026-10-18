/**
 * Lets you hand a prescription/instructions to any AI chat and paste back a
 * structured JSON blob that fills the Add Medicine form, instead of typing
 * everything by hand. The prompt below is the one contract that keeps the
 * AI's output limited to exactly what the form needs — nothing else.
 */
export const AI_MEDICINE_PROMPT = `You are helping fill out a medicine reminder app. Based on the medicine instructions I give you below, respond with ONLY a single JSON object — no markdown, no code fences, no explanation, nothing before or after it — in exactly this shape:

{
  "name": string,               // medicine name
  "amountPerDose": number,      // pills taken per dose, e.g. 1
  "totalQuantity": number,      // total pills in the prescription, e.g. 30
  "startDate": "YYYY-MM-DD",    // today if not specified
  "schedules": [                // one entry per daily dose time
    { "type": "meal", "meal": "breakfast" | "lunch" | "dinner" }
    // OR, for a specific clock time instead of a meal:
    // { "type": "fixed", "time": "HH:mm" }  (24-hour format)
  ]
}

Here are my medicine instructions:
`;

export interface ParsedMedicineJson {
  name: string;
  amountPerDose: number;
  totalQuantity: number;
  startDate: string;
  schedules: ({ type: 'meal'; meal: 'breakfast' | 'lunch' | 'dinner' } | { type: 'fixed'; time: string })[];
}

const MEALS = new Set(['breakfast', 'lunch', 'dinner']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_24H = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Validates and parses the JSON an AI returned from AI_MEDICINE_PROMPT. Returns undefined if it doesn't match. */
export function parseMedicineJson(text: string): ParsedMedicineJson | undefined {
  let raw: unknown;
  try {
    // Tolerate the AI wrapping it in a code fence anyway.
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    raw = JSON.parse(cleaned);
  } catch {
    return undefined;
  }

  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.name !== 'string' || !candidate.name.trim()) return undefined;
  if (typeof candidate.amountPerDose !== 'number' || candidate.amountPerDose <= 0) return undefined;
  if (typeof candidate.totalQuantity !== 'number' || candidate.totalQuantity <= 0) return undefined;
  if (typeof candidate.startDate !== 'string' || !ISO_DATE.test(candidate.startDate)) return undefined;
  if (!Array.isArray(candidate.schedules) || candidate.schedules.length === 0) return undefined;

  const schedules: ParsedMedicineJson['schedules'] = [];
  for (const entry of candidate.schedules) {
    if (!entry || typeof entry !== 'object') return undefined;
    const item = entry as Record<string, unknown>;
    if (item.type === 'meal' && typeof item.meal === 'string' && MEALS.has(item.meal)) {
      schedules.push({ type: 'meal', meal: item.meal as 'breakfast' | 'lunch' | 'dinner' });
    } else if (item.type === 'fixed' && typeof item.time === 'string' && TIME_24H.test(item.time)) {
      schedules.push({ type: 'fixed', time: item.time });
    } else {
      return undefined;
    }
  }

  return {
    name: candidate.name.trim(),
    amountPerDose: candidate.amountPerDose,
    totalQuantity: candidate.totalQuantity,
    startDate: candidate.startDate,
    schedules,
  };
}
