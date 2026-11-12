import { Movimiento } from '../models/finanzas.models';
import { calcularTotales } from '../services/movimientos.service';
import { esMayor, restar, sumar } from './dinero';

const movimiento = (monto: number, tipo: 'ingreso' | 'gasto', categoria = 'Otros'): Movimiento => ({
  id: 1,
  descripcion: 'x',
  monto,
  fecha: '2026-11-12',
  tipo,
  categoriaId: 1,
  categoria,
  automatico: false,
  monedaOriginal: null,
  montoOriginal: null,
});

describe('Cuentas de dinero en céntimos', () => {
  it('suma decimales sin desviarse (10.10 + 20.20 es 30.30, no 30.299999…)', () => {
    expect(10.1 + 20.2).not.toBe(30.3); // el problema de los decimales en binario
    expect(sumar([10.1, 20.2])).toBe(30.3);
    expect(sumar([0.1, 0.2, 0.3])).toBe(0.6);
  });

  it('resta hasta cero sin dejar "-0"', () => {
    expect(Object.is(restar(30.3, sumar([10.1, 20.2])), 0)).toBe(true);
    expect(restar(0.3, 0.1)).toBe(0.2);
  });

  it('compara a nivel de céntimo', () => {
    expect(esMayor(30.3, sumar([10.1, 20.2]))).toBe(false); // retirar 30.30 de 30.30 sí se puede
    expect(esMayor(30.31, 30.3)).toBe(true);
  });

  it('calcularTotales: gastar todo el saldo deja exactamente 0', () => {
    const { ingresos, gastos, saldo } = calcularTotales([
      movimiento(10.1, 'ingreso'),
      movimiento(20.2, 'ingreso'),
      movimiento(30.3, 'gasto'),
    ]);
    expect(ingresos).toBe(30.3);
    expect(gastos).toBe(30.3);
    expect(Object.is(saldo, 0)).toBe(true); // no "-0", que se mostraba como "S/ -0.00"
  });

  it('calcularTotales: ahorros con céntimos', () => {
    const { ahorro } = calcularTotales([
      movimiento(10.1, 'gasto', 'Ahorro'),
      movimiento(20.2, 'gasto', 'Ahorro'),
    ]);
    expect(ahorro).toBe(30.3);
  });
});
