import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GraficoMeses, ResumenMes } from './grafico-meses';

const mes = (clave: string, ingresos: number, gastos: number): ResumenMes => ({
  clave,
  etiqueta: clave.slice(5),
  nombre: `Mes ${clave}`,
  ingresos,
  gastos,
  ahorro: 0,
});

describe('GraficoMeses', () => {
  let fixture: ComponentFixture<GraficoMeses>;
  let grafico: HTMLElement;

  async function dibujar(meses: ResumenMes[]) {
    fixture = TestBed.createComponent(GraficoMeses);
    fixture.componentRef.setInput('meses', meses);
    fixture.componentRef.setInput('seleccionado', meses.at(-1)?.clave ?? '');
    grafico = fixture.nativeElement;
    await fixture.whenStable();
  }

  it('dibuja dos columnas por mes, con alturas proporcionales a la mayor', async () => {
    await dibujar([mes('2026-10', 1000, 500), mes('2026-11', 2000, 0)]);

    const columnas = grafico.querySelectorAll<HTMLElement>('[role="img"]');
    expect(columnas.length).toBe(2);
    const [ingresos, gastos] = [...columnas[0].querySelectorAll<HTMLElement>('.bg-green-500, .bg-red-600')];
    expect(ingresos.style.height).toBe('50%'); // 1000 de un eje que llega a 2000
    expect(gastos.style.height).toBe('25%');
    expect(columnas[1].getAttribute('aria-label')).toBe(
      'Mes 2026-11: ingresos S/ 2,000.00, gastos S/ 0.00',
    );
  });

  it('tiene leyenda y la tabla con los mismos datos', async () => {
    await dibujar([mes('2026-10', 1000, 1200)]);

    expect(grafico.textContent).toContain('Ingresos');
    expect(grafico.textContent).toContain('Gastos');
    const filas = grafico.querySelectorAll('tbody tr');
    expect(filas.length).toBe(1);
    expect(filas[0].textContent).toContain('S/ 1,000.00');
    expect(filas[0].textContent).toContain('− S/ 200.00'); // gastó más de lo que ganó
  });

  it('muestra un mensaje si todavía no hay datos', async () => {
    await dibujar([mes('2026-10', 0, 0), mes('2026-11', 0, 0)]);

    expect(grafico.querySelector('figure')).toBeNull();
    expect(grafico.textContent).toContain('aquí verás cómo cambian mes a mes');
  });
});
