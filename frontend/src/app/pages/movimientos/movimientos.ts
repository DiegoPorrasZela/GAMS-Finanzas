import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import {
  DatosMovimiento,
  Frecuencia,
  Movimiento,
  Recurrente,
  TipoMovimiento,
  ULTIMO_DIA,
  clasificar,
  esAhorro,
  esRetiro,
  esSaldoInicial,
} from '../../models/finanzas.models';
import { CategoriasService } from '../../services/categorias.service';
import { DialogoService } from '../../services/dialogo.service';
import { mensajeDeError } from '../../services/errores';
import { MovimientosService, calcularTotales } from '../../services/movimientos.service';
import { RecurrentesService } from '../../services/recurrentes.service';
import {
  capitalizar,
  esUltimoDiaDelMes,
  fraseRepeticion,
  hoy,
  mesesConDatos,
  nombreMes,
  primeraFecha,
  textoFrecuencia,
} from '../../utils/fechas';
import { ddmmaaaa, soles } from '../../utils/formato';
import { noFutura } from '../../utils/validadores';

// Efecto de un movimiento en el saldo: suma si es ingreso, resta si es gasto
const efectoEnSaldo = (tipo: TipoMovimiento, monto: number) => (tipo === 'ingreso' ? monto : -monto);

@Component({
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe],
  selector: 'app-movimientos',
  styleUrl: './movimientos.css',
  templateUrl: './movimientos.html',
})
export class Movimientos {
  private readonly servicio = inject(MovimientosService);
  private readonly categoriasService = inject(CategoriasService);
  private readonly recurrentesService = inject(RecurrentesService);
  private readonly dialogo = inject(DialogoService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly hoy = hoy();
  protected readonly cargando = this.servicio.cargando;
  protected readonly errorCarga = computed(
    () =>
      this.servicio.error() ?? this.categoriasService.error() ?? this.recurrentesService.error(),
  );
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  private readonly saldoTotal = computed(() => calcularTotales(this.servicio.movimientos()).saldo);

  // ---- Formulario para agregar o editar ----
  protected readonly tipoNuevo = signal<TipoMovimiento>('gasto');
  protected readonly editando = signal<Movimiento | null>(null);
  // El saldo inicial se registra una sola vez: si ya existe, solo se ofrece al editar ese movimiento
  private readonly saldoInicialRegistrado = computed(
    () => this.servicio.movimientos().find(esSaldoInicial) ?? null,
  );
  // Ahorros y retiros se manejan desde Metas: aquí solo aparecen al editar uno de esos movimientos
  protected readonly categoriasNuevo = computed(() => {
    const registrado = this.saldoInicialRegistrado();
    const editando = this.editando();
    return this.categoriasService
      .categorias()
      .filter((c) => c.tipo === this.tipoNuevo())
      .filter((c) => !esSaldoInicial(c) || !registrado || editando?.id === registrado.id)
      .filter((c) => !(esAhorro(c) || esRetiro(c)) || editando?.categoriaId === c.id);
  });

  protected readonly clasificar = clasificar;
  protected readonly textoFrecuencia = textoFrecuencia;
  protected readonly enviado = signal(false);
  protected readonly guardando = signal(false);

  protected readonly formulario = this.fb.group({
    descripcion: ['', [Validators.required, Validators.maxLength(60)]],
    monto: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    categoriaId: this.fb.control<number | null>(null, Validators.required),
    fecha: [this.hoy, [Validators.required, noFutura]],
    repetir: [false],
    frecuencia: this.fb.control<Frecuencia>('MENSUAL'),
    dia: this.fb.control<number>(new Date().getDate()), // día del mes (31 = último día)
  });

  // Opciones del día del mes para los automáticos mensuales: 1 a 30 y "Último día del mes"
  protected readonly dias = Array.from({ length: 30 }, (_, i) => i + 1);
  protected readonly ULTIMO_DIA = ULTIMO_DIA;

  // ---- Movimientos automáticos ----
  protected readonly recurrentes = this.recurrentesService.recurrentes;

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
    this.recurrentesService.cargar();

    // Cuando llegan las categorías o cambia el tipo, elige una categoría válida para ese tipo
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

  // El saldo inicial no puede repetirse cada mes
  protected esSaldoInicialElegido(): boolean {
    const id = this.formulario.controls.categoriaId.value;
    const categoria = this.categoriasNuevo().find((c) => c.id === id);
    return !!categoria && esSaldoInicial(categoria);
  }

  // Al marcar "Repetir", propone como día del mes el de la fecha (o "último día" si la fecha es fin de mes)
  protected alCambiarRepetir(): void {
    const fecha = this.formulario.controls.fecha.value || this.hoy;
    this.formulario.controls.dia.setValue(
      esUltimoDiaDelMes(fecha) ? ULTIMO_DIA : Number(fecha.slice(8, 10)),
    );
  }

  // "cada día", "el 15 y el último día de cada mes", "el último día de cada mes"…
  protected repeticionElegida(): string {
    const { fecha, frecuencia, dia } = this.formulario.getRawValue();
    return fraseRepeticion(frecuencia, dia, fecha || this.hoy);
  }

  // Primera fecha en que se registrará (la fecha del formulario es "desde")
  protected primerRegistro(): string {
    const { fecha, frecuencia, dia } = this.formulario.getRawValue();
    return primeraFecha(fecha || this.hoy, frecuencia, dia);
  }

  protected readonly ddmmaaaa = ddmmaaaa;

  // Muestra el error de un campo solo después de tocarlo o de intentar guardar
  protected tieneError(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || this.enviado());
  }

