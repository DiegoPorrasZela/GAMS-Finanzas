import { Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Dialogo } from './components/dialogo/dialogo';
import { Logo } from './components/logo/logo';
import { Toasts } from './components/toasts/toasts';
import { AuthService } from './services/auth.service';

interface Enlace {
  ruta: string;
  texto: string;
  exacto: boolean;
}

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Dialogo, Logo, Toasts],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly usuario = this.auth.usuario;
  protected readonly esAdmin = this.auth.esAdmin;

  // Los enlaces cambian según haya sesión y según el rol
  protected readonly enlaces = computed<Enlace[]>(() => {
    const privados: Enlace[] = this.usuario()
      ? [
          { ruta: '/', texto: 'Inicio', exacto: true },
          { ruta: '/movimientos', texto: 'Movimientos', exacto: false },
          { ruta: '/metas', texto: 'Metas', exacto: false },
        ]
      : [];
    const publicos: Enlace[] = [
      { ruta: '/tipo-cambio', texto: 'Tipo de cambio', exacto: false },
      { ruta: '/acerca', texto: 'Acerca', exacto: false },
    ];
    const admin: Enlace[] = this.esAdmin() ? [{ ruta: '/admin', texto: 'Admin', exacto: false }] : [];
    return [...privados, ...publicos, ...admin];
  });

  protected cerrarSesion(): void {
    this.auth.cerrarSesion();
    this.router.navigate(['/login']);
  }
}
