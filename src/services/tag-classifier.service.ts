import * as tf from '@tensorflow/tfjs';
import { Preferences } from '@capacitor/preferences';

export class TagClassifierService {
  private model: tf.LayersModel;

  constructor(
    public vocabTempo: string[],
    public vocabDance: string[],
    public vocabInstr: string[],
    public vocabSpeech: string[],
    public vocabLoud: string[]
  ) {
    // Definisce l'input (5 feature)
    const input = tf.input({ shape: [5] });
    const dense1 = tf.layers
      .dense({ units: 64, activation: 'relu' })
      .apply(input);
    const dense2 = tf.layers
      .dense({ units: 32, activation: 'relu' })
      .apply(dense1);

    // Effettua il casting degli output a SymbolicTensor
    const outputTempo = tf.layers
      .dense({
        units: this.vocabTempo.length,
        activation: 'softmax',
        name: 'tempo',
      })
      .apply(dense2) as tf.SymbolicTensor;

    const outputDance = tf.layers
      .dense({
        units: this.vocabDance.length,
        activation: 'softmax',
        name: 'dance',
      })
      .apply(dense2) as tf.SymbolicTensor;

    const outputInstr = tf.layers
      .dense({
        units: this.vocabInstr.length,
        activation: 'softmax',
        name: 'instr',
      })
      .apply(dense2) as tf.SymbolicTensor;

    const outputSpeech = tf.layers
      .dense({
        units: this.vocabSpeech.length,
        activation: 'softmax',
        name: 'speech',
      })
      .apply(dense2) as tf.SymbolicTensor;

    const outputLoud = tf.layers
      .dense({
        units: this.vocabLoud.length,
        activation: 'softmax',
        name: 'loud',
      })
      .apply(dense2) as tf.SymbolicTensor;

    // Costruisci il modello multi-output
    this.model = tf.model({
      inputs: input,
      outputs: [
        outputTempo,
        outputDance,
        outputInstr,
        outputSpeech,
        outputLoud,
      ],
    });

    // Compila il modello usando una loss per ogni output
    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: {
        tempo: 'categoricalCrossentropy',
        dance: 'categoricalCrossentropy',
        instr: 'categoricalCrossentropy',
        speech: 'categoricalCrossentropy',
        loud: 'categoricalCrossentropy',
      },
    });

    this.model.summary();
  }

  public async trainOnSample(
    features: number[],
    target: {
      tempo: string;
      dance: string;
      instr: string;
      speech: string;
      loud: string;
    }
  ): Promise<void> {
    // Funzione helper per creare il vettore one-hot
    const oneHot = (vocab: string[], tag: string) => {
      const index = vocab.indexOf(tag);
      const vector = new Array(vocab.length).fill(0);
      if (index >= 0) vector[index] = 1;
      return vector;
    };

    const targetData = {
      tempo: oneHot(this.vocabTempo, target.tempo),
      dance: oneHot(this.vocabDance, target.dance),
      instr: oneHot(this.vocabInstr, target.instr),
      speech: oneHot(this.vocabSpeech, target.speech),
      loud: oneHot(this.vocabLoud, target.loud),
    };

    const xs = tf.tensor2d([features], [1, features.length]);
    const ys = {
      tempo: tf.tensor2d([targetData.tempo], [1, this.vocabTempo.length]),
      dance: tf.tensor2d([targetData.dance], [1, this.vocabDance.length]),
      instr: tf.tensor2d([targetData.instr], [1, this.vocabInstr.length]),
      speech: tf.tensor2d([targetData.speech], [1, this.vocabSpeech.length]),
      loud: tf.tensor2d([targetData.loud], [1, this.vocabLoud.length]),
    };

    await this.model.fit(xs, ys, { epochs: 5, verbose: 0 });
    xs.dispose();
    Object.values(ys).forEach(t => t.dispose());
  }

  public predictTag(features: number[]): {
    tempo: string;
    dance: string;
    instr: string;
    speech: string;
    loud: string;
  } {
    const xs = tf.tensor2d([features], [1, features.length]);
    const outputs = this.model.predict(xs) as tf.Tensor[];
    const result = {
      tempo: this.vocabTempo[outputs[0].argMax(-1).dataSync()[0]],
      dance: this.vocabDance[outputs[1].argMax(-1).dataSync()[0]],
      instr: this.vocabInstr[outputs[2].argMax(-1).dataSync()[0]],
      speech: this.vocabSpeech[outputs[3].argMax(-1).dataSync()[0]],
      loud: this.vocabLoud[outputs[4].argMax(-1).dataSync()[0]],
    };
    xs.dispose();
    outputs.forEach(t => t.dispose());
    return result;
  }
}

export class TagVocabularyHelper {
  private tagCounts: { [tag: string]: number } = {};

  constructor() {
    // Carica il vocabolario persistente al momento della creazione
    this.loadVocabulary();
  }

  // Carica il vocabolario salvato da Preferences
  public async loadVocabulary(): Promise<void> {
    try {
      const result = await Preferences.get({ key: 'tagVocabulary' });
      if (result.value) {
        this.tagCounts = JSON.parse(result.value);
        console.log('Vocabolario caricato:', this.tagCounts);
      } else {
        console.log('Nessun vocabolario trovato. Inizializzo vuoto.');
      }
    } catch (error) {
      console.error('Errore nel caricamento del vocabolario:', error);
    }
  }

  // Salva il vocabolario corrente su Preferences
  public async saveVocabulary(): Promise<void> {
    try {
      await Preferences.set({
        key: 'tagVocabulary',
        value: JSON.stringify(this.tagCounts),
      });
      console.log('Vocabolario salvato:', this.tagCounts);
    } catch (error) {
      console.error('Errore nel salvataggio del vocabolario:', error);
    }
  }

  // Aggiorna i conteggi dei tag e salva il vocabolario persistente
  public async updateTagCounts(tags: string[]): Promise<void> {
    tags.forEach(tag => {
      const normTag = tag.trim().toLowerCase();
      this.tagCounts[normTag] = (this.tagCounts[normTag] || 0) + 1;
    });
    console.log('Vocabolario aggiornato (conteggi):', this.tagCounts);
    await this.saveVocabulary();
  }

  // Metodo per resettare il vocabolario
  public async resetVocabulary(): Promise<void> {
    this.tagCounts = {}; // Svuota il vocabolario in memoria
    try {
      await Preferences.remove({ key: 'tagVocabulary' });
      console.log('Vocabolario resettato.');
    } catch (error) {
      console.error('Errore durante il reset del vocabolario:', error);
    }
  }

  // Restituisce l'elenco dei tag (le chiavi del vocabolario)
  public getVocabulary(): string[] {
    return Object.keys(this.tagCounts);
  }
}
