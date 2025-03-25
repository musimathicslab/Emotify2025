import { Component } from '@angular/core';
import { LastFmService } from '../../../services/lastfm.service';
import { ProfileHeaderComponent } from '../profile-header/profile-header.component';
import { ProfileStatsComponent } from '../profile-stats/profile-stats.component';
import { RecentTracksComponent } from '../recent-tracks/recent-tracks.component';
import { TopArtistsComponent } from '../top-artists/top-artists.component';
import { TopTracksComponent } from '../top-tracks/top-tracks.component';
import { TopGeneresComponent } from '../top-generes/top-generes.component';
import { MoodStatisticComponent } from '../mood-statistic/mood-statistic.component';
import { MusicListeningTimesComponent } from '../music-listening-times/music-listening-times.component';
import { FavoriteArtistsByMoodComponent } from '../favorite-artists-by-mood/favorite-artists-by-mood.component';
import { FavoriteSongsByMoodComponent } from '../favorite-songs-by-mood/favorite-songs-by-mood.component';
import { Preferences } from '@capacitor/preferences';

@Component({
  selector: 'app-profile-page',
  imports: [
    ProfileHeaderComponent,
    ProfileStatsComponent,
    RecentTracksComponent,
    TopArtistsComponent,
    TopTracksComponent,
    TopGeneresComponent,
    MoodStatisticComponent,
    MusicListeningTimesComponent,
    FavoriteArtistsByMoodComponent,
    FavoriteSongsByMoodComponent,
  ],
  templateUrl: './profile-page.component.html',
  styleUrls: ['./profile-page.component.css'],
  standalone: true,
})
export class ProfilePageComponent {
  userProfile: any;
  username!: string;

  constructor(private lastFmService: LastFmService) {}

  async ngOnInit(): Promise<void> {
    // Recupera il nome utente dalle Capacitor Preferences
    const result = await Preferences.get({ key: 'lastfmUser' });
    if (result.value) {
      this.username = result.value;
      this.fetchUserProfile();
    } else {
      console.error("Username non trovato. L'utente non risulta autenticato.");
    }
  }

  fetchUserProfile(): void {
    if (!this.username) return;
    this.lastFmService.getUserProfile().subscribe(data => {
      this.userProfile = data.user;
    });
  }
}
