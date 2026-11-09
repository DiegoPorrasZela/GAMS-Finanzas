import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Aporte, DatosMeta, MetaAhorro } from '../../models/finanzas.models';
import { mensajeDeError } from '../../services/errores';
import { MetasService } from '../../services/metas.service';
import { hoy, mesesHasta } from '../../utils/fechas';

@Component({
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe],
  selector: 'app-metas',
  templateUrl: './metas.html',
})
export class Metas {
  private readonly servicio = inject(MetasService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly hoy = hoy();
  protected readonly metas = this.servicio.metas;
  protected readonly cargando = this.servicio.cargando;
  protected readonly errorCarga = this.servicio.error;
  protected readonly mensaje = signal<{ error: boolean; texto: string } | null>(null);

  // ---- Formulario de meta (crear o editar) ----
  protected readonly editando = signal<MetaAhorro | null>(null);
  protected readonly enviado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly formulario = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
    montoObjetivo: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    fechaLimite: [''],
  });

  // ---- Aportes ----
  protected readonly aportandoA = signal<number | null>(null);
  protected readonly verAportesDe = signal<number | null>(null);
  protected readonly formAporte = this.fb.group({
    monto: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    fecha: [this.hoy, Validators.required],
  });

  constructor() {
    this.servicio.cargar();
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
    if (!confirm(`¿Eliminar la meta "${meta.nombre}" y todos sus aportes?`)) return;
    this.servicio.eliminar(meta.id).subscribe({
      next: () => {
        this.mostrar(`Meta "${meta.nombre}" eliminada.`);
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
    if (!confirm(`¿Eliminar el aporte de S/ ${aporte.monto.toFixed(2)}?`)) return;
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
