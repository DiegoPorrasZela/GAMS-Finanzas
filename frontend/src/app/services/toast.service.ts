import { Injectable, signal } from '@angular/core';

export type TipoToast = 'exito' | 'error' | 'info';

// Botón dentro de la notificación (ej. "Deshacer")
export interface AccionToast {
  texto: string;
  ejecutar: () => void;
}

export interface Toast {
  id: number;
  texto: string;
  tipo: TipoToast;
  accion?: AccionToast;
}

const MAXIMO_VISIBLES = 3;

// Notificaciones flotantes. El componente <app-toasts> (en app.html) las muestra.
// Uso: toast.exito('Gasto registrado') · toast.error('No se pudo guardar')
@Injectable({ providedIn: 'root' })
export class ToastService {
  private siguienteId = 1;
  private readonly lista = signal<Toast[]>([]);
  readonly toasts = this.lista.asReadonly();

  exito(texto: string): void {
    this.mostrar({ texto, tipo: 'exito' }, 4000);
  }

  // Los errores se quedan un poco más para que dé tiempo de leerlos
  error(texto: string): void {
    this.mostrar({ texto, tipo: 'error' }, 6000);
  }

  info(texto: string): void {
    this.mostrar({ texto, tipo: 'info' }, 4000);
  }

  // Notificación con un botón; dura lo mismo que la acción está disponible
  conAccion(texto: string, accion: AccionToast, segundos: number): void {
    this.mostrar({ texto, tipo: 'exito', accion }, segundos * 1000);
  }

  // Ejecuta la acción del botón y cierra la notificación
  elegirAccion(id: number): void {
    const toast = this.lista().find((t) => t.id === id);
    this.cerrar(id);
    toast?.accion?.ejecutar();
  }

  cerrar(id: number): void {
    this.lista.update((lista) => lista.filter((toast) => toast.id !== id));
  }

  private mostrar(datos: Omit<Toast, 'id'>, duracion: number): void {
    const toast: Toast = { id: this.siguienteId++, ...datos };
    // Si ya hay muchos, se descartan los más antiguos
    this.lista.update((lista) => [...lista.slice(-(MAXIMO_VISIBLES - 1)), toast]);
    setTimeout(() => this.cerrar(toast.id), duracion);
  }
}
