import { Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Dialogo } from './components/dialogo/dialogo';
import { Icono } from './components/icono/icono';
import { Logo } from './components/logo/logo';
import { NavegacionMovil } from './components/navegacion-movil/navegacion-movil';
import { RegistroRapido } from './components/registro-rapido/registro-rapido';
import { Toasts } from './components/toasts/toasts';
import { AuthService } from './services/auth.service';
import { PwaService } from './services/pwa.service';
import { RegistroRapidoService } from './services/registro-rapido.service';

interface Enlace {
  ruta: string;
  texto: string;
  exacto: boolean;
}

@Component({
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    Dialogo,
    Icono,
    Logo,
    NavegacionMovil,
    RegistroRapido,
    Toasts,
  ],
  selector: 'app-root',
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
    const admin: Enlace[] = this.esAdmin()
      ? [{ ruta: '/admin', texto: 'Admin', exacto: false }]
      : [];
    return [...privados, ...publicos, ...admin];
  });

  private readonly registroRapido = inject(RegistroRapidoService);
  // Se crea al iniciar la app para escuchar a tiempo si se puede instalar o si hay una versión nueva
  private readonly pwa = inject(PwaService);
  protected readonly sePuedeInstalar = this.pwa.sePuedeInstalar;

  protected registrar(): void {
    this.registroRapido.abrir();
  }

  protected instalar(): void {
    this.pwa.instalar();
  }

  protected cerrarSesion(): void {
    this.auth.cerrarSesion();
    this.router.navigate(['/login']);
  }
}
