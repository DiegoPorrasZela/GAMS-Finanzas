import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Login } from './login';

describe('Login', () => {
  it('should show and hide the password with the eye button', async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    const pagina = fixture.nativeElement as HTMLElement;
    const password = pagina.querySelector<HTMLInputElement>('#password')!;
    const ojo = () => pagina.querySelector<HTMLButtonElement>('app-ver-password button')!;

    expect(password.type).toBe('password');
    expect(ojo().getAttribute('aria-label')).toBe('Mostrar contraseña');

    ojo().click();
    await fixture.whenStable();
    expect(password.type).toBe('text');
    expect(ojo().getAttribute('aria-label')).toBe('Ocultar contraseña');
    expect(ojo().getAttribute('aria-pressed')).toBe('true');

    ojo().click();
    await fixture.whenStable();
    expect(password.type).toBe('password');
  });
});
