import { Injectable } from '@angular/core';
import { lastValueFrom, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { Preferences } from '@capacitor/preferences'; 
import {
  BehaviorSubject,
  from,
  interval,
  Observable,
  of,
  switchMap,
} from 'rxjs';

import { environment } from '../environments/environment';
import { SpotifyLoginService } from './spotify.service';

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

@Injectable({
  providedIn: 'root',
})
export class SpotifyPlayerService {
  private player: any;
  private deviceId: string | null = null;

  /**
   * Nuovo BehaviorSubject per segnalare quando il player è stato inizializzato correttamente.
   */
  public playerReady$ = new BehaviorSubject<boolean>(false);

  // BehaviorSubject per UI e stato
  isPlaying$ = new BehaviorSubject<boolean>(false);
  trackTitle$ = new BehaviorSubject<string>('Nessun brano in riproduzione');
  artistName$ = new BehaviorSubject<string>('');
  albumCover$ = new BehaviorSubject<string>('');
  progress$ = new BehaviorSubject<number>(0);
  currentTime$ = new BehaviorSubject<string>('0:00');
  totalTime$ = new BehaviorSubject<string>('0:00');
  currentTrackId$ = new BehaviorSubject<string>('');

  constructor(private spotifyLoginService: SpotifyLoginService) {
    // Al costruttore, inizializziamo il Player SOLO se abbiamo un token valido
    this.spotifyLoginService.getValidAccessToken().subscribe(token => {
      if (token) {
        this.loadSpotifySDK(token);
      } else {
        console.error(
          '🚨 Token di accesso non disponibile (o refresh fallito)!'
        );
      }
    });
  }

  /**
   * Carica lo script del Web Playback SDK di Spotify e si prepara ad inizializzare il player.
   */
  private loadSpotifySDK(accessToken: string) {
    if (!window.Spotify) {
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      document.body.appendChild(script);
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      this.initializePlayer(accessToken);
    };
  }

  /**
   * Inizializza effettivamente il Player con il token valido.
   */
  private async initializePlayer(accessToken: string) {
    // Inizializzazione del player Spotify
    this.player = new window.Spotify.Player({
      name: environment.spotify.customPlayerName,
      getOAuthToken: (cb: (token: string) => void) => {
        // Ogni volta che il player vuole un token, facciamo una getValidAccessToken
        this.spotifyLoginService.getValidAccessToken().subscribe(token => {
          if (token) {
            cb(token);
          } else {
            console.error('🚨 Nessun token disponibile per il Player.');
          }
        });
      },
      volume: 0.5,
    });

    this.player.addListener(
      'ready',
      async ({ device_id }: { device_id: string }) => {
        console.log('✅ Player pronto con device_id:', device_id);
        this.deviceId = device_id;
        // Impostiamo playerReady$ = true per notificare che è caricato
        this.playerReady$.next(true);
        // Trasferisci la riproduzione sul nostro Player
        setTimeout(() => this.transferPlaybackToDevice(), 2000);
      }
    );

    this.player.addListener('player_state_changed', (state: any) => {
      if (!state || !state.track_window?.current_track) {
        console.warn('🚨 Nessuna traccia in riproduzione.');
        this.currentTrackId$.next('');
        return;
      }

      const track = state.track_window.current_track;
      this.isPlaying$.next(!state.paused);
      this.trackTitle$.next(track.name || 'Nessun brano');
      this.artistName$.next(
        track.artists.map((artist: any) => artist.name).join(', ') || '---'
      );
      this.albumCover$.next(track.album.images[0]?.url || '');
      this.currentTrackId$.next(track.id);

      // Aggiorna il tempo totale della traccia
      if (track.duration_ms) {
        this.totalTime$.next(this.formatTime(track.duration_ms));
      }
    });

    // Aggiorno la posizione corrente ogni secondo
    interval(1000).subscribe(() => {
      this.updatePlaybackPosition();
    });

    this.player.connect();
  }

  /**
   * Aggiorna la posizione (progress bar) e il tempo corrente.
   */
  private async updatePlaybackPosition() {
    // Se non sta suonando o player non è definito, evito
    if (!this.isPlaying$.getValue() || !this.player) return;

    try {
      const state = await this.player.getCurrentState();
      if (!state) return;

      this.progress$.next((state.position / state.duration) * 100);
      this.currentTime$.next(this.formatTime(state.position));
    } catch (error) {
      console.error('🚨 Errore nel recuperare la posizione:', error);
    }
  }

  private formatTime(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  /**
   * Cerca una traccia per nome e artista.
   */
  searchTrack(
    trackName: string,
    artistName: string
  ): Observable<string | null> {
    return this.spotifyLoginService.getValidAccessToken().pipe(
      switchMap(token => {
        if (!token) {
          console.error('🚨 Token non disponibile per la ricerca.');
          return of(null);
        }

        const url = `https://api.spotify.com/v1/search?q=track:${encodeURIComponent(trackName)}%20artist:${encodeURIComponent(artistName)}&type=track&limit=1`;

        return from(
          fetch(url, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          })
            .then(response => response.json())
            .then(data => data.tracks?.items?.[0]?.id ?? null)
            .catch(error => {
              console.error(
                '🚨 Errore durante la ricerca della traccia:',
                error
              );
              return null;
            })
        );
      })
    );
  }

  togglePlay() {
    if (!this.player) {
      console.error('🚨 Il player non è inizializzato!');
      return;
    }

    this.player.togglePlay().catch((error: any) => {
      console.error('🚨 Errore nel togglare la riproduzione:', error);
    });
  }

  previousTrack() {
    if (!this.player) {
      console.error('🚨 Il player non è inizializzato!');
      return;
    }

    this.player.previousTrack().catch((error: any) => {
      console.error('🚨 Errore nel passare alla traccia precedente:', error);
    });
  }

  nextTrack() {
    if (!this.player) {
      console.error('🚨 Il player non è inizializzato!');
      return;
    }

    this.player.nextTrack().catch((error: any) => {
      console.error('🚨 Errore nel passare alla traccia successiva:', error);
    });
  }

  public getCurrentTrackTitle(): string {
    return this.trackTitle$.getValue();
  }

  public getCurrentArtist(): string {
    return this.artistName$.getValue();
  }

  /**
   * Recupera la lista dei dispositivi disponibili tramite API.
   */
  async getAvailableDevices() {
    // Otteniamo un token prima di chiamare l’endpoint
    this.spotifyLoginService.getValidAccessToken().subscribe(async token => {
      if (!token) {
        console.error(
          '🚨 Errore: nessun token disponibile (o refresh fallito).'
        );
        return;
      }

      try {
        const response = await fetch(
          'https://api.spotify.com/v1/me/player/devices',
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          console.error('🚨 Errore nel recuperare i dispositivi:', errorData);
          return;
        }

        const data = await response.json();
        console.log('📱 Dispositivi disponibili:', data.devices);

        if (data.devices.length === 0) {
          console.error(
            '🚨 Nessun dispositivo disponibile per la riproduzione!'
          );
        }
      } catch (error) {
        console.error('🚨 Errore nel recupero dei dispositivi:', error);
      }
    });
  }

  pause() {
    if (!this.player) {
      console.error('🚨 Il player non è inizializzato!');
      return;
    }

    this.player.pause().catch((error: any) => {
      console.error('🚨 Errore nel mettere in pausa la riproduzione:', error);
    });
  }

  async getUserTopTracks(
    limit: number = 10
  ): Promise<{ title: string; artist: string }[]> {
    const token = await this.spotifyLoginService
      .getValidAccessToken()
      .toPromise();
    if (!token) {
      console.error('🚨 Token non disponibile per ottenere i top tracks.');
      return [];
    }
    const url = `https://api.spotify.com/v1/me/top/tracks?limit=${limit}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      return data.items.map((track: any) => ({
        title: track.name,
        artist: track.artists.map((a: any) => a.name).join(', '),
      }));
    } catch (error) {
      console.error('Errore nel recuperare i top tracks:', error);
      return [];
    }
  }

  /**
   * Recupera le tracce dagli artisti preferiti dell'utente.
   * Utilizza l’endpoint per i top artist e per ciascun artista richiede il suo top track.
   */
  async getTracksByFavoriteArtists(): Promise<
    { title: string; artist: string }[]
  > {
    const token = await this.spotifyLoginService.getValidAccessToken();
    if (!token) {
      console.error('🚨 Token non disponibile per ottenere i top artist.');
      return [];
    }
    // Recupera i top artist dell'utente
    const artistsUrl = `https://api.spotify.com/v1/me/top/artists?limit=10`;
    try {
      const artistsResponse = await fetch(artistsUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const artistsData = await artistsResponse.json();
      const favoriteArtists = artistsData.items; // array degli artisti preferiti
      let tracks: { title: string; artist: string }[] = [];
      // Per ogni artista, recupera i top tracks (le prime 10)
      for (const artist of favoriteArtists) {
        const artistId = artist.id;
        const topTracksUrl = `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`;
        try {
          const tracksResponse = await fetch(topTracksUrl, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          const tracksData = await tracksResponse.json();
          if (tracksData.tracks && tracksData.tracks.length > 0) {
            // Recupera le prime 10 tracce (o tutte quelle disponibili se meno di 10)
            tracksData.tracks.slice(0, 10).forEach((track: any) => {
              tracks.push({
                title: track.name,
                artist: track.artists.map((a: any) => a.name).join(', '),
              });
            });
          }
        } catch (error) {
          console.error(
            `Errore nel recuperare i top tracks per l'artista ${artist.name}:`,
            error
          );
        }
      }
      return tracks;
    } catch (error) {
      console.error('Errore nel recuperare i top artist:', error);
      return [];
    }
  }


  

  public async getUserLikedTracks(
    limit: number = 50
  ): Promise<{ title: string; artist: string }[]> {
    const token = await this.spotifyLoginService
      .getValidAccessToken()
      .toPromise();
    if (!token) {
      console.error('🚨 Token non disponibile per ottenere le tracce salvate.');
      return [];
    }
    const url = `https://api.spotify.com/v1/me/tracks?limit=${limit}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      // Mappa la risposta per ritornare un array di oggetti { title, artist }
      return data.items.map((item: any) => ({
        title: item.track.name,
        artist: item.track.artists.map((artist: any) => artist.name).join(', '),
      }));
    } catch (error) {
      console.error(
        'Errore nel recuperare le tracce salvate (liked tracks):',
        error
      );
      return [];
    }
  }

  private async transferPlaybackToDevice() {
    if (!this.deviceId) {
      console.error(
        '🚨 Device ID non disponibile, impossibile trasferire la riproduzione.'
      );
      return;
    }

    this.spotifyLoginService.getValidAccessToken().subscribe(async token => {
      if (!token) {
        console.error(
          '🚨 Errore: nessun token disponibile (o refresh fallito).'
        );
        return;
      }

      const url = 'https://api.spotify.com/v1/me/player';
      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ device_ids: [this.deviceId], play: true }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('🚨 Errore nel trasferire la riproduzione:', errorData);
          // Se lo status è 404, controlla il deviceId o l’accesso
          if (response.status === 404) {
            console.warn(
              'Device non trovato. Verifica che il device ID sia corretto e che il player sia connesso.'
            );
          }
        } else {
          console.log('✅ Riproduzione trasferita con successo.');
        }
      } catch (error) {
        console.error(
          '🚨 Errore di rete nel trasferire la riproduzione:',
          error
        );
      }
    });
  }

  async playTrack(trackId: string) {
    if (!this.deviceId) {
      console.error('🚨 Errore: Nessun device ID disponibile.');
      return;
    }

    // Controlla se il player è pronto
    let state = await this.player?.getCurrentState();
    if (!state) {
      console.warn(
        '⏳ Il player non è ancora pronto, ritento tra 2 secondi...'
      );
      await this.player.connect();
      setTimeout(() => this.playTrack(trackId), 2000);
      return;
    }

    this.spotifyLoginService.getValidAccessToken().subscribe(async token => {
      if (!token) {
        console.error(
          '🚨 Errore: nessun token disponibile (o refresh fallito).'
        );
        return;
      }

      // Costruisci l'URL per il play
      const url = `https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`;
      const body = { uris: [`spotify:track:${trackId}`] };

      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          // Se ricevi 404, logga l'errore e prova eventualmente a riconnettere il player
          const errorData = await response.json();
          console.error('🚨 Errore nel riprodurre la traccia:', errorData);
          // Se l'errore è 404, potresti voler forzare un refresh della connessione o notificare l’utente.
          if (response.status === 404) {
            console.warn(
              'Il brano non è stato trovato. Verifica che il trackId sia corretto.'
            );
          }
        } else {
          console.log('✅ Traccia avviata con successo:', trackId);
        }
      } catch (error) {
        console.error(
          '🚨 Errore di rete nella riproduzione della traccia:',
          error
        );
      }
    });
  }
}
