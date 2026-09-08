/// <reference lib="webworker" />
// Background calculation worker: keeps branch-and-bound search off the main
// thread so large grids stay responsive.

import { calculateRequest } from "./compute";
import type { CalcRequest } from "./types";

self.onmessage = (event: MessageEvent<CalcRequest>) => {
  self.postMessage(calculateRequest(event.data));
};
