import { BehaviorSubject } from 'rxjs';
import { TrackRating } from './track-rating';
import { NeuralModelService } from '../services/neural-model.service';
import { MemoryStore } from './ memory-store';

export class MemoryModelImpl {
  // Esposto pubblicamente lo store per permettere l'accesso diretto
  public memoryStore: MemoryStore;
  private modelService: NeuralModelService;

  // Aggiungi un BehaviorSubject che tiene traccia delle tracce memorizzate
  private tracksSubject = new BehaviorSubject<TrackRating[]>([]);
  // Esponi l'Observable per permettere la sottoscrizione da altri componenti
  public tracks$ = this.tracksSubject.asObservable();

  constructor() {
    // Inizializza lo store e il modello
    this.memoryStore = new MemoryStore('memoryModel');
    this.modelService = new NeuralModelService(9);
    // Inizializza il BehaviorSubject con le tracce correnti
    this.tracksSubject.next(this.memoryStore.getAllTracks());
  }

  /**
   * Salva una traccia in memoria.
   */
  public async addTrackToMemory(
    trackTitle: string,
    artist: string,
    emotion: string,
    emotionLevel: number,
    activity: number,
    location: number,
    tags: string[], // custom tags (calcolati internamente)
    tempo: number,
    danceability: number,
    instrumentalness: number,
    speechiness: number,
    loudness: number,
    externalTags: string[] = [] // tag recuperati da Last.fm
  ): Promise<void> {
    // Unisci i due insiemi (evitando duplicati)
    const allTags = Array.from(new Set([...tags, ...externalTags]));

    // Salva la traccia con tutti i tag
    this.memoryStore.addTrack(
      trackTitle,
      artist,
      emotion,
      emotionLevel,
      activity,
      location,
      allTags,
      tempo,
      danceability,
      instrumentalness,
      speechiness,
      loudness
    );

    // Dopo l'aggiunta, aggiorna il BehaviorSubject con le tracce aggiornate
    const updatedTracks = this.memoryStore.getAllTracks();
    this.tracksSubject.next(updatedTracks);
  }

  /**
   * Allena il modello su un singolo campione.
   */
  public async trainModel(
    context: number[],
    targetFeatures: number[],
    targetEmotion: number[]
  ): Promise<void> {
    console.log(
      'TrainModel => context:',
      context,
      'features:',
      targetFeatures,
      'emotion:',
      targetEmotion
    );
    await this.modelService.trainSingleSample(
      context,
      targetFeatures,
      targetEmotion
    );
  }

  /**
   * Restituisce tutte le tracce memorizzate.
   */
  public getAllTracks(): TrackRating[] {
    return this.memoryStore.getAllTracks();
  }
}
