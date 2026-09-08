import { DRAFT_STORAGE_KEY, HISTORY_LIMIT, HISTORY_STORAGE_KEY } from "../constants";
import { makeId } from "../domain/scenario";
import type { Draft, HistoryItem, Snapshot } from "../types";

export const readJson = <T,>(key: string): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const writeJson = (key: string, value: unknown): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable is non-fatal for the calculator.
  }
};

const isSnapshot = (value: unknown): value is Snapshot =>
  !!value &&
  typeof (value as Snapshot).contracts === "number" &&
  typeof (value as Snapshot).tenderers === "number" &&
  Array.isArray((value as Snapshot).prices) &&
  Array.isArray((value as Snapshot).discounts);

export const normalizeHistoryItem = (raw: unknown): HistoryItem | null => {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;

  if (isSnapshot(item.snapshot)) {
    return {
      id: typeof item.id === "string" ? item.id : makeId("h"),
      savedAt: typeof item.savedAt === "number" ? item.savedAt : Date.now(),
      name: typeof item.name === "string" ? item.name : "Calculation",
      source: item.source === "random" ? "random" : "manual",
      snapshot: item.snapshot,
    };
  }

  if (
    typeof item.contracts === "number" &&
    typeof item.tenderers === "number" &&
    Array.isArray(item.prices) &&
    Array.isArray(item.discounts)
  ) {
    const timestamp =
      typeof item.timestamp === "number" ? item.timestamp : Date.now();
    const legacySelection = Array.isArray(item.selectedContracts)
      ? (item.selectedContracts as unknown[])
      : [];
    const selectedContracts = legacySelection
      .map((value, index) => (value ? index : -1))
      .filter((index) => index >= 0);

    return {
      id: typeof item.id === "string" ? item.id : makeId("h"),
      savedAt: timestamp,
      name: `Manual · ${new Date(timestamp).toLocaleString()}`,
      source: "manual",
      snapshot: {
        contracts: item.contracts as number,
        tenderers: item.tenderers as number,
        prices: item.prices as number[][],
        discounts: item.discounts as number[][][],
        tendererNames: Array.isArray(item.tendererNames)
          ? (item.tendererNames as string[])
          : [],
        contractNames: [],
        selectedContracts,
        useAverageDOP: false,
        fastMode: false,
      },
    };
  }

  return null;
};

export const readDraft = (): Draft | null => readJson<Draft>(DRAFT_STORAGE_KEY);

export const saveDraft = (draft: Draft): void =>
  writeJson(DRAFT_STORAGE_KEY, draft);

export const readHistory = (): HistoryItem[] => {
  const raw = readJson<unknown[]>(HISTORY_STORAGE_KEY);
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeHistoryItem)
    .filter((item): item is HistoryItem => item !== null)
    .slice(0, HISTORY_LIMIT);
};

export const saveHistory = (history: HistoryItem[]): void =>
  writeJson(HISTORY_STORAGE_KEY, history.slice(0, HISTORY_LIMIT));
