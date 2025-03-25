import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { from, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root',
})
export class SpotifyTrackService {
  private apiUrl = 'https://api.spotify.com/v1';

  constructor(private http: HttpClient) {}

  /**
   * Cerca una traccia per nome e artista e restituisce l'URL della copertina dell'album.
   * Se non trova immagini, restituisce un'immagine di fallback.
   */
  getTrackImage(trackName: string, artistName: string): Observable<string> {
    return from(Preferences.get({ key: 'spotifyAccessToken' })).pipe(
      switchMap(result => {
        const accessToken = result.value;
        if (!accessToken) {
          console.error('Spotify access token mancante');
          return of('img/music.png');
        }
        const headers = new HttpHeaders({
          Authorization: `Bearer ${accessToken}`,
        });
        // Costruisco la query per cercare la traccia
        const query = `track:"${trackName}" artist:"${artistName}"`;
        const params = new HttpParams()
          .set('q', query)
          .set('type', 'track')
          .set('limit', '1');

        return this.http.get<any>(`${this.apiUrl}/search`, { headers, params });
      }),
      map(response => {
        const items = response?.tracks?.items;
        if (items && items.length > 0) {
          const track = items[0];
          if (
            track &&
            track.album &&
            track.album.images &&
            track.album.images.length > 0
          ) {
            return track.album.images[0].url;
          }
        }
        return 'img/music.png';
      }),
      catchError(error => {
        console.error(
          'Errore in getTrackImage per',
          trackName,
          artistName,
          error
        );
        return of('img/music.png');
      })
    );
  }
}
