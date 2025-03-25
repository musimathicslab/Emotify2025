import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { EmotionsService } from '../../../services/emotions.service';
import { NgForOf, NgIf } from '@angular/common';
import { Card } from 'primeng/card';
import { ProgressSpinner } from 'primeng/progressspinner';

@Component({
  selector: 'app-favorite-songs-by-mood',
  imports: [NgIf, NgForOf, Card, ProgressSpinner],
  templateUrl: './favorite-songs-by-mood.component.html',
  styleUrls: ['./favorite-songs-by-mood.component.css'],
  standalone: true,
})
export class FavoriteSongsByMoodComponent implements OnInit {
  favoriteSongsByMood: { [p: string]: string[] } = {};
  loading = true; // Stato di caricamento

  constructor(
    public emotionsService: EmotionsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadFavoriteSongsByMood();
  }

  loadFavoriteSongsByMood(): void {
    // Simulazione di un caricamento asincrono: dopo 500ms si caricano i dati
    setTimeout(() => {
      this.favoriteSongsByMood =
        this.emotionsService.getFavoriteSongsByMoodLabel();
      this.loading = false;
      this.cdr.detectChanges();
    }, 50);
  }

  protected readonly Object = Object;
}
