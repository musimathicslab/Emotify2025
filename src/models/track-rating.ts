export interface TrackRating {
  id: string; // "titolo-artista" o simile
  seedGenres: string;
  seedTracks: string;
  popularity: number;
  tags: string[];
  rating: number;
  title: string;
  artist: string;
  emotion: string;
  tempo: number;
  danceability: number;
  instrumentalness: number;
  emotionLevel: number;
  speechiness: number;
  loudness: number;
  activity: string;
  location: string;
  audioFeatures: number[];
  timestamp: string; // ✅ Aggiunto per supportare i momenti della giornata
}

export interface RatingParameter {
  label: string;
  value: number;
}

export interface RatingsData {
  selectedEmotion: string;
  songRating: string;
  parameterControls: RatingParameter[];
}
