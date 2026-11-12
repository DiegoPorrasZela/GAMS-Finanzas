import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { Tasa, TipoCambioService } from '../../services/tipo-cambio.service';
import { GraficoTasas } from '../../components/grafico-tasas/grafico-tasas';
import { Icono } from '../../components/icono/icono';

// Se muestran primero en los selectores
const POPULARES = [
  'USD',
  'PEN',
  'EUR',
  'GBP',
  'JPY',
  'CNY',
  'BRL',
  'MXN',
  'CLP',
  'COP',
  'ARS',
  'CAD',
];

const PERIODOS = [
  { texto: '1 mes', meses: 1 },
  { texto: '3 meses', meses: 3 },
  { texto: '6 meses', meses: 6 },
  { texto: '1 año', meses: 12 },
  { texto: '5 años', meses: 60 },
];

interface OpcionMoneda {
  codigo: string;
  nombre: string;
}

@Component({
  imports: [DatePipe, GraficoTasas, Icono],
  selector: 'app-tipo-cambio',
  styleUrl: './tipo-cambio.css',
  templateUrl: './tipo-cambio.html',
})
export class TipoCambio {
  private readonly servicio = inject(TipoCambioService);
  private readonly nombresEs = new Intl.DisplayNames(['es'], {
    type: 'currency',
    fallback: 'none',
  });
  private peticion?: Subscription;

  protected readonly periodos = PERIODOS;

  // Filtros (por defecto: dólar a sol, último mes)
  protected readonly base = signal('USD');
  protected readonly destino = signal('PEN');
  protected readonly meses = signal(1);

  protected readonly monto = signal(100);
  protected readonly estado = signal<'cargando' | 'listo' | 'error'>('cargando');
  protected readonly tasas = signal<Tasa[]>([]);

  // Empieza con las populares; se completa con la lista de la API
  protected readonly monedas = signal<OpcionMoneda[]>(POPULARES.map((c) => this.opcion(c)));
  protected readonly populares = computed(() =>
    this.monedas().filter((m) => POPULARES.includes(m.codigo)),
  );
  protected readonly otras = computed(() =>
    this.monedas().filter((m) => !POPULARES.includes(m.codigo)),
  );

  protected readonly actual = computed(() => this.tasas().at(-1));

  protected readonly variacionDia = computed(() => {
    const actual = this.actual();
    const anterior = this.tasas().at(-2);
    return actual && anterior ? actual.rate - anterior.rate : 0;
  });

  protected readonly variacionPeriodo = computed(() => {
    const primera = this.tasas()[0]?.rate;
    const ultima = this.actual()?.rate;
    return primera && ultima ? ((ultima - primera) / primera) * 100 : 0;
  });

  protected readonly minimo = computed(() => Math.min(...this.tasas().map((t) => t.rate)));
  protected readonly maximo = computed(() => Math.max(...this.tasas().map((t) => t.rate)));

  protected readonly resultado = computed(() => this.monto() * (this.actual()?.rate ?? 0));

  // Para la tabla: del más reciente al más antiguo
  protected readonly tasasRecientes = computed(() => [...this.tasas()].reverse());

  constructor() {
    this.servicio.obtenerMonedas().subscribe({
      // Solo monedas: las criptomonedas (AAVE, USDT…) y los metales no son monedas ISO
      // y Intl no sabe nombrarlas ni darles formato
      next: (lista) =>
        this.monedas.set(
          lista.filter((m) => m.type === 'currency').map((m) => this.opcion(m.iso_code, m.name)),
        ),
      // Si falla, nos quedamos con las populares
      error: () => {},
    });
    this.cargar();
  }

  protected cargar(): void {
    this.peticion?.unsubscribe(); // cancela la petición anterior si aún no terminó
    this.estado.set('cargando');

    this.peticion = this.servicio
      .obtenerTasas(this.base(), this.destino(), this.fechaDesde())
      .subscribe({
        next: (tasas) => {
          this.tasas.set(tasas);
          this.estado.set('listo');
        },
        error: () => this.estado.set('error'),
      });
  }

  protected cambiarBase(evento: Event): void {
    this.base.set((evento.target as HTMLSelectElement).value);
    this.cargar();
  }

  protected cambiarDestino(evento: Event): void {
    this.destino.set((evento.target as HTMLSelectElement).value);
    this.cargar();
  }

  protected cambiarPeriodo(meses: number): void {
    this.meses.set(meses);
    this.cargar();
  }

  protected invertir(): void {
    const base = this.base();
    this.base.set(this.destino());
    this.destino.set(base);
    this.cargar();
  }

  protected cambiarMonto(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    this.monto.set(valor >= 0 ? valor : 0);
  }

  protected formatearDinero(valor: number, moneda: string): string {
    try {
      return new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda }).format(valor);
    } catch {
      // Código que Intl no reconoce: se muestra el número con el código al lado
      return `${valor.toLocaleString('es-PE', { maximumFractionDigits: 2 })} ${moneda}`;
    }
  }

  protected formatearTasa(valor: number): string {
    return valor.toLocaleString('es-PE', { maximumSignificantDigits: 6 });
  }

  // Sin signo: la flecha ▲▼ ya indica si sube o baja
  protected formatearPorcentaje(valor: number): string {
    return Math.abs(valor / 100).toLocaleString('es-PE', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  protected abs(valor: number): number {
    return Math.abs(valor);
  }

  protected textoPeriodo(): string {
    return PERIODOS.find((p) => p.meses === this.meses())?.texto ?? '';
  }

  private opcion(codigo: string, nombreApi = codigo): OpcionMoneda {
    let nombre = nombreApi;
    try {
      nombre = this.nombresEs.of(codigo) ?? nombreApi; // nombre en español si Intl lo conoce
    } catch {
      // Código que no es ISO (ej. de 4 letras): se usa el nombre que da la API
    }
    return { codigo, nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1) };
  }

  // Fecha de inicio según el periodo, en formato AAAA-MM-DD
  private fechaDesde(): string {
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() - this.meses());
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }
}
