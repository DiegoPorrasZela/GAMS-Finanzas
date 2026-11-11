import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CATEGORIA_SALDO_INICIAL, clasificar, esSaldoInicial } from '../../models/finanzas.models';
import { AuthService } from '../../services/auth.service';
import { CategoriasService } from '../../services/categorias.service';
import { DialogoService } from '../../services/dialogo.service';
import { mensajeDeError } from '../../services/errores';
import { soles } from '../../utils/formato';
import { MetasService } from '../../services/metas.service';
import { MovimientosService, calcularTotales } from '../../services/movimientos.service';
import { PresupuestosService } from '../../services/presupuestos.service';
import { RegistroRapidoService } from '../../services/registro-rapido.service';
import { ToastService } from '../../services/toast.service';
import {
  capitalizar,
  claveMes,
  diasRestantesDelMes,
  hoy,
  mesActual,
  mesesConDatos,
  nombreMes,
} from '../../utils/fechas';

function leer(clave: string): boolean {
  try {
    return localStorage.getItem(clave) === '1';
  } catch {
    return false;
  }
}

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
  private readonly categoriasService = inject(CategoriasService);
  private readonly auth = inject(AuthService);
  private readonly dialogo = inject(DialogoService);
  private readonly toast = inject(ToastService);
  private readonly registroRapido = inject(RegistroRapidoService);
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
  private readonly totalesTodos = computed(() =>
    calcularTotales(this.movimientosService.movimientos()),
  );
  // Lo separado a ahorros ya salió del saldo: todo el saldo está disponible para gastar
  protected readonly saldoTotal = computed(() => this.totalesTodos().saldo);
  protected readonly enMetas = computed(() =>
    this.metasService.metas().reduce((suma, meta) => suma + meta.ahorrado, 0),
  );
  protected readonly enAhorros = computed(() => this.totalesTodos().ahorro - this.enMetas());
  protected readonly sinMovimientos = computed(
    () =>
      !this.cargando() && !this.error() && this.movimientosService.movimientos().length === 0,
  );

  // ---- Saldo inicial: el dinero con el que empieza (se registra una sola vez) ----
  protected readonly tieneSaldoInicial = computed(() =>
    this.movimientosService.movimientos().some(esSaldoInicial),
  );
  private readonly claveOmitido = `gams-sin-saldo-inicial-${this.auth.usuario()?.id}`;
  private readonly saldoInicialOmitido = signal(leer(this.claveOmitido));
  protected readonly mostrarSaldoInicial = computed(
    () =>
      !this.cargando() && !this.error() && !this.tieneSaldoInicial() && !this.saldoInicialOmitido(),
  );
  protected readonly guardandoSaldoInicial = signal(false);
  protected readonly errorSaldoInicial = signal<string | null>(null);
  protected readonly formSaldoInicial = this.fb.group({
    monto: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
  });
  protected readonly totalesMes = computed(() => calcularTotales(this.movimientosDelMes()));
  protected readonly ultimos = computed(() => this.movimientosDelMes().slice(0, 5));
  protected readonly clasificar = clasificar;

  // ---- Gastos por categoría (gráfico de barras) ----
  protected readonly gastosPorCategoria = computed(() => {
    const totales = new Map<string, number>();
    // Solo gastos de consumo: lo separado a ahorros no es un gasto
    for (const m of this.movimientosDelMes().filter((m) => clasificar(m) === 'gasto')) {
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

    // ahorro = lo que separaste a tus ahorros este mes (menos lo que retiraste)
    const { gastos, ahorro } = this.totalesMes();
    const porcentaje = Math.round((gastos * 100) / presupuesto.limiteGasto);
    const restante = presupuesto.limiteGasto - gastos;
    const dias = this.esMesActual() ? diasRestantesDelMes() : null;

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
    this.categoriasService.cargar();
  }

  protected registrar(): void {
    this.registroRapido.abrir();
  }

  protected guardarSaldoInicial(): void {
    this.formSaldoInicial.markAllAsTouched();
    if (this.formSaldoInicial.invalid || this.guardandoSaldoInicial()) return;

    const categoria = this.categoriasService
      .categorias()
      .find((c) => esSaldoInicial({ nombre: c.nombre, tipo: c.tipo }));
    if (!categoria) {
      this.errorSaldoInicial.set('Todavía se están cargando los datos. Inténtalo en un momento.');
      return;
    }

    const monto = this.formSaldoInicial.getRawValue().monto!;
    this.guardandoSaldoInicial.set(true);
    this.errorSaldoInicial.set(null);
    this.movimientosService
      .agregar({ descripcion: CATEGORIA_SALDO_INICIAL, monto, fecha: hoy(), categoriaId: categoria.id })
      .subscribe({
        next: () => {
          this.guardandoSaldoInicial.set(false);
          this.toast.exito(`Saldo inicial de ${soles(monto)} registrado. ¡Listo para empezar!`);
        },
        error: (e) => {
          this.guardandoSaldoInicial.set(false);
          this.errorSaldoInicial.set(mensajeDeError(e));
        },
      });
  }

  // "Empiezo sin dinero": no volver a mostrar la tarjeta a este usuario
  protected omitirSaldoInicial(): void {
    this.saldoInicialOmitido.set(true);
    try {
      localStorage.setItem(this.claveOmitido, '1');
    } catch {
      // Sin localStorage, solo se oculta hasta recargar la página
    }
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

  // Consejo mientras se llena el formulario: lo que se puede gastar según los ingresos del mes
  protected consejoPresupuesto() {
    const ingresos = this.totalesMes().ingresos;
    if (ingresos <= 0) return null;
    const { limiteGasto, ahorroObjetivo } = this.formPresupuesto.getRawValue();
    const ahorro = ahorroObjetivo ?? 0;
    const total = (limiteGasto ?? 0) + ahorro;
    return {
      ingresos,
      ahorro,
      total,
      sugerido: Math.max(0, ingresos - ahorro),
      excede: limiteGasto !== null && total > ingresos,
    };
  }

  protected usarSugerido(): void {
    const consejo = this.consejoPresupuesto();
    if (consejo) this.formPresupuesto.controls.limiteGasto.setValue(consejo.sugerido);
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
          this.toast.exito(`Presupuesto de ${this.nombreDelMes()} guardado.`);
        },
        error: (e) => {
          this.guardandoPresupuesto.set(false);
          this.errorPresupuesto.set(mensajeDeError(e));
        },
      });
  }

  protected async eliminarPresupuesto(): Promise<void> {
    const presupuesto = this.presupuesto();
    if (!presupuesto) return;
    const confirmado = await this.dialogo.confirmar({
      tono: 'peligro',
      titulo: `¿Eliminar el presupuesto de ${this.nombreDelMes()}?`,
      mensaje: `Gasto máximo ${soles(presupuesto.limiteGasto)} · meta de ahorro ${soles(presupuesto.ahorroObjetivo)}`,
      detalle: 'Tus movimientos no cambian. Puedes volver a definirlo cuando quieras.',
      confirmar: 'Eliminar presupuesto',
    });
    if (!confirmado) return;
    const [anio, mes] = this.mes().split('-').map(Number);
    this.presupuestosService.eliminar(anio, mes).subscribe({
      next: () => this.toast.exito(`Presupuesto de ${this.nombreDelMes()} eliminado.`),
      error: (e) => this.toast.error(mensajeDeError(e)),
    });
  }
}
