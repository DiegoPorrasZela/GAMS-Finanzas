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

const dosDigitos = (n: number) => String(n).padStart(2, '0');
const aFecha = (anio: number, mes: number, dia: number) =>
  `${anio}-${dosDigitos(mes)}-${dosDigitos(dia)}`;

export function ultimoDiaDelMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate();
}

export function esUltimoDiaDelMes(fecha: string): boolean {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return dia === ultimoDiaDelMes(anio, mes);
}

function diaDeLaSemana(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Intl.DateTimeFormat('es-PE', { weekday: 'long' }).format(new Date(anio, mes - 1, dia));
}

// Frase para usar dentro de una oración: "cada día", "cada semana, los lunes",
// "el 15 y el último día de cada mes", "el último día de cada mes", "el día 9 de cada mes"
export function fraseRepeticion(frecuencia: string, dia: number, fechaReferencia: string): string {
  switch (frecuencia) {
    case 'DIARIA':
      return 'cada día';
    case 'SEMANAL':
      return `cada semana, los ${diaDeLaSemana(fechaReferencia)}`;
    case 'QUINCENAL':
      return 'el 15 y el último día de cada mes';
    default:
      if (dia >= 31) return 'el último día de cada mes';
      if (dia >= 29) return `el día ${dia} de cada mes (o el último, si el mes es más corto)`;
      return `el día ${dia} de cada mes`;
  }
}

// Para mostrar un automático: "Cada día", "El 15 y el último día de cada mes"…
export function textoFrecuencia(r: {
  frecuencia: string;
  dia: number;
  proximoCargo: string;
}): string {
  return capitalizar(fraseRepeticion(r.frecuencia, r.dia, r.proximoCargo));
}

// Misma regla que el backend: primera fecha del calendario igual o posterior a "desde".
// Si el mes no tiene el día elegido, se usa su último día.
export function primeraFecha(desde: string, frecuencia: string, dia: number): string {
  if (frecuencia === 'DIARIA' || frecuencia === 'SEMANAL') return desde;
  const [anio, mes] = desde.split('-').map(Number);
  const enMes = (a: number, m: number, d: number) =>
    aFecha(a, m, Math.min(d, ultimoDiaDelMes(a, m)));
  const [anioSig, mesSig] = mes === 12 ? [anio + 1, 1] : [anio, mes + 1];

  if (frecuencia === 'QUINCENAL') {
    const quince = aFecha(anio, mes, 15);
    return quince >= desde ? quince : enMes(anio, mes, 31);
  }
  const esteMes = enMes(anio, mes, dia);
  return esteMes >= desde ? esteMes : enMes(anioSig, mesSig, dia);
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

// "2026-11-09" y -7 → "2026-11-02"
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const resultado = new Date(anio, mes - 1, dia + dias);
  return aFecha(resultado.getFullYear(), resultado.getMonth() + 1, resultado.getDate());
}

// Título de un día en la lista: "Hoy", "Ayer", "Lunes, 3 de noviembre" (con el año si no es el actual)
export function tituloDia(fecha: string, referencia = hoy()): string {
  if (fecha === referencia) return 'Hoy';
  if (fecha === sumarDias(referencia, -1)) return 'Ayer';
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const otroAnio = anio !== Number(referencia.slice(0, 4));
  return capitalizar(
    new Intl.DateTimeFormat('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...(otroAnio ? { year: 'numeric' } : {}),
    }).format(new Date(anio, mes - 1, dia)),
  );
}

// Los "cantidad" meses que terminan en "hasta" (AAAA-MM), del más antiguo al más reciente
export function mesesHastaIncluido(hasta: string, cantidad: number): string[] {
  const [anio, mes] = hasta.split('-').map(Number);
  return Array.from({ length: cantidad }, (_, i) => {
    const fecha = new Date(anio, mes - 1 - (cantidad - 1 - i), 1);
    return claveMes(fecha.getFullYear(), fecha.getMonth() + 1);
  });
}

// "2026-11" → "nov" (y "nov 2025" si es de otro año que "referencia")
export function mesCorto(clave: string, referencia = mesActual()): string {
  const [anio, mes] = clave.split('-').map(Number);
  const texto = new Intl.DateTimeFormat('es-PE', { month: 'short' })
    .format(new Date(anio, mes - 1, 1))
    .replace('.', '')
    .toLowerCase(); // según el navegador viene "Nov" o "nov."; en español va "nov"
  return clave.slice(0, 4) === referencia.slice(0, 4) ? texto : `${texto} ${anio}`;
}

// Meses que quedan hasta una fecha, contando el mes actual (mínimo 1)
export function mesesHasta(fecha: string): number {
  const [anio, mes] = fecha.split('-').map(Number);
  const ahora = new Date();
  return Math.max(1, (anio - ahora.getFullYear()) * 12 + (mes - (ahora.getMonth() + 1)) + 1);
}