  protected async guardar(): Promise<void> {
    this.enviado.set(true);
    if (this.formulario.invalid || this.guardando()) return;

    const { descripcion, monto, categoriaId, fecha, repetir, frecuencia, dia } =
      this.formulario.getRawValue();
    const datos: DatosMovimiento = {
      descripcion: descripcion.trim(),
      monto: monto!,
      categoriaId: categoriaId!,
      fecha,
    };
    const editando = this.editando();

    // Avisar (no bloquear) si el saldo total quedaría en negativo
    const saldoNuevo =
      this.saldoTotal() -
      (editando ? efectoEnSaldo(editando.tipo, editando.monto) : 0) +
      efectoEnSaldo(this.tipoNuevo(), datos.monto);
    if (
      saldoNuevo < 0 &&
      saldoNuevo < this.saldoTotal() &&
      !(await this.dialogo.confirmar({
        tono: 'aviso',
        titulo: 'Tu saldo quedaría en negativo',
        mensaje: `Con este movimiento tu saldo quedaría en ${soles(saldoNuevo)}.`,
        detalle:
          '¿Te falta registrar algún ingreso o tu saldo inicial? Si el gasto es real, puedes guardarlo igual.',
        confirmar: 'Guardar de todos modos',
        cancelar: 'Revisar',
      }))
    ) {
      return;
    }

    const automatico = repetir && !editando && !this.esSaldoInicialElegido();
    const peticion: Observable<unknown> = editando
      ? this.servicio.actualizar(editando.id, datos)
      : automatico
        ? this.recurrentesService.crear(datos, frecuencia, frecuencia === 'MENSUAL' ? dia : undefined)
        : this.servicio.agregar(datos);
    const repeticion = this.repeticionElegida();
    const primera = this.primerRegistro();

    this.guardando.set(true);
    this.errorAccion.set(null);
    this.aviso.set(null);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.editando.set(null);
        if (automatico) {
          // El backend ya registró el primer movimiento: se vuelve a cargar la lista
          this.servicio.cargar();
          this.aviso.set(
            `"${datos.descripcion}" se registrará automáticamente ${repeticion}. ` +
              (primera <= this.hoy
                ? 'El primero ya quedó registrado.'
                : `El primero será el ${ddmmaaaa(primera)}.`),
          );
        }
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
      repetir: false,
      frecuencia: 'MENSUAL',
      dia: Number(movimiento.fecha.slice(8, 10)),
    });
    this.enviado.set(false);
    this.errorAccion.set(null);
    document.getElementById('descripcion')?.focus();
  }

  protected cancelarEdicion(): void {
    this.editando.set(null);
    this.limpiarFormulario();
  }

  protected async eliminar(movimiento: Movimiento): Promise<void> {
    const saldoNuevo = this.saldoTotal() - efectoEnSaldo(movimiento.tipo, movimiento.monto);
    const signo = movimiento.tipo === 'ingreso' ? '+' : '-';
    const confirmado = await this.dialogo.confirmar({
      tono: 'peligro',
      titulo: '¿Eliminar este movimiento?',
      mensaje: `"${movimiento.descripcion}" · ${signo} ${soles(movimiento.monto)} · ${ddmmaaaa(movimiento.fecha)}`,
      detalle:
        movimiento.tipo === 'ingreso' && saldoNuevo < 0
          ? `Tu saldo quedará en ${soles(saldoNuevo)}.`
          : undefined,
      confirmar: 'Eliminar',
    });
    if (!confirmado) return;

    this.errorAccion.set(null);
    this.servicio.eliminar(movimiento.id).subscribe({
      next: () => {
        if (this.editando()?.id === movimiento.id) this.cancelarEdicion();
      },
      error: (e) => this.errorAccion.set(mensajeDeError(e)),
    });
  }

  // ---- Automáticos ----

  protected alternarRecurrente(recurrente: Recurrente): void {
    this.recurrentesService.cambiarEstado(recurrente, !recurrente.activo).subscribe({
      next: () => this.servicio.cargar(),
      error: (e) => this.errorAccion.set(mensajeDeError(e)),
    });
  }

  protected async eliminarRecurrente(recurrente: Recurrente): Promise<void> {
    const confirmado = await this.dialogo.confirmar({
      tono: 'peligro',
      titulo: '¿Dejar de registrar este automático?',
      mensaje: `"${recurrente.descripcion}" · ${soles(recurrente.monto)} · ${textoFrecuencia(recurrente).toLowerCase()}`,
      detalle: 'Los movimientos que ya se registraron se conservan.',
      confirmar: 'Eliminar automático',
    });
    if (!confirmado) return;
    this.recurrentesService.eliminar(recurrente.id).subscribe({
      error: (e) => this.errorAccion.set(mensajeDeError(e)),
    });
  }

  // ---- Filtros ----

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
    this.formulario.reset({
      descripcion: '',
      monto: null,
      categoriaId,
      fecha: this.hoy,
      repetir: false,
      frecuencia: 'MENSUAL',
      dia: new Date().getDate(),
    });
    this.enviado.set(false);
  }
}
