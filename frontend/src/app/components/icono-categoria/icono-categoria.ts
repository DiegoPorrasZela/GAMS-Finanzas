import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icono } from '../icono/icono';
import { clasesDeColor } from './apariencia';

// Círculo de color con el ícono de una categoría (Comida naranja, Transporte azul…).
// Ayuda a reconocer cada movimiento de un vistazo, sin leer el nombre de la categoría.
@Component({
  selector: 'app-icono-categoria',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <span
      class="flex items-center justify-center rounded-full"
      [class]="clases()"
      [class.size-9]="tamano() === 'normal'"
      [class.size-7]="tamano() === 'chico'"
      aria-hidden="true"
    >
      <app-icono
        [nombre]="icono()"
        [class.size-5]="tamano() === 'normal'"
        [class.size-4]="tamano() === 'chico'"
      />
    </span>
  `,
})
export class IconoCategoria {
  readonly icono = input<string>('etiqueta');
  readonly color = input<string>('gris');
  readonly tamano = input<'normal' | 'chico'>('normal');

  protected readonly clases = computed(() => clasesDeColor(this.color()).insignia);
}
