import { Component, Input } from '@angular/core';
import { Card } from 'primeng/card';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-profile-stats',
  imports: [Card, NgIf],
  templateUrl: './profile-stats.component.html',
  styleUrl: './profile-stats.component.css',
  standalone: true,
})
export class ProfileStatsComponent {
  @Input() user: any;

  getListeningTime(playcount: number): string {
    if (!playcount) return 'Dati non disponibili';

    // Stima: 210 secondi per brano (3,5 minuti)
    const totalSeconds = playcount * 210;
    let totalMinutes = Math.floor(totalSeconds / 60);

    const months = Math.floor(totalMinutes / (60 * 24 * 30));
    totalMinutes %= 60 * 24 * 30;

    const days = Math.floor(totalMinutes / (60 * 24));
    totalMinutes %= 60 * 24;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    // Costruisce la stringa finale
    // Esempio: "8 giorni, 2 ore e 30 minuti"
    // Se vuoi i mesi, li includi se months > 0
    let parts: string[] = [];
    if (months > 0) parts.push(`${months} mesi`);
    if (days > 0) parts.push(`${days} giorni`);
    if (hours > 0) parts.push(`${hours} ore`);
    if (minutes > 0) parts.push(`${minutes} minuti`);

    // Se dopo i calcoli non hai nulla, allora "0 minuti"
    if (parts.length === 0) return '0 minuti';

    // Unisce con virgole e “e” finale (opzionale)
    if (parts.length > 1) {
      const last = parts.pop();
      return parts.join(', ') + ' e ' + last;
    } else {
      return parts[0];
    }
  }
}
