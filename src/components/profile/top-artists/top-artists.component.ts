import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { LastFmService } from '../../../services/lastfm.service';
import { SpotifyArtistService } from '../../../services/spotify-artist.service';
import { Card } from 'primeng/card';
import { DecimalPipe, NgForOf, NgIf, NgStyle } from '@angular/common';
import { Preferences } from '@capacitor/preferences';

@Component({
  selector: 'app-top-artists',
  standalone: true,
  imports: [Card, NgIf, NgForOf, NgStyle, DecimalPipe],
  templateUrl: './top-artists.component.html',
  styleUrls: ['./top-artists.component.css'],
})
export class TopArtistsComponent implements OnChanges, OnInit {
  @Input() username!: string;
  topArtists: any[] = [];

  // Definisci i colori della palette
  rankColors = ['#F20530', '#025E73', '#038C8C', '#F29F05', '#F28705'];

  getRankColor(index: number): string {
    return this.rankColors[index] || '#cccccc'; // Se l'indice è oltre i 5 elementi, usa grigio
  }

  getTextColor(index: number): string {
    return this.rankColors[index] || '#cccccc'; // Usa il colore del rank per il testo
  }

  constructor(
    private lastFmService: LastFmService,
    private spotifyArtistService: SpotifyArtistService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['username'] && this.username) {
      console.log(
        `🔄 Username cambiato, caricamento artisti per: ${this.username}`
      );
      this.fetchTopArtists();
    }
  }

  async ngOnInit(): Promise<void> {
    const storedUsernameResult = await Preferences.get({ key: 'lastfmUser' });
    const storedUsername = storedUsernameResult.value;

    if (!storedUsername) {
      return;
    }
    this.username = storedUsername;
    this.fetchTopArtists();
  }

  fetchTopArtists(): void {
    this.lastFmService.getTopArtists(this.username, 5).subscribe(artists => {
      if (!Array.isArray(artists) || artists.length === 0) {
        this.topArtists = [];
        return;
      }

      // Se vuoi limitare al top 5
      artists = artists.slice(0, 5);

      // Calcola il totale dei playcount (ricorda di convertire in numero se necessario)
      const totalPlaycount = artists.reduce(
        (sum, artist) => sum + Number(artist.playcount),
        0
      );

      // Per ogni artista, calcola la percentuale relativa
      this.topArtists = artists.map(artist => ({
        ...artist,
        percentage:
          totalPlaycount > 0
            ? (Number(artist.playcount) / totalPlaycount) * 100
            : 0,
      }));

      // Recupera immagini da Spotify per migliorare la visualizzazione
      this.topArtists.forEach(artist => {
        this.spotifyArtistService
          .getArtistImage(artist.name)
          .subscribe(imgUrl => {
            if (imgUrl) {
              artist.image = imgUrl;
            }
            this.cdr.detectChanges(); // Forza il refresh della view
          });
      });
    });
  }
}
