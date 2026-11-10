import { Injectable, signal } from '@angular/core';

// peligro: eliminar algo · aviso: algo que conviene revisar (ej. saldo negativo) · info: confirmación normal
export type TonoDialogo = 'peligro' | 'aviso' | 'info';

export interface OpcionesDialogo {
  titulo: string;
  mensaje: string;
  detalle?: string; // recuadro destacado debajo del mensaje
  confirmar?: string; // texto del botón principal (por defecto "Aceptar")
  cancelar?: string; // texto del botón secundario (por defecto "Cancelar")
  tono?: TonoDialogo;
}

interface DialogoAbierto extends OpcionesDialogo {
  responder: (aceptado: boolean) => void;
}

// Reemplaza a confirm() del navegador. El componente <app-dialogo> (en app.html) muestra el diálogo
// que esté abierto aquí. Uso: if (await dialogo.confirmar({ titulo: '¿Eliminar?', ... })) { ... }
@Injectable({ providedIn: 'root' })
export class DialogoService {
  private readonly abierto = signal<DialogoAbierto | null>(null);
  readonly actual = this.abierto.asReadonly();

  confirmar(opciones: OpcionesDialogo): Promise<boolean> {
    this.abierto()?.responder(false); // si había otro abierto, se cancela
    return new Promise((resolver) =>
      this.abierto.set({
        ...opciones,
        responder: (aceptado) => {
          this.abierto.set(null);
          resolver(aceptado);
        },
      }),
    );
  }

  responder(aceptado: boolean): void {
    this.abierto()?.responder(aceptado);
  }
}
