import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { restar } from '../../utils/dinero';
import { soles } from '../../utils/formato';

export interface ResumenMes {
  clave: string; // AAAA-MM
  etiqueta: string; // "nov"
  nombre: string; // "Noviembre de 2026"
  ingresos: number;
  gastos: number;
  ahorro: number;
}

// Paso "redondo" para las marcas del eje: 1, 2, 2.5 o 5 × 10ⁿ
function pasoRedondo(aproximado: number): number {
  const potencia = 10 ** Math.floor(Math.log10(aproximado));
  const base = aproximado / potencia;
  const redondo = base <= 1 ? 1 : base <= 2 ? 2 : base <= 2.5 ? 2.5 : base <= 5 ? 5 : 10;
  return redondo * potencia;
}

// Marcas del eje en números enteros hasta 10 000 ("1,500") y abreviadas desde ahí ("12 mil")
const textoMarca = (valor: number) =>
  valor >= 10_000 ? `${(valor / 1000).toLocaleString('en-US')} mil` : valor.toLocaleString('en-US');

// Ingresos contra gastos de varios meses, en columnas agrupadas.
// Colores validados para daltonismo (verde 500 / rojo 600); además hay leyenda, un detalle por mes
// al pasar el mouse o con el teclado, y la tabla con todos los valores.
@Component({
  selector: 'app-grafico-meses',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grafico-meses.html',
})
export class GraficoMeses {
  readonly meses = input.required<ResumenMes[]>();
  readonly seleccionado = input<string>('');

  protected readonly hayDatos = computed(() =>
    this.meses().some((m) => m.ingresos > 0 || m.gastos > 0),
  );

  private readonly escala = computed(() => {
    const maximo = Math.max(0, ...this.meses().flatMap((m) => [m.ingresos, m.gastos]));
    if (maximo === 0)
      return { tope: 1, marcas: [] as { valor: number; posicion: number; texto: string }[] };
    const paso = pasoRedondo(maximo / 4);
    const tope = Math.ceil(maximo / paso) * paso;
    const marcas = [];
    for (let valor = 0; valor <= tope + paso / 2; valor += paso) {
      marcas.push({ valor, posicion: (valor * 100) / tope, texto: textoMarca(valor) });
    }
    return { tope, marcas };
  });

  protected readonly marcas = computed(() => this.escala().marcas);
  protected readonly abs = Math.abs;

  protected diferencia(mes: ResumenMes): number {
    return restar(mes.ingresos, mes.gastos);
  }

  protected altura(valor: number): number {
    return (valor * 100) / this.escala().tope;
  }

  // Lo que lee el lector de pantalla al llegar a un mes
  protected descripcion(mes: ResumenMes): string {
    return `${mes.nombre}: ingresos ${soles(mes.ingresos)}, gastos ${soles(mes.gastos)}`;
  }
}
