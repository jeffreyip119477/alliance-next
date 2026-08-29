"use client";

import dynamic from "next/dynamic";

// The calculator is a pure client tool (no SEO/SSR value). Loading it with
// ssr:false means the server renders no HTML for this tree, so there is
// nothing to hydrate-compare — which eliminates the entire class of
// hydration-mismatch warnings, including ones caused by browser extensions
// injecting attributes into <input> nodes before React loads (e.g. data-sharkid).
const AllianceCombinationsCalculator = dynamic(
  () => import("@/components/alliance-combinations"),
  { ssr: false }
);

export default function Home() {
  return (
    <div>
      <AllianceCombinationsCalculator />
    </div>
  );
}
