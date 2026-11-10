import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import {
  Aporte,
  CATEGORIA_AHORRO,
  CATEGORIA_RETIRO,
  DatosMeta,
  Frecuencia,
  MetaAhorro,
  Recurrente,
  esAhorro,
  esRetiro,
} from '../../models/finanzas.models';
import { CategoriasService } from '../../services/categorias.service';
import { mensajeDeError } from '../../services/errores';
import { MetasService } from '../../services/metas.service';
import { MovimientosService, calcularTotales } from '../../services/movimientos.service';
import { RecurrentesService } from '../../services/recurrentes.service';
import { hoy, mesesHasta, textoFrecuencia } from '../../utils/fechas';
import { noFutura, noPasada } from '../../utils/validadores';

type FrecuenciaAhorro = 'UNA_VEZ' | Frecuencia;

const CADA: Record<Frecuencia, string> = {
  DIARIA: 'cada día',
  SEMANAL: 'cada semana',
  QUINCENAL: 'cada quincena (el 15 y el último día del mes)',
  MENSUAL: 'cada mes',
};

// Saldo ──(separar)──► Ahorros ──(aportar)──► Metas;  Ahorros ──(retirar)──► Saldo
@Component({
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe],
  selector: 'app-metas',
  templateUrl: './metas.html',
})
export class Metas {
  private readonly servicio = inject(MetasService);
  private readonly movimientosService = inject(MovimientosService);
  private readonly categoriasService = inject(CategoriasService);
  private readonly recurrentesService = inject(RecurrentesService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly hoy = hoy();
  protected readonly textoFrecuencia = textoFrecuencia;
  protected readonly metas = this.servicio.metas;
  protected readonly cargando = this.servicio.cargando;
  protected readonly errorCarga = computed(
    () =>
      this.servicio.error() ??
      this.movimientosService.error() ??
      this.categoriasService.error() ??
      this.recurrentesService.error(),
  );
  protected readonly mensaje = signal<{ error: boolean; texto: string } | null>(null);

  // ---- Dinero ----
  private readonly totales = computed(() =>
    calcularTotales(this.movimientosService.movimientos()),
  );
  protected readonly saldo = computed(() => this.totales().saldo); // disponible para gastar
  protected readonly totalAhorrado = computed(() => this.totales().ahorro); // separado − retirado
  protected readonly enMetas = computed(() =>
    this.metas().reduce((suma, meta) => suma + meta.ahorrado, 0),
  );
  protected readonly libres = computed(() => this.totalAhorrado() - this.enMetas()); // sin asignar a metas

  // ---- Separar a ahorros / retirar ----
  protected readonly accion = signal<'separar' | 'retirar' | null>(null);
  protected readonly guardandoAhorro = signal(false);
  protected readonly formAhorro = this.fb.group({
    monto: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    frecuencia: this.fb.control<FrecuenciaAhorro>('UNA_VEZ'),
  });
  protected readonly ahorrosAutomaticos = computed(() =>
    this.recurrentesService.recurrentes().filter(esAhorro),
  );

  // ---- Formulario de meta (crear o editar) ----
  protected readonly editando = signal<MetaAhorro | null>(null);
  protected readonly enviado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly formulario = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
    montoObjetivo: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    fechaLimite: ['', noPasada],
  });

  // ---- Aportes ----
  protected readonly aportandoA = signal<number | null>(null);
  protected readonly verAportesDe = signal<number | null>(null);
  protected readonly formAporte = this.fb.group({
    monto: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    fecha: [this.hoy, [Validators.required, noFutura]],
  });

  constructor() {
    this.servicio.cargar();
    this.movimientosService.cargar();
    this.categoriasService.cargar();
    this.recurrentesService.cargar();
  }

  protected tieneError(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || this.enviado());
  }

  // Cuánto ahorrar por mes para llegar a tiempo (o si la fecha ya pasó)
  protected sugerencia(meta: MetaAhorro): { vencida: boolean; meses: number; porMes: number } | null {
    if (!meta.fechaLimite || meta.faltante <= 0) return null;
    if (meta.fechaLimite < this.hoy) return { vencida: true, meses: 0, porMes: 0 };
    const meses = mesesHasta(meta.fechaLimite);
    return { vencida: false, meses, porMes: meta.faltante / meses };
  }

  // ---- Ahorros ----

  protected abrirAccion(accion: 'separar' | 'retirar'): void {
    this.accion.set(this.accion() === accion ? null : accion);
    this.formAhorro.reset({ monto: null, frecuencia: 'UNA_VEZ' });
    this.mensaje.set(null);
  }

  protected guardarAhorro(): void {
    this.formAhorro.markAllAsTouched();
    const accion = this.accion();
    if (!accion || this.formAhorro.invalid || this.guardandoAhorro()) return;

    const { monto, frecuencia } = this.formAhorro.getRawValue();
    const separar = accion === 'separar';
    const categoria = this.categoriasService
      .categorias()
      .find((c) => (separar ? esAhorro(c) : esRetiro(c)));
    if (!categoria) {
      this.mostrar('Todavía se están cargando los datos. Inténtalo en un momento.', true);
      return;
    }
    if (!separar && monto! > this.libres()) {
      this.mostrar(`Solo tienes S/ ${this.libres().toFixed(2)} libres en tus ahorros para retirar.`, true);
      return;
    }
    // Separar más de lo que hay en el saldo se avisa, no se bloquea (igual que un gasto)
    const saldoNuevo = this.saldo() - monto!;
    if (
      separar &&
      saldoNuevo < 0 &&
      !confirm(`Tu saldo para gastar quedaría en S/ ${saldoNuevo.toFixed(2)}. ¿Separar de todos modos?`)
    ) {
      return;
    }

    const automatico = separar && frecuencia !== 'UNA_VEZ';
    const datos = {
      descripcion: !separar ? CATEGORIA_RETIRO : automatico ? 'Ahorro automático' : CATEGORIA_AHORRO,
      monto: monto!,
      fecha: this.hoy,
      categoriaId: categoria.id,
    };
    const peticion: Observable<unknown> = automatico
      ? this.recurrentesService.crear(datos, frecuencia as Frecuencia)
      : this.movimientosService.agregar(datos);

    this.guardandoAhorro.set(true);
    peticion.subscribe({
      next: () => {
        this.guardandoAhorro.set(false);
        this.accion.set(null);
        if (automatico) {
          // El backend ya registró el de hoy: se vuelve a cargar la lista
          this.movimientosService.cargar();
          this.mostrar(
            `🔁 Se separarán S/ ${monto!.toFixed(2)} a tus ahorros ${CADA[frecuencia as Frecuencia]}. El de hoy ya se separó.`,
          );
        } else {
          this.mostrar(
            separar
              ? `🐷 Separaste S/ ${monto!.toFixed(2)} a tus ahorros.`
              : `Retiraste S/ ${monto!.toFixed(2)} de tus ahorros: volvió a tu saldo.`,
          );
        }
      },
      error: (e) => {
        this.guardandoAhorro.set(false);
        this.mostrar(mensajeDeError(e), true);
      },
    });
  }

  protected alternarAhorroAutomatico(recurrente: Recurrente): void {
    this.recurrentesService.cambiarEstado(recurrente, !recurrente.activo).subscribe({
      next: () => this.movimientosService.cargar(),
      error: (e) => this.mostrar(mensajeDeError(e), true),
    });
  }

  protected eliminarAhorroAutomatico(recurrente: Recurrente): void {
    if (!confirm('¿Dejar de separar este ahorro automáticamente?\n\nLo que ya se separó se conserva.')) return;
    this.recurrentesService.eliminar(recurrente.id).subscribe({
      error: (e) => this.mostrar(mensajeDeError(e), true),
    });
  }

  // ---- Metas ----

  protected guardarMeta(): void {
    this.enviado.set(true);
    if (this.formulario.invalid || this.guardando()) return;

    const { nombre, montoObjetivo, fechaLimite } = this.formulario.getRawValue();
    const datos: DatosMeta = {
      nombre: nombre.trim(),
      montoObjetivo: montoObjetivo!,
      fechaLimite: fechaLimite || null,
    };
    const editando = this.editando();
    const peticion = editando
      ? this.servicio.actualizar(editando.id, datos)
      : this.servicio.crear(datos);

    this.guardando.set(true);
    peticion.subscribe({
      next: (meta) => {
        this.mostrar(`Meta "${meta.nombre}" ${editando ? 'actualizada' : 'creada'}.`);
        this.guardando.set(false);
        this.cancelarEdicion();
      },
      error: (e) => {
        this.mostrar(mensajeDeError(e), true);
        this.guardando.set(false);
      },
    });
  }

  protected editarMeta(meta: MetaAhorro): void {
    this.editando.set(meta);
    this.formulario.setValue({
      nombre: meta.nombre,
      montoObjetivo: meta.montoObjetivo,
      fechaLimite: meta.fechaLimite ?? '',
    });
    this.mensaje.set(null);
    document.getElementById('nombre-meta')?.focus();
  }

  protected cancelarEdicion(): void {
    this.editando.set(null);
    this.formulario.reset({ nombre: '', montoObjetivo: null, fechaLimite: '' });
    this.enviado.set(false);
  }

  protected eliminarMeta(meta: MetaAhorro): void {
    const pregunta = `¿Eliminar la meta "${meta.nombre}"?\n\nLo que aportaste (S/ ${meta.ahorrado.toFixed(2)}) vuelve a tus ahorros.`;
    if (!confirm(pregunta)) return;
    this.servicio.eliminar(meta.id).subscribe({
      next: () => {
        this.mostrar(`Meta "${meta.nombre}" eliminada. Su dinero volvió a tus ahorros.`);
        if (this.editando()?.id === meta.id) this.cancelarEdicion();
      },
      error: (e) => this.mostrar(mensajeDeError(e), true),
    });
  }

  protected abrirAporte(meta: MetaAhorro): void {
    this.aportandoA.set(this.aportandoA() === meta.id ? null : meta.id);
    this.formAporte.reset({ monto: null, fecha: this.hoy });
  }

  protected guardarAporte(meta: MetaAhorro): void {
    this.formAporte.markAllAsTouched();
    if (this.formAporte.invalid) return;

    const { monto, fecha } = this.formAporte.getRawValue();
    // Los aportes salen de los ahorros libres
    if (monto! > this.libres()) {
      this.mostrar(
        this.libres() > 0
          ? `En tus ahorros tienes S/ ${this.libres().toFixed(2)} libres. Separa más a tus ahorros para aportar esa cantidad.`
          : 'Tus ahorros están vacíos: primero separa dinero a tus ahorros.',
        true,
      );
      return;
    }
    this.servicio.aportar(meta.id, { monto: monto!, fecha }).subscribe({
      next: (actualizada) => {
        this.aportandoA.set(null);
        this.mostrar(
          actualizada.porcentaje >= 100
            ? `🎉 ¡Completaste la meta "${actualizada.nombre}"!`
            : `Aporte de S/ ${monto!.toFixed(2)} registrado en "${actualizada.nombre}".`,
        );
      },
      error: (e) => this.mostrar(mensajeDeError(e), true),
    });
  }

  protected quitarAporte(meta: MetaAhorro, aporte: Aporte): void {
    if (!confirm(`¿Quitar el aporte de S/ ${aporte.monto.toFixed(2)}? Vuelve a tus ahorros.`)) return;
    this.servicio.quitarAporte(meta.id, aporte.id).subscribe({
      error: (e) => this.mostrar(mensajeDeError(e), true),
    });
  }

  protected alternarAportes(meta: MetaAhorro): void {
    this.verAportesDe.set(this.verAportesDe() === meta.id ? null : meta.id);
  }

  private mostrar(texto: string, error = false): void {
    this.mensaje.set({ texto, error });
  }
}
