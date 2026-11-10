import { Component, ElementRef, afterRenderEffect, inject, viewChild } from '@angular/core';
import { DialogoService } from '../../services/dialogo.service';

// Diálogo de confirmación con el elemento nativo <dialog> y showModal(): el navegador bloquea el resto
// de la página, mantiene el foco dentro, cierra con Esc y lo anuncia a los lectores de pantalla.
@Component({
  selector: 'app-dialogo',
  templateUrl: './dialogo.html',
})
export class Dialogo {
  private readonly servicio = inject(DialogoService);
  protected readonly actual = this.servicio.actual;
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    // Después de dibujar el contenido, abre o cierra el <dialog> según el servicio
    afterRenderEffect(() => {
      const elemento = this.dialogo().nativeElement;
      const debeEstarAbierto = this.actual() !== null;
      if (debeEstarAbierto && !elemento.open) {
        if (typeof elemento.showModal === 'function') elemento.showModal();
        else elemento.setAttribute('open', ''); // navegadores muy antiguos o entorno de pruebas
      } else if (!debeEstarAbierto && elemento.open) {
        if (typeof elemento.close === 'function') elemento.close();
        else elemento.removeAttribute('open');
      }
    });
  }

  protected aceptar(): void {
    this.servicio.responder(true);
  }

  protected cancelar(): void {
    this.servicio.responder(false);
  }

  // Esc: el navegador dispara "cancel"; se evita que cierre solo para que el servicio decida
  protected alPresionarEsc(evento: Event): void {
    evento.preventDefault();
    this.cancelar();
  }

  // Un clic en el fondo oscuro (fuera del cuadro) también cancela
  protected alHacerClic(evento: MouseEvent): void {
    if (evento.target === this.dialogo().nativeElement) this.cancelar();
  }
}
