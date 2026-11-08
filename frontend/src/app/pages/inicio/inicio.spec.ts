import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Inicio } from './inicio';

describe('Inicio', () => {
  it('should show the totals of the user movements', async () => {
    await TestBed.configureTestingModule({
      imports: [Inicio],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(Inicio);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${environment.apiUrl}/movimientos`).flush([
      { id: 1, descripcion: 'Pago', monto: 1500, fecha: '2026-11-07', tipo: 'INGRESO', categoriaId: 1, categoria: 'Sueldo' },
      { id: 2, descripcion: 'Menú', monto: 45, fecha: '2026-11-06', tipo: 'GASTO', categoriaId: 6, categoria: 'Comida' },
    ]);
    await fixture.whenStable();

    const texto = (fixture.nativeElement as HTMLElement).textContent;
    expect(texto).toContain('1,455.00'); // saldo
    expect(texto).toContain('Menú');
    http.verify();
  });
});
