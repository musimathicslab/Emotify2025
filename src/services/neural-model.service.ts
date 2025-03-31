import * as tf from '@tensorflow/tfjs';

export class NeuralModelService {
  private model: tf.LayersModel;

  /**
   * @param inputDim Numero di feature in ingresso (ad es. 9)
   */
  constructor(inputDim: number) {
    this.model = this.createMultiOutputModel(inputDim);
  }

  /**
   * Crea un modello multi-output con:
   * - Una testa per la regressione (5 neuroni, output lineare)
   * - Una testa per la classificazione dell'emozione (5 neuroni, softmax)
   */
  private createMultiOutputModel(inputDim: number): tf.LayersModel {
    // Ingresso
    const input = tf.input({ shape: [inputDim] });

    // Strati condivisi
    const dense1 = tf.layers
      .dense({ units: 64, activation: 'relu' })
      .apply(input) as tf.SymbolicTensor;
    const dense2 = tf.layers
      .dense({ units: 32, activation: 'relu' })
      .apply(dense1) as tf.SymbolicTensor;

    // Testa 1: Regressione per le audio features (5 output)
    const outputFeatures = tf.layers
      .dense({ units: 5, activation: 'linear', name: 'feature_output' })
      .apply(dense2) as tf.SymbolicTensor;

    // Testa 2: Classificazione per l'emozione (5 classi)
    const outputEmotion = tf.layers
      .dense({ units: 5, activation: 'softmax', name: 'emotion_output' })
      .apply(dense2) as tf.SymbolicTensor;

    // Costruzione del modello multi-output
    const model = tf.model({
      inputs: input,
      outputs: [outputFeatures, outputEmotion],
    });

    // Compilazione: utilizziamo due loss differenti per ciascuna testa
    model.compile({
      optimizer: tf.train.adam(),
      loss: ['meanSquaredError', 'categoricalCrossentropy'],
      metrics: ['mse', 'accuracy'],
    });

    console.log('Modello multi-output creato:');
    model.summary();
    return model;
  }

  /**
   * Allena il modello su un singolo campione.
   * @param context Array di input (es. contesto di dimensione inputDim)
   * @param targetFeatures Array con 5 target numerici (regressione)
   * @param targetEmotion Array one-hot con 5 elementi per l'emozione
   */
  public async trainSingleSample(
    context: number[],
    targetFeatures: number[],
    targetEmotion: number[]
  ): Promise<void> {
    const xs = tf.tensor2d([context], [1, context.length]);
    const ysFeatures = tf.tensor2d(
      [targetFeatures],
      [1, targetFeatures.length]
    );
    const ysEmotion = tf.tensor2d([targetEmotion], [1, targetEmotion.length]);

    await this.model.fit(xs, [ysFeatures, ysEmotion], { epochs: 5 });
    xs.dispose();
    ysFeatures.dispose();
    ysEmotion.dispose();
  }

  /**
   * Effettua la predizione su un dato contesto.
   * @param context Array di input di dimensione inputDim
   * @returns Un oggetto contenente:
   *   - features: array con le 5 audio features predette
   *   - emotionProbs: array con le probabilità per ciascuna delle 5 emozioni
   */
  public predict(context: number[]): {
    features: number[];
    emotionProbs: number[];
  } {
    const xs = tf.tensor2d([context], [1, context.length]);
    const preds = this.model.predict(xs) as tf.Tensor[];
    // Predizione per le audio features (regressione)
    const features = Array.from(preds[0].dataSync());
    // Predizione per l'emozione (classificazione, softmax output)
    const emotionProbs = Array.from(preds[1].dataSync());
    xs.dispose();
    preds[0].dispose();
    preds[1].dispose();
    return { features, emotionProbs };
  }

  /**
   * Salva il modello su IndexedDB.
   * @param name Nome con cui salvare il modello (default: 'my-tf-model')
   */
  public async saveModel(name = 'my-tf-model'): Promise<void> {
    await this.model.save(`indexeddb://${name}`);
    console.log('Modello salvato in IndexedDB:', name);
  }

  /**
   * Carica il modello da IndexedDB.
   * Se il modello non esiste, ne viene creato uno nuovo.
   * @param inputDim Dimensione dell'input (necessaria per creare un nuovo modello se non esiste)
   * @param name Nome del modello salvato (default: 'my-tf-model')
   */
  public static async loadModel(
    inputDim: number,
    name = 'my-tf-model'
  ): Promise<NeuralModelService> {
    const service = new NeuralModelService(inputDim);
    try {
      service.model = (await tf.loadLayersModel(
        `indexeddb://${name}`
      )) as tf.LayersModel;
      console.log('Modello caricato da IndexedDB:', name);
    } catch (error) {
      console.warn(
        'Nessun modello salvato trovato. Viene creato un nuovo modello.'
      );
    }
    return service;
  }
}
