import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Solo deja entrar con sesión; si no, lleva al login y recuerda a dónde quería ir
export const autenticadoGuard: CanActivateFn = (_ruta, estado) => {
  const auth = inject(AuthService);
  if (auth.sesionVigente()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { volver: estado.url } });
};

// Solo deja entrar a los administradores (el backend también lo verifica)
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.sesionVigente() && auth.esAdmin()) return true;
  return inject(Router).createUrlTree(['/']);
};

// Login y registro: si ya hay sesión, no tiene sentido mostrarlos
export const invitadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (!auth.sesionVigente()) return true;
  return inject(Router).createUrlTree(['/']);
};
