import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, lastValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// PrimeNG components
import { Slider } from 'primeng/slider';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessagesModule } from 'primeng/messages';
import { StyleClass } from 'primeng/styleclass';
import { ProgressSpinner } from 'primeng/progressspinner';
import { AsyncPipe, DecimalPipe, NgIf } from '@angular/common';

// Servizi interni
import { SpotifyPlayerService } from '../../../services/spotify-player.service';
import { LastFmService } from '../../../services/lastfm.service';
import { MemoryModelImpl } from '../../../models/memory-model';
import { RLAgent } from '../../../models/rlagent';
import { RatingsData } from '../../../models/track-rating';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { Preferences } from '@capacitor/preferences';
import { RatingComponent } from '../rating/rating.component';

// Importa il classificatore e il helper per il vocabolario
import {
  TagClassifierService,
  TagVocabularyHelper,
} from '../../../services/tag-classifier.service';

// Importa costanti e la funzione helper per il mapping dei tag
import {
  FEATURE_THRESHOLDS,
  MUSIC_TAGS,
  VOCAB_DANCE,
  VOCAB_INSTR,
  VOCAB_LOUD,
  VOCAB_SPEECH,
  VOCAB_TEMPO,
} from '../../../constants/music-tags.constants';
import { getTagForFeature } from '../../../constants/tag-mapper.util';

@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.css'],
  providers: [MessageService],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    Slider,
    Card,
    AsyncPipe,
    Button,
    MessagesModule,
    StyleClass,
    ProgressSpinner,
    NgIf,
    Toast,
    DecimalPipe,
    RatingComponent,
  ],
})
export class PlayerComponent implements OnInit, OnDestroy {
  isPlaying$ = new BehaviorSubject<boolean>(false);
  trackTitle$ = new BehaviorSubject<string>('Nessun brano in riproduzione');
  artistName$ = new BehaviorSubject<string>('');
  albumCover$ = new BehaviorSubject<string>('');
  currentTime$ = new BehaviorSubject<string>('0:00');
  totalTime$ = new BehaviorSubject<string>('0:00');

  isPlayerReady$!: BehaviorSubject<boolean>;
  progress = 0;
  formGroup: FormGroup;

  // Buffer per evitare riproduzioni ripetute: massimo 30 brani
  private recentlyPlayed: string[] = [];
  private isLoadingNewSong = false;
  trainingCount = 0;
  trainingLimit = 20;
  enableRating = true;

  @Input() selectedEmotion = 0;
  @Input() selectedActivity = 0;
  @Input() selectedLocation = 0;
  @Input() selectedEmotionLevel = '';

  private memoryModel: MemoryModelImpl;
  private rlAgent: RLAgent;
  private destroy$ = new Subject<void>();

  // Feature audio correnti: devono essere un array di 5 numeri
  currentAudioFeatures: number[] = [];
  private candidateTracks: { title: string; artist: string }[] = [];
  // Stato dell'RLAgent (deve avere 9 elementi: 3 parametri di contesto, 1 emotionLevel e 5 feature)
  private lastState: number[] = [];
  private lastAction = 0;
  isTrackRated = false;

  private tagVocabularyHelper = new TagVocabularyHelper();
  private storageKey = 'trainingCount';

  private tagClassifier: TagClassifierService = new TagClassifierService(
    VOCAB_TEMPO,
    VOCAB_DANCE,
    VOCAB_INSTR,
    VOCAB_SPEECH,
    VOCAB_LOUD
  );

  // src/constants/mappings.ts
  mapLocation(location: string | null): number {
    const mapping: { [key: string]: number } = {
      casa: 1,
      ufficio: 2,
      scuola: 3,
      palestra: 4,
      parco: 5,
      viaggio: 6,
    };
    return location && mapping[location.toLowerCase()]
      ? mapping[location.toLowerCase()]
      : 0;
  }

  mapEmotion(emotion: string | null): number {
    const mapping: { [key: string]: number } = {
      tristezza: 0,
      rabbia: 1,
      felicità: 2,
      paura: 3,
      disgusto: 4,
    };
    return emotion ? (mapping[emotion.toLowerCase()] ?? 0) : 0;
  }

