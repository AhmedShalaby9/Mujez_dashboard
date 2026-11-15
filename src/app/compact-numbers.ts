/** Compact display values; all money parsing and edit round trips stay exact in minor units. */
const scales = [
  { value: 1n, suffix: '' },
  { value: 1000n, suffix: 'k' },
  { value: 1000000n, suffix: 'm' },
  { value: 1000000000n, suffix: 'b' },
];
function decimal(n: bigint, places: number) {
  if (!places) return String(n);
  const s = n.toString().padStart(places + 1, '0');
  return (s.slice(0, -places) + '.' + s.slice(-places)).replace(/\.?0+$/, '');
}
function scaled(value: bigint, minor: boolean, exact: boolean) {
  const sign = value < 0n ? '-' : '',
    a = value < 0n ? -value : value;
  const base = minor ? 100n : 1n;
  let i = scales.length - 1;
  while (i > 0 && a < scales[i].value * base) i--;
  if (exact) {
    const places = (minor ? 2 : 0) + [0, 3, 6, 9][i];
    return sign + decimal(a, places) + scales[i].suffix;
  }
  let rounded = (a * 100n + (scales[i].value * base) / 2n) / (scales[i].value * base);
  if (rounded >= 100000n && i < scales.length - 1) {
    i++;
    rounded = (a * 100n + (scales[i].value * base) / 2n) / (scales[i].value * base);
  }
  return sign + decimal(rounded, 2) + scales[i].suffix;
}
export function compactMinor(value: string | bigint) {
  return scaled(BigInt(value), true, true);
}
export function compactMoney(value: string | null | undefined, currency = 'EGP') {
  return value == null ? '—' : currency + ' ' + compactMinor(value);
}
export function compactAmountInput(value: string | bigint) {
  return scaled(BigInt(value), true, true);
}
export function compactNumber(value: number | bigint | string) {
  if (typeof value === 'bigint' || (typeof value === 'string' && /^-?\d+$/.test(value)))
    return scaled(BigInt(value), false, false);
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return scaled(BigInt(Math.round(n * 100)), true, false);
}
/** Accept 10m, 250k, grouped digits and Arabic digits without floating-point multiplication. */
export function parseCompactAmount(value: string, max = 999999999999999999n): string {
  const s = value
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/٬/g, ',')
    .replace(/٫/g, '.');
  if (s.length > 80 || !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?\s*[kmb]?$/i.test(s))
    throw Error('Enter an amount such as 10m, 250k or 1250.50');
  const match = s.replace(/,/g, '').match(/^(\d+)(?:\.(\d+))?\s*([kmb]?)$/i)!;
  const fraction = match[2] ?? '',
    suffix = match[3].toLowerCase();
  const factor =
    suffix === 'b' ? 1000000000n : suffix === 'm' ? 1000000n : suffix === 'k' ? 1000n : 1n;
  const numerator = BigInt(match[1] + fraction) * factor * 100n;
  const denominator = 10n ** BigInt(fraction.length);
  if (numerator % denominator) throw Error('Amount must resolve to whole cents');
  const result = numerator / denominator;
  if (result > max) throw Error('Amount is outside the allowed range');
  return result.toString();
}

export function compactMajor(value: number) {
  return Number.isFinite(value) ? compactMinor(BigInt(Math.round(value * 100))) : '—';
}
/** Compact amounts embedded in server-generated messages, preserving other numbers. */
export function compactMoneyText(value: string) {
  return value.replace(
    /EGP\s+([0-9][0-9,]*(?:\.[0-9]+)?)(?![a-z])/gi,
    (original, amount: string) => {
      try {
        return compactMoney(parseCompactAmount(amount));
      } catch {
        return original;
      }
    },
  );
}
