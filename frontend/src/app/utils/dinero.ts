// Cuentas de dinero exactas.
// JavaScript guarda los decimales en binario y algunos no se pueden representar exactos:
// 10.10 + 20.20 da 30.299999999999997, que es MENOR que 30.30. Con eso, retirar 30.30 de unos ahorros
// de 10.10 + 20.20 parecía "más de lo que tienes", y gastar todo el saldo dejaba S/ -0.00.
// La solución: sumar y restar en céntimos (números enteros, que sí son exactos) y pasar a soles al final.

export const aCentimos = (monto: number): number => Math.round(monto * 100);

// "centimos === 0" también es verdadero para -0: así nunca se muestra "S/ -0.00"
export const deCentimos = (centimos: number): number => (centimos === 0 ? 0 : centimos / 100);

export const sumar = (montos: number[]): number =>
  deCentimos(montos.reduce((total, monto) => total + aCentimos(monto), 0));

export const restar = (monto: number, menos: number): number =>
  deCentimos(aCentimos(monto) - aCentimos(menos));

// Compara montos a nivel de céntimo (ej. ¿el retiro supera lo que hay libre?)
export const esMayor = (monto: number, que: number): boolean => aCentimos(monto) > aCentimos(que);