  mapActivity(activity: string | null): number {
    const mapping: { [key: string]: number } = {
      lavorando: 1,
      studiando: 2,
      rilassando: 3,
      allenandoti: 4,
      leggendo: 5,
      giocando: 6,
      meditando: 7,
      cucinando: 8,
      fotografando: 9,
      panorami: 10,
    };
    return activity && mapping[activity.toLowerCase()]
      ? mapping[activity.toLowerCase()]
      : 0;
  }

  private async loadTrainingProgress(): Promise<void> {
    try {
      const result = await Preferences.get({ key: this.storageKey });
      if (result.value !== null) {
        this.trainingCount = parseInt(result.value, 10);
      }
    } catch (error) {
      console.error('Errore nel caricamento del training progress:', error);
    }
  }

  private async saveTrainingProgress(): Promise<void> {
    try {
      await Preferences.set({
        key: this.storageKey,
        value: this.trainingCount.toString(),
      });
    } catch (error) {
      console.error('Errore nel salvataggio del training progress:', error);
    }
  }

  constructor(
    private spotifyPlayerService: SpotifyPlayerService,
    private fb: FormBuilder,
    private lastFmService: LastFmService,
    private messageService: MessageService
  ) {
    this.isPlayerReady$ = this.spotifyPlayerService.playerReady$;
    this.memoryModel = new MemoryModelImpl();
    // L'RLAgent viene istanziato con inputDim=9
    this.rlAgent = new RLAgent(9, 10);
    this.formGroup = this.fb.group({ value: [0] });
  }

