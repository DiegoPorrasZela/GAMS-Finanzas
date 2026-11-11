import { Component, ElementRef, afterRenderEffect, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PwaService } from '../../services/pwa.service';
import { RegistroRapidoService } from '../../services/registro-rapido.service';

// Navegación de celular y tablet (debajo de 1024 px), como en las apps nativas:
// pestañas abajo, al alcance del pulgar, con el botón "+" en el centro.
// "Más" abre una hoja con la cuenta y las secciones menos usadas.
@Component({
  selector: 'app-navegacion-movil',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navegacion-movil.html',
})
export class NavegacionMovil {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly registroRapido = inject(RegistroRapidoService);
  private readonly pwa = inject(PwaService);
  protected readonly sePuedeInstalar = this.pwa.sePuedeInstalar;
  private readonly hoja = viewChild.required<ElementRef<HTMLDialogElement>>('hoja');

  protected readonly usuario = this.auth.usuario;
  protected readonly esAdmin = this.auth.esAdmin;
  protected readonly menuAbierto = signal(false);

  constructor() {
    afterRenderEffect(() => {
      const elemento = this.hoja().nativeElement;
      if (this.menuAbierto() && !elemento.open) {
        if (typeof elemento.showModal === 'function') elemento.showModal();
        else elemento.setAttribute('open', '');
      } else if (!this.menuAbierto() && elemento.open) {
        if (typeof elemento.close === 'function') elemento.close();
        else elemento.removeAttribute('open');
      }
    });
  }

  protected registrar(): void {
    this.registroRapido.abrir();
  }

  protected instalar(): void {
    this.cerrarMenu();
    this.pwa.instalar();
  }

  protected cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  protected alPresionarEsc(evento: Event): void {
    evento.preventDefault();
    this.cerrarMenu();
  }

  protected alHacerClic(evento: MouseEvent): void {
    if (evento.target === this.hoja().nativeElement) this.cerrarMenu();
  }

  protected cerrarSesion(): void {
    this.cerrarMenu();
    this.auth.cerrarSesion();
    this.router.navigate(['/login']);
  }

  // Iniciales para el avatar: "Usuario Demo" → "UD"
  protected iniciales(nombre: string): string {
    return nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0].toUpperCase())
      .join('');
  }
}
