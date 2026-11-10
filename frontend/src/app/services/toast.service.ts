import { Injectable, signal } from '@angular/core';

export type TipoToast = 'exito' | 'error' | 'info';

export interface Toast {
  id: number;
  texto: string;
  tipo: TipoToast;
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
    this.mostrar(texto, 'exito', 4000);
  }

  // Los errores se quedan un poco más para que dé tiempo de leerlos
  error(texto: string): void {
    this.mostrar(texto, 'error', 6000);
  }

  info(texto: string): void {
    this.mostrar(texto, 'info', 4000);
  }

  cerrar(id: number): void {
    this.lista.update((lista) => lista.filter((toast) => toast.id !== id));
  }

  private mostrar(texto: string, tipo: TipoToast, duracion: number): void {
    const toast: Toast = { id: this.siguienteId++, texto, tipo };
    // Si ya hay muchos, se descartan los más antiguos
    this.lista.update((lista) => [...lista.slice(-(MAXIMO_VISIBLES - 1)), toast]);
    setTimeout(() => this.cerrar(toast.id), duracion);
  }
}
