import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { Admin } from './admin';

const api = environment.apiUrl;

describe('Admin (categorías)', () => {
  let fixture: ComponentFixture<Admin>;
  let http: HttpTestingController;
  let pagina: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Admin],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Admin);
    http = TestBed.inject(HttpTestingController);
    pagina = fixture.nativeElement;

    http.expectOne(`${api}/categorias`).flush([
      { id: 6, nombre: 'Comida', tipo: 'GASTO', icono: 'comida', color: 'naranja' },
      { id: 3, nombre: 'Ahorro', tipo: 'GASTO', icono: 'alcancia', color: 'cielo' },
    ]);
    http.expectOne(`${api}/usuarios`).flush([]);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('should create a category with the chosen icon and color', async () => {
    const nombre = pagina.querySelector<HTMLInputElement>('#nombre-categoria')!;
    nombre.value = 'Gimnasio';
    nombre.dispatchEvent(new Event('input'));
    pagina.querySelector<HTMLInputElement>('input[aria-label="Gimnasio (pesa)"]')!.click();
    pagina.querySelector<HTMLInputElement>('input[aria-label="Violeta"]')!.click();
    pagina.querySelector('form')!.dispatchEvent(new Event('submit'));

    const peticion = http.expectOne({ method: 'POST', url: `${api}/categorias` });
    expect(peticion.request.body).toEqual({
      nombre: 'Gimnasio',
      tipo: 'GASTO',
      icono: 'pesa',
      color: 'violeta',
    });
  });

  it('should load the icon and color of the category being edited', async () => {
    [...pagina.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.trim() === 'Editar')!
      .click();
    await fixture.whenStable();

    expect(pagina.querySelector<HTMLInputElement>('input[aria-label="Comida"]')!.checked).toBe(
      true,
    );
    expect(pagina.querySelector<HTMLInputElement>('input[aria-label="Naranja"]')!.checked).toBe(
      true,
    );
  });
});
