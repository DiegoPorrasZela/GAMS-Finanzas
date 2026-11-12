import { Component } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-acerca',
  templateUrl: './acerca.html',
})
export class Acerca {
  protected readonly tecnologias = [
    'Angular',
    'Tailwind CSS',
    'Java 21',
    'Spring Boot',
    'Spring Security + JWT',
    'PostgreSQL',
    'API Frankfurter',
  ];
}
