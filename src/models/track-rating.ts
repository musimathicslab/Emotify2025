export interface TrackRating {
  id: string; // "titolo-artista" o simile
  seedGenres: string;
  seedTracks: string;
  popularity: number;
  tags: string[];
  realEmotion: string;
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
  timestamp: string;
}

export interface RatingParameter {
  label: string;
  value: number;
}

export interface RatingsData {
  selectedEmotion: number;
  parameterControls: RatingParameter[];
}
