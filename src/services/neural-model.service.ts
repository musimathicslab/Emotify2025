// neural-model.service.ts
import * as tf from '@tensorflow/tfjs';

export class NeuralModelService {
  private model: tf.Sequential;

  constructor() {
    this.model = tf.sequential();
    this.model.add(
      tf.layers.dense({ units: 64, inputShape: [3], activation: 'relu' })
    );
    this.model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    this.model.add(tf.layers.dense({ units: 5 }));
    this.model.compile({
      optimizer: tf.train.adam(),
      loss: 'meanSquaredError',
    });
  }

  public async trainSingleSample(
    context: number[],
    targetFeatures: number[],
    rating: number
  ) {
    const xs = tf.tensor2d([context], [1, context.length]);
    const ys = tf.tensor2d([targetFeatures], [1, targetFeatures.length]);
    const sampleWeightArray = [rating];
    const sampleWeights = tf.tensor1d(sampleWeightArray);

    await this.model.fit(xs, ys, { epochs: 5 });
    xs.dispose();
    ys.dispose();
    sampleWeights.dispose();
  }

  public async trainBatch(contexts: number[][], features: number[][]) {
    const xs = tf.tensor2d(contexts, [contexts.length, contexts[0].length]);
    const ys = tf.tensor2d(features, [features.length, features[0].length]);
    try {
      await this.model.fit(xs, ys, { epochs: 10 });
      console.log('Addestramento batch completato');
    } catch (error) {
      console.error('Errore trainBatch:', error);
    } finally {
      xs.dispose();
      ys.dispose();
    }
  }

  public predictAudioFeatures(context: number[]): number[] {
    const xs = tf.tensor2d([context], [1, context.length]);
    const output = this.model.predict(xs) as tf.Tensor;
    const predicted = Array.from(output.dataSync());
    xs.dispose();
    output.dispose();
    return predicted;
  }

  public async saveModel(name = 'my-tf-model'): Promise<void> {
    await this.model.save(`indexeddb://${name}`);
    console.log('Modello salvato in IndexedDB:', name);
  }

  public static async loadModel(
    name = 'my-tf-model'
  ): Promise<NeuralModelService> {
    const service = new NeuralModelService();
    try {
      service.model = (await tf.loadLayersModel(
        `indexeddb://${name}`
      )) as tf.Sequential;
      console.log('Modello caricato da IndexedDB:', name);
    } catch (error) {
      console.warn('Nessun modello salvato trovato. Uso un modello nuovo.');
    }
    return service;
  }
}
