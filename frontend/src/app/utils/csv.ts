import { Movimiento, clasificar } from '../models/finanzas.models';
import { ddmmaaaa } from './formato';

const TIPOS = {
  ingreso: 'Ingreso',
  gasto: 'Gasto',
  ahorro: 'Ahorro',
  retiro: 'Retiro de ahorros',
  saldoInicial: 'Saldo inicial',
} as const;

// Un valor de texto listo para CSV: entre comillas si hace falta, y sin que Excel lo tome como fórmula
// (un texto que empieza con = + - @ podría ejecutar una fórmula al abrir el archivo).
function texto(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[",\r\n]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

// Números con punto decimal y sin separador de miles, como los lee Excel en Perú
const numero = (valor: number) => valor.toFixed(2);

// Movimientos en formato CSV (se abre directo en Excel o Google Sheets).
// El monto va con signo: positivo si entró dinero, negativo si salió; así se puede sumar la columna.
export function movimientosACsv(movimientos: Movimiento[]): string {
  const encabezado = [
    'Fecha',
    'Tipo',
    'Categoría',
    'Descripción',
    'Monto (S/)',
    'Moneda original',
    'Monto original',
    'Automático',
  ];
  const filas = movimientos.map((m) =>
    [
      ddmmaaaa(m.fecha),
      TIPOS[clasificar(m)],
      texto(m.categoria),
      texto(m.descripcion),
      numero(m.tipo === 'ingreso' ? m.monto : -m.monto),
      m.monedaOriginal ?? '',
      m.montoOriginal === null ? '' : numero(m.montoOriginal),
      m.automatico ? 'Sí' : 'No',
    ].join(','),
  );
  return [encabezado.join(','), ...filas].join('\r\n');
}

// Descarga un texto como archivo. El BOM inicial hace que Excel lea bien las tildes y la ñ.
export function descargarCsv(nombreArchivo: string, contenido: string): void {
  const archivo = new Blob(['﻿', contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}
