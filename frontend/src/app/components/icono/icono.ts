import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONOS, NombreIcono } from './iconos';

// Ícono SVG del set de la app. El tamaño y el color se dan desde afuera con clases:
// <app-icono nombre="alcancia" class="size-5 text-sky-700" />
// Es decorativo (aria-hidden): el texto de al lado o el aria-label del botón dicen qué es.
@Component({
  selector: 'app-icono',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block shrink-0' },
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="grosor()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class="block size-full"
    >
      @for (d of trazos(); track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
})
export class Icono {
  readonly nombre = input.required<NombreIcono | string>();
  readonly grosor = input(2);

  // Si llega una clave desconocida (ej. una categoría creada con una versión más nueva), se usa la etiqueta
  protected readonly trazos = computed(
    () => ICONOS[this.nombre() as NombreIcono] ?? ICONOS.etiqueta,
  );
}
