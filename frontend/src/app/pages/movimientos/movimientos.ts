import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { Icono } from '../../components/icono/icono';
import { IconoCategoria } from '../../components/icono-categoria/icono-categoria';
import {
  DatosMovimiento,
  Frecuencia,
  Moneda,
  Movimiento,
  Recurrente,
  SIMBOLO_MONEDA,
  TipoMovimiento,
  ULTIMO_DIA,
  clasificar,
  esAhorro,
  esCategoriaDelSistema,
  esRetiro,
  esSaldoInicial,
} from '../../models/finanzas.models';
import { CategoriasService } from '../../services/categorias.service';
import { DialogoService } from '../../services/dialogo.service';
import { mensajeDeError } from '../../services/errores';
import {
  MovimientosService,
  SEGUNDOS_PARA_DESHACER,
  calcularTotales,
} from '../../services/movimientos.service';
import { RecurrentesService } from '../../services/recurrentes.service';
import { aSoles, conversionASoles } from '../../services/tipo-cambio.service';
import { ToastService } from '../../services/toast.service';
import { descargarCsv, movimientosACsv } from '../../utils/csv';
import {
  capitalizar,
  esUltimoDiaDelMes,
  fraseRepeticion,
  hoy,
  mesesConDatos,
  nombreMes,
  primeraFecha,
  textoFrecuencia,
  tituloDia,
} from '../../utils/fechas';
import { ddmmaaaa, enMoneda, soles } from '../../utils/formato';
import { noFutura } from '../../utils/validadores';

// Efecto de un movimiento en el saldo: suma si es ingreso, resta si es gasto
const efectoEnSaldo = (tipo: TipoMovimiento, monto: number) =>
  tipo === 'ingreso' ? monto : -monto;

// Movimientos que se muestran de a poco ("Ver más") para que la lista cargue rápido
const POR_PAGINA = 30;

interface Dia {
  fecha: string;
  titulo: string; // "Hoy", "Ayer", "Lunes, 3 de noviembre"
  neto: number; // cuánto cambió el saldo ese día
  movimientos: Movimiento[];
}

