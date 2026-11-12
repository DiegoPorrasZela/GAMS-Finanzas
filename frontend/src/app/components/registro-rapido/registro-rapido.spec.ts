import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { DialogoService } from '../../services/dialogo.service';
import { RegistroRapidoService } from '../../services/registro-rapido.service';
import { ToastService } from '../../services/toast.service';
import { RegistroRapido } from './registro-rapido';

const api = environment.apiUrl;

const categorias = [
  { id: 1, nombre: 'Sueldo', tipo: 'INGRESO' },
  { id: 2, nombre: 'Saldo inicial', tipo: 'INGRESO' },
  { id: 3, nombre: 'Ahorro', tipo: 'GASTO' },
  { id: 6, nombre: 'Comida', tipo: 'GASTO' },
];
const movimientos = [
  { id: 1, descripcion: 'Pago de prácticas', monto: 300, fecha: '2026-11-07', tipo: 'INGRESO', categoriaId: 1, categoria: 'Sueldo', automatico: false },
  { id: 2, descripcion: 'Menú del almuerzo', monto: 15, fecha: '2026-11-06', tipo: 'GASTO', categoriaId: 6, categoria: 'Comida', automatico: false },
];

describe('RegistroRapido', () => {
  let fixture: ComponentFixture<RegistroRapido>;
  let http: HttpTestingController;
  let hoja: HTMLElement;
  let servicio: RegistroRapidoService;

  const escribir = (id: string, valor: string) => {
    const input = hoja.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  };
  const enviar = () => hoja.querySelector('form')!.dispatchEvent(new Event('submit'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistroRapido],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistroRapido);
    http = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(RegistroRapidoService);
    hoja = fixture.nativeElement;
    await fixture.whenStable();

    // Al abrir carga datos frescos (para autocompletar y para el aviso de saldo)
    servicio.abrir();
    await fixture.whenStable();
    http.expectOne(`${api}/categorias`).flush(categorias);
    http.expectOne(`${api}/movimientos`).flush(movimientos);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('should open the sheet and only offer regular categories', () => {
    expect(hoja.querySelector('dialog')!.hasAttribute('open')).toBe(true);
    const opciones = [...hoja.querySelectorAll('#rapido-categoria option')].map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Comida']); // "Ahorro" es del sistema: se maneja en Metas
  });

  it('should register an expense, notify and close', async () => {
    escribir('rapido-monto', '12.50');
    escribir('rapido-descripcion', 'Pasaje');
    enviar();
    await fixture.whenStable();

    const peticion = http.expectOne({ method: 'POST', url: `${api}/movimientos` });
    expect(peticion.request.body).toMatchObject({ descripcion: 'Pasaje', monto: 12.5, categoriaId: 6 });
    peticion.flush({ id: 9, descripcion: 'Pasaje', monto: 12.5, fecha: '2026-11-11', tipo: 'GASTO', categoriaId: 6, categoria: 'Comida', automatico: false });
    await fixture.whenStable();

    expect(servicio.abierto()).toBe(false);
    const textos = TestBed.inject(ToastService).toasts().map((t) => t.texto).join(' ');
    expect(textos).toContain('Gasto registrado: Pasaje');
  });

  it('should register an income with an income category', async () => {
    [...hoja.querySelectorAll<HTMLButtonElement>('[aria-label="Tipo"] button')]
      .find((b) => b.textContent?.includes('Ingreso'))!
      .click();
    await fixture.whenStable();
    escribir('rapido-monto', '650');
    escribir('rapido-descripcion', 'Quincena');
    enviar();
    await fixture.whenStable();

    const peticion = http.expectOne({ method: 'POST', url: `${api}/movimientos` });
    expect(peticion.request.body).toMatchObject({ monto: 650, categoriaId: 1 }); // "Saldo inicial" no se ofrece
  });

  it('should ask before saving an expense that leaves the balance negative', async () => {
    const confirmar = vi.spyOn(TestBed.inject(DialogoService), 'confirmar').mockResolvedValue(false);
    escribir('rapido-monto', '500');
    escribir('rapido-descripcion', 'Celular');
    enviar();
    await fixture.whenStable();

    expect(confirmar).toHaveBeenCalledWith(
      expect.objectContaining({ tono: 'aviso', mensaje: expect.stringContaining('S/ -215.00') }),
    );
    expect(servicio.abierto()).toBe(true); // al elegir "Revisar" sigue abierto y no se envía nada
  });

  it('should not send an empty form', async () => {
    enviar();
    await fixture.whenStable();

    expect(hoja.textContent).toContain('Ingresa un monto mayor a 0');
    expect(hoja.textContent).toContain('Escribe una descripción');
  });
});
