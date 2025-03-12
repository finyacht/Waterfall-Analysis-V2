export function formatNumber(value: number, decimals: number = 0): string {
<<<<<<< HEAD
  if (isNaN(value)) return '0';
  
=======
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

>>>>>>> 08934c19121ecdbe767bab21e1306d0b85b594f2
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
<<<<<<< HEAD
  
  return formatter.format(value);
} 
=======

  return formatter.format(value);
}
>>>>>>> 08934c19121ecdbe767bab21e1306d0b85b594f2
