import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Tasa } from '../../services/tipo-cambio.service';

const ALTO = 280;
const MARGEN = { arriba: 16, derecha: 64, abajo: 32, izquierda: 64 };

// Redondea un paso del eje a 1, 2 o 5 × 10^n para que las marcas sean números limpios
function pasoRedondo(valor: number): number {
  const potencia = 10 ** Math.floor(Math.log10(valor));
  const fraccion = valor / potencia;
  const redondo = fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 5 ? 5 : 10;
  return redondo * potencia;
}

// "2026-09-23" → Date en hora local (sin desfase de zona horaria)
function aFecha(texto: string): Date {
  const [anio, mes, dia] = texto.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

@Component({
  selector: 'app-grafico-tasas',
  templateUrl: './grafico-tasas.html',
  host: { class: 'block' },
})
export class GraficoTasas {
  readonly tasas = input.required<Tasa[]>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly alto = ALTO;
  protected readonly ancho = signal(800);
  protected readonly indiceActivo = signal<number | null>(null);

  // Convierte índices y valores a píxeles dentro del SVG
  protected readonly escala = computed(() => {
    const tasas = this.tasas();
    const valores = tasas.map((t) => t.rate);
    const min = Math.min(...valores);
    const max = Math.max(...valores);

    const paso = pasoRedondo((max - min || max * 0.01 || 1) / 4);
    const inicio = Math.floor(min / paso) * paso;
    const fin = Math.ceil(max / paso) * paso || inicio + paso;
    const decimales = Math.max(0, -Math.floor(Math.log10(paso)));

    const marcas: number[] = [];
    for (let valor = inicio; valor <= fin + paso / 2; valor += paso) {
      marcas.push(valor);
    }

    const x0 = MARGEN.izquierda;
    const x1 = this.ancho() - MARGEN.derecha;
    const y0 = ALTO - MARGEN.abajo;
    const y1 = MARGEN.arriba;

    const x = (i: number) =>
      tasas.length > 1 ? x0 + (i / (tasas.length - 1)) * (x1 - x0) : (x0 + x1) / 2;
    const y = (valor: number) => y0 - ((valor - inicio) / (fin - inicio || 1)) * (y0 - y1);

    return { x, y, marcas, decimales, x0, x1, y0 };
  });

  protected readonly puntos = computed(() => {
    const e = this.escala();
    return this.tasas().map((t, i) => ({ x: e.x(i), y: e.y(t.rate) }));
  });

  protected readonly linea = computed(() =>
    this.puntos()
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' '),
  );

  protected readonly area = computed(() => {
    const puntos = this.puntos();
    const y0 = this.escala().y0;
    return `${this.linea()} L ${puntos.at(-1)!.x} ${y0} L ${puntos[0].x} ${y0} Z`;
  });

  // Unas pocas fechas repartidas en el eje X
  protected readonly etiquetasX = computed(() => {
    const tasas = this.tasas();
    const cantidad = Math.min(this.ancho() < 500 ? 3 : 5, tasas.length);
    const dias = (aFecha(tasas.at(-1)!.date).getTime() - aFecha(tasas[0].date).getTime()) / 864e5;
    const formato = new Intl.DateTimeFormat(
      'es-PE',
      dias > 100 ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' },
    );

    return Array.from({ length: cantidad }, (_, n) => {
      const i = cantidad > 1 ? Math.round((n / (cantidad - 1)) * (tasas.length - 1)) : 0;
      const ancla = n === 0 ? 'start' : n === cantidad - 1 ? 'end' : 'middle';
      return { x: this.escala().x(i), texto: formato.format(aFecha(tasas[i].date)), ancla };
    });
  });

  protected readonly activo = computed(() => {
    const i = this.indiceActivo();
    if (i === null) return null;
    const tasa = this.tasas()[i];
    const punto = this.puntos()[i];
    // Mantiene el tooltip dentro del gráfico
    const izquierda = Math.min(Math.max(punto.x, 70), this.ancho() - 70);
    return { tasa, punto, izquierda, fecha: this.fechaLarga(tasa.date) };
  });

  protected readonly resumen = computed(() => {
    const tasas = this.tasas();
    const ultima = tasas.at(-1)!;
    return `Gráfico de ${ultima.base} a ${ultima.quote}: ${tasas.length} días, último valor ${this.formatear(ultima.rate)}`;
  });

  constructor() {
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const observador = new ResizeObserver(([entrada]) =>
        this.ancho.set(entrada.contentRect.width),
      );
      observador.observe(this.host.nativeElement);
      this.destroyRef.onDestroy(() => observador.disconnect());
    });
  }

  protected formatear(valor: number, decimales?: number): string {
    return valor.toLocaleString('es-PE', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
      maximumSignificantDigits: decimales === undefined ? 6 : undefined,
    });
  }

  protected fechaLarga(texto: string): string {
    return aFecha(texto).toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  // El cursor busca la fecha más cercana en X (no hace falta apuntar a la línea)
  protected alMover(evento: PointerEvent): void {
    const svg = evento.currentTarget as SVGElement;
    const px = evento.clientX - svg.getBoundingClientRect().left;
    const { x0, x1 } = this.escala();
    const n = this.tasas().length;
    const i = Math.round(((px - x0) / (x1 - x0)) * (n - 1));
    this.indiceActivo.set(Math.min(Math.max(i, 0), n - 1));
  }

  protected alPresionarTecla(evento: KeyboardEvent): void {
    const ultimo = this.tasas().length - 1;
    const actual = this.indiceActivo() ?? ultimo;
    const siguiente: Record<string, number> = {
      ArrowLeft: actual - 1,
      ArrowRight: actual + 1,
      Home: 0,
      End: ultimo,
    };
    if (evento.key in siguiente) {
      evento.preventDefault();
      this.indiceActivo.set(Math.min(Math.max(siguiente[evento.key], 0), ultimo));
    }
  }
}
