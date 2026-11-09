import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { mensajeDeError } from '../../services/errores';
import { MetasService } from '../../services/metas.service';
import { MovimientosService, calcularTotales } from '../../services/movimientos.service';
import { PresupuestosService } from '../../services/presupuestos.service';
import {
  capitalizar,
  claveMes,
  diasRestantesDelMes,
  mesActual,
  mesesConDatos,
  nombreMes,
} from '../../utils/fechas';

// Colores de las barras del gráfico por categoría
const COLORES = [
  'bg-green-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-indigo-500',
];

@Component({
  imports: [RouterLink, ReactiveFormsModule, DatePipe, DecimalPipe],
  selector: 'app-inicio',
  styleUrl: './inicio.css',
  templateUrl: './inicio.html',
})
export class Inicio {
  private readonly movimientosService = inject(MovimientosService);
  private readonly presupuestosService = inject(PresupuestosService);
  private readonly metasService = inject(MetasService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly nombre = computed(() => this.auth.usuario()?.nombre.split(' ')[0] ?? '');
  protected readonly cargando = this.movimientosService.cargando;
  protected readonly error = computed(
    () =>
      this.movimientosService.error() ?? this.presupuestosService.error() ?? this.metasService.error(),
  );

  // ---- Mes elegido ----
  protected readonly mes = signal(mesActual());
  protected readonly esMesActual = computed(() => this.mes() === mesActual());
  protected readonly nombreDelMes = computed(() => nombreMes(this.mes()));
  protected readonly opcionesMes = computed(() =>
    mesesConDatos(this.movimientosService.movimientos().map((m) => m.fecha)).map((clave) => ({
      clave,
      texto: capitalizar(nombreMes(clave)),
    })),
  );

  private readonly movimientosDelMes = computed(() =>
    this.movimientosService.movimientos().filter((m) => m.fecha.startsWith(this.mes())),
  );
  protected readonly saldoTotal = computed(
    () => calcularTotales(this.movimientosService.movimientos()).saldo,
  );
  protected readonly totalesMes = computed(() => calcularTotales(this.movimientosDelMes()));
  protected readonly ultimos = computed(() => this.movimientosDelMes().slice(0, 5));

  // ---- Gastos por categoría (gráfico de barras) ----
  protected readonly gastosPorCategoria = computed(() => {
    const totales = new Map<string, number>();
    for (const m of this.movimientosDelMes().filter((m) => m.tipo === 'gasto')) {
      totales.set(m.categoria, (totales.get(m.categoria) ?? 0) + m.monto);
    }
    const totalGastos = [...totales.values()].reduce((suma, monto) => suma + monto, 0);
    const mayor = Math.max(0, ...totales.values());
    return [...totales]
      .sort((a, b) => b[1] - a[1])
      .map(([categoria, monto], i) => ({
        categoria,
        monto,
        porcentaje: Math.round((monto * 100) / totalGastos),
        ancho: (monto * 100) / mayor,
        color: COLORES[i % COLORES.length],
      }));
  });

  // ---- Presupuesto del mes ----
  protected readonly presupuesto = computed(
    () =>
      this.presupuestosService
        .presupuestos()
        .find((p) => claveMes(p.anio, p.mes) === this.mes()) ?? null,
  );

  protected readonly avance = computed(() => {
    const presupuesto = this.presupuesto();
    if (!presupuesto) return null;

    const { ingresos, gastos } = this.totalesMes();
    const porcentaje = Math.round((gastos * 100) / presupuesto.limiteGasto);
    const restante = presupuesto.limiteGasto - gastos;
    const dias = this.esMesActual() ? diasRestantesDelMes() : null;
    const ahorro = ingresos - gastos;

    return {
      gastos,
      porcentaje,
      restante,
      dias,
      porDia: dias && restante > 0 ? restante / dias : null,
      estado: porcentaje >= 100 ? 'excedido' : porcentaje >= 80 ? 'cuidado' : 'bien',
      ahorro,
      porcentajeAhorro:
        presupuesto.ahorroObjetivo > 0
          ? Math.max(0, Math.round((ahorro * 100) / presupuesto.ahorroObjetivo))
          : null,
    };
  });

  protected readonly editandoPresupuesto = signal(false);
  protected readonly guardandoPresupuesto = signal(false);
  protected readonly errorPresupuesto = signal<string | null>(null);
  protected readonly formPresupuesto = this.fb.group({
    limiteGasto: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    ahorroObjetivo: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
  });

  // ---- Metas de ahorro (resumen) ----
  protected readonly metas = computed(() => this.metasService.metas().slice(0, 3));

  constructor() {
    this.movimientosService.cargar();
    this.presupuestosService.cargar();
    this.metasService.cargar();
  }

  protected cambiarMes(evento: Event): void {
    this.mes.set((evento.target as HTMLSelectElement).value);
    this.editandoPresupuesto.set(false);
  }

  protected abrirPresupuesto(): void {
    const actual = this.presupuesto();
    this.formPresupuesto.reset({
      limiteGasto: actual?.limiteGasto ?? null,
      ahorroObjetivo: actual?.ahorroObjetivo ?? 0,
    });
    this.errorPresupuesto.set(null);
    this.editandoPresupuesto.set(true);
  }

  protected guardarPresupuesto(): void {
    this.formPresupuesto.markAllAsTouched();
    if (this.formPresupuesto.invalid || this.guardandoPresupuesto()) return;

    const [anio, mes] = this.mes().split('-').map(Number);
    const { limiteGasto, ahorroObjetivo } = this.formPresupuesto.getRawValue();
    this.guardandoPresupuesto.set(true);
    this.presupuestosService
      .guardar(anio, mes, { limiteGasto: limiteGasto!, ahorroObjetivo: ahorroObjetivo! })
      .subscribe({
        next: () => {
          this.guardandoPresupuesto.set(false);
          this.editandoPresupuesto.set(false);
        },
        error: (e) => {
          this.guardandoPresupuesto.set(false);
          this.errorPresupuesto.set(mensajeDeError(e));
        },
      });
  }

  protected eliminarPresupuesto(): void {
    if (!confirm(`¿Eliminar el presupuesto de ${this.nombreDelMes()}?`)) return;
    const [anio, mes] = this.mes().split('-').map(Number);
    this.presupuestosService.eliminar(anio, mes).subscribe({
      error: (e) => this.errorPresupuesto.set(mensajeDeError(e)),
    });
  }
}
