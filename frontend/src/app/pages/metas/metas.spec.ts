import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { Metas } from './metas';

const api = environment.apiUrl;
const laptop = {
  id: 1,
  nombre: 'Laptop',
  montoObjetivo: 2500,
  fechaLimite: '2099-12-31',
  ahorrado: 550,
  faltante: 1950,
  porcentaje: 22,
  aportes: [{ id: 7, monto: 550, fecha: '2026-11-01' }],
};

describe('Metas', () => {
  let fixture: ComponentFixture<Metas>;
  let http: HttpTestingController;
  let pagina: HTMLElement;

  const escribir = (selector: string, valor: string) => {
    const input = pagina.querySelector<HTMLInputElement>(selector)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  };
  const boton = (texto: string) =>
    [...pagina.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Metas],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Metas);
    http = TestBed.inject(HttpTestingController);
    pagina = fixture.nativeElement;
    http.expectOne(`${api}/metas`).flush([laptop]);
    // Ganó S/ 3000 y separó S/ 2000 a ahorros; S/ 550 ya están en la meta → S/ 1450 libres en ahorros
    http.expectOne(`${api}/movimientos`).flush([
      { id: 1, descripcion: 'Sueldo', monto: 3000, fecha: '2026-11-01', tipo: 'INGRESO', categoriaId: 1, categoria: 'Sueldo', automatico: false },
      { id: 2, descripcion: 'Ahorro', monto: 2000, fecha: '2026-11-01', tipo: 'GASTO', categoriaId: 15, categoria: 'Ahorro', automatico: false },
    ]);
    http.expectOne(`${api}/categorias`).flush([
      { id: 1, nombre: 'Sueldo', tipo: 'INGRESO' },
      { id: 15, nombre: 'Ahorro', tipo: 'GASTO' },
      { id: 16, nombre: 'Retiro de ahorros', tipo: 'INGRESO' },
    ]);
    http.expectOne(`${api}/recurrentes`).flush([]);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('should show the savings: free, in goals and total', () => {
    expect(pagina.textContent).toContain('1,450.00'); // libres
    expect(pagina.textContent).toContain('550.00'); // en metas
    expect(pagina.textContent).toContain('2,000.00'); // total ahorrado
    expect(pagina.textContent).toContain('Tu saldo para gastar: S/ 1,000.00');
  });

  it('should not send a contribution bigger than the free savings', async () => {
    boton('+ Aportar').click();
    await fixture.whenStable();

    escribir('#monto-aporte-1', '5000');
    pagina.querySelectorAll('form')[1].dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(pagina.textContent).toContain('En tus ahorros tienes S/ 1450.00 libres');
    // No se envió nada al backend (http.verify() lo comprueba)
  });

  it('should separate money to savings once (it shows as "Ahorro" in Movimientos)', async () => {
    boton('+ Separar a ahorros').click();
    await fixture.whenStable();
    escribir('#monto-ahorro', '200');
    pagina.querySelector('#monto-ahorro')!.closest('form')!.dispatchEvent(new Event('submit'));

    const peticion = http.expectOne({ method: 'POST', url: `${api}/movimientos` });
    expect(peticion.request.body).toEqual({ descripcion: 'Ahorro', monto: 200, fecha: expect.any(String), categoriaId: 15 });
    peticion.flush({ id: 3, descripcion: 'Ahorro', monto: 200, fecha: '2026-11-09', tipo: 'GASTO', categoriaId: 15, categoria: 'Ahorro', automatico: false });
    await fixture.whenStable();

    expect(pagina.textContent).toContain('Separaste S/ 200.00 a tus ahorros');
    expect(pagina.textContent).toContain('1,650.00'); // libres: 1450 + 200
  });

  it('should separate money automatically every week', async () => {
    boton('+ Separar a ahorros').click();
    await fixture.whenStable();
    escribir('#monto-ahorro', '25');
    const frecuencia = pagina.querySelector<HTMLSelectElement>('#frecuencia-ahorro')!;
    frecuencia.value = 'SEMANAL';
    frecuencia.dispatchEvent(new Event('change'));
    frecuencia.closest('form')!.dispatchEvent(new Event('submit'));

    const peticion = http.expectOne({ method: 'POST', url: `${api}/recurrentes` });
    expect(peticion.request.body).toMatchObject({ monto: 25, categoriaId: 15, frecuencia: 'SEMANAL' });
    peticion.flush({ id: 1, descripcion: 'Ahorro automático', monto: 25, tipo: 'GASTO', categoriaId: 15, categoria: 'Ahorro', frecuencia: 'SEMANAL', dia: 9, proximoCargo: '2026-11-16', activo: true });
    // El backend ya registró el de hoy: se vuelve a cargar la lista
    http.expectOne(`${api}/movimientos`).flush([]);
    await fixture.whenStable();

    expect(pagina.textContent).toContain('Se separarán S/ 25.00 a tus ahorros cada semana');
  });

  it('should not withdraw more than the free savings', async () => {
    boton('Retirar').click();
    await fixture.whenStable();
    escribir('#monto-ahorro', '5000');
    pagina.querySelector('#monto-ahorro')!.closest('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(pagina.textContent).toContain('Solo tienes S/ 1450.00 libres en tus ahorros para retirar');
  });

  it('should show the progress and how much to save per month', () => {
    expect(pagina.textContent).toContain('Laptop');
    expect(pagina.textContent).toContain('22 %');
    expect(pagina.textContent).toContain('al mes');
  });

  it('should create a goal without deadline', async () => {
    escribir('#nombre-meta', 'Viaje');
    escribir('#objetivo', '800');
    pagina.querySelector('form')!.dispatchEvent(new Event('submit'));

    const peticion = http.expectOne({ method: 'POST', url: `${api}/metas` });
    expect(peticion.request.body).toEqual({ nombre: 'Viaje', montoObjetivo: 800, fechaLimite: null });
    peticion.flush({ ...laptop, id: 2, nombre: 'Viaje', montoObjetivo: 800, fechaLimite: null, ahorrado: 0, faltante: 800, porcentaje: 0, aportes: [] });
    await fixture.whenStable();

    expect(pagina.textContent).toContain('Meta "Viaje" creada');
  });

  it('should register a contribution and update the progress', async () => {
    boton('+ Aportar').click();
    await fixture.whenStable();

    escribir('#monto-aporte-1', '100');
    pagina.querySelectorAll('form')[1].dispatchEvent(new Event('submit'));

    const peticion = http.expectOne({ method: 'POST', url: `${api}/metas/1/aportes` });
    expect(peticion.request.body).toEqual({ monto: 100, fecha: expect.any(String) });
    peticion.flush({ ...laptop, ahorrado: 650, faltante: 1850, porcentaje: 26 });
    await fixture.whenStable();

    expect(pagina.textContent).toContain('26 %');
    expect(pagina.textContent).toContain('Aporte de S/ 100.00 registrado');
  });
});
