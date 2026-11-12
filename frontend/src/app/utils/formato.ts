// Montos en soles con el mismo formato que el pipe number de las pantallas: "S/ 1,234.50"
export function soles(monto: number): string {
  return `S/ ${monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Montos en cualquier moneda de la app: "US$ 10.00", "€ 5.50", "S/ 34.42"
export function enMoneda(monto: number, simbolo: string): string {
  return `${simbolo} ${monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// "2026-11-09" → "09/11/2026"
export function ddmmaaaa(fecha: string): string {
  return fecha.split('-').reverse().join('/');
}
