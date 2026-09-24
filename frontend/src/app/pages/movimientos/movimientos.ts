import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CATEGORIAS,
  Movimiento,
  MovimientosService,
  TipoMovimiento,
  calcularTotales,
} from '../../services/movimientos.service';

// Fecha de hoy en formato AAAA-MM-DD (hora local)
function hoy(): string {
  const fecha = new Date();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

@Component({
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe],
  selector: 'app-movimientos',
  styleUrl: './movimientos.css',
  templateUrl: './movimientos.html',
})
export class Movimientos {
  private readonly servicio = inject(MovimientosService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly hoy = hoy();

  // ---- Formulario para agregar ----
  protected readonly tipoNuevo = signal<TipoMovimiento>('gasto');
  protected readonly categoriasNuevo = computed(() => CATEGORIAS[this.tipoNuevo()]);
  protected readonly enviado = signal(false);

  protected readonly formulario = this.fb.group({
    descripcion: ['', [Validators.required, Validators.maxLength(60)]],
    monto: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    categoria: [CATEGORIAS.gasto[0], Validators.required],
    fecha: [this.hoy, Validators.required],
  });

  // ---- Filtros de la lista ----
  protected readonly filtroTipo = signal<'todos' | TipoMovimiento>('todos');
  protected readonly filtroCategoria = signal('');
  protected readonly busqueda = signal('');

  protected readonly opcionesTipo = [
    { valor: 'todos', texto: 'Todos' },
    { valor: 'ingreso', texto: 'Ingresos' },
    { valor: 'gasto', texto: 'Gastos' },
  ] as const;

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
    const tipo = this.filtroTipo();
    const categoria = this.filtroCategoria();
    const texto = this.busqueda().trim().toLowerCase();

    return this.servicio
      .movimientos()
      .filter((m) => tipo === 'todos' || m.tipo === tipo)
      .filter((m) => !categoria || m.categoria === categoria)
      .filter((m) => !texto || m.descripcion.toLowerCase().includes(texto));
  });

  protected readonly totales = computed(() => calcularTotales(this.filtrados()));

  protected readonly hayFiltros = computed(
    () => this.filtroTipo() !== 'todos' || this.filtroCategoria() !== '' || this.busqueda() !== '',
  );

  protected elegirTipo(tipo: TipoMovimiento): void {
    this.tipoNuevo.set(tipo);
    this.formulario.controls.categoria.setValue(CATEGORIAS[tipo][0]);
  }

  // Muestra el error de un campo solo después de tocarlo o de intentar guardar
  protected tieneError(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || this.enviado());
  }

  protected guardar(): void {
    this.enviado.set(true);
    if (this.formulario.invalid) return;

    const { descripcion, monto, categoria, fecha } = this.formulario.getRawValue();
    this.servicio.agregar({
      descripcion: descripcion.trim(),
      monto: monto!,
      categoria,
      fecha,
      tipo: this.tipoNuevo(),
    });

    // Limpia el formulario pero mantiene el tipo y la categoría elegidos
    this.formulario.reset({ categoria, fecha: this.hoy });
    this.enviado.set(false);
  }

  protected cambiarFiltroTipo(tipo: 'todos' | TipoMovimiento): void {
    this.filtroTipo.set(tipo);
    this.filtroCategoria.set('');
  }

  protected cambiarCategoria(evento: Event): void {
    this.filtroCategoria.set((evento.target as HTMLSelectElement).value);
  }

  protected buscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected limpiarFiltros(): void {
    this.filtroTipo.set('todos');
    this.filtroCategoria.set('');
    this.busqueda.set('');
  }

  protected eliminar(movimiento: Movimiento): void {
    if (confirm(`¿Eliminar "${movimiento.descripcion}"?`)) {
      this.servicio.eliminar(movimiento.id);
    }
  }

  protected restablecer(): void {
    if (confirm('Se borrarán tus cambios y volverán los datos de ejemplo. ¿Continuar?')) {
      this.servicio.restablecer();
      this.limpiarFiltros();
    }
  }
}
