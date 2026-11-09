import { AbstractControl, ValidationErrors } from '@angular/forms';
import { hoy } from './fechas';

// Las fechas están en texto AAAA-MM-DD, así que se pueden comparar directamente.
// El backend aplica las mismas reglas; aquí solo se avisa antes de enviar.

// Movimientos y aportes: pueden ser de días anteriores, pero no futuros
export function noFutura(control: AbstractControl<string>): ValidationErrors | null {
  return control.value && control.value > hoy() ? { futura: true } : null;
}

// Fecha límite de una meta: no puede estar en el pasado
export function noPasada(control: AbstractControl<string>): ValidationErrors | null {
  return control.value && control.value < hoy() ? { pasada: true } : null;
}
