import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../services/toast.service';
import { DialogoService } from '../../services/dialogo.service';
import { Movimientos } from './movimientos';

const api = environment.apiUrl;

// Así responde el backend (tipo en mayúsculas)
const categorias = [
  { id: 1, nombre: 'Sueldo', tipo: 'INGRESO' },
  { id: 6, nombre: 'Comida', tipo: 'GASTO' },
  { id: 7, nombre: 'Transporte', tipo: 'GASTO' },
];
const movimientos = [
  { id: 1, descripcion: 'Pago de prácticas', monto: 1500, fecha: '2026-11-07', tipo: 'INGRESO', categoriaId: 1, categoria: 'Sueldo', automatico: false },
  { id: 2, descripcion: 'Menú del almuerzo', monto: 15, fecha: '2026-11-06', tipo: 'GASTO', categoriaId: 6, categoria: 'Comida', automatico: false },
  { id: 3, descripcion: 'Recarga de tarjeta', monto: 30, fecha: '2026-11-05', tipo: 'GASTO', categoriaId: 7, categoria: 'Transporte', automatico: false },
];

describe('Movimientos', () => {
  let fixture: ComponentFixture<Movimientos>;
  let http: HttpTestingController;
  let pagina: HTMLElement;

  const filas = () => pagina.querySelectorAll('ul[aria-label="Lista de movimientos"] > li');
  const escribir = (id: string, valor: string) => {
    const input = pagina.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  };
  // Mensajes que se mostraron como notificaciones flotantes
  const notificaciones = () => TestBed.inject(ToastService).toasts().map((t) => t.texto).join(' | ');
  const enviarFormulario = () => pagina.querySelector('form')!.dispatchEvent(new Event('submit'));
  const elegirIngreso = () =>
    [...pagina.querySelectorAll('button')].find((b) => b.textContent?.includes('▲ Ingreso'))!.click();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Movimientos],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Movimientos);
    http = TestBed.inject(HttpTestingController);
    pagina = fixture.nativeElement;

    http.expectOne(`${api}/movimientos`).flush(movimientos);
    http.expectOne(`${api}/categorias`).flush(categorias);
    http.expectOne(`${api}/recurrentes`).flush([]);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('should create an automatic movement when "Repetir cada mes" is checked', async () => {
    escribir('descripcion', 'Sueldo');
    escribir('monto', '1200');
    pagina.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    enviarFormulario();

    const peticion = http.expectOne({ method: 'POST', url: `${api}/recurrentes` });
    expect(peticion.request.body).toMatchObject({ descripcion: 'Sueldo', monto: 1200, categoriaId: 6 });
    peticion.flush({ id: 1, descripcion: 'Sueldo', monto: 1200, tipo: 'GASTO', categoriaId: 6, categoria: 'Comida', frecuencia: 'MENSUAL', dia: 9, proximoCargo: '2099-01-09', activo: true });
    // El backend ya registró el primer movimiento: la lista se vuelve a cargar
    http.expectOne(`${api}/movimientos`).flush(movimientos);
    await fixture.whenStable();

    expect(notificaciones()).toContain('se registrará automáticamente');
    expect(pagina.textContent).toContain('día 9 de cada mes');
  });

  it('should schedule a biweekly salary (15th and last day of the month)', async () => {
    elegirIngreso();
    escribir('descripcion', 'Sueldo quincenal');
    escribir('monto', '650');
    pagina.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await fixture.whenStable();
    const frecuencia = pagina.querySelector<HTMLSelectElement>('#frecuencia')!;
    frecuencia.value = 'QUINCENAL';
    frecuencia.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(pagina.textContent).toContain('el 15 y el último día de cada mes');
    expect(pagina.textContent).toContain('Primer registro');

    enviarFormulario();
    const peticion = http.expectOne({ method: 'POST', url: `${api}/recurrentes` });
    expect(peticion.request.body).toMatchObject({ descripcion: 'Sueldo quincenal', monto: 650, frecuencia: 'QUINCENAL' });
    peticion.flush({ id: 2, descripcion: 'Sueldo quincenal', monto: 650, tipo: 'INGRESO', categoriaId: 1, categoria: 'Sueldo', frecuencia: 'QUINCENAL', dia: 15, proximoCargo: '2099-01-15', activo: true });
    http.expectOne(`${api}/movimientos`).flush(movimientos);
    await fixture.whenStable();

    expect(pagina.textContent).toContain('El 15 y el último día de cada mes'); // en la tarjeta de automáticos
  });

  it('should offer "last day of the month" for monthly salaries', async () => {
    pagina.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await fixture.whenStable();
    const dia = pagina.querySelector<HTMLSelectElement>('#dia')!;
    const opciones = [...dia.options].map((o) => o.textContent?.trim());

    expect(opciones).toContain('Último día del mes');
    dia.value = dia.options[dia.options.length - 1].value; // "Último día del mes"
    dia.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(pagina.textContent).toContain('el último día de cada mes');
  });

  it('should ask before saving an expense that leaves the balance negative', async () => {
    const confirmar = vi.spyOn(TestBed.inject(DialogoService), 'confirmar').mockResolvedValue(false);
    escribir('descripcion', 'Laptop');
    escribir('monto', '5000');
    enviarFormulario();
    await fixture.whenStable();

    expect(confirmar).toHaveBeenCalledWith(
      expect.objectContaining({ tono: 'aviso', mensaje: expect.stringContaining('S/ -3,545.00') }),
    );
    // Al cancelar no se envía nada (http.verify() lo comprueba)
  });

  it('should not accept a future date', async () => {
    escribir('descripcion', 'Algo');
    escribir('monto', '10');
    escribir('fecha', '2099-01-01');
    enviarFormulario();
    await fixture.whenStable();

    expect(pagina.textContent).toContain('La fecha no puede ser futura');
  });

  it('should suggest previous descriptions and fill category and amount when one is chosen', async () => {
    const sugerencias = [...pagina.querySelectorAll('#descripciones-anteriores option')].map(
      (o) => (o as HTMLOptionElement).value,
    );
    expect(sugerencias).toEqual(['Menú del almuerzo', 'Recarga de tarjeta']); // solo gastos

    escribir('descripcion', 'menú del almuerzo');
    pagina.querySelector('#descripcion')!.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(pagina.querySelector<HTMLInputElement>('#monto')!.value).toBe('15');
    expect(pagina.querySelector<HTMLSelectElement>('#categoria')!.selectedOptions[0].textContent?.trim()).toBe(
      'Comida',
    );
  });

  it('should copy a movement to the form with today\'s date ("Registrar de nuevo")', async () => {
    pagina.querySelector<HTMLButtonElement>('button[aria-label="Registrar de nuevo Recarga de tarjeta"]')!.click();
    await fixture.whenStable();

    expect(pagina.querySelector<HTMLInputElement>('#descripcion')!.value).toBe('Recarga de tarjeta');
    expect(pagina.querySelector<HTMLInputElement>('#monto')!.value).toBe('30');
    expect(pagina.querySelector<HTMLInputElement>('#fecha')!.value).not.toBe('2026-11-05'); // la de hoy
    expect(pagina.textContent).toContain('Nuevo movimiento'); // no es edición: se registra uno nuevo
  });

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
    const confirmar = vi.spyOn(TestBed.inject(DialogoService), 'confirmar').mockResolvedValue(true);
    pagina.querySelector<HTMLButtonElement>('button[aria-label="Eliminar Menú del almuerzo"]')!.click();
    await fixture.whenStable(); // espera la respuesta del diálogo

    expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({ tono: 'peligro', confirmar: 'Eliminar' }));
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
