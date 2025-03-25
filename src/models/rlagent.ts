import * as tf from '@tensorflow/tfjs';
import { Preferences } from '@capacitor/preferences';

export class RLAgent {
  private qNetwork: tf.Sequential;
  private readonly optimizer: tf.Optimizer;
  private epsilon: number;
  private readonly epsilonDecay: number;
  private readonly minEpsilon: number;
  private readonly gamma: number; // discount factor
  private readonly actionSpaceSize: number;
  private bestLoss: number | null = null;
  private bestWeights: tf.Tensor[] | null = null;

  // inputDim=9, actionSpaceSize ad esempio 10
  constructor(inputDim: number, actionSpaceSize: number) {
    this.actionSpaceSize = actionSpaceSize;
    this.optimizer = tf.train.adam(0.001);
    this.qNetwork = this.createQNetwork(inputDim, actionSpaceSize);
    this.epsilon = 1.0;
    this.epsilonDecay = 0.99;
    this.minEpsilon = 0.1;
    this.gamma = 0.95;
  }

  private createQNetwork(inputDim: number, outputDim: number): tf.Sequential {
    const model = tf.sequential();
    model.add(
      tf.layers.dense({ inputShape: [inputDim], units: 64, activation: 'relu' })
    );
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: outputDim }));
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

  public selectAction(state: number[], candidatePenalties?: number[]): number {
    if (Math.random() < this.epsilon) {
      return Math.floor(Math.random() * this.actionSpaceSize);
    } else {
      const qValues = this.predict(state);
      if (candidatePenalties && candidatePenalties.length === qValues.length) {
        const penalizedQValues = qValues.map(
          (q, idx) => q - candidatePenalties[idx]
        );
        return penalizedQValues.indexOf(Math.max(...penalizedQValues));
      } else {
        return qValues.indexOf(Math.max(...qValues));
      }
    }
  }

  public async trainStep(
    state: number[],
    action: number,
    reward: number,
    nextState: number[],
    done: boolean
  ): Promise<void> {
    const expectedDim = this.qNetwork.inputs[0].shape[1] as number;
    if (!state || state.length !== expectedDim) {
      console.warn(
        `trainStep: Stato non valido. Atteso ${expectedDim}, ottenuto ${state?.length}.`
      );
      return;
    }
    if (!done && (!nextState || nextState.length !== expectedDim)) {
      console.warn(
        `trainStep: nextState non valido. Atteso ${expectedDim}, ottenuto ${nextState?.length}.`
      );
      return;
    }
    const qValues = this.predict(state);
    let target = reward;
    if (!done) {
      const nextQ = this.predict(nextState);
      target = reward + this.gamma * Math.max(...nextQ);
    }
    const targetQValues = [...qValues];
    targetQValues[action] = target;

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

  // Metodo per caricare i best weights salvati da Preferences
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
