import { Movimiento } from '../models/finanzas.models';
import { movimientosACsv } from './csv';

const base: Movimiento = {
  id: 1,
  descripcion: 'Menú del almuerzo',
  monto: 15,
  fecha: '2026-11-06',
  tipo: 'gasto',
  categoriaId: 6,
  categoria: 'Comida',
  automatico: false,
  monedaOriginal: null,
  montoOriginal: null,
};

describe('Exportar movimientos a CSV', () => {
  it('pone encabezados y el monto con signo (se puede sumar la columna en Excel)', () => {
    const lineas = movimientosACsv([
      base,
      {
        ...base,
        id: 2,
        descripcion: 'Sueldo',
        monto: 1500,
        tipo: 'ingreso',
        categoria: 'Sueldo',
        automatico: true,
      },
    ]).split('\r\n');

    expect(lineas[0]).toBe(
      'Fecha,Tipo,Categoría,Descripción,Monto (S/),Moneda original,Monto original,Automático',
    );
    expect(lineas[1]).toBe('06/11/2026,Gasto,Comida,Menú del almuerzo,-15.00,,,No');
    expect(lineas[2]).toBe('06/11/2026,Ingreso,Sueldo,Sueldo,1500.00,,,Sí');
  });

  it('incluye el monto en la moneda original y distingue los ahorros', () => {
    const [, dolares, ahorro] = movimientosACsv([
      {
        ...base,
        descripcion: 'Suscripción',
        monto: 34.5,
        monedaOriginal: 'USD',
        montoOriginal: 10,
      },
      { ...base, descripcion: 'Para la laptop', categoria: 'Ahorro' },
    ]).split('\r\n');

    expect(dolares).toContain('-34.50,USD,10.00');
    expect(ahorro).toContain(',Ahorro,Ahorro,');
  });

  it('protege los textos con comas, comillas o que parecen fórmulas', () => {
    const [, fila] = movimientosACsv([{ ...base, descripcion: '=HYPERLINK("x")' }]).split('\r\n');
    expect(fila).toContain(`"'=HYPERLINK(""x"")"`);

    const [, otra] = movimientosACsv([{ ...base, descripcion: 'Pan, leche' }]).split('\r\n');
    expect(otra).toContain('"Pan, leche"');
  });
});
