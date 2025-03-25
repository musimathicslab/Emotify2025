import { LastFmService } from '../services/lastfm.service';
import { TrackRating } from './track-rating';
import { NeuralModelService } from '../services/neural-model.service';
import { MemoryStore } from './memory-store';


export class MemoryModelImpl {
  // Esposto pubblicamente lo store per permettere l'accesso diretto
  public memoryStore: MemoryStore;
  private modelService: NeuralModelService;

  constructor(private lastFmService: LastFmService) {
    // Inizializza lo store e il modello
    this.memoryStore = new MemoryStore('memoryModel');
    this.modelService = new NeuralModelService();
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
    rating: number,
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
      rating,
      allTags, // Usa l'unione dei tag
      tempo,
      danceability,
      instrumentalness,
      speechiness,
      loudness
    );
  }

  /**
   * Allena il modello su un singolo campione.
   */
  public async trainModel(
    context: number[],
    targetFeatures: number[],
    rating: number
  ): Promise<void> {
    console.log(
      'TrainModel => context:',
      context,
      'features:',
      targetFeatures,
      'rating:',
      rating
    );
    await this.modelService.trainSingleSample(context, targetFeatures, rating);
  }

  /**
   * Predice audio features date le dimensioni di contesto.
   */
  public predictAudioFeatures(context: number[]): number[] {
    return this.modelService.predictAudioFeatures(context);
  }

  /**
   * Restituisce tutte le tracce memorizzate.
   */
  public getAllTracks(): TrackRating[] {
    return this.memoryStore.getAllTracks();
  }

  /**
   * Restituisce le tracce per un contesto specifico.
   */
  public getTracksForContext(
    emotion: string,
    emotionLevel: number,
    activity: number,
    location: number
  ): TrackRating[] {
    return this.memoryStore.getTracksForContext(
      emotion,
      emotionLevel,
      activity,
      location
    );
  }

  /**
   * Restituisce le statistiche dei mood.
   */
  public getMoodStatistics(): { [mood: string]: number } {
    return this.memoryStore.getMoodStatistics();
  }

  /**
   * Restituisce la traccia più simile data la similarità coseno.
   */
  public getSimilarTrackForContext(
    emotion: string,
    emotionLevel: number,
    activity: number,
    location: number,
    inputFeatures: number[]
  ): TrackRating | null {
    const trackList = this.memoryStore.getTracksForContext(
      emotion,
      emotionLevel,
      activity,
      location
    );
    if (!trackList || trackList.length === 0) {
      console.warn(
        `🚨 Nessuna traccia in memoria per contesto: ${emotion}-${emotionLevel}-${activity}-${location}`
      );
      return null;
    }

    const cosineSimilarity = (v1: number[], v2: number[]): number => {
      const dot = v1.reduce(
        (sum: number, val: number, i: number) => sum + val * v2[i],
        0
      );
      const mag1 = Math.sqrt(
        v1.reduce((sum: number, val: number) => sum + val * val, 0)
      );
      const mag2 = Math.sqrt(
        v2.reduce((sum: number, val: number) => sum + val * val, 0)
      );
      if (mag1 === 0 || mag2 === 0) return 0;
      return dot / (mag1 * mag2);
    };

    const similarities: number[] = trackList.map((tr: TrackRating) =>
      cosineSimilarity(inputFeatures, tr.audioFeatures)
    );
    const maxSim = Math.max(...similarities);
    const threshold = maxSim * 0.9;
    const topCandidates = trackList.filter(
      (_, i: number) => similarities[i] >= threshold
    );

    if (topCandidates.length === 0) {
      const bestIndex = similarities.indexOf(maxSim);
      return trackList[bestIndex];
    }

    const randomIndex = Math.floor(Math.random() * topCandidates.length);
    return topCandidates[randomIndex];
  }

  /**
   * Salva il modello neurale su storage locale.
   */
  public async saveModelToLocal(): Promise<void> {
    await this.modelService.saveModel('my-tf-model');
  }

  /**
   * Carica il modello neurale da storage locale.
   */
  public async loadModelFromLocal(): Promise<void> {
    this.modelService = await NeuralModelService.loadModel('my-tf-model');
  }
}
