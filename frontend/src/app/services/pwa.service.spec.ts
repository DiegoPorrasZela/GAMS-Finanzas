import { TestBed } from '@angular/core/testing';
import { PwaService } from './pwa.service';
import { ToastService } from './toast.service';

// Simula el evento que Chrome dispara cuando la app se puede instalar
function eventoInstalacion() {
  const evento = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn().mockResolvedValue(undefined);
  Object.assign(evento, { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  return { evento, prompt };
}

describe('PwaService', () => {
  let pwa: PwaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    pwa = TestBed.inject(PwaService);
  });

  it('should not offer installing until the browser allows it', () => {
    expect(pwa.sePuedeInstalar()).toBe(false);
  });

  it('should keep the browser prompt and show it when the user taps "Instalar"', async () => {
    const { evento, prompt } = eventoInstalacion();
    window.dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(true); // sin el aviso automático del navegador
    expect(pwa.sePuedeInstalar()).toBe(true);

    await pwa.instalar();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(pwa.sePuedeInstalar()).toBe(false); // el aviso del navegador solo se puede usar una vez
  });

  it('should confirm with a notification once the app is installed', () => {
    window.dispatchEvent(eventoInstalacion().evento);
    window.dispatchEvent(new Event('appinstalled'));

    expect(pwa.sePuedeInstalar()).toBe(false);
    const textos = TestBed.inject(ToastService).toasts().map((t) => t.texto);
    expect(textos.join(' ')).toContain('quedó instalada');
  });
});
