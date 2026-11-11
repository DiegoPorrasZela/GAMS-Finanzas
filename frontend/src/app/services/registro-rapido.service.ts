import { Injectable, signal } from '@angular/core';

// Abre el registro rápido de movimientos desde cualquier pantalla (botón "+" de la barra inferior,
// botón "+ Registrar" de la barra superior o el acceso de Inicio).
@Injectable({ providedIn: 'root' })
export class RegistroRapidoService {
  private readonly abiertoSignal = signal(false);
  readonly abierto = this.abiertoSignal.asReadonly();

  abrir(): void {
    this.abiertoSignal.set(true);
  }

  cerrar(): void {
    this.abiertoSignal.set(false);
  }
}
