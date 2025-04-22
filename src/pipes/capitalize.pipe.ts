import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'capitalize',
  standalone: true,
})
export class CapitalizePipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return '';
    // Rimuove gli spazi iniziali e finali della stringa
    value = value.trim();
    // Capitalizza la prima lettera e converte il resto in minuscolo
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }
}
