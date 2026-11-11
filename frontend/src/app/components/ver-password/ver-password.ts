import { Component, model } from '@angular/core';

// Botón 👁 para mostrar u ocultar una contraseña. Va dentro de un contenedor "relative" junto al input:
//   <input [type]="ver() ? 'text' : 'password'" class="pr-10" />
//   <app-ver-password [(visible)]="ver" />
@Component({
  selector: 'app-ver-password',
  template: `
    <button
      type="button"
      (click)="visible.set(!visible())"
      [attr.aria-label]="visible() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
      [attr.aria-pressed]="visible()"
      [title]="visible() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
      class="absolute inset-y-0 right-0 flex items-center rounded-r-md px-3 text-gray-500 transition-colors hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-green-500/40 focus-visible:outline-none"
    >
      <svg
        class="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        @if (visible()) {
          <!-- ojo tachado -->
          <path d="M9.9 4.2A10.4 10.4 0 0 1 12 4c7 0 10 8 10 8a17.6 17.6 0 0 1-3.2 4.2" />
          <path d="M6.6 6.6A17.5 17.5 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.6" />
          <path d="M14.1 14.1a3 3 0 0 1-4.2-4.2M2 2l20 20" />
        } @else {
          <!-- ojo -->
          <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
          <circle cx="12" cy="12" r="3" />
        }
      </svg>
    </button>
  `,
})
export class VerPassword {
  readonly visible = model(false);
}
