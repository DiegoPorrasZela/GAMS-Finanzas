import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controlador: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem(
      'gams-sesion',
      JSON.stringify({
        token: 'token-de-prueba',
        expiraEn: '2099-01-01T00:00:00Z',
        usuario: { id: 2, nombre: 'Usuario Demo', email: 'demo@gams.pe', rol: 'USUARIO' },
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controlador = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controlador.verify();
    localStorage.clear();
  });

  it('should send the token to our backend', () => {
    http.get(`${environment.apiUrl}/movimientos`).subscribe();
    const peticion = controlador.expectOne(`${environment.apiUrl}/movimientos`);

    expect(peticion.request.headers.get('Authorization')).toBe('Bearer token-de-prueba');
    peticion.flush([]);
  });

  it('should not send the token to external APIs', () => {
    http.get('https://api.frankfurter.dev/v2/currencies').subscribe();
    const peticion = controlador.expectOne('https://api.frankfurter.dev/v2/currencies');

    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush([]);
  });

  it('should close the session and go to login when the token expired (401)', () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const auth = TestBed.inject(AuthService);

    http.get(`${environment.apiUrl}/movimientos`).subscribe({ error: () => {} });
    controlador
      .expectOne(`${environment.apiUrl}/movimientos`)
      .flush({ detail: 'Debes iniciar sesión' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.usuario()).toBeNull();
    expect(navegar).toHaveBeenCalledWith(['/login'], { queryParams: { expirada: 1 } });
  });
});
