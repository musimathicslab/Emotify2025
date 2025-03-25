import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { EmotionsService } from '../../../services/emotions.service';
import { CommonModule, NgForOf, NgIf } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-mood-statistic',
  templateUrl: './mood-statistic.component.html',
  styleUrls: ['./mood-statistic.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    TagModule,
    NgIf,
    NgForOf,
    ProgressSpinnerModule,
  ],
})
export class MoodStatisticComponent implements OnInit {
  moodStatistics: { [mood: string]: number } = {};
  loading = true;

  constructor(
    public emotionsService: EmotionsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadMoodStatistics();
  }

  loadMoodStatistics(): void {
    // Simuliamo un ritardo asincrono per mostrare il caricamento
    setTimeout(() => {
      const stats = this.emotionsService.getMoodFrequency();
      this.moodStatistics = stats ? stats : {};
      this.loading = false;
      this.cdr.detectChanges();
    }, 50);
  }

  get moodKeys(): string[] {
    return Object.keys(this.moodStatistics);
  }
}
