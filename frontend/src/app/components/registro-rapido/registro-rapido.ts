import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Icono } from '../icono/icono';
import {
  DatosMovimiento,
  Moneda,
  Movimiento,
  SIMBOLO_MONEDA,
  TipoMovimiento,
  clasificar,
  esCategoriaDelSistema,
} from '../../models/finanzas.models';
import { CategoriasService } from '../../services/categorias.service';
import { DialogoService } from '../../services/dialogo.service';
import { mensajeDeError } from '../../services/errores';
import { MovimientosService, calcularTotales } from '../../services/movimientos.service';
import { RegistroRapidoService } from '../../services/registro-rapido.service';
import { aSoles, conversionASoles } from '../../services/tipo-cambio.service';
import { ToastService } from '../../services/toast.service';
import { hoy } from '../../utils/fechas';
import { restar } from '../../utils/dinero';
import { ddmmaaaa, enMoneda, soles } from '../../utils/formato';
import { noFutura } from '../../utils/validadores';

// Registro rápido de un ingreso o gasto desde cualquier pantalla.
// En celular es una hoja que sube desde abajo; en computadora, un cuadro centrado.
// Las opciones avanzadas (repetir automáticamente) siguen en la página Movimientos.
@Component({
  selector: 'app-registro-rapido',
  imports: [ReactiveFormsModule, RouterLink, DecimalPipe, Icono],
  templateUrl: './registro-rapido.html',
})
export class RegistroRapido {
  private readonly servicio = inject(RegistroRapidoService);
  private readonly movimientosService = inject(MovimientosService);
  private readonly categoriasService = inject(CategoriasService);
  private readonly dialogo = inject(DialogoService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly hoja = viewChild.required<ElementRef<HTMLDialogElement>>('hoja');

  protected readonly abierto = this.servicio.abierto;
  protected readonly hoy = hoy();
  protected readonly tipo = signal<TipoMovimiento>('gasto');
  protected readonly enviado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly formulario = this.fb.group({
    moneda: this.fb.control<Moneda>('PEN'),
    monto: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    descripcion: ['', [Validators.required, Validators.maxLength(60)]],
    categoriaId: this.fb.control<number | null>(null, Validators.required),
    fecha: [this.hoy, [Validators.required, noFutura]],
  });

  // Pago en dólares o euros: se convierte a soles con el tipo de cambio del día del gasto
  protected readonly SIMBOLO_MONEDA = SIMBOLO_MONEDA;
  protected readonly ddmmaaaa = ddmmaaaa;
  protected readonly moneda = toSignal(this.formulario.controls.moneda.valueChanges, {
    initialValue: 'PEN' as Moneda,
  });
  private readonly fecha = toSignal(this.formulario.controls.fecha.valueChanges, {
    initialValue: this.hoy,
  });
  private readonly montoEscrito = toSignal(this.formulario.controls.monto.valueChanges, {
    initialValue: null,
  });
  protected readonly conversion = conversionASoles(this.moneda, this.fecha);
  protected readonly montoEnSoles = computed(() => {
    const monto = this.montoEscrito();
    const conversion = this.conversion();
    return monto && conversion.estado === 'lista' ? aSoles(monto, conversion.tasa) : null;
  });

  // Saldo inicial y ahorros tienen su propio lugar (Inicio y Metas): aquí solo ingresos y gastos
  protected readonly categorias = computed(() =>
    this.categoriasService
      .categorias()
      .filter((c) => c.tipo === this.tipo() && !esCategoriaDelSistema(c)),
  );

  // Lo que ya registró antes (la más reciente de cada descripción) para autocompletar
  protected readonly sugerencias = computed(() => {
    const vistas = new Map<string, Movimiento>();
    for (const m of this.movimientosService.movimientos()) {
      const clave = m.descripcion.trim().toLowerCase();
      if (clasificar(m) === this.tipo() && !vistas.has(clave)) vistas.set(clave, m);
    }
    return [...vistas.values()].slice(0, 30);
  });

  constructor() {
    // Al abrir: datos frescos (para el autocompletado y el aviso de saldo) y formulario limpio
    effect(() => {
      if (this.abierto()) untracked(() => this.preparar());
    });

    // La categoría elegida siempre corresponde al tipo
    effect(() => {
      const opciones = this.categorias();
      const control = this.formulario.controls.categoriaId;
      if (!opciones.some((c) => c.id === control.value)) control.setValue(opciones[0]?.id ?? null);
    });

    // Abre o cierra el <dialog> nativo según el servicio
    afterRenderEffect(() => {
      const elemento = this.hoja().nativeElement;
      if (this.abierto() && !elemento.open) {
        if (typeof elemento.showModal === 'function') elemento.showModal();
        else elemento.setAttribute('open', '');
      } else if (!this.abierto() && elemento.open) {
        if (typeof elemento.close === 'function') elemento.close();
        else elemento.removeAttribute('open');
      }
    });
  }

  protected tieneError(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || this.enviado());
  }

