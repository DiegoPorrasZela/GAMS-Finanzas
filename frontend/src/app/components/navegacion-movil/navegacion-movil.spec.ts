import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PwaService } from '../../services/pwa.service';
import { RegistroRapidoService } from '../../services/registro-rapido.service';
import { NavegacionMovil } from './navegacion-movil';

function iniciarSesion(rol: 'USUARIO' | 'ADMIN') {
  localStorage.setItem(
    'gams-sesion',
    JSON.stringify({
      token: 'token-de-prueba',
      expiraEn: '2099-01-01T00:00:00Z',
      usuario: { id: 1, nombre: 'Diego Porras', email: 'diego@gams.pe', rol },
    }),
  );
}

describe('NavegacionMovil', () => {
  let fixture: ComponentFixture<NavegacionMovil>;
  let barra: HTMLElement;

  const boton = (texto: string) =>
    [...barra.querySelectorAll('button')].find((b) => b.textContent?.includes(texto))!;

  async function crear(rol: 'USUARIO' | 'ADMIN' = 'USUARIO') {
    iniciarSesion(rol);
    await TestBed.configureTestingModule({
      imports: [NavegacionMovil],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(NavegacionMovil);
    barra = fixture.nativeElement;
    await fixture.whenStable();
  }

  afterEach(() => localStorage.clear());

  it('should show the main tabs and the "+" button', async () => {
    await crear();
    const pestanas = barra.querySelector('nav')!.textContent!;

    expect(pestanas).toContain('Inicio');
    expect(pestanas).toContain('Movimientos');
    expect(pestanas).toContain('Metas');
    expect(pestanas).toContain('Más');
    expect(barra.querySelector('button[aria-label="Registrar movimiento"]')).toBeTruthy();
  });

  it('should open the quick add from the "+" button', async () => {
    await crear();
    barra.querySelector<HTMLButtonElement>('button[aria-label="Registrar movimiento"]')!.click();

    expect(TestBed.inject(RegistroRapidoService).abierto()).toBe(true);
  });

  it('should show the account and the admin link in "Más" for an admin', async () => {
    await crear('ADMIN');
    boton('Más').click();
    await fixture.whenStable();
    const hoja = barra.querySelector('dialog')!;

    expect(hoja.hasAttribute('open')).toBe(true);
    expect(hoja.textContent).toContain('DP'); // iniciales del avatar
    expect(hoja.textContent).toContain('diego@gams.pe');
    expect(hoja.textContent).toContain('Administración');
  });

  it('should hide the admin link for a regular user', async () => {
    await crear('USUARIO');
    expect(barra.querySelector('dialog')!.textContent).not.toContain('Administración');
  });

  it('should offer installing the app only when the browser allows it', async () => {
    await crear();
    expect(barra.textContent).not.toContain('Instalar la app');

    TestBed.inject(PwaService).sePuedeInstalar.set(true);
    await fixture.whenStable();
    expect(barra.textContent).toContain('Instalar la app');
  });

  it('should log out and go to the login page', async () => {
    await crear();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    boton('Más').click();
    await fixture.whenStable();
    boton('Cerrar sesión').click();

    expect(TestBed.inject(AuthService).usuario()).toBeNull();
    expect(navegar).toHaveBeenCalledWith(['/login']);
  });
});
