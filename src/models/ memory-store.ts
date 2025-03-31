import { Preferences } from '@capacitor/preferences';
import { TrackRating } from './track-rating';

export class MemoryStore {
  private memory: Map<string, TrackRating[]> = new Map();
  private readonly storageKey: string;
  private readonly readyPromise: Promise<void>;

  constructor(storageKey: string = 'memoryModel') {
    this.storageKey = storageKey;
    // Avvia il caricamento della memoria e conserva la Promise per poi attendere
    this.readyPromise = this.loadFromStorage();
  }

  /**
   * Restituisce una Promise che si risolve quando la memoria è stata caricata.
   */
  public async ready(): Promise<void> {
    return this.readyPromise;
  }

  /**
   * Carica la memoria dalle Preferences.
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const saved = await Preferences.get({ key: this.storageKey });
      if (saved.value) {
        const parsed = JSON.parse(saved.value);
        const data = parsed.data || parsed;
        this.memory = new Map(data);
        console.log('✅ Memoria caricata dalle Preferences:', this.memory);
      } else {
        console.log('Nessun dato salvato, memoria vuota.');
      }
    } catch (error) {
      console.error('Errore nel caricamento della memoria:', error);
    }
  }

  /**
   * Salva la memoria nelle Preferences.
   */
  private async saveToStorage(): Promise<void> {
    try {
      const toStore = {
        version: 1,
        data: Array.from(this.memory.entries()),
      };
      await Preferences.set({
        key: this.storageKey,
        value: JSON.stringify(toStore),
      });
      console.log('💾 Memoria salvata con successo!');
    } catch (error) {
      console.error('Errore nel salvataggio della memoria:', error);
    }
  }

  /**
   * Normalizza il contesto, gestendo eventuali valori non validi.
   */
  private normalizeContext(
    emotion: string,
    emotionLevel: number,
    activity: number,
    location: number
  ): {
    safeEmotion: string;
    safeEmotionLevel: number;
    safeActivity: number;
    safeLocation: number;
  } {
    const safeEmotion = emotion?.trim().toLowerCase() || 'default';
    const safeEmotionLevel = isNaN(emotionLevel) ? 0 : emotionLevel;
    const safeActivity = isNaN(activity) ? 0 : activity;
    const safeLocation = isNaN(location) ? 0 : location;
    return { safeEmotion, safeEmotionLevel, safeActivity, safeLocation };
  }

  /**
   * Costruisce una chiave basata su emotion, emotionLevel, activity e location.
   */
  private buildKey(
    emotion: string,
    emotionLevel: number,
    activity: number,
    location: number
  ): string {
    const { safeEmotion, safeEmotionLevel, safeActivity, safeLocation } =
      this.normalizeContext(emotion, emotionLevel, activity, location);
    return `${safeEmotion}-${safeEmotionLevel}-${safeActivity}-${safeLocation}`;
  }

  /**
   * Aggiunge o aggiorna un brano (TrackRating) nella memoria.
   */
  public addTrack(
    trackTitle: string,
    artist: string,
    emotion: string,
    emotionLevel: number,
    activity: number,
    location: number,
    tags: string[],
    tempo: number,
    danceability: number,
    instrumentalness: number,
    speechiness: number,
    loudness: number
  ): void {
    const key = this.buildKey(emotion, emotionLevel, activity, location);

    const newTrack: TrackRating = {
      id: `${trackTitle}-${artist}`.trim(),
      title: trackTitle.trim(),
      artist: artist.trim(),
      emotion: emotion.trim(),
      realEmotion: emotion.trim(),
      emotionLevel,
      tempo,
      danceability,
      instrumentalness,
      speechiness,
      loudness,
      seedGenres: '',
      seedTracks: trackTitle.trim(),
      popularity: 0,
      tags: tags.map(t => t.trim().toLowerCase()),
      activity: activity.toString(),
      location: location.toString(),
      timestamp: new Date().toISOString(),
      audioFeatures: [
        tempo,
        danceability,
        instrumentalness,
        speechiness,
        loudness,
      ],
    };

    const trackList = this.memory.get(key) || [];
    trackList.push(newTrack);
    // Salva il nuovo array (potresti anche voler ordinare se hai un criterio specifico)
    this.memory.set(key, trackList);

    // Salva su Preferences (fire-and-forget)
    this.saveToStorage().catch(error =>
      console.error('Errore nel salvataggio della memoria:', error)
    );

    console.log(`✅ Traccia aggiunta: ${trackTitle} - ${artist}`);
  }

  /**
   * Restituisce tutte le tracce memorizzate.
   */
  public getAllTracks(): TrackRating[] {
    let all: TrackRating[] = [];
    this.memory.forEach((list: TrackRating[]) => {
      all = all.concat(list);
    });
    return all;
  }
}
