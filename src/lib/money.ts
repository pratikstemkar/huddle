/**
 * Money is stored as an integer number of minor units (paise for INR, cents for USD), so sums never
 * pick up floating-point dust. Every currency the app offers has two decimal places.
 */

/** The most one expense or settlement can be, in minor units (matches the database check). */
export const MAX_AMOUNT_MINOR = 100_000_000_000;

/**
 * Reads a typed amount into minor units: "1,250.5" -> 125050, "₹ 600" -> 60000.
 * Null for anything that isn't a positive amount with at most two decimals, or is over the limit.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[\s, ]/g, '').replace(/^[^\d.-]+/, '');
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  const minor = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > MAX_AMOUNT_MINOR) return null;
  return minor;
}

function locale(currency: string) {
  return currency === 'INR' ? 'en-IN' : undefined;
}

/** "₹1,250", or "₹1,250.50" when there are paise. Indian digit grouping for INR. */
export function formatMoney(minor: number, currency = 'INR'): string {
  const digits = minor % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat(locale(currency), {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 100);
}

/** The symbol shown next to the amount input, e.g. "₹". */
export function currencySymbol(currency = 'INR'): string {
  const parts = new Intl.NumberFormat(locale(currency), { style: 'currency', currency }).formatToParts(0);
  return parts.find((p) => p.type === 'currency')?.value ?? currency;
}

/** The amount as it would be typed back into the input: 125050 -> "1250.50", 60000 -> "600". */
export function amountInput(minor: number): string {
  const whole = Math.floor(minor / 100);
  const fraction = minor % 100;
  return fraction ? `${whole}.${String(fraction).padStart(2, '0')}` : String(whole);
}