  protected elegirTipo(tipo: TipoMovimiento): void {
    this.tipo.set(tipo);
  }

  // Al elegir algo que ya registró, completa la categoría y el monto (si está vacío)
  protected alElegirDescripcion(): void {
    const texto = this.formulario.controls.descripcion.value.trim().toLowerCase();
    const anterior = this.sugerencias().find((m) => m.descripcion.trim().toLowerCase() === texto);
    if (!anterior) return;
    if (this.categorias().some((c) => c.id === anterior.categoriaId)) {
      this.formulario.controls.categoriaId.setValue(anterior.categoriaId);
    }
    if (this.formulario.controls.monto.value === null) {
      this.formulario.patchValue({
        moneda: anterior.monedaOriginal ?? 'PEN',
        monto: anterior.montoOriginal ?? anterior.monto,
      });
    }
  }

  protected async guardar(): Promise<void> {
    this.enviado.set(true);
    if (this.formulario.invalid || this.guardando()) return;

    const { moneda, monto, descripcion, categoriaId, fecha } = this.formulario.getRawValue();
    const tipo = this.tipo();

    // En dólares o euros se guarda en soles con la tasa del día (y también el monto original)
    let montoEnSoles = monto!;
    if (moneda !== 'PEN') {
      const conversion = this.conversion();
      if (conversion.estado !== 'lista') {
        this.error.set(
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
    const montoTexto =
      moneda === 'PEN'
        ? soles(montoEnSoles)
        : `${enMoneda(monto!, SIMBOLO_MONEDA[moneda])} (${soles(montoEnSoles)})`;

    // Misma regla que en Movimientos: un gasto que deja el saldo en negativo se avisa, no se bloquea
    const saldoNuevo = restar(
      calcularTotales(this.movimientosService.movimientos()).saldo,
      montoEnSoles,
    );
    if (
      tipo === 'gasto' &&
      saldoNuevo < 0 &&
      !(await this.dialogo.confirmar({
        tono: 'aviso',
        titulo: 'Tu saldo quedaría en negativo',
        mensaje: `Con este gasto tu saldo quedaría en ${soles(saldoNuevo)}.`,
        detalle:
          '¿Te falta registrar algún ingreso o tu saldo inicial? Si el gasto es real, puedes guardarlo igual.',
        confirmar: 'Guardar de todos modos',
        cancelar: 'Revisar',
      }))
    ) {
      return;
    }

    this.guardando.set(true);
    this.error.set(null);
    this.movimientosService.agregar(datos).subscribe({
      next: () => {
        this.guardando.set(false);
        this.servicio.cerrar();
        this.toast.exito(
          `${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} registrado: ${datos.descripcion} · ${montoTexto}`,
        );
      },
      error: (e) => {
        this.guardando.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }

  protected cerrar(): void {
    this.servicio.cerrar();
  }

  // Esc: el navegador dispara "cancel"; se cierra a través del servicio
  protected alPresionarEsc(evento: Event): void {
    evento.preventDefault();
    this.cerrar();
  }

  // Un clic en el fondo oscuro (fuera de la hoja) también cierra
  protected alHacerClic(evento: MouseEvent): void {
    if (evento.target === this.hoja().nativeElement) this.cerrar();
  }

  private preparar(): void {
    this.categoriasService.cargar();
    this.movimientosService.cargar();
    this.tipo.set('gasto');
    this.formulario.reset({
      moneda: 'PEN',
      monto: null,
      descripcion: '',
      categoriaId: null,
      fecha: this.hoy,
    });
    this.enviado.set(false);
    this.error.set(null);
  }
}
