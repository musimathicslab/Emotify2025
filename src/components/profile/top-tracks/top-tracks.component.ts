import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { LastFmService } from '../../../services/lastfm.service';
import { SpotifyTrackService } from '../../../services/spotify-track.service';
import { Card } from 'primeng/card';
import { NgIf } from '@angular/common';
import { Preferences } from '@capacitor/preferences';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-top-tracks',
  standalone: true,
  imports: [Card, NgIf, ProgressSpinnerModule],
  templateUrl: './top-tracks.component.html',
  styleUrls: ['./top-tracks.component.css'],
})
export class TopTracksComponent implements OnChanges, OnInit {
  @Input() username!: string;
  topTracks: any[] = [];
  loading = true;

  constructor(
    private lastFmService: LastFmService,
    private spotifyTrackService: SpotifyTrackService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['username'] && this.username) {
      this.fetchTopTracks();
    }
  }

  async ngOnInit(): Promise<void> {
    // Recupera username e token dalle Preferences
    const lastfmUserResult = await Preferences.get({ key: 'lastfmUser' });
    if (!lastfmUserResult.value) {
      this.lastFmService.getAuthenticatedUser().subscribe();
    }
    // Se l'username non è passato come Input, impostalo dalle Preferences
    if (!this.username && lastfmUserResult.value) {
      this.username = lastfmUserResult.value;
    }
    this.fetchTopTracks();
  }

  fetchTopTracks(): void {
    this.loading = true;
    this.lastFmService.getTopTracks(this.username).subscribe(
      tracks => {
        this.topTracks = tracks;

        // Per ogni traccia, cerca l'immagine tramite Spotify
        this.topTracks.forEach(track => {
          this.spotifyTrackService
            .getTrackImage(track.name, track.artist)
            .subscribe(imgUrl => {
              track.image = imgUrl;
            });
        });
        this.loading = false;
        this.cdr.detectChanges();
      },
      error => {
        console.error('Errore nel fetch delle tracce:', error);
        this.loading = false;
        this.cdr.detectChanges();
      }
    );
  }
}
