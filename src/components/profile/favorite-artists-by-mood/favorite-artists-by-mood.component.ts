import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { EmotionsService } from '../../../services/emotions.service';
import { NgForOf, NgIf } from '@angular/common';
import { Card } from 'primeng/card';
import { ProgressSpinner } from 'primeng/progressspinner';

@Component({
  selector: 'app-favorite-artists-by-mood',
  imports: [NgForOf, NgIf, Card, ProgressSpinner],
  templateUrl: './favorite-artists-by-mood.component.html',
  styleUrls: ['./favorite-artists-by-mood.component.css'],
  standalone: true,
})
export class FavoriteArtistsByMoodComponent implements OnInit {
  favoriteArtistsByMood: { [mood: string]: string[] } = {};
  loading = true; // Stato di caricamento

  constructor(
    public emotionsService: EmotionsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadFavoriteArtistsByMood();
  }

  loadFavoriteArtistsByMood(): void {
    // Simulazione di un caricamento asincrono: dopo 500ms si caricano i dati
    setTimeout(() => {
      this.favoriteArtistsByMood =
        this.emotionsService.getFavoriteArtistsByMood();
      this.loading = false;
      this.cdr.detectChanges();
    }, 50);
  }

  protected readonly Object = Object;
}
