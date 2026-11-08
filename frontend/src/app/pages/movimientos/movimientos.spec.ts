import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { Movimientos } from './movimientos';

const api = environment.apiUrl;

// Así responde el backend (tipo en mayúsculas)
const categorias = [
  { id: 1, nombre: 'Sueldo', tipo: 'INGRESO' },
  { id: 6, nombre: 'Comida', tipo: 'GASTO' },
  { id: 7, nombre: 'Transporte', tipo: 'GASTO' },
];
const movimientos = [
  { id: 1, descripcion: 'Pago de prácticas', monto: 1500, fecha: '2026-11-07', tipo: 'INGRESO', categoriaId: 1, categoria: 'Sueldo' },
  { id: 2, descripcion: 'Menú del almuerzo', monto: 15, fecha: '2026-11-06', tipo: 'GASTO', categoriaId: 6, categoria: 'Comida' },
  { id: 3, descripcion: 'Recarga de tarjeta', monto: 30, fecha: '2026-11-05', tipo: 'GASTO', categoriaId: 7, categoria: 'Transporte' },
];

describe('Movimientos', () => {
  let fixture: ComponentFixture<Movimientos>;
  let http: HttpTestingController;
  let pagina: HTMLElement;

  const filas = () => pagina.querySelectorAll('ul > li');
  const escribir = (id: string, valor: string) => {
    const input = pagina.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  };
  const enviarFormulario = () => pagina.querySelector('form')!.dispatchEvent(new Event('submit'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Movimientos],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Movimientos);
    http = TestBed.inject(HttpTestingController);
    pagina = fixture.nativeElement;

    http.expectOne(`${api}/movimientos`).flush(movimientos);
    http.expectOne(`${api}/categorias`).flush(categorias);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('should list the movements from the API', () => {
    expect(filas().length).toBe(3);
    expect(pagina.textContent).toContain('Pago de prácticas');
  });

  it('should add a movement with the first category of the chosen type', async () => {
    escribir('descripcion', 'Pasaje a la universidad');
    escribir('monto', '3.5');
    enviarFormulario();

    const peticion = http.expectOne({ method: 'POST', url: `${api}/movimientos` });
    expect(peticion.request.body).toEqual({
      descripcion: 'Pasaje a la universidad',
      monto: 3.5,
      categoriaId: 6,
      fecha: expect.any(String),
    });
    peticion.flush({ ...movimientos[1], id: 4, descripcion: 'Pasaje a la universidad', monto: 3.5 });
    await fixture.whenStable();

    expect(filas().length).toBe(4);
    expect(pagina.textContent).toContain('Pasaje a la universidad');
  });

  it('should not send anything when the form is invalid', async () => {
    enviarFormulario();
    await fixture.whenStable();

    expect(pagina.textContent).toContain('Escribe una descripción');
  });

  it('should edit a movement', async () => {
    pagina.querySelector<HTMLButtonElement>('button[aria-label="Editar Menú del almuerzo"]')!.click();
    await fixture.whenStable();
    expect(pagina.querySelector<HTMLInputElement>('#descripcion')!.value).toBe('Menú del almuerzo');
    expect(pagina.textContent).toContain('Editar movimiento');

    escribir('monto', '18');
    enviarFormulario();

    const peticion = http.expectOne({ method: 'PUT', url: `${api}/movimientos/2` });
    expect(peticion.request.body).toMatchObject({ monto: 18, categoriaId: 6 });
    peticion.flush({ ...movimientos[1], monto: 18 });
    await fixture.whenStable();

    expect(pagina.textContent).toContain('18.00');
    expect(pagina.textContent).toContain('Nuevo movimiento');
  });

  it('should delete a movement after confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    pagina.querySelector<HTMLButtonElement>('button[aria-label="Eliminar Menú del almuerzo"]')!.click();

    http.expectOne({ method: 'DELETE', url: `${api}/movimientos/2` }).flush(null);
    await fixture.whenStable();

    expect(filas().length).toBe(2);
    expect(pagina.textContent).not.toContain('Menú del almuerzo');
  });

  it('should show the server message when saving fails', async () => {
    escribir('descripcion', 'Algo');
    escribir('monto', '10');
    enviarFormulario();

    http
      .expectOne({ method: 'POST', url: `${api}/movimientos` })
      .flush({ detail: 'La categoría 6 no existe' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(pagina.textContent).toContain('La categoría 6 no existe');
  });

  it('should filter by type', async () => {
    const botonIngresos = [...pagina.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Ingresos',
    )!;
    botonIngresos.click();
    await fixture.whenStable();

    expect(filas().length).toBe(1);
  });
});
