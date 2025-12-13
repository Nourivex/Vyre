// Ollama embedding adapter skeleton
// This adapter should call local ollama runtime to produce embeddings.
export class OllamaAdapter {
  name = 'ollama';

  constructor(opts: any = {}) {
    // opts may include binaryPath, modelName, etc.
  }

  async embedTexts(texts: string[], options?: {model?:string}) : Promise<Float32Array[]> {
    // TODO: call ollama binary or client and return embeddings
    // Placeholder: return zero vectors
    return texts.map(() => new Float32Array(0));
  }
}
