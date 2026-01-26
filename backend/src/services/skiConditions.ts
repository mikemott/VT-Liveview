interface ColorInput {
  snowfall24hr: number | null;
  trailsOpen: number;
  trailsTotal: number;
  liftsOpen: number;
  liftsTotal: number;
}

export function calculateResortColor(input: ColorInput): 'green' | 'yellow' | 'red' {
  const { snowfall24hr, trailsOpen, trailsTotal, liftsOpen, liftsTotal } = input;

  // Step 1: Check snow quality
  const hasGoodSnow = snowfall24hr !== null && snowfall24hr >= 2;
  const hasDecentSnow = snowfall24hr !== null && snowfall24hr >= 0.5;

  // Step 2: Check operational status
  const trailsPercent = (trailsOpen / trailsTotal) * 100;
  const liftsPercent = (liftsOpen / liftsTotal) * 100;
  const operationsPercent = Math.min(trailsPercent, liftsPercent);

  const goodOperations = operationsPercent >= 70;
  const decentOperations = operationsPercent >= 40;

  // Step 3: Combine (tiered priority)
  if (hasGoodSnow && goodOperations) return 'green';
  if (hasDecentSnow && decentOperations) return 'yellow';
  if (decentOperations) return 'yellow';
  return 'red';
}
