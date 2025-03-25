import { Component, Input, OnInit } from '@angular/core';
import { LastFmService } from '../../../services/lastfm.service';
import { NgForOf, NgIf } from '@angular/common';
import { Card } from 'primeng/card';
import { Preferences } from '@capacitor/preferences';

@Component({
  selector: 'app-top-generes',
  imports: [NgForOf, NgIf, Card],
  templateUrl: './top-generes.component.html',
  styleUrl: './top-generes.component.css',
  standalone: true,
})
export class TopGeneresComponent implements OnInit {
  @Input() username!: string;
  topGenres: string[] = [];
  loading = true;
  error = '';

  constructor(private lastFmService: LastFmService) {}

  ngOnInit(): void {
    if (!this.username) {
      // Recupera il valore salvato nelle Preferences
      Preferences.get({ key: 'lastfmUser' })
        .then(result => {
          if (result.value) {
            this.username = result.value;
            console.log(
              'Username recuperato dalle Preferences:',
              this.username
            );
            this.fetchTopGenres();
          } else {
            this.loading = false;
            this.error = 'Username non disponibile.';
          }
        })
        .catch(err => {
          console.error(
            'Errore nel recupero del username dalle Preferences:',
            err
          );
          this.loading = false;
          this.error = 'Errore nel recupero del username.';
        });
    } else {
      this.fetchTopGenres();
    }
  }

  fetchTopGenres() {
    this.lastFmService.getTopGenres(this.username).subscribe({
      next: genres => {
        this.topGenres = genres;
        this.loading = false;
      },
      error: () => {
        this.error = 'Errore nel recupero dei generi';
        this.loading = false;
      },
    });
  }
}
