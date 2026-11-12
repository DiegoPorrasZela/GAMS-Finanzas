import { mesCorto, mesesHastaIncluido, sumarDias, tituloDia } from './fechas';

describe('Fechas de la lista y del gráfico', () => {
  it('suma y resta días cruzando meses y años', () => {
    expect(sumarDias('2026-11-02', -7)).toBe('2026-10-26');
    expect(sumarDias('2026-12-30', 3)).toBe('2027-01-02');
    expect(sumarDias('2028-03-01', -1)).toBe('2028-02-29'); // año bisiesto
  });

  it('titula los días como "Hoy", "Ayer" o con su fecha', () => {
    expect(tituloDia('2026-11-11', '2026-11-11')).toBe('Hoy');
    expect(tituloDia('2026-11-10', '2026-11-11')).toBe('Ayer');
    expect(tituloDia('2026-11-03', '2026-11-11')).toBe('Martes, 3 de noviembre');
    expect(tituloDia('2025-12-31', '2026-11-11')).toContain('2025'); // de otro año, con el año
  });

  it('arma los 6 meses que terminan en el mes elegido, cruzando el año', () => {
    expect(mesesHastaIncluido('2026-02', 6)).toEqual([
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('abrevia los meses y agrega el año si no es el del mes elegido', () => {
    expect(mesCorto('2026-11', '2026-11')).toBe('nov');
    expect(mesCorto('2025-12', '2026-02')).toBe('dic 2025');
  });
});
