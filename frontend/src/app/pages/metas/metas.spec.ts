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
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

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
