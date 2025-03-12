export function formatNumber(value: number, decimals: number = 0): string {
  if (isNaN(value)) return '0';
  
  // Handle negative numbers
  const sign = value < 0 ? '-' : '';
  const absValue = Math.abs(value);
  
  // Format with commas and specified decimal places
  const parts = absValue.toFixed(decimals).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return sign + parts.join('.');
} 