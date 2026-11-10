import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogoService } from '../../services/dialogo.service';
import { Dialogo } from './dialogo';

describe('Dialogo', () => {
  let fixture: ComponentFixture<Dialogo>;
  let servicio: DialogoService;
  let elemento: HTMLElement;

  const dialogo = () => elemento.querySelector('dialog')!;
  const boton = (texto: string) =>
    [...elemento.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Dialogo] }).compileComponents();
    fixture = TestBed.createComponent(Dialogo);
    servicio = TestBed.inject(DialogoService);
    elemento = fixture.nativeElement;
    await fixture.whenStable();
  });

  async function abrir() {
    const respuesta = servicio.confirmar({
      tono: 'peligro',
      titulo: '¿Eliminar la meta "Laptop"?',
      mensaje: 'Objetivo: S/ 2,500.00',
      detalle: 'Lo que aportaste vuelve a tus ahorros.',
      confirmar: 'Eliminar meta',
    });
    await fixture.whenStable();
    return respuesta;
  }

  it('should show the title, message, detail and custom buttons', async () => {
    abrir();
    await fixture.whenStable();

    expect(dialogo().open).toBe(true);
    expect(dialogo().getAttribute('role')).toBe('alertdialog');
    expect(elemento.textContent).toContain('¿Eliminar la meta "Laptop"?');
    expect(elemento.textContent).toContain('Lo que aportaste vuelve a tus ahorros.');
    expect(boton('Eliminar meta')).toBeTruthy();
    expect(boton('Cancelar').hasAttribute('autofocus')).toBe(true); // la opción segura
  });

  it('should resolve true when the main button is clicked and then close', async () => {
    const respuesta = abrir();
    await fixture.whenStable();
    boton('Eliminar meta').click();

    await expect(respuesta).resolves.toBe(true);
    await fixture.whenStable();
    expect(dialogo().open).toBe(false);
    expect(servicio.actual()).toBeNull();
  });

  it('should resolve false with Cancelar, with Esc and with a click on the backdrop', async () => {
    let respuesta = abrir();
    await fixture.whenStable();
    boton('Cancelar').click();
    await expect(respuesta).resolves.toBe(false);

    respuesta = abrir();
    await fixture.whenStable();
    dialogo().dispatchEvent(new Event('cancel', { cancelable: true })); // tecla Esc
    await expect(respuesta).resolves.toBe(false);

    respuesta = abrir();
    await fixture.whenStable();
    dialogo().dispatchEvent(new MouseEvent('click', { bubbles: true })); // clic en el fondo
    await expect(respuesta).resolves.toBe(false);
  });

  it('should cancel the previous dialog if another one opens', async () => {
    const primera = servicio.confirmar({ titulo: 'Primera', mensaje: '' });
    servicio.confirmar({ titulo: 'Segunda', mensaje: '' });
    await expect(primera).resolves.toBe(false);
  });
});
