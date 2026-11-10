import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Categoria,
  TipoMovimiento,
  Usuario,
  esCategoriaDelSistema,
} from '../../models/finanzas.models';
import { AuthService } from '../../services/auth.service';
import { CategoriasService } from '../../services/categorias.service';
import { mensajeDeError } from '../../services/errores';
import { UsuariosService } from '../../services/usuarios.service';

// Panel del administrador: CRUD de categorías y gestión de usuarios
@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-admin',
  templateUrl: './admin.html',
})
export class Admin {
  private readonly categoriasService = inject(CategoriasService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly idActual = computed(() => this.auth.usuario()?.id);
  protected readonly mensaje = signal<{ error: boolean; texto: string } | null>(null);

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
  });

  // ---- Usuarios ----
  protected readonly usuarios = signal<Usuario[]>([]);

  constructor() {
    this.categoriasService.cargar();
    this.usuariosService.listar().subscribe({
      next: (lista) => this.usuarios.set(lista),
      error: (e) => this.mostrar(mensajeDeError(e), true),
    });
  }

  protected tieneErrorNombre(): boolean {
    const control = this.formulario.controls.nombre;
    return control.invalid && (control.touched || this.enviado());
  }

  protected guardarCategoria(): void {
    this.enviado.set(true);
    if (this.formulario.invalid || this.guardando()) return;

    const { nombre, tipo } = this.formulario.getRawValue();
    const editando = this.editando();
    const peticion = editando
      ? this.categoriasService.actualizar(editando.id, nombre.trim(), tipo)
      : this.categoriasService.crear(nombre.trim(), tipo);

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
    this.formulario.setValue({ nombre: categoria.nombre, tipo: categoria.tipo });
    this.mensaje.set(null);
    document.getElementById('nombre-categoria')?.focus();
  }

  protected cancelarEdicion(): void {
    this.editando.set(null);
    this.formulario.reset({ nombre: '', tipo: this.formulario.controls.tipo.value });
    this.enviado.set(false);
  }

  protected eliminarCategoria(categoria: Categoria): void {
    if (!confirm(`¿Eliminar la categoría "${categoria.nombre}"?`)) return;

    this.categoriasService.eliminar(categoria.id).subscribe({
      next: () => {
        this.mostrar(`Categoría "${categoria.nombre}" eliminada.`);
        if (this.editando()?.id === categoria.id) this.cancelarEdicion();
      },
      error: (e) => this.mostrar(mensajeDeError(e), true),
    });
  }

  protected eliminarUsuario(usuario: Usuario): void {
    const pregunta = `¿Eliminar la cuenta de ${usuario.nombre}? También se borrarán todos sus movimientos.`;
    if (!confirm(pregunta)) return;

    this.usuariosService.eliminar(usuario.id).subscribe({
      next: () => {
        this.usuarios.update((lista) => lista.filter((u) => u.id !== usuario.id));
        this.mostrar(`Cuenta de ${usuario.nombre} eliminada.`);
      },
      error: (e) => this.mostrar(mensajeDeError(e), true),
    });
  }

  private mostrar(texto: string, error = false): void {
    this.mensaje.set({ texto, error });
  }
}
