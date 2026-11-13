import { NombreIcono } from '../icono/iconos';

// Íconos y colores que se pueden elegir para una categoría (los mismos que acepta el backend).
// El nombre se lee en voz alta en el selector del administrador.
export const ICONOS_DE_CATEGORIA: readonly { clave: NombreIcono; nombre: string }[] = [
  { clave: 'maletin', nombre: 'Maletín' },
  { clave: 'regalo', nombre: 'Regalo' },
  { clave: 'laptop', nombre: 'Laptop' },
  { clave: 'etiqueta', nombre: 'Etiqueta' },
  { clave: 'monedas', nombre: 'Monedas' },
  { clave: 'billetera', nombre: 'Billetera' },
  { clave: 'comida', nombre: 'Comida' },
  { clave: 'cafe', nombre: 'Café' },
  { clave: 'bus', nombre: 'Bus' },
  { clave: 'auto', nombre: 'Auto' },
  { clave: 'rayo', nombre: 'Servicios (rayo)' },
  { clave: 'casa', nombre: 'Casa' },
  { clave: 'celular', nombre: 'Celular' },
  { clave: 'libro', nombre: 'Libro' },
  { clave: 'salud', nombre: 'Salud (corazón)' },
  { clave: 'pesa', nombre: 'Gimnasio (pesa)' },
  { clave: 'juego', nombre: 'Videojuegos' },
  { clave: 'bolsa', nombre: 'Bolsa de compras' },
  { clave: 'camiseta', nombre: 'Ropa' },
  { clave: 'maleta', nombre: 'Viajes (maleta)' },
  { clave: 'huella', nombre: 'Mascota' },
  { clave: 'caja', nombre: 'Caja' },
  { clave: 'alcancia', nombre: 'Alcancía' },
  { clave: 'retiro', nombre: 'Retiro' },
];

export type ColorCategoria =
  | 'verde'
  | 'teal'
  | 'cielo'
  | 'azul'
  | 'indigo'
  | 'violeta'
  | 'rosa'
  | 'rojo'
  | 'naranja'
  | 'ambar'
  | 'gris';

// Clases completas (Tailwind solo genera las clases que aparecen escritas tal cual en el código)
// - insignia: círculo del ícono (fondo claro + ícono oscuro)
// - muestra: bolita del selector de color del administrador
// - barra: barra del gráfico "¿En qué se va tu dinero?". Usa el tono 600 (más oscuro que la muestra)
//   para que también los colores claros (ámbar, verde, celeste) se distingan del fondo gris de la barra
interface ClasesDeColor {
  nombre: string;
  insignia: string;
  muestra: string;
  barra: string;
}

export const COLORES_DE_CATEGORIA: Record<ColorCategoria, ClasesDeColor> = {
  verde: {
    nombre: 'Verde',
    insignia: 'bg-green-100 text-green-700',
    muestra: 'bg-green-500',
    barra: 'bg-green-600',
  },
  teal: {
    nombre: 'Turquesa',
    insignia: 'bg-teal-100 text-teal-700',
    muestra: 'bg-teal-500',
    barra: 'bg-teal-600',
  },
  cielo: {
    nombre: 'Celeste',
    insignia: 'bg-sky-100 text-sky-700',
    muestra: 'bg-sky-500',
    barra: 'bg-sky-600',
  },
  azul: {
    nombre: 'Azul',
    insignia: 'bg-blue-100 text-blue-700',
    muestra: 'bg-blue-500',
    barra: 'bg-blue-600',
  },
  indigo: {
    nombre: 'Índigo',
    insignia: 'bg-indigo-100 text-indigo-700',
    muestra: 'bg-indigo-500',
    barra: 'bg-indigo-600',
  },
  violeta: {
    nombre: 'Violeta',
    insignia: 'bg-violet-100 text-violet-700',
    muestra: 'bg-violet-500',
    barra: 'bg-violet-600',
  },
  rosa: {
    nombre: 'Rosa',
    insignia: 'bg-pink-100 text-pink-700',
    muestra: 'bg-pink-500',
    barra: 'bg-pink-600',
  },
  rojo: {
    nombre: 'Rojo',
    insignia: 'bg-red-100 text-red-700',
    muestra: 'bg-red-500',
    barra: 'bg-red-600',
  },
  naranja: {
    nombre: 'Naranja',
    insignia: 'bg-orange-100 text-orange-700',
    muestra: 'bg-orange-500',
    barra: 'bg-orange-600',
  },
  ambar: {
    nombre: 'Ámbar',
    insignia: 'bg-amber-100 text-amber-700',
    muestra: 'bg-amber-500',
    barra: 'bg-amber-600',
  },
  gris: {
    nombre: 'Gris',
    insignia: 'bg-gray-100 text-gray-600',
    muestra: 'bg-gray-500',
    barra: 'bg-gray-600',
  },
};

export const COLORES = Object.keys(COLORES_DE_CATEGORIA) as ColorCategoria[];

export const clasesDeColor = (color: string) =>
  COLORES_DE_CATEGORIA[color as ColorCategoria] ?? COLORES_DE_CATEGORIA.gris;
