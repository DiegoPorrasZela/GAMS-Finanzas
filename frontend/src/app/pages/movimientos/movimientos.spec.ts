import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Movimientos } from './movimientos';

describe('Movimientos', () => {
  let fixture: ComponentFixture<Movimientos>;
  let pagina: HTMLElement;

  const filas = () => pagina.querySelectorAll('ul > li');

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Movimientos],
    }).compileComponents();

    fixture = TestBed.createComponent(Movimientos);
    pagina = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('should list the sample movements', () => {
    expect(filas().length).toBe(7);
    expect(pagina.textContent).toContain('Pago de prácticas');
  });

  it('should add a movement from the form', async () => {
    const escribir = (id: string, valor: string) => {
      const input = pagina.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = valor;
      input.dispatchEvent(new Event('input'));
    };
    escribir('descripcion', 'Pasaje a la universidad');
    escribir('monto', '3.5');
    pagina.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(filas().length).toBe(8);
    expect(pagina.textContent).toContain('Pasaje a la universidad');
  });

  it('should not add a movement when the form is invalid', async () => {
    pagina.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(filas().length).toBe(7);
    expect(pagina.textContent).toContain('Escribe una descripción');
  });

  it('should filter by type', async () => {
    const botonIngresos = [...pagina.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Ingresos',
    )!;
    botonIngresos.click();
    await fixture.whenStable();

    expect(filas().length).toBe(2);
  });
});
