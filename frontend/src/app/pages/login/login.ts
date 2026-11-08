import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { mensajeDeError } from '../../services/errores';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-login',
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly sesionExpirada = this.ruta.snapshot.queryParamMap.has('expirada');
  protected readonly enviando = signal(false);
  protected readonly lento = signal(false);
  protected readonly enviado = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly formulario = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected tieneError(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || this.enviado());
  }

  protected usarCuentaDemo(): void {
    this.formulario.setValue({ email: 'demo@gams.pe', password: 'demo123' });
  }

  protected ingresar(): void {
    this.enviado.set(true);
    if (this.formulario.invalid || this.enviando()) return;

    this.enviando.set(true);
    this.error.set(null);
    // El servidor gratuito "duerme" y puede tardar en responder la primera vez
    const aviso = setTimeout(() => this.lento.set(true), 4000);

    const { email, password } = this.formulario.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => {
        clearTimeout(aviso);
        this.router.navigateByUrl(this.destino());
      },
      error: (e) => {
        clearTimeout(aviso);
        this.error.set(mensajeDeError(e));
        this.enviando.set(false);
        this.lento.set(false);
      },
    });
  }

  // Vuelve a la página que pidió antes de iniciar sesión (solo rutas internas)
  private destino(): string {
    const volver = this.ruta.snapshot.queryParamMap.get('volver');
    return volver?.startsWith('/') && !volver.startsWith('//') ? volver : '/';
  }
}
