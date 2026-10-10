const INTEGER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Heights and counts with en-US grouping: 318442 → "318,442". */
export function formatInteger(value: number): string {
  return INTEGER.format(value);
}
