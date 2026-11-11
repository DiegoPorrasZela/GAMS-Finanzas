import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';
import { ToastService } from './toast.service';

// Evento que Chrome y Edge disparan cuando la app se puede instalar (no es parte del estándar DOM)
interface EventoInstalacion extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Funciones de app instalable (PWA): botón "Instalar la app" y aviso de nueva versión
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly toast = inject(ToastService);
  private readonly actualizaciones = inject(SwUpdate, { optional: true });
  private eventoInstalacion: EventoInstalacion | null = null;

  readonly sePuedeInstalar = signal(false);

  constructor() {
    if (typeof window === 'undefined') return;

    // El navegador avisa que se puede instalar: se guarda para mostrar nuestro propio botón
    const alPoderInstalar = (evento: Event) => {
      evento.preventDefault();
      this.eventoInstalacion = evento as EventoInstalacion;
      this.sePuedeInstalar.set(true);
    };
    const alInstalar = () => {
      this.eventoInstalacion = null;
      this.sePuedeInstalar.set(false);
      this.toast.exito('¡GAMS Finanzas quedó instalada! Búscala en tu pantalla de inicio.');
    };
    window.addEventListener('beforeinstallprompt', alPoderInstalar);
    window.addEventListener('appinstalled', alInstalar);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', alPoderInstalar);
      window.removeEventListener('appinstalled', alInstalar);
    });

    // Hay una versión nueva desplegada y ya se descargó
    if (this.actualizaciones?.isEnabled) {
      this.actualizaciones.versionUpdates
        .pipe(
          filter((evento) => evento.type === 'VERSION_READY'),
          takeUntilDestroyed(),
        )
        .subscribe(() =>
          this.toast.info('Hay una nueva versión de GAMS Finanzas: recarga la página para verla.'),
        );
    }
  }

  // Muestra el cuadro de instalación del navegador (cada aviso del navegador se usa una sola vez)
  async instalar(): Promise<void> {
    const evento = this.eventoInstalacion;
    if (!evento) return;
    this.eventoInstalacion = null;
    this.sePuedeInstalar.set(false);
    await evento.prompt();
    await evento.userChoice;
  }
}
