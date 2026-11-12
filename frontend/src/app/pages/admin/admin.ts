import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Icono } from '../../components/icono/icono';
import { IconoCategoria } from '../../components/icono-categoria/icono-categoria';
import {
  COLORES,
  COLORES_DE_CATEGORIA,
  ColorCategoria,
  ICONOS_DE_CATEGORIA,
} from '../../components/icono-categoria/apariencia';
import {
  Categoria,
  TipoMovimiento,
  Usuario,
  esCategoriaDelSistema,
} from '../../models/finanzas.models';
import { AuthService } from '../../services/auth.service';
import { CategoriasService } from '../../services/categorias.service';
import { DialogoService } from '../../services/dialogo.service';
import { mensajeDeError } from '../../services/errores';
import { ToastService } from '../../services/toast.service';
import { UsuariosService } from '../../services/usuarios.service';

// Panel del administrador: CRUD de categorías y gestión de usuarios
@Component({
  imports: [ReactiveFormsModule, Icono, IconoCategoria],
  selector: 'app-admin',
  templateUrl: './admin.html',
})
export class Admin {
  private readonly categoriasService = inject(CategoriasService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly auth = inject(AuthService);
  private readonly dialogo = inject(DialogoService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly idActual = computed(() => this.auth.usuario()?.id);
  private readonly toast = inject(ToastService);

  // ---- Categorías ----
  protected readonly grupos = computed(() => {
    const categorias = this.categoriasService.categorias();
    return [
      { titulo: 'Ingresos', lista: categorias.filter((c) => c.tipo === 'ingreso') },
      { titulo: 'Gastos', lista: categorias.filter((c) => c.tipo === 'gasto') },
    ];
  });
  // Saldo inicial, Ahorro y Retiro de ahorros son del sistema: el backend no deja editarlas ni eliminarlas
  protected readonly esDelSistema = (categoria: Categoria) => esCategoriaDelSistema(categoria);
  protected readonly editando = signal<Categoria | null>(null);
  protected readonly enviado = signal(false);
  protected readonly guardando = signal(false);

  protected readonly formulario = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(50)]],
    tipo: this.fb.control<TipoMovimiento>('gasto'),
    icono: ['etiqueta'],
    color: this.fb.control<ColorCategoria>('gris'),
  });

  // Opciones de apariencia y vista previa de la categoría mientras se llena el formulario
  protected readonly iconos = ICONOS_DE_CATEGORIA;
  protected readonly colores = COLORES.map((clave) => ({ clave, ...COLORES_DE_CATEGORIA[clave] }));
  protected readonly vistaPrevia = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });

  // ---- Usuarios ----
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly estadoUsuarios = signal<'cargando' | 'listo' | 'error'>('cargando');

  constructor() {
    this.categoriasService.cargar();
    this.usuariosService.listar().subscribe({
      next: (lista) => {
        this.usuarios.set(lista);
        this.estadoUsuarios.set('listo');
      },
      error: (e) => {
        this.estadoUsuarios.set('error');
        this.mostrar(mensajeDeError(e), true);
      },
    });
  }

  protected tieneErrorNombre(): boolean {
    const control = this.formulario.controls.nombre;
    return control.invalid && (control.touched || this.enviado());
  }

  protected guardarCategoria(): void {
    this.enviado.set(true);
    if (this.formulario.invalid || this.guardando()) return;

    const { nombre, tipo, icono, color } = this.formulario.getRawValue();
    const datos = { nombre: nombre.trim(), tipo, icono, color };
    const editando = this.editando();
    const peticion = editando
      ? this.categoriasService.actualizar(editando.id, datos)
      : this.categoriasService.crear(datos);

    this.guardando.set(true);
    peticion.subscribe({
      next: (categoria) => {
        this.mostrar(`Categoría "${categoria.nombre}" ${editando ? 'actualizada' : 'creada'}.`);
        this.guardando.set(false);
        this.cancelarEdicion();
      },
      error: (e) => {
        this.mostrar(mensajeDeError(e), true);
        this.guardando.set(false);
      },
    });
  }

  protected editarCategoria(categoria: Categoria): void {
    this.editando.set(categoria);
    this.formulario.setValue({
      nombre: categoria.nombre,
      tipo: categoria.tipo,
      icono: categoria.icono,
      color: categoria.color as ColorCategoria,
    });
    document.getElementById('nombre-categoria')?.focus();
  }

  protected cancelarEdicion(): void {
    this.editando.set(null);
    this.formulario.reset({
      nombre: '',
      tipo: this.formulario.controls.tipo.value,
      icono: 'etiqueta',
      color: 'gris',
    });
    this.enviado.set(false);
  }

  protected async eliminarCategoria(categoria: Categoria): Promise<void> {
    const confirmado = await this.dialogo.confirmar({
      tono: 'peligro',
      titulo: `¿Eliminar la categoría "${categoria.nombre}"?`,
      mensaje: `Categoría de ${categoria.tipo === 'ingreso' ? 'ingresos' : 'gastos'}.`,
      detalle: 'Solo se puede eliminar si ningún usuario la usa en sus movimientos.',
      confirmar: 'Eliminar categoría',
    });
    if (!confirmado) return;

    this.categoriasService.eliminar(categoria.id).subscribe({
      next: () => {
        this.mostrar(`Categoría "${categoria.nombre}" eliminada.`);
        if (this.editando()?.id === categoria.id) this.cancelarEdicion();
      },
      error: (e) => this.mostrar(mensajeDeError(e), true),
    });
  }

  protected async eliminarUsuario(usuario: Usuario): Promise<void> {
    const confirmado = await this.dialogo.confirmar({
      tono: 'peligro',
      titulo: `¿Eliminar la cuenta de ${usuario.nombre}?`,
      mensaje: usuario.email,
      detalle:
        'También se borrarán todos sus movimientos, presupuestos, metas y ahorros. Esta acción no se puede deshacer.',
      confirmar: 'Eliminar cuenta',
    });
    if (!confirmado) return;

    this.usuariosService.eliminar(usuario.id).subscribe({
      next: () => {
        this.usuarios.update((lista) => lista.filter((u) => u.id !== usuario.id));
        this.mostrar(`Cuenta de ${usuario.nombre} eliminada.`);
      },
      error: (e) => this.mostrar(mensajeDeError(e), true),
    });
  }

  // Éxito y errores de las acciones se muestran como notificaciones flotantes
  private mostrar(texto: string, error = false): void {
    if (error) this.toast.error(texto);
    else this.toast.exito(texto);
  }
}
