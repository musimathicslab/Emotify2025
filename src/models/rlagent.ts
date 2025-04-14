import * as tf from '@tensorflow/tfjs';
import { Preferences } from '@capacitor/preferences';

export class RLAgent {
  private qNetwork: tf.Sequential;
  private readonly optimizer: tf.Optimizer;
  private epsilon: number;
  private readonly epsilonDecay: number;
  private readonly minEpsilon: number;
  private bestLoss: number | null = null;
  private bestWeights: tf.Tensor[] | null = null;

  constructor(inputDim: number, actionSpaceSize: number) {
    this.optimizer = tf.train.adam(0.001);
    this.qNetwork = this.createQNetwork(inputDim, actionSpaceSize);
    this.epsilon = 1.0;
    this.epsilonDecay = 0.99;
    this.minEpsilon = 0.1;
  }

  private createQNetwork(inputDim: number, outputDim: number): tf.Sequential {
    const model = tf.sequential();
    model.add(
      tf.layers.dense({ inputShape: [inputDim], units: 64, activation: 'relu' })
    );
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    // Layer finale con 'sigmoid' per output compresi tra 0 e 1
    model.add(tf.layers.dense({ units: outputDim, activation: 'sigmoid' }));
    model.compile({ optimizer: this.optimizer, loss: 'meanSquaredError' });
    console.log('RL Agent Q-Network:');
    model.summary();
    return model;
  }

  public predict(state: number[]): number[] {
    return tf.tidy(() => {
      const input = tf.tensor2d([state]);
      const output = this.qNetwork.predict(input) as tf.Tensor;
      return Array.from(output.dataSync());
    });
  }

  // Metodo per predire le audio features; l'output (range [0,1]) viene scalato a [0,100].
  public predictNextAudioFeatures(state: number[]): number[] {
    return tf.tidy(() => {
      const input = tf.tensor2d([state]);
      const output = this.qNetwork.predict(input) as tf.Tensor;
      // Scala l'output: moltiplica ogni elemento per 100
      const scaledOutput = output.mul(tf.scalar(100));
      return Array.from(scaledOutput.dataSync());
    });
  }

  public async trainStep(
    state: number[],
    action: number,
    reward: number
  ): Promise<void> {
    const expectedDim = this.qNetwork.inputs[0].shape[1] as number;
    if (!state || state.length !== expectedDim) {
      console.warn(
        `trainStep: Stato non valido. Atteso ${expectedDim}, ottenuto ${state?.length}.`
      );
      return;
    }
    const qValues = this.predict(state);
    const targetQValues = [...qValues];
    targetQValues[action] = reward;

    const xs = tf.tensor2d([state]);
    const ys = tf.tensor2d([targetQValues]);

    const history = await this.qNetwork.fit(xs, ys, { epochs: 1, verbose: 0 });
    xs.dispose();
    ys.dispose();

    const lossArr = history.history['loss'];
    const lossValue = Number(lossArr[0]);

    this.epsilon = Math.max(this.minEpsilon, this.epsilon * this.epsilonDecay);

    if (this.bestLoss === null || lossValue < this.bestLoss) {
      this.bestLoss = lossValue;
      this.bestWeights = this.qNetwork.getWeights();
      console.log(`Nuovi pesi migliori trovati con loss: ${lossValue}`);
    }
  }

  public async getBestWeights(): Promise<any> {
    if (!this.bestWeights) {
      this.bestWeights = this.qNetwork.getWeights();
    }
    return await Promise.all(
      this.bestWeights.map(async (tensor: tf.Tensor) => {
        const vals = await tensor.data();
        return {
          shape: tensor.shape,
          values: Array.from(vals),
        };
      })
    );
  }

  public async saveBestWeightsToPreferences(): Promise<void> {
    const weightsData = await this.getBestWeights();
    await Preferences.set({
      key: 'modelWeights',
      value: JSON.stringify(weightsData),
    });
    console.log('Pesi del modello salvati nelle Preferences.');
  }

  public async loadBestWeightsFromPreferences(): Promise<void> {
    const result = await Preferences.get({ key: 'modelWeights' });
    if (result.value) {
      try {
        const weightsData = JSON.parse(result.value);
        const weights = weightsData.map(
          (w: { shape: number[]; values: number[] }) =>
            tf.tensor(w.values, w.shape)
        );
        this.qNetwork.setWeights(weights);
        console.log('Best weights caricati correttamente.');
      } catch (error) {
        console.error('Errore nel caricamento dei best weights:', error);
      }
    } else {
      console.warn('Nessun best weights salvato trovato.');
    }
  }
}
