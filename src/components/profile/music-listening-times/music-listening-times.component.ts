import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { EmotionsService } from '../../../services/emotions.service';
import { CardModule } from 'primeng/card';
import { CommonModule, NgForOf, NgIf } from '@angular/common';
import { Tag } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { StyleClass } from 'primeng/styleclass';

@Component({
  selector: 'app-music-listening-times',
  standalone: true,
  templateUrl: './music-listening-times.component.html',
  styleUrls: ['./music-listening-times.component.css'],
  imports: [
    CardModule,
    CommonModule,
    Tag,
    NgIf,
    NgForOf,
    ProgressSpinnerModule,
    StyleClass,
  ],
})
export class MusicListeningTimesComponent implements OnInit {
  // Oggetto che mappa "fascia oraria" -> "stringa con i codici mood"
  listeningTimes: { [timeRange: string]: string } = {};
  loading = true;
  protected readonly Object = Object;

  constructor(
    public emotionsService: EmotionsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadListeningTimesByMood();
  }

  loadListeningTimesByMood(): void {
    // Simula un caricamento asincrono
    setTimeout(() => {
      this.listeningTimes = this.emotionsService.getListeningTimesByMood();
      this.loading = false;
      this.cdr.detectChanges();
    }, 50);
  }

  /**
   * Trasforma la stringa di mood (es. "0,4") in un array di codici
   */
  getMoodsForTimeRange(timeRange: string): string[] {
    const raw = this.listeningTimes[timeRange];
    if (!raw) return [];
    return raw
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
}
