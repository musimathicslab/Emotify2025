import {
  Component,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { LastFmService } from '../../../services/lastfm.service';
import { NgForOf, NgIf, SlicePipe } from '@angular/common';
import { Card } from 'primeng/card';
import { Preferences } from '@capacitor/preferences';

@Component({
  selector: 'app-recent-tracks',
  templateUrl: './recent-tracks.component.html',
  styleUrls: ['./recent-tracks.component.css'],
  standalone: true,
  imports: [SlicePipe, NgForOf, NgIf, Card],
})
export class RecentTracksComponent implements OnInit, OnChanges {
  @Input() username!: string;
  recentTracks: any[] = [];
  // Imposta il limite di default
  limit: number = 10;

  constructor(private lastFmService: LastFmService) {}

  async ngOnInit(): Promise<void> {
    this.setTrackLimit(window.innerWidth);
    // Se non è stato passato un username tramite input, proviamo a recuperarlo dalle Preferences
    if (!this.username) {
      const storedUsernameResult = await Preferences.get({ key: 'lastfmUser' });
      if (storedUsernameResult.value) {
        this.username = storedUsernameResult.value;
      } else {
      }
    }
    // Una volta definito l'username, carica i brani recenti
    if (this.username) {
      this.fetchRecentTracks();
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any): void {
    this.setTrackLimit(event.target.innerWidth);
  }

  private setTrackLimit(width: number): void {
    // Imposta a 5 per schermi piccoli, a 10 per schermi grandi
    this.limit = width < 768 ? 5 : 10;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['username'] && this.username) {
      this.fetchRecentTracks();
    }
  }

  fetchRecentTracks(): void {
    this.lastFmService.getRecentTracks(this.username).subscribe(data => {
      this.recentTracks = data || [];
    });
  }
}
