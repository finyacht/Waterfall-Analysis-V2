export function formatNumber(value: number, decimals: number = 0): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return formatter.format(value);
}
