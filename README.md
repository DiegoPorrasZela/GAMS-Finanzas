# GAMS Finanzas

Aplicación web de finanzas personales para registrar ingresos y gastos, ver el saldo y consultar el tipo de cambio.

Proyecto del curso **Desarrollo Full Stack** — Universidad Tecnológica del Perú (UTP).

## Estructura

```
GAMS-Finanzas/
├── frontend/   Angular 22 + Tailwind CSS 4
└── backend/    Java + Spring Boot (Avance 2)
```

## Funcionalidades (Avance 1)

- **Inicio:** resumen de saldo, ingresos, gastos y últimos movimientos.
- **Movimientos:** registrar, filtrar, buscar y eliminar ingresos y gastos.
- **Tipo de cambio:** conversión entre más de 160 monedas con historial y gráfico, usando la API pública [Frankfurter](https://frankfurter.dev).

## Cómo ejecutar el frontend

Requisitos: [Node.js](https://nodejs.org) 22.22 o superior (se recomienda 24 LTS).

```bash
cd frontend
npm install
npm start
```

Abrir <http://localhost:4200>.

Pruebas: `npm test`
