import { Readable, Transform } from 'stream';
import fs from 'fs';
import { S3Client, HeadBucketCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { BackupFileInfo, IStorageProvider, StorageConfig } from './storageInterface';

/** remote_path is bucket/prefix; host is an optional S3-compatible endpoint. */
export class S3Provider implements IStorageProvider {
  private client: S3Client;
  private bucket: string;
  private prefix: string;
  constructor(config: StorageConfig) {
    const parts = config.remote_path.replace(/^s3:\/\//, '').split('/');
    this.bucket = parts.shift() || '';
    this.prefix = parts.filter(Boolean).join('/');
    if (!this.bucket || parts.includes('..')) throw new Error('Invalid S3 bucket/prefix');
    this.client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: config.host || undefined,
      forcePathStyle: Boolean(config.host),
      credentials: config.username && config.password
        ? { accessKeyId: config.username, secretAccessKey: config.password } : undefined
    });
  }
  private key(name: string): string {
    const uri = `s3://${this.bucket}/`;
    const full = name.startsWith(uri) ? name.slice(uri.length)
      : [this.prefix, name].filter(Boolean).join('/');
    if (full.split('/').some(part => part === '..') || full.startsWith('/') ||
        (this.prefix && full !== this.prefix && !full.startsWith(this.prefix + '/'))) {
      throw new Error('S3 key escapes the configured prefix');
    }
    return full;
  }
  async testConnection() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { success: true, message: 'S3 bucket accessible (write permissions require an upload test).' };
    } catch (err: any) { return { success: false, message: err.message }; }
  }
  async uploadStream(name: string, source: Readable) {
    const Key = this.key(name);
    let bytesWritten = 0;
    const counter = new Transform({ transform(chunk, encoding, done) {
      bytesWritten += chunk.length; done(null, chunk);
    }});
    const onError = (err: Error) => counter.destroy(err);
    source.on('error', onError);
    source.pipe(counter);
    try {
      await new Upload({ client: this.client, params: { Bucket: this.bucket, Key, Body: counter },
        queueSize: 2, partSize: 8 * 1024 * 1024, leavePartsOnError: false }).done();
      return { bytesWritten, path: `s3://${this.bucket}/${Key}` };
    } finally {
      source.unpipe(counter); source.removeListener('error', onError);
      source.destroy(); counter.destroy();
    }
  }
  uploadLocalFile(local: string, name: string) { return this.uploadStream(name, fs.createReadStream(local)); }
  async downloadStream(name: string): Promise<Readable> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key(name) }));
    if (!(result.Body instanceof Readable)) throw new Error('S3 returned no readable body');
    return result.Body;
  }
  async listBackups(directory?: string): Promise<BackupFileInfo[]> {
    const prefix = directory ? this.key(directory).replace(/\/$/, '') : this.prefix;
    const files: BackupFileInfo[] = [];
    let ContinuationToken: string | undefined;
    do {
      const result = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket,
        Prefix: prefix ? prefix + '/' : '', ContinuationToken }));
      for (const item of result.Contents || []) {
        if (item.Key && !item.Key.endsWith('/')) files.push({
          filename: item.Key.split('/').pop()!, fullPath: `s3://${this.bucket}/${item.Key}`,
          sizeBytes: item.Size || 0, modifiedAt: item.LastModified || new Date(0)
        });
      }
      ContinuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (ContinuationToken);
    return files.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
  }
  async deleteFile(name: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(name) }));
    return true;
  }
  async getFreeSpace() { return { totalBytes: 0, freeBytes: 0 }; }
}
