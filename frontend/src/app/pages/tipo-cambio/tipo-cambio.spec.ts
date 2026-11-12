import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TipoCambio } from './tipo-cambio';

describe('TipoCambio', () => {
  let fixture: ComponentFixture<TipoCambio>;
  let http: HttpTestingController;

  const tasasUsdPen = [
    { date: '2026-09-22', base: 'USD', quote: 'PEN', rate: 3.3614 },
    { date: '2026-09-23', base: 'USD', quote: 'PEN', rate: 3.3698 },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TipoCambio],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TipoCambio);
    http = TestBed.inject(HttpTestingController);

    http
      .expectOne((req) => req.url.endsWith('/currencies'))
      .flush([
        { iso_code: 'USD', name: 'United States Dollar', type: 'currency' },
        { iso_code: 'PEN', name: 'Peruvian Sol', type: 'currency' },
        { iso_code: 'EUR', name: 'Euro', type: 'currency' },
        { iso_code: 'KRW', name: 'South Korean Won', type: 'currency' },
        // La API también trae criptomonedas (algunas con 4 letras) y metales: no son monedas
        { iso_code: 'AAVE', name: 'Aave', type: 'crypto' },
        { iso_code: 'BTC', name: 'Bitcoin', type: 'crypto' },
        { iso_code: 'XAU', name: 'Gold', type: 'metal' },
      ]);
  });

  afterEach(() => http.verify());

  const texto = () => (fixture.nativeElement as HTMLElement).textContent;

  it('should list every currency from the API, without cryptocurrencies or metals', async () => {
    http.expectOne((r) => r.url.endsWith('/rates')).flush(tasasUsdPen);
    await fixture.whenStable();
    const select = (fixture.nativeElement as HTMLElement).querySelector('select')!;

    expect(select.querySelector('option[value="KRW"]')?.textContent).toContain('KRW');
    expect(select.querySelector('option[value="AAVE"]')).toBeNull();
    expect(select.querySelector('option[value="BTC"]')).toBeNull();
    expect(select.querySelector('option[value="XAU"]')).toBeNull();
  });

  it('should convert from USD to PEN by default', async () => {
    const req = http.expectOne((r) => r.url.endsWith('/rates'));
    expect(req.request.params.get('base')).toBe('USD');
    expect(req.request.params.get('quotes')).toBe('PEN');
    req.flush(tasasUsdPen);
    await fixture.whenStable();

    expect(texto()).toContain('3.3698');
    expect(texto()).toMatch(/S\/\s336\.98/); // 100 USD convertidos a soles
  });

  it('should request the swapped pair when inverting', async () => {
    http.expectOne((r) => r.url.endsWith('/rates')).flush(tasasUsdPen);
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[aria-label="Intercambiar monedas"]')!
      .click();

    const req = http.expectOne((r) => r.url.endsWith('/rates'));
    expect(req.request.params.get('base')).toBe('PEN');
    expect(req.request.params.get('quotes')).toBe('USD');
    req.flush([]);
  });

  it('should show an error message when the API fails', async () => {
    http
      .expectOne((r) => r.url.endsWith('/rates'))
      .flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(texto()).toContain('No se pudo obtener el tipo de cambio');
  });
});
