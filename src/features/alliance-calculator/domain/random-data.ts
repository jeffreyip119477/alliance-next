export interface RandomGrid {
  prices: number[][];
  discounts: number[][][];
}

export const generateRandomData = (
  contracts: number,
  tenderers: number,
  priceMin: number,
  priceMax: number,
  discountMax: number,
  random: () => number = Math.random
): RandomGrid => {
  const prices: number[][] = [];
  const discounts: number[][][] = [];

  for (let tenderer = 0; tenderer < tenderers; tenderer++) {
    prices[tenderer] = [];
    discounts[tenderer] = [];
    for (let contract = 0; contract < contracts; contract++) {
      prices[tenderer][contract] =
        Math.floor(random() * (priceMax - priceMin + 1)) + priceMin;
      discounts[tenderer][contract] = Array(contracts).fill(0);
      for (let tier = 1; tier < contracts; tier++) {
        discounts[tenderer][contract][tier] = Number(
          (random() * discountMax).toFixed(4)
        );
      }
    }
  }

  return { prices, discounts };
};
