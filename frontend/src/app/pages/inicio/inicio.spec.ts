import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { mesActual } from '../../utils/fechas';
import { Inicio } from './inicio';

const api = environment.apiUrl;
const mes = mesActual();
const [anio, numeroMes] = mes.split('-').map(Number);

const movimientos = [
  {
    id: 1,
    descripcion: 'Pago de prácticas',
    monto: 1500,
    fecha: `${mes}-01`,
    tipo: 'INGRESO',
    categoriaId: 1,
    categoria: 'Sueldo',
  },
  {
    id: 2,
    descripcion: 'Menú',
    monto: 450,
    fecha: `${mes}-01`,
    tipo: 'GASTO',
    categoriaId: 6,
    categoria: 'Comida',
  },
  {
    id: 3,
    descripcion: 'Cine',
    monto: 50,
    fecha: `${mes}-01`,
    tipo: 'GASTO',
    categoriaId: 11,
    categoria: 'Ocio',
  },
  {
    id: 4,
    descripcion: 'Gasto antiguo',
    monto: 100,
    fecha: '2020-01-15',
    tipo: 'GASTO',
    categoriaId: 6,
    categoria: 'Comida',
  },
  // Separado a ahorros: sale del saldo, pero no es un gasto (cuenta como ahorro del mes)
  {
    id: 5,
    descripcion: 'Ahorro',
    monto: 300,
    fecha: `${mes}-01`,
    tipo: 'GASTO',
    categoriaId: 15,
    categoria: 'Ahorro',
  },
];
const metas = [
  {
    id: 1,
    nombre: 'Laptop',
    montoObjetivo: 2500,
    fechaLimite: null,
    ahorrado: 250,
    faltante: 2250,
    porcentaje: 10,
    aportes: [],
  },
];

describe('Inicio', () => {
  let fixture: ComponentFixture<Inicio>;
  let http: HttpTestingController;
  let texto: () => string;

  async function crear(presupuestos: unknown[]) {
    await TestBed.configureTestingModule({
      imports: [Inicio],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Inicio);
    http = TestBed.inject(HttpTestingController);
    texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

    http.expectOne(`${api}/movimientos`).flush(movimientos);
    http.expectOne(`${api}/presupuestos`).flush(presupuestos);
    http.expectOne(`${api}/metas`).flush(metas);
    http.expectOne(`${api}/categorias`).flush([
      { id: 1, nombre: 'Sueldo', tipo: 'INGRESO' },
      { id: 14, nombre: 'Saldo inicial', tipo: 'INGRESO' },
      { id: 6, nombre: 'Comida', tipo: 'GASTO' },
    ]);
    await fixture.whenStable();
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('should register the initial balance from the card, only once', async () => {
    await crear([]);
    expect(texto()).toContain('¿Con cuánto dinero empezaste?');

    const monto = fixture.nativeElement.querySelector('#saldo-inicial') as HTMLInputElement;
    monto.value = '350';
    monto.dispatchEvent(new Event('input'));
    monto.closest('form')!.dispatchEvent(new Event('submit'));

    const peticion = http.expectOne({ method: 'POST', url: `${api}/movimientos` });
    expect(peticion.request.body).toEqual({
      descripcion: 'Saldo inicial',
      monto: 350,
      fecha: expect.any(String),
      categoriaId: 14,
    });
    peticion.flush({
      id: 9,
      descripcion: 'Saldo inicial',
      monto: 350,
      fecha: `${mes}-01`,
      tipo: 'INGRESO',
      categoriaId: 14,
      categoria: 'Saldo inicial',
      automatico: false,
    });
    await fixture.whenStable();

    // Ya tiene saldo inicial: la tarjeta desaparece
    expect(texto()).not.toContain('¿Con cuánto dinero empezaste?');
    expect(texto()).toContain('950.00'); // saldo: 600 + 350
  });

  it('should hide the initial balance card when the user starts without money', async () => {
    await crear([]);
    const boton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (b: HTMLButtonElement) => b.textContent?.trim() === 'Empiezo sin dinero',
    ) as HTMLButtonElement;
    boton.click();
    await fixture.whenStable();

    expect(texto()).not.toContain('¿Con cuánto dinero empezaste?');
  });

  it('should show the month totals, the budget alert and the spending by category', async () => {
    await crear([{ anio, mes: numeroMes, limiteGasto: 600, ahorroObjetivo: 300 }]);

    expect(texto()).toContain('600.00'); // disponible: 1500 − 450 − 50 − 100 − 300 separados
    expect(texto()).toContain('En ahorros S/ 50.00'); // 300 separados − 250 en metas
    expect(texto()).toContain('500.00'); // gastos del mes: el ahorro NO cuenta como gasto
    expect(texto()).toContain('Cuidado: ya usaste el 83 %'); // 500 de 600
    expect(texto()).toContain('Cumpliste tu meta de ahorro'); // separó 300 de 300
    expect(texto()).toContain('90 %'); // Comida: 450 de 500 (el ahorro no aparece en el gráfico)
    expect(texto()).toContain('Laptop');
  });

  it('should let the user define the budget of the month', async () => {
    await crear([]);
    expect(texto()).toContain('Aún no tienes presupuesto');

    const boton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (b: HTMLButtonElement) => b.textContent?.trim() === 'Definir presupuesto',
    ) as HTMLButtonElement;
    boton.click();
    await fixture.whenStable();

    const limite = fixture.nativeElement.querySelector('#limite') as HTMLInputElement;
    limite.value = '800';
    limite.dispatchEvent(new Event('input'));
    limite.closest('form')!.dispatchEvent(new Event('submit'));

    const peticion = http.expectOne({
      method: 'PUT',
      url: `${api}/presupuestos/${anio}/${numeroMes}`,
    });
    expect(peticion.request.body).toEqual({ limiteGasto: 800, ahorroObjetivo: 0 });
    peticion.flush({ anio, mes: numeroMes, limiteGasto: 800, ahorroObjetivo: 0 });
    await fixture.whenStable();

    expect(texto()).toContain('Gastaste');
    expect(texto()).toContain('63 %'); // 500 de 800
  });
});
