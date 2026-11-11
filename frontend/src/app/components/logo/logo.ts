import { Component } from '@angular/core';

// Isotipo de GAMS Finanzas: una flecha que sube (el mismo dibujo que el favicon).
// El tamaño se controla desde afuera: <app-logo class="size-8" />
@Component({
  selector: 'app-logo',
  host: { class: 'inline-block shrink-0', 'aria-hidden': 'true' },
  template: `
    <svg class="size-full" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#16a34a" />
      <path
        d="M8 21.5l5-5 4 3 7.5-8.5"
        fill="none"
        stroke="#fff"
        stroke-width="2.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M19.5 11h5v5"
        fill="none"
        stroke="#fff"
        stroke-width="2.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `,
})
export class Logo {}
