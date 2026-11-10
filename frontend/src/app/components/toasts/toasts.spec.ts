import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastService } from '../../services/toast.service';
import { Toasts } from './toasts';

describe('Toasts', () => {
  let fixture: ComponentFixture<Toasts>;
  let servicio: ToastService;
  let elemento: HTMLElement;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [Toasts] }).compileComponents();
    fixture = TestBed.createComponent(Toasts);
    servicio = TestBed.inject(ToastService);
    elemento = fixture.nativeElement;
  });

  afterEach(() => vi.useRealTimers());

  it('should show success as status and errors as alert (read by screen readers)', () => {
    servicio.exito('Gasto registrado');
    servicio.error('No se pudo guardar');
    fixture.detectChanges();

    expect(elemento.querySelector('[role="status"]')?.textContent).toContain('Gasto registrado');
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain('No se pudo guardar');
    expect(elemento.querySelector('section')?.getAttribute('aria-live')).toBe('polite');
  });

  it('should close by itself: success after 4 s, errors after 6 s', () => {
    servicio.exito('Listo');
    servicio.error('Falló');

    vi.advanceTimersByTime(4000);
    expect(servicio.toasts().map((t) => t.texto)).toEqual(['Falló']);
    vi.advanceTimersByTime(2000);
    expect(servicio.toasts()).toEqual([]);
  });

  it('should close with the × button', () => {
    servicio.info('Automático en pausa');
    fixture.detectChanges();
    elemento.querySelector<HTMLButtonElement>('button[aria-label="Cerrar notificación"]')!.click();

    expect(servicio.toasts()).toEqual([]);
  });

  it('should keep at most 3 on screen (the newest ones)', () => {
    ['1', '2', '3', '4'].forEach((texto) => servicio.exito(texto));
    expect(servicio.toasts().map((t) => t.texto)).toEqual(['2', '3', '4']);
  });
});
