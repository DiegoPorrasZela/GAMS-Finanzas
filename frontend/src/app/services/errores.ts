import { HttpErrorResponse } from '@angular/common/http';

// Convierte un error HTTP en un mensaje para el usuario.
// El backend responde en formato ProblemDetail: { detail: '...', errores: { campo: 'mensaje' } }
export function mensajeDeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo otra vez.';
    }
    const cuerpo = error.error;
    if (cuerpo?.errores) {
      const primero = Object.values(cuerpo.errores)[0];
      if (typeof primero === 'string') return primero;
    }
    if (typeof cuerpo?.detail === 'string') return cuerpo.detail;
  }
  return 'Ocurrió un error inesperado. Inténtalo otra vez.';
}