@Component({
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, Icono, IconoCategoria],
  selector: 'app-movimientos',
  styleUrl: './movimientos.css',
  templateUrl: './movimientos.html',
})
export class Movimientos {
  private readonly servicio = inject(MovimientosService);
  private readonly categoriasService = inject(CategoriasService);
  private readonly recurrentesService = inject(RecurrentesService);
  private readonly dialogo = inject(DialogoService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly hoy = hoy();
  protected readonly cargando = this.servicio.cargando;
  // Solo la primera carga muestra el esqueleto; al recargar, la lista anterior se queda en pantalla
  protected readonly cargandoPrimeraVez = computed(
    () => this.cargando() && this.servicio.movimientos().length === 0,
  );
  protected readonly errorCarga = computed(
    () =>
      this.servicio.error() ?? this.categoriasService.error() ?? this.recurrentesService.error(),
  );
  // Los errores al guardar se muestran junto al formulario; el resto, como notificación flotante
  protected readonly errorAccion = signal<string | null>(null);

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
  protected readonly SIMBOLO_MONEDA = SIMBOLO_MONEDA;
  protected readonly abs = Math.abs;

  // Descripciones que ya usó (la más reciente de cada una) del tipo elegido, para autocompletar
  protected readonly descripcionesAnteriores = computed(() => {
    const tipo = this.tipoNuevo();
    const vistas = new Map<string, Movimiento>();
    for (const m of this.servicio.movimientos()) {
      const clave = m.descripcion.trim().toLowerCase();
      if (clasificar(m) === tipo && !vistas.has(clave)) vistas.set(clave, m);
    }
    return [...vistas.values()].slice(0, 30);
  });
  protected readonly enviado = signal(false);
  protected readonly guardando = signal(false);

  protected readonly formulario = this.fb.group({
    descripcion: ['', [Validators.required, Validators.maxLength(60)]],
    moneda: this.fb.control<Moneda>('PEN'),
    monto: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    categoriaId: this.fb.control<number | null>(null, Validators.required),
    fecha: [this.hoy, [Validators.required, noFutura]],
    repetir: [false],
    frecuencia: this.fb.control<Frecuencia>('MENSUAL'),
    dia: this.fb.control<number>(new Date().getDate()), // día del mes (31 = último día)
  });

  // ---- Pago en dólares o euros: se convierte a soles con el tipo de cambio del día del gasto ----
  private readonly controles = this.formulario.controls;
  protected readonly moneda = toSignal(this.controles.moneda.valueChanges, {
    initialValue: 'PEN' as Moneda,
  });
  private readonly fechaElegida = toSignal(this.controles.fecha.valueChanges, {
    initialValue: this.hoy,
  });
  private readonly montoEscrito = toSignal(this.controles.monto.valueChanges, {
    initialValue: null,
  });
  private readonly categoriaElegida = toSignal(this.controles.categoriaId.valueChanges, {
    initialValue: null,
  });
  protected readonly conversion = conversionASoles(this.moneda, this.fechaElegida);
  protected readonly montoEnSoles = computed(() => {
    const monto = this.montoEscrito();
    const conversion = this.conversion();
    return monto && conversion.estado === 'lista' ? aSoles(monto, conversion.tasa) : null;
  });
  // El saldo inicial y los ahorros van siempre en soles
  protected readonly aceptaOtraMoneda = computed(() => {
    const categoria = this.categoriasNuevo().find((c) => c.id === this.categoriaElegida());
    return !categoria || !esCategoriaDelSistema(categoria);
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

    // Si se elige una categoría que va siempre en soles, vuelve a soles
    effect(() => {
      if (!this.aceptaOtraMoneda() && this.controles.moneda.value !== 'PEN') {
        this.controles.moneda.setValue('PEN');
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

  // ---- Lista agrupada por día, de a 30 ----
  // Al cambiar un filtro se vuelve a mostrar solo la primera página
  protected readonly limite = linkedSignal({
    source: () => [this.filtroMes(), this.filtroTipo(), this.filtroCategoria(), this.busqueda()],
    computation: () => POR_PAGINA,
  });
  protected readonly restantes = computed(() =>
    Math.max(0, this.filtrados().length - this.limite()),
  );

  protected readonly diasVisibles = computed<Dia[]>(() => {
    const lista = this.filtrados();
    // El total de cada día se calcula con todos sus movimientos, aunque "Ver más" corte el día
    const netoPorDia = new Map<string, number>();
    for (const m of lista) {
      netoPorDia.set(m.fecha, (netoPorDia.get(m.fecha) ?? 0) + efectoEnSaldo(m.tipo, m.monto));
    }
    const dias: Dia[] = [];
    for (const m of lista.slice(0, this.limite())) {
      let dia = dias.at(-1);
      if (dia?.fecha !== m.fecha) {
        dia = {
          fecha: m.fecha,
          titulo: tituloDia(m.fecha, this.hoy),
          neto: netoPorDia.get(m.fecha)!,
          movimientos: [],
        };
        dias.push(dia);
      }
      dia.movimientos.push(m);
    }
    return dias;
  });

  protected verMas(): void {
    this.limite.update((limite) => limite + POR_PAGINA);
  }

  // Ícono y color de la categoría del movimiento
  protected apariencia(movimiento: Movimiento) {
    return this.categoriasService.apariencia(movimiento.categoriaId);
  }

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

    const { descripcion, moneda, monto, categoriaId, fecha, repetir, frecuencia, dia } =
      this.formulario.getRawValue();

    // En dólares o euros, el monto se guarda en soles con la tasa del día (y también el monto original)
    let montoEnSoles = monto!;
    if (moneda !== 'PEN') {
      const conversion = this.conversion();
      if (conversion.estado !== 'lista') {
        this.errorAccion.set(
          conversion.estado === 'cargando'
            ? 'Un momento: estamos consultando el tipo de cambio.'
            : 'No se pudo consultar el tipo de cambio. Revisa tu conexión o registra el monto en soles.',
        );
        return;
      }
      montoEnSoles = aSoles(monto!, conversion.tasa);
    }
    const datos: DatosMovimiento = {
      descripcion: descripcion.trim(),
      monto: montoEnSoles,
      categoriaId: categoriaId!,
      fecha,
      ...(moneda !== 'PEN' ? { monedaOriginal: moneda, montoOriginal: monto! } : {}),
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

    // Los automáticos se registran en soles
    const automatico = repetir && moneda === 'PEN' && !editando && !this.esSaldoInicialElegido();
    const peticion: Observable<unknown> = editando
      ? this.servicio.actualizar(editando.id, datos)
      : automatico
        ? this.recurrentesService.crear(
            datos,
            frecuencia,
            frecuencia === 'MENSUAL' ? dia : undefined,
          )
        : this.servicio.agregar(datos);
    const repeticion = this.repeticionElegida();
    const primera = this.primerRegistro();
    const montoTexto =
      moneda === 'PEN'
        ? soles(datos.monto)
        : `${enMoneda(monto!, SIMBOLO_MONEDA[moneda])} (${soles(datos.monto)})`;

    const tipo = this.tipoNuevo() === 'ingreso' ? 'Ingreso' : 'Gasto';
    this.guardando.set(true);
    this.errorAccion.set(null);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.editando.set(null);
        if (automatico) {
          // El backend ya registró el primero si su fecha llegó: se vuelve a cargar la lista
          this.servicio.cargar();
          this.toast.exito(
            `"${datos.descripcion}" se registrará automáticamente ${repeticion}. ` +
              (primera <= this.hoy
                ? 'El primero ya quedó registrado.'
                : `El primero será el ${ddmmaaaa(primera)}.`),
          );
        } else if (editando) {
          this.toast.exito(`Cambios guardados en "${datos.descripcion}".`);
        } else {
          this.toast.exito(`${tipo} registrado: ${datos.descripcion} · ${montoTexto}`);
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
      moneda: movimiento.monedaOriginal ?? 'PEN',
      monto: movimiento.montoOriginal ?? movimiento.monto,
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

  // Al elegir una descripción que ya usó, completa la categoría y el monto (si todavía está vacío)
  protected alElegirDescripcion(): void {
    if (this.editando()) return;
    const texto = this.formulario.controls.descripcion.value.trim().toLowerCase();
    const anterior = this.descripcionesAnteriores().find(
      (m) => m.descripcion.trim().toLowerCase() === texto,
    );
    if (!anterior) return;
    if (this.categoriasNuevo().some((c) => c.id === anterior.categoriaId)) {
      this.formulario.controls.categoriaId.setValue(anterior.categoriaId);
    }
    if (this.formulario.controls.monto.value === null) {
      this.formulario.patchValue({
        moneda: anterior.monedaOriginal ?? 'PEN',
        monto: anterior.montoOriginal ?? anterior.monto,
      });
    }
  }

  // "Registrar de nuevo": copia un movimiento al formulario con la fecha de hoy (ej. el almuerzo de cada día)
  protected registrarDeNuevo(movimiento: Movimiento): void {
    this.editando.set(null);
    this.tipoNuevo.set(movimiento.tipo);
    this.formulario.reset({
      descripcion: movimiento.descripcion,
      moneda: movimiento.monedaOriginal ?? 'PEN',
      monto: movimiento.montoOriginal ?? movimiento.monto,
      categoriaId: movimiento.categoriaId,
      fecha: this.hoy,
      repetir: false,
      frecuencia: 'MENSUAL',
      dia: new Date().getDate(),
    });
    this.enviado.set(false);
    this.errorAccion.set(null);
    document.getElementById('monto')?.focus();
    this.toast.info(
      `Listo para registrar "${movimiento.descripcion}" con fecha de hoy: revisa el monto y agrégalo.`,
    );
  }

  // Patrón "Deshacer": se quita al instante y hay unos segundos para recuperarlo (sin diálogo de confirmación)
  protected eliminar(movimiento: Movimiento): void {
    if (this.editando()?.id === movimiento.id) this.cancelarEdicion();
    const saldoNuevo = this.saldoTotal() - efectoEnSaldo(movimiento.tipo, movimiento.monto);

    const deshacer = this.servicio.eliminarConDeshacer(movimiento.id, (e) =>
      this.toast.error(`No se pudo eliminar "${movimiento.descripcion}": ${mensajeDeError(e)}`),
    );
    this.toast.conAccion(
      `"${movimiento.descripcion}" eliminado.` +
        (movimiento.tipo === 'ingreso' && saldoNuevo < 0
          ? ` Tu saldo quedó en ${soles(saldoNuevo)}.`
          : ''),
      { texto: 'Deshacer', ejecutar: deshacer },
      SEGUNDOS_PARA_DESHACER,
    );
  }

  // Descarga en CSV (Excel) lo que se ve con los filtros actuales
  protected exportar(): void {
    const lista = this.filtrados();
    descargarCsv(`gams-movimientos-${this.filtroMes() || 'todos'}.csv`, movimientosACsv(lista));
    this.toast.exito(
      `Se descargaron ${lista.length} ${lista.length === 1 ? 'movimiento' : 'movimientos'}. Ábrelo con Excel o Google Sheets.`,
    );
  }

  // ---- Automáticos ----

  protected alternarRecurrente(recurrente: Recurrente): void {
    const reanudar = !recurrente.activo;
    this.recurrentesService.cambiarEstado(recurrente, reanudar).subscribe({
      next: () => {
        this.servicio.cargar();
        this.toast.info(
          reanudar
            ? `"${recurrente.descripcion}" se volverá a registrar automáticamente.`
            : `"${recurrente.descripcion}" quedó en pausa: no se registrará hasta que lo reanudes.`,
        );
      },
      error: (e) => this.toast.error(mensajeDeError(e)),
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
      next: () =>
        this.toast.exito(`"${recurrente.descripcion}" ya no se registrará automáticamente.`),
      error: (e) => this.toast.error(mensajeDeError(e)),
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
      moneda: 'PEN',
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
