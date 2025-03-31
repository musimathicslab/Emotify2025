import { Injectable } from '@angular/core';
import { MemoryModelImpl } from '../models/memory-model';
import { MOOD_DATA, MoodInfo, Severity } from '../constants/emotions.constants';

@Injectable({
  providedIn: 'root',
})
export class EmotionsService {
  private memoryModel: MemoryModelImpl;
  private emotionNameMap: { [code: number]: string } = {};

  constructor() {
    // Inizializza il memory model aggiornato (con reattività)
    this.memoryModel = new MemoryModelImpl();

    // Attendi che la memoria sia pronta e logga le tracce iniziali
    this.memoryModel.memoryStore.ready().then(() => {
      console.log(
        '✅ Memoria pronta in EmotionsService:',
        this.memoryModel.getAllTracks()
      );
    });

    this.initializeEmotionNameMap();
  }

  // Se vuoi accedere in modo reattivo alle tracce, espone un getter:
  public get tracks$() {
    return this.memoryModel.tracks$;
  }

  private initializeEmotionNameMap(): void {
    Object.keys(MOOD_DATA).forEach(codeStr => {
      const code = Number(codeStr);
      this.emotionNameMap[code] = MOOD_DATA[code].label;
    });
  }

  public getEmotionNamesWithImg(): {
    code: number;
    name: string;
    img: string;
  }[] {
    return Object.entries(MOOD_DATA).map(([codeStr, mood]) => ({
      code: Number(codeStr),
      name: mood.label,
      img: mood.image,
    }));
  }

  private getMoodInfo(code: number): MoodInfo {
    return (
      MOOD_DATA[code] || { label: `Mood ${code}`, image: '', severity: 'info' }
    );
  }

  public getEmotionName(code: number): string {
    return this.emotionNameMap[code] || `Mood ${code}`;
  }

  public getMoodLabel(input: number | string): string {
    return typeof input === 'string' ? input : this.getMoodInfo(input).label;
  }

  public getMoodFrequency(): { [moodLabel: string]: number } {
    // Utilizza l'array aggiornato delle tracce
    const tracks = this.memoryModel.getAllTracks();
    console.log('📌 Tracce in memoria:', tracks);
    const moodCounts: { [moodLabel: string]: number } = {};
    tracks.forEach(track => {
      if (track?.emotion != null) {
        const code = Number(track.emotion);
        const label = this.getEmotionName(code);
        moodCounts[label] = (moodCounts[label] || 0) + 1;
      }
    });
    return moodCounts;
  }

  public getMoodSeverityByLabel(label: string): Severity {
    const entry = Object.values(MOOD_DATA).find(m => m.label === label);
    return entry ? entry.severity : 'info';
  }

  public getFavoriteArtistsByMood(): { [moodLabel: string]: string[] } {
    const tracks = this.memoryModel.getAllTracks();
    const freqMap: { [moodLabel: string]: Map<string, number> } = {};

    tracks.forEach(track => {
      if (track?.emotion != null && track?.artist) {
        const code = Number(track.emotion);
        const moodLabel = this.getEmotionName(code);
        if (!freqMap[moodLabel]) {
          freqMap[moodLabel] = new Map<string, number>();
        }
        const oldCount = freqMap[moodLabel].get(track.artist) || 0;
        freqMap[moodLabel].set(track.artist, oldCount + 1);
      }
    });

    const finalObj: { [moodLabel: string]: string[] } = {};
    Object.keys(freqMap).forEach(moodLabel => {
      const sorted = Array.from(freqMap[moodLabel].entries())
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);
      finalObj[moodLabel] = sorted.slice(0, 3);
    });
    return finalObj;
  }

  public getListeningTimesByMood(): { [timeRange: string]: string } {
    const tracks = this.memoryModel.getAllTracks();
    const listeningTimes: { [timeRange: string]: string[] } = {
      'Mattina (6-10 AM)': [],
      'Pomeriggio (11 AM - 4 PM)': [],
      'Sera (5-9 PM)': [],
      'Notte (10 PM - 5 AM)': [],
    };

    tracks.forEach(track => {
      if (track?.timestamp && track?.emotion != null) {
        const date = new Date(track.timestamp);
        if (!isNaN(date.getTime())) {
          const hour = date.getHours();
          const code = Number(track.emotion);
          const label = this.getEmotionName(code);
          if (hour >= 6 && hour < 10) {
            listeningTimes['Mattina (6-10 AM)'].push(label);
          } else if (hour >= 11 && hour < 16) {
            listeningTimes['Pomeriggio (11 AM - 4 PM)'].push(label);
          } else if (hour >= 16 && hour < 21) {
            listeningTimes['Sera (5-9 PM)'].push(label);
          } else {
            listeningTimes['Notte (10 PM - 5 AM)'].push(label);
          }
        }
      }
    });

    return Object.fromEntries(
      Object.entries(listeningTimes).map(([range, labels]) => [
        range,
        Array.from(new Set(labels)).join(', '),
      ])
    );
  }

  public getFavoriteSongsByMoodLabel(): { [moodLabel: string]: string[] } {
    const tracks = this.memoryModel.getAllTracks();
    const songMap: { [moodLabel: string]: Map<string, number> } = {};

    tracks.forEach(track => {
      if (track?.emotion != null) {
        const code = Number(track.emotion);
        const moodLabel = this.getEmotionName(code);

        if (!songMap[moodLabel]) {
          songMap[moodLabel] = new Map<string, number>();
        }

        // Qui salvi la canzone nel map
        const title = `${track.title || 'Titolo sconosciuto'} - ${
          track.artist || 'Artista sconosciuto'
        }`;
        const oldCount = songMap[moodLabel].get(title) || 0;
        songMap[moodLabel].set(title, oldCount + 1);
      }
    });

    // Ora costruisci il risultato finale
    const result: { [moodLabel: string]: string[] } = {};
    Object.keys(songMap).forEach(moodLabel => {
      result[moodLabel] = Array.from(songMap[moodLabel].entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(entry => entry[0]);
    });

    return result;
  }
}
