import { esUltimoDiaDelMes, fraseRepeticion, primeraFecha } from './fechas';

// Deben coincidir con las reglas del backend (MovimientoRecurrenteTest)
describe('Calendario de los automáticos', () => {
  it('último día del mes: se ajusta a febrero, a meses de 30 y a años bisiestos', () => {
    expect(primeraFecha('2026-02-01', 'MENSUAL', 31)).toBe('2026-02-28');
    expect(primeraFecha('2026-04-01', 'MENSUAL', 31)).toBe('2026-04-30');
    expect(primeraFecha('2028-02-01', 'MENSUAL', 31)).toBe('2028-02-29');
  });

  it('día 30 en febrero usa el último día', () => {
    expect(primeraFecha('2026-02-10', 'MENSUAL', 30)).toBe('2026-02-28');
  });

  it('programar a futuro: creado el 9 con día 15, el primero es el 15', () => {
    expect(primeraFecha('2026-11-09', 'MENSUAL', 15)).toBe('2026-11-15');
  });

  it('si el día ya pasó en el mes, empieza el mes siguiente (también en diciembre)', () => {
    expect(primeraFecha('2026-11-20', 'MENSUAL', 15)).toBe('2026-12-15');
    expect(primeraFecha('2026-12-20', 'MENSUAL', 15)).toBe('2027-01-15');
  });

  it('quincenal: el 15, o el último día si el 15 ya pasó', () => {
    expect(primeraFecha('2026-11-09', 'QUINCENAL', 15)).toBe('2026-11-15');
    expect(primeraFecha('2026-11-15', 'QUINCENAL', 15)).toBe('2026-11-15');
    expect(primeraFecha('2026-11-16', 'QUINCENAL', 15)).toBe('2026-11-30');
    expect(primeraFecha('2026-02-20', 'QUINCENAL', 15)).toBe('2026-02-28');
  });

  it('describe la repetición en palabras', () => {
    expect(fraseRepeticion('QUINCENAL', 15, '2026-11-15')).toBe('el 15 y el último día de cada mes');
    expect(fraseRepeticion('MENSUAL', 31, '2026-11-30')).toBe('el último día de cada mes');
    expect(fraseRepeticion('MENSUAL', 30, '2026-11-30')).toContain('o el último, si el mes es más corto');
    expect(fraseRepeticion('MENSUAL', 15, '2026-11-15')).toBe('el día 15 de cada mes');
  });

  it('reconoce el último día del mes', () => {
    expect(esUltimoDiaDelMes('2026-11-30')).toBe(true);
    expect(esUltimoDiaDelMes('2026-10-30')).toBe(false);
    expect(esUltimoDiaDelMes('2028-02-29')).toBe(true);
  });
});
