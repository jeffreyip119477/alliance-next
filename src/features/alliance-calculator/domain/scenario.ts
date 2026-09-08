import { projectToSelectedContracts } from "./projection";

export const allIndices = (count: number): number[] =>
  Array.from({ length: count }, (_, index) => index);

export const makeId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const scenarioKey = (
  prices: number[][],
  discounts: number[][][],
  contracts: number,
  tenderers: number,
  useAverageDOP: boolean,
  fastMode: boolean,
  selection: number[],
  forced: (number | null)[],
  forbidden: boolean[][],
  maxWins: number[]
): string => {
  const effective = selection.length > 0 ? selection : allIndices(contracts);
  const projection = projectToSelectedContracts(
    prices,
    discounts,
    effective,
    forced,
    forbidden
  );

  return JSON.stringify([
    contracts,
    tenderers,
    useAverageDOP,
    fastMode,
    projection.prices,
    projection.discounts,
    projection.forced ?? null,
    projection.forbidden ?? null,
    maxWins,
  ]);
};