  async ngOnInit(): Promise<void> {
    await this.loadTrainingProgress();

    // Aggiorna il vocabolario iniziale (opzionale)
    [VOCAB_TEMPO, VOCAB_DANCE, VOCAB_INSTR, VOCAB_SPEECH, VOCAB_LOUD]
      .flat()
      .forEach(tag => this.tagVocabularyHelper.updateTagCounts([tag]));

    // Sottoscrizioni per il player
    this.isPlaying$ = this.spotifyPlayerService.isPlaying$;
    this.trackTitle$ = this.spotifyPlayerService.trackTitle$;
    this.artistName$ = this.spotifyPlayerService.artistName$;
    this.albumCover$ = this.spotifyPlayerService.albumCover$;
    this.currentTime$ = this.spotifyPlayerService.currentTime$;
    this.totalTime$ = this.spotifyPlayerService.totalTime$;

    this.spotifyPlayerService.currentTrackId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(trackId => {});

    this.spotifyPlayerService.progress$
      .pipe(takeUntil(this.destroy$))
      .subscribe(progress => {
        this.progress = progress;
        this.formGroup.patchValue({ value: progress }, { emitEvent: false });
        if (
          this.trainingCount < this.trainingLimit &&
          progress >= 99 &&
          !this.isTrackRated
        ) {
          console.warn('Traccia terminata, ma non valutata. Blocco autoplay.');
          this.spotifyPlayerService.pause();
          this.messageService.add({
            severity: 'warn',
            summary: 'Valutazione richiesta',
            detail: "Devi valutare la traccia prima di riprodurne un'altra.",
            life: 3000,
          });
        } else if (this.trainingCount >= this.trainingLimit && progress >= 99) {
          this.playNextSongWithRL();
        }
      });

    this.formGroup
      .get('value')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        this.progress = value;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  togglePlay(): void {
    this.spotifyPlayerService.togglePlay();
  }

  previousTrack(): void {
    if (this.isLoadingNewSong) return;
    this.spotifyPlayerService.previousTrack();
  }

  nextTrack(): void {
    if (this.isLoadingNewSong) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Attendere...',
        detail: "Un'operazione è già in corso, attendere un attimo.",
        life: 3000,
      });
      return;
    }
    if (this.trainingCount < this.trainingLimit && !this.isTrackRated) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Valutazione richiesta',
        detail: 'Devi valutare la traccia prima di passare alla successiva.',
        life: 3000,
      });
      return;
    }
    if (this.trainingCount >= this.trainingLimit) {
      this.isTrackRated = false;
      this.playNextSongWithRL();
      return;
    }
    this.isTrackRated = false;
    this.spotifyPlayerService.nextTrack();
  }

  get currentTrackId$() {
    return this.spotifyPlayerService.currentTrackId$;
  }

  /**
   * Costruisce lo stato per l'RLAgent: [emotion, activity, location, emotionLevel, ...5 audio features]
   */
  private buildRLState(
    emotion: number,
    activity: number,
    location: number,
    emotionLevel: number,
    features: number[]
  ): number[] {
    if (!features || features.length !== 5) {
      console.warn(
        `buildRLState: features non validi. Attesi 5, ottenuti ${features ? features.length : 0}. Uso valori default.`
      );
      features = [50, 50, 50, 50, 50];
    }
    // Converte ogni elemento in numero per evitare che restino stringhe.
    const state = [
      Number(emotion),
      Number(activity),
      Number(location),
      Number(emotionLevel),
      ...features.map(val => Number(val)),
    ];
    console.log('Stato costruito per RLAgent:', state);
    return state;
  }

  /**
   * Seleziona la prossima traccia tramite il processo RL.
   */
  public async playNextSongWithRL(): Promise<void> {
    // Assicura che le feature audio siano un array di 5 elementi
    this.currentAudioFeatures = this.ensureAudioFeatures(
      this.currentAudioFeatures
    );

    let candidateTracks: { title: string; artist: string }[] = [];

    if (this.trainingCount < this.trainingLimit) {
      console.log('Training in corso: uso top tracks interne.');
      candidateTracks = await this.spotifyPlayerService.getUserTopTracks(50);
      console.log(candidateTracks);
    } else {
      const predicted = this.tagClassifier.predictTag(
        this.currentAudioFeatures
      );
      console.log('Tag predetti dal classificatore:', predicted);
      const predictedTags = [
        predicted.tempo,
        predicted.dance,
        predicted.instr,
        predicted.speech,
        predicted.loud,
      ];
      console.log('Predicted tags:', predictedTags);
      const currentTitle = this.spotifyPlayerService.getCurrentTrackTitle();
      const currentArtist = this.spotifyPlayerService.getCurrentArtist();
      const commonMemoryTags = await this.analyzeCommonMemoryTags(
        predictedTags,
        currentTitle,
        currentArtist
      );
      console.log('Common memory tags:', commonMemoryTags);
      const searchTags = commonMemoryTags;
      console.log('Tag usati per la ricerca:', searchTags);
      for (const tag of searchTags) {
        const candidate = await this.findTrackByTag(tag);
        if (candidate) candidateTracks.push(candidate);
      }
      if (candidateTracks.length === 0) {
        console.warn(
          'Nessun candidato trovato tramite tag. Uso top tracks Spotify.'
        );
        candidateTracks = await this.spotifyPlayerService.getUserTopTracks(50);
      }
    }

    // Rimuove duplicati
    candidateTracks = candidateTracks.reduce(
      (unique, candidate) => {
        if (
          !unique.find(
            c => c.title.toLowerCase() === candidate.title.toLowerCase()
          )
        ) {
          unique.push(candidate);
        }
        return unique;
      },
      [] as { title: string; artist: string }[]
    );
    console.log('Candidate tracks dopo rimozione duplicati:', candidateTracks);

    // Filtra le tracce già riprodotte
    const filteredCandidates = candidateTracks.filter(
      candidate => !this.recentlyPlayed.includes(candidate.title.toLowerCase())
    );
    console.log(
      'Candidate tracks dopo filtro tracce già riprodotte:',
      filteredCandidates
    );
    if (filteredCandidates.length === 0) {
      console.warn('Tutti i candidati sono già stati riprodotti recentemente.');
      return;
    }
    this.candidateTracks = filteredCandidates;

    // Seleziona un candidato casualmente
    const chosenCandidate = this.selectRandomCandidate(this.candidateTracks);
    const trackId = await lastValueFrom(
      this.spotifyPlayerService.searchTrack(
        chosenCandidate.title,
        chosenCandidate.artist
      )
    );
    if (trackId) {
      this.updateRecentlyPlayed(chosenCandidate.title);
      await this.spotifyPlayerService.playTrack(trackId);
    } else {
      console.error('Nessun trackId trovato per', chosenCandidate);
    }
    this.isLoadingNewSong = false;

    const { safeEmotion, safeActivity, safeLocation, safeEmotionLevel } =
      this.getSafeContext();
    const state = this.buildRLState(
      safeEmotion,
      safeActivity,
      safeLocation,
      safeEmotionLevel,
      this.currentAudioFeatures
    );
    console.log('Stato passato a RLAgent:', state);
    this.lastState = state;
  }

  private async analyzeCommonMemoryTags(
    predictedTags: string[],
    currentTitle: string,
    currentArtist: string,
    topN: number = 10,
    minRequired: number = 3
  ): Promise<string[]> {
    const memoryTracks = this.memoryModel.getAllTracks();
    const filteredTracks = memoryTracks.filter(track => {
      if (!track.tags || !Array.isArray(track.tags)) {
        return false;
      }
      const matchingTagsCount = predictedTags.filter(tag =>
        track.tags.includes(tag)
      ).length;
      return matchingTagsCount >= minRequired;
    });

    let allTags: string[] = [];
    filteredTracks.forEach(track => {
      if (track.tags && Array.isArray(track.tags)) {
        allTags.push(...track.tags);
      }
    });

    const frequency: { [tag: string]: number } = {};
    allTags.forEach(tag => {
      frequency[tag] = (frequency[tag] || 0) + 1;
    });
    console.log('Frequenza dei tag:', frequency);

    let sortedTags = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);

    const defaultTags = new Set([
      ...VOCAB_TEMPO,
      ...VOCAB_DANCE,
      ...VOCAB_INSTR,
      ...VOCAB_SPEECH,
      ...VOCAB_LOUD,
    ]);
    let commonTags = sortedTags.filter(tag => !defaultTags.has(tag));
    console.log('Tag comuni (esclusi default):', commonTags);

    if (commonTags.length === 0 && filteredTracks.length > 0) {
      console.warn(
        'Nessun tag comune trovato esclusi quelli di default. Uso i tag della prima traccia filtrata.'
      );
      commonTags = filteredTracks[0].tags.filter(tag => !defaultTags.has(tag));
    }

    if (commonTags.length === 0) {
      console.warn(
        'Fallback: nessun tag utile trovato in memoria. Uso Last.fm.'
      );
      try {
        const externalTags = await lastValueFrom(
          this.lastFmService.getTrackTopTags(currentTitle, currentArtist)
        );
        console.log('Tag esterni da Last.fm:', externalTags);
        commonTags = externalTags;
      } catch (error) {
        console.error('Errore nel fallback Last.fm:', error);
        commonTags = predictedTags;
      }
    }

    const topTags = commonTags.slice(0, topN);
    console.log('Tag comuni finali da usare per la ricerca:', topTags);
    return topTags;
  }

  private updateRecentlyPlayed(title: string): void {
    const titleLower = title.toLowerCase();
    if (!this.recentlyPlayed.includes(titleLower)) {
      this.recentlyPlayed.push(titleLower);
      if (this.recentlyPlayed.length > 30) this.recentlyPlayed.shift();
    }
  }

  private async findTrackByTag(
    tag: string
  ): Promise<{ title: string; artist: string } | null> {
    try {
      const topTracks = await lastValueFrom(
        this.lastFmService.getTopTracksByTag(tag, 10)
      );
      if (!topTracks || topTracks.length === 0) {
        console.log(`Nessuna traccia trovata per il tag "${tag}".`);
        return null;
      }
      const availableTracks = topTracks.filter(
        track => !this.recentlyPlayed.includes(track.name.toLowerCase())
      );
      let chosenTrack;
      if (availableTracks.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableTracks.length);
        chosenTrack = availableTracks[randomIndex];
      } else {
        const randomIndex = Math.floor(Math.random() * topTracks.length);
        chosenTrack = topTracks[randomIndex];
        this.recentlyPlayed = [];
      }
      let selectedArtist = 'Unknown Artist';
      if (chosenTrack.artist && chosenTrack.artist.name) {
        selectedArtist = chosenTrack.artist.name;
      } else if (typeof chosenTrack.artist === 'string') {
        selectedArtist = chosenTrack.artist;
      }
      return { title: chosenTrack.name, artist: selectedArtist };
    } catch (error) {
      console.error(
        `Errore nel recupero delle tracce per il tag "${tag}":`,
        error
      );
      return null;
    }
  }

  async handleRatings(ratings: RatingsData): Promise<void> {
    if (this.isLoadingNewSong) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Attendere...',
        detail:
          'Caricamento in corso della nuova traccia, attendere un attimo.',
        life: 3000,
      });
      return;
    }
    this.isLoadingNewSong = true;
    console.log('Valutazioni ricevute:', ratings);

    const currentTrackTitle = this.spotifyPlayerService.getCurrentTrackTitle();
    const currentArtist = this.spotifyPlayerService.getCurrentArtist();
    if (!currentTrackTitle || !currentArtist) {
      console.warn('Nessuna traccia o artista in riproduzione.');
      this.isLoadingNewSong = false;
      return;
    }

    try {
      const tempo =
        ratings.parameterControls.find(p => p.label === 'Tempo')?.value || 50;
      const danceability =
        ratings.parameterControls.find(p => p.label === 'Danceability')
          ?.value || 50;
      const instrumentalness =
        ratings.parameterControls.find(p => p.label === 'Instrumentalness')
          ?.value || 50;
      const speechiness =
        ratings.parameterControls.find(p => p.label === 'Speechiness')?.value ||
        50;
      const loudness =
        ratings.parameterControls.find(p => p.label === 'Loudness')?.value ||
        50;

      // Assicura che le feature siano 5 elementi
      this.currentAudioFeatures = this.ensureAudioFeatures([
        tempo,
        danceability,
        instrumentalness,
        speechiness,
        loudness,
      ]);

      const target = {
        tempo: getTagForFeature(
          tempo,
          FEATURE_THRESHOLDS.TEMPO,
          MUSIC_TAGS.TEMPO
        ),
        dance: getTagForFeature(
          danceability,
          FEATURE_THRESHOLDS.DANCEABILITY,
          MUSIC_TAGS.DANCEABILITY
        ),
        instr: getTagForFeature(
          instrumentalness,
          FEATURE_THRESHOLDS.INSTRUMENTALNESS,
          MUSIC_TAGS.INSTRUMENTALNESS
        ),
        speech: getTagForFeature(
          speechiness,
          FEATURE_THRESHOLDS.SPEECHINESS,
          MUSIC_TAGS.SPEECHINESS
        ),
        loud: getTagForFeature(
          loudness,
          FEATURE_THRESHOLDS.LOUDNESS,
          MUSIC_TAGS.LOUDNESS
        ),
      };
      const customTags = [
        target.tempo,
        target.dance,
        target.instr,
        target.speech,
        target.loud,
      ];
      console.log('Tag personalizzati calcolati:', customTags);

      const externalTags = await lastValueFrom(
        this.lastFmService.getTrackTopTags(currentTrackTitle, currentArtist)
      ).catch(error => {
        console.error('Errore nel recupero dei tag da Last.fm:', error);
        return [];
      });
      console.log('Tag esterni recuperati da Last.fm:', externalTags);

      await this.memoryModel.addTrackToMemory(
        currentTrackTitle,
        currentArtist,
        String(this.selectedEmotion ?? 0),
        parseFloat(this.selectedEmotionLevel) || 0,
        this.selectedActivity ?? 0,
        this.selectedLocation ?? 0,
        customTags,
        tempo,
        danceability,
        instrumentalness,
        speechiness,
        loudness,
        externalTags
      );
      console.log(
        `Traccia "${currentTrackTitle}" salvata con tag:`,
        customTags
      );

      // Costruisci lo stato completo (9 elementi) per il training
      const { safeEmotion, safeActivity, safeLocation, safeEmotionLevel } =
        this.getSafeContext();
      const fullContext = this.buildRLState(
        safeEmotion,
        safeActivity,
        safeLocation,
        safeEmotionLevel,
        this.currentAudioFeatures
      );

      const targetEmotion = [0, 0, 0, 0, 0];
      targetEmotion[this.selectedEmotion] = 1;

      // Utilizza fullContext (con 9 elementi) invece del contesto parziale
      await this.memoryModel.trainModel(
        fullContext,
        this.currentAudioFeatures,
        targetEmotion
      );
      await this.tagClassifier.trainOnSample(this.currentAudioFeatures, target);
      console.log('Classifier addestrato sul campione con tag target:', target);

      const predictedTags = this.tagClassifier.predictTag(
        this.currentAudioFeatures
      );
      console.log('Tag predetti dal classificatore:', predictedTags);

      const sessionKeyResult = await Preferences.get({
        key: 'lastfmSessionKey',
      });
      const sessionKey = sessionKeyResult.value;
      if (sessionKey) {
        this.lastFmService
          .addTagsToTrack(
            currentArtist,
            currentTrackTitle,
            customTags,
            sessionKey
          )
          .subscribe(result => {
            console.log('Tag aggiornati su Last.fm:', result);
          });
      } else {
        console.warn(
          'Session key non disponibile: impossibile aggiornare i tag su Last.fm.'
        );
      }

      // Se lo stato precedente non è già impostato correttamente, inizializzalo
      if (!this.lastState || this.lastState.length !== 9) {
        this.lastState = this.buildRLState(
          safeEmotion,
          safeActivity,
          safeLocation,
          safeEmotionLevel,
          this.currentAudioFeatures
        );
      }
      const nextState = this.buildRLState(
        safeEmotion,
        safeActivity,
        safeLocation,
        safeEmotionLevel,
        this.currentAudioFeatures
      );

      // Calcola il reward basato sulla similarità coseno
      const cosineSimilarity = (v1: number[], v2: number[]): number => {
        const dot = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
        const mag1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
        const mag2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));
        if (mag1 === 0 || mag2 === 0) return 0;
        return dot / (mag1 * mag2);
      };
      const targetAudioFeatures = [
        tempo,
        danceability,
        instrumentalness,
        speechiness,
        loudness,
      ];
      const reward = cosineSimilarity(
        this.currentAudioFeatures,
        targetAudioFeatures
      );
      console.log('Reward calcolato (similarità coseno):', reward);

      await this.rlAgent.trainStep(this.lastState, this.lastAction, reward);
      console.log('RLAgent trainStep completato');

      await this.rlAgent.saveBestWeightsToPreferences();
      this.lastState = nextState;

      this.trainingCount++;
      await this.saveTrainingProgress();
      console.log(
        `Training Count: ${this.trainingCount}/${this.trainingLimit}`
      );

      if (this.trainingCount >= this.trainingLimit) {
        console.log(
          'Il modello è stato addestrato. Disabilitiamo la valutazione.'
        );
        this.enableRating = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Addestramento Completato',
          detail:
            'Il modello ha appreso dalle canzoni! Ora userà il suo apprendimento per consigliarti brani automaticamente.',
          life: 5000,
        });
      }

      setTimeout(() => {
        this.playNextSongWithRL();
      }, 2000);
    } catch (error) {
      console.error('Errore nel processo di rating:', error);
      this.isLoadingNewSong = false;
    }
  }

  private ensureAudioFeatures(features: number[]): number[] {
    if (!features || features.length !== 5) {
      console.warn(
        `ensureAudioFeatures: lunghezza non valida (${features ? features.length : 0}). Uso valori di default.`
      );
      return [50, 50, 50, 50, 50];
    }
    return features;
  }

  private getSafeContext(): {
    safeEmotion: number;
    safeActivity: number;
    safeLocation: number;
    safeEmotionLevel: number;
  } {
    const safeEmotion = this.mapEmotion(
      this.selectedEmotion ? String(this.selectedEmotion) : null
    );
    const safeActivity = this.mapActivity(
      this.selectedActivity ? String(this.selectedActivity) : null
    );
    const safeLocation = this.mapLocation(
      this.selectedLocation ? String(this.selectedLocation) : null
    );
    const safeEmotionLevel = parseFloat(this.selectedEmotionLevel) || 0;
    return { safeEmotion, safeActivity, safeLocation, safeEmotionLevel };
  }

  private selectRandomCandidate(
    candidates: { title: string; artist: string }[]
  ): { title: string; artist: string } {
    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
  }
}
