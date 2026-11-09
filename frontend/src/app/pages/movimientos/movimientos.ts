import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatosMovimiento, Movimiento, TipoMovimiento } from '../../models/finanzas.models';
import { CategoriasService } from '../../services/categorias.service';
import { mensajeDeError } from '../../services/errores';
import { MovimientosService, calcularTotales } from '../../services/movimientos.service';
import { capitalizar, hoy, mesesConDatos, nombreMes } from '../../utils/fechas';

@Component({
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe],
  selector: 'app-movimientos',
  styleUrl: './movimientos.css',
  templateUrl: './movimientos.html',
})
export class Movimientos {
  private readonly servicio = inject(MovimientosService);
  private readonly categoriasService = inject(CategoriasService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly hoy = hoy();
  protected readonly cargando = this.servicio.cargando;
  protected readonly errorCarga = computed(
    () => this.servicio.error() ?? this.categoriasService.error(),
  );
  protected readonly errorAccion = signal<string | null>(null);

  // ---- Formulario para agregar o editar ----
  protected readonly tipoNuevo = signal<TipoMovimiento>('gasto');
  protected readonly editando = signal<Movimiento | null>(null);
  protected readonly categoriasNuevo = computed(() =>
    this.categoriasService.categorias().filter((c) => c.tipo === this.tipoNuevo()),
  );
  protected readonly enviado = signal(false);
  protected readonly guardando = signal(false);

  protected readonly formulario = this.fb.group({
    descripcion: ['', [Validators.required, Validators.maxLength(60)]],
    monto: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    categoriaId: this.fb.control<number | null>(null, Validators.required),
    fecha: [this.hoy, Validators.required],
  });

  // ---- Filtros de la lista ----
  protected readonly filtroMes = signal(''); // '' = todos los meses
  protected readonly opcionesMes = computed(() =>
    mesesConDatos(this.servicio.movimientos().map((m) => m.fecha)).map((clave) => ({
      clave,
      texto: capitalizar(nombreMes(clave)),
    })),
  );
  protected readonly filtroTipo = signal<'todos' | TipoMovimiento>('todos');
  protected readonly filtroCategoria = signal('');
  protected readonly busqueda = signal('');

  protected readonly opcionesTipo = [
    { valor: 'todos', texto: 'Todos' },
    { valor: 'ingreso', texto: 'Ingresos' },
    { valor: 'gasto', texto: 'Gastos' },
  ] as const;

  constructor() {
    this.servicio.cargar();
    this.categoriasService.cargar();

    // Cuando llegan las categorías o cambia el tipo, elige la primera si la actual no corresponde
    effect(() => {
      const opciones = this.categoriasNuevo();
      const control = this.formulario.controls.categoriaId;
      if (!opciones.some((c) => c.id === control.value)) {
        control.setValue(opciones[0]?.id ?? null);
      }
    });
  }

  // Solo las categorías que existen en la lista (según el tipo elegido)
  protected readonly categoriasFiltro = computed(() => {
    const tipo = this.filtroTipo();
    const usadas = this.servicio
      .movimientos()
      .filter((m) => tipo === 'todos' || m.tipo === tipo)
      .map((m) => m.categoria);
    return [...new Set(usadas)].sort();
  });

  protected readonly filtrados = computed(() => {
    const mes = this.filtroMes();
    const tipo = this.filtroTipo();
    const categoria = this.filtroCategoria();
    const texto = this.busqueda().trim().toLowerCase();

    return this.servicio
      .movimientos()
      .filter((m) => !mes || m.fecha.startsWith(mes))
      .filter((m) => tipo === 'todos' || m.tipo === tipo)
      .filter((m) => !categoria || m.categoria === categoria)
      .filter((m) => !texto || m.descripcion.toLowerCase().includes(texto));
  });

  protected readonly totales = computed(() => calcularTotales(this.filtrados()));

  protected readonly hayFiltros = computed(
    () =>
      this.filtroMes() !== '' ||
      this.filtroTipo() !== 'todos' ||
      this.filtroCategoria() !== '' ||
      this.busqueda() !== '',
  );

  protected elegirTipo(tipo: TipoMovimiento): void {
    this.tipoNuevo.set(tipo);
  }

  // Muestra el error de un campo solo después de tocarlo o de intentar guardar
  protected tieneError(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || this.enviado());
  }

  protected guardar(): void {
    this.enviado.set(true);
    if (this.formulario.invalid || this.guardando()) return;

    const { descripcion, monto, categoriaId, fecha } = this.formulario.getRawValue();
    const datos: DatosMovimiento = {
      descripcion: descripcion.trim(),
      monto: monto!,
      categoriaId: categoriaId!,
      fecha,
    };
    const editando = this.editando();
    const peticion = editando
      ? this.servicio.actualizar(editando.id, datos)
      : this.servicio.agregar(datos);

    this.guardando.set(true);
    this.errorAccion.set(null);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.editando.set(null);
        this.limpiarFormulario(categoriaId);
      },
      error: (e) => {
        this.guardando.set(false);
        this.errorAccion.set(mensajeDeError(e));
      },
    });
  }

  protected editar(movimiento: Movimiento): void {
    this.editando.set(movimiento);
    this.tipoNuevo.set(movimiento.tipo);
    this.formulario.setValue({
      descripcion: movimiento.descripcion,
      monto: movimiento.monto,
      categoriaId: movimiento.categoriaId,
      fecha: movimiento.fecha,
    });
    this.enviado.set(false);
    this.errorAccion.set(null);
    document.getElementById('descripcion')?.focus();
  }

  protected cancelarEdicion(): void {
    this.editando.set(null);
    this.limpiarFormulario();
  }

  protected eliminar(movimiento: Movimiento): void {
    if (!confirm(`¿Eliminar "${movimiento.descripcion}"?`)) return;

    this.errorAccion.set(null);
    this.servicio.eliminar(movimiento.id).subscribe({
      next: () => {
        if (this.editando()?.id === movimiento.id) this.cancelarEdicion();
      },
      error: (e) => this.errorAccion.set(mensajeDeError(e)),
    });
  }

  protected cambiarFiltroTipo(tipo: 'todos' | TipoMovimiento): void {
    this.filtroTipo.set(tipo);
    this.filtroCategoria.set('');
  }

  protected cambiarMes(evento: Event): void {
    this.filtroMes.set((evento.target as HTMLSelectElement).value);
  }

  protected cambiarCategoria(evento: Event): void {
    this.filtroCategoria.set((evento.target as HTMLSelectElement).value);
  }

  protected buscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected limpiarFiltros(): void {
    this.filtroMes.set('');
    this.filtroTipo.set('todos');
    this.filtroCategoria.set('');
    this.busqueda.set('');
  }

  // Limpia el formulario pero mantiene el tipo y la categoría elegidos
  private limpiarFormulario(categoriaId = this.formulario.controls.categoriaId.value): void {
    this.formulario.reset({ descripcion: '', monto: null, categoriaId, fecha: this.hoy });
    this.enviado.set(false);
  }
}
