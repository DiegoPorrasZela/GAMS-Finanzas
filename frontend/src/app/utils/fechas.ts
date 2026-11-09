// Ayudas para fechas. Días en formato AAAA-MM-DD y meses en formato AAAA-MM (siempre hora local).

export function hoy(): string {
  const fecha = new Date();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export function mesActual(): string {
  return hoy().slice(0, 7);
}

export function claveMes(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

// "2026-11" → "noviembre de 2026"
export function nombreMes(clave: string): string {
  const [anio, mes] = clave.split('-').map(Number);
  return new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' }).format(
    new Date(anio, mes - 1, 1),
  );
}

export function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Meses que tienen datos, más el mes actual, del más reciente al más antiguo
export function mesesConDatos(fechas: string[]): string[] {
  const meses = new Set(fechas.map((fecha) => fecha.slice(0, 7)));
  meses.add(mesActual());
  return [...meses].sort().reverse();
}

// Días que faltan para terminar el mes actual, contando hoy
export function diasRestantesDelMes(): number {
  const fecha = new Date();
  const ultimoDia = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
  return ultimoDia - fecha.getDate() + 1;
}

// Meses que quedan hasta una fecha, contando el mes actual (mínimo 1)
export function mesesHasta(fecha: string): number {
  const [anio, mes] = fecha.split('-').map(Number);
  const ahora = new Date();
  return Math.max(1, (anio - ahora.getFullYear()) * 12 + (mes - (ahora.getMonth() + 1)) + 1);
}
