import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import path from 'path';
import fs from 'fs';

@Injectable()
export class LocalEmbeddingService implements OnModuleDestroy {
  private pipeline: any = null;
  private loadPromise: Promise<void> | null = null;
  private readonly logger = new Logger(LocalEmbeddingService.name);
  private readonly MODEL_ID = 'Xenova/jina-embeddings-v2-base-zh';
  private readonly CACHE_DIR = path.resolve(__dirname, '../../../data/models');
  private readonly BATCH_SIZE = 8;

  private async ensureModel(): Promise<void> {
    if (this.pipeline) return;
    if (this.loadPromise) {
      await this.loadPromise;
      return;
    }

    this.loadPromise = this.loadModel();
    await this.loadPromise;
  }

  private async loadModel(): Promise<void> {
    this.logger.log(`Loading local embedding model: ${this.MODEL_ID}`);

    const { pipeline, env } = await import('@huggingface/transformers');
    env.cacheDir = this.CACHE_DIR;
    env.allowRemoteModels = true;

    if (!fs.existsSync(this.CACHE_DIR)) {
      fs.mkdirSync(this.CACHE_DIR, { recursive: true });
    }

    this.pipeline = await pipeline('feature-extraction', this.MODEL_ID, {
      dtype: 'fp32',
    });

    this.logger.log('Local embedding model loaded successfully');
  }

  async embed(input: string[]): Promise<{ embeddings: number[][]; dimensions: number }> {
    await this.ensureModel();

    const allEmbeddings: number[][] = [];

    // Process in batches to limit memory
    for (let i = 0; i < input.length; i += this.BATCH_SIZE) {
      const batch = input.slice(i, i + this.BATCH_SIZE);
      const results = await this.pipeline(batch, {
        pooling: 'mean',
        normalize: true,
      });

      // results.tolist() returns number[][] for batch input
      const batchEmbeddings: number[][] = results.tolist();
      allEmbeddings.push(...batchEmbeddings);
    }

    const dimensions = allEmbeddings[0]?.length ?? 0;
    return { embeddings: allEmbeddings, dimensions };
  }

  getStatus(): { downloaded: boolean; loading: boolean; modelId: string } {
    // Check if model files exist in cache
    const downloaded = this.isModelCached();
    const loading = this.loadPromise !== null && this.pipeline === null;
    return { downloaded, loading, modelId: this.MODEL_ID };
  }

  async downloadModel(): Promise<void> {
    await this.ensureModel();
  }

  private isModelCached(): boolean {
    if (!fs.existsSync(this.CACHE_DIR)) return false;
    // Transformers.js v3 stores models as {cacheDir}/{org}/{model}/
    const [org, name] = this.MODEL_ID.split('/');
    const modelDir = path.join(this.CACHE_DIR, org, name);
    return fs.existsSync(modelDir);
  }

  onModuleDestroy() {
    this.pipeline = null;
    this.loadPromise = null;
  }
}
