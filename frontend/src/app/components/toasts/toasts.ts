import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';

// Pila de notificaciones flotantes (abajo a la derecha; abajo al centro en celular)
@Component({
  selector: 'app-toasts',
  templateUrl: './toasts.html',
})
export class Toasts {
  private readonly servicio = inject(ToastService);
  protected readonly toasts = this.servicio.toasts;

  protected cerrar(id: number): void {
    this.servicio.cerrar(id);
  }
}
