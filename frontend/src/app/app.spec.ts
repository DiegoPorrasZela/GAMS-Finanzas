import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  async function crearNavbar(): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).querySelector('nav')!;
  }

  afterEach(() => localStorage.clear());

  it('should show only public links when there is no session', async () => {
    const nav = await crearNavbar();

    expect(nav.textContent).toContain('GAMS Finanzas');
    expect(nav.textContent).toContain('Tipo de cambio');
    expect(nav.textContent).toContain('Iniciar sesión');
    expect(nav.textContent).not.toContain('Movimientos');
    expect(nav.textContent).not.toContain('Admin');
  });

  it('should show private links and the admin link for an admin session', async () => {
    localStorage.setItem(
      'gams-sesion',
      JSON.stringify({
        token: 'token-de-prueba',
        expiraEn: '2099-01-01T00:00:00Z',
        usuario: { id: 1, nombre: 'Administrador', email: 'admin@gams.pe', rol: 'ADMIN' },
      }),
    );
    const nav = await crearNavbar();

    expect(nav.textContent).toContain('Movimientos');
    expect(nav.textContent).toContain('Admin');
    expect(nav.textContent).toContain('Cerrar sesión');
    expect(nav.textContent).not.toContain('Iniciar sesión');
  });
});
