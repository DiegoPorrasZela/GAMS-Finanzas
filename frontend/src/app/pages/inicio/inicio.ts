import { Component, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MovimientosService, calcularTotales } from '../../services/movimientos.service';

@Component({
  imports: [RouterLink, DatePipe, DecimalPipe],
  selector: 'app-inicio',
  styleUrl: './inicio.css',
  templateUrl: './inicio.html',
})
export class Inicio {
  private readonly servicio = inject(MovimientosService);

  private readonly totales = computed(() => calcularTotales(this.servicio.movimientos()));

  protected readonly ingresos = computed(() => this.totales().ingresos);
  protected readonly gastos = computed(() => this.totales().gastos);
  protected readonly saldo = computed(() => this.totales().saldo);

  protected readonly ultimos = computed(() => this.servicio.movimientos().slice(0, 4));
}
