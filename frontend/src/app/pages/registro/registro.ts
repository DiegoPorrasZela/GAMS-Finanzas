import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Logo } from '../../components/logo/logo';
import { VerPassword } from '../../components/ver-password/ver-password';
import { AuthService } from '../../services/auth.service';
import { mensajeDeError } from '../../services/errores';

// Valida que las dos contraseñas sean iguales
function contrasenasIguales(grupo: AbstractControl): ValidationErrors | null {
  const { password, confirmar } = grupo.value;
  return password === confirmar ? null : { noCoinciden: true };
}

@Component({
  imports: [ReactiveFormsModule, RouterLink, Logo, VerPassword],
  selector: 'app-registro',
  templateUrl: './registro.html',
})
export class Registro {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly enviando = signal(false);
  protected readonly verPassword = signal(false);
  protected readonly enviado = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly formulario = this.fb.group(
    {
      nombre: ['', [Validators.required, Validators.maxLength(80)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
      password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(72)]],
      confirmar: ['', Validators.required],
    },
    { validators: contrasenasIguales },
  );

  protected tieneError(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || this.enviado());
  }

  protected noCoinciden(): boolean {
    const confirmar = this.formulario.controls.confirmar;
    return (
      this.formulario.hasError('noCoinciden') &&
      confirmar.value !== '' &&
      (confirmar.touched || this.enviado())
    );
  }

  protected registrar(): void {
    this.enviado.set(true);
    if (this.formulario.invalid || this.enviando()) return;

    this.enviando.set(true);
    this.error.set(null);
    const { nombre, email, password } = this.formulario.getRawValue();
    this.auth.registrar(nombre.trim(), email, password).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
