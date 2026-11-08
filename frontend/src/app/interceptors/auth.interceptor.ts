import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

// Se ejecuta en cada petición HTTP (patrón Chain of Responsibility):
// 1. Si va a nuestro backend, le agrega el token: "Authorization: Bearer <token>".
// 2. Si el backend responde 401 (token vencido o inválido), cierra la sesión y lleva al login.
export const authInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  // Las APIs externas (como Frankfurter) no deben recibir nuestro token
  if (!peticion.url.startsWith(environment.apiUrl)) {
    return siguiente(peticion);
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();

  const conToken = token
    ? peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : peticion;

  return siguiente(conToken).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token) {
        auth.cerrarSesion();
        router.navigate(['/login'], { queryParams: { expirada: 1 } });
      }
      return throwError(() => error);
    }),
  );
};
