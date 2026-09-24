import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly enlaces = [
    { ruta: '/', texto: 'Inicio', exacto: true },
    { ruta: '/movimientos', texto: 'Movimientos', exacto: false },
    { ruta: '/tipo-cambio', texto: 'Tipo de cambio', exacto: false },
    { ruta: '/acerca', texto: 'Acerca', exacto: false },
  ];
}
