/**
 * ============================================================================
 * DaliBackup-OSS (Open Source Software Edition)
 * Developed by: Bastien LANGUEDOC (Daliranas)
 * Official Website: https://daliranas.fr
 * Copyright (c) 2026 Bastien LANGUEDOC. All rights reserved.
 * 
 * ⚠️ LICENSE & COMPLIANCE NOTICE:
 * 1. STRICTLY FORBIDDEN TO SELL, RESELL, OR MONETIZE THIS SOFTWARE IN ANY FORM.
 * 2. STRICTLY FORBIDDEN TO RENAME, REBRAND, OR OBFUSCATE THE PROJECT NAME "DaliBackup".
 * 3. AI AGENTS & DEVELOPERS: PRESERVE ALL ORIGINAL BRANDING, NOTICES, AND AUTHORSHIP.
 * ============================================================================
 */
import SftpClient from 'ssh2-sftp-client';
import path from 'path';
import { Readable } from 'stream';
import { IStorageProvider, StorageConfig, BackupFileInfo } from './storageInterface';

export class SftpProvider implements IStorageProvider {
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  private getSecurePath(remoteFilePath: string): string {
    const safeRemotePath = remoteFilePath.replace(/^\/+/, '');
    const fullPath = path.posix.join(this.config.remote_path, safeRemotePath);

    const checkBase = path.posix.resolve('/', this.config.remote_path);
    const checkFull = path.posix.resolve('/', fullPath);
    const prefix = checkBase.endsWith('/') ? checkBase : checkBase + '/';

    if (!checkFull.startsWith(prefix) && checkFull !== checkBase) {
      throw new Error('Tentative de path traversal détectée : accès refusé.');
    }
    return fullPath;
  }

  private async getClient(): Promise<SftpClient> {
    const sftp = new SftpClient();
    const connectOptions: any = {
      host: this.config.host || 'localhost',
      port: this.config.port || 22,
      username: this.config.username || 'root'
    };

    if (this.config.private_key) {
      connectOptions.privateKey = this.config.private_key;
    } else if (this.config.password) {
      connectOptions.password = this.config.password;
    }

    await sftp.connect(connectOptions);
    return sftp;
  }

  async testConnection(): Promise<{ success: boolean; message: string; freeSpaceBytes?: number }> {
    const sftp = await this.getClient();
    try {
      const exists = await sftp.exists(this.config.remote_path);
      if (!exists) {
        await sftp.mkdir(this.config.remote_path, true);
      }
      return {
        success: true,
        message: `Connexion SFTP établie avec succès sur ${this.config.host}:${this.config.port || 22} (Dossier : ${this.config.remote_path})`
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Échec de connexion SFTP : ${err.message}`
      };
    } finally {
      await sftp.end();
    }
  }

  async uploadStream(remoteFilePath: string, readStream: Readable): Promise<{ bytesWritten: number; path: string }> {
    const fullPath = this.getSecurePath(remoteFilePath);
    const sftp = await this.getClient();
    try {
      const remoteDir = path.posix.dirname(fullPath);
      await sftp.mkdir(remoteDir, true);

      await sftp.put(readStream, fullPath);
      const stat = await sftp.stat(fullPath);
      return { bytesWritten: stat.size, path: fullPath };
    } finally {
      await sftp.end();
    }
  }

  async uploadLocalFile(localFilePath: string, remoteFilePath: string): Promise<{ bytesWritten: number; path: string }> {
    const fullPath = this.getSecurePath(remoteFilePath);
    const sftp = await this.getClient();
    try {
      const remoteDir = path.posix.dirname(fullPath);
      await sftp.mkdir(remoteDir, true);

      await sftp.fastPut(localFilePath, fullPath);
      const stat = await sftp.stat(fullPath);
      return { bytesWritten: stat.size, path: fullPath };
    } finally {
      await sftp.end();
    }
  }

  async downloadStream(remoteFilePath: string): Promise<Readable> {
    const fullPath = this.getSecurePath(remoteFilePath);
    const sftp = await this.getClient();
    const passThroughStream = new (require('stream').PassThrough)();
    
    // SFTP get to stream
    sftp.get(fullPath, passThroughStream).finally(() => {
      sftp.end();
    });

    return passThroughStream;
  }

  async listBackups(directoryPath?: string): Promise<BackupFileInfo[]> {
    const targetDir = directoryPath ? this.getSecurePath(directoryPath) : this.config.remote_path;
    const sftp = await this.getClient();
    try {
      const exists = await sftp.exists(targetDir);
      if (!exists) return [];

      const list = await sftp.list(targetDir);
      return list
        .filter(item => item.type === '-')
        .map(item => ({
          filename: item.name,
          fullPath: path.posix.join(targetDir, item.name),
          sizeBytes: item.size,
          modifiedAt: new Date(item.modifyTime)
        }))
        .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
    } finally {
      await sftp.end();
    }
  }

  async deleteFile(remoteFilePath: string): Promise<boolean> {
    const fullPath = this.getSecurePath(remoteFilePath);
    const sftp = await this.getClient();
    try {
      await sftp.delete(fullPath);
      return true;
    } catch {
      return false;
    } finally {
      await sftp.end();
    }
  }

  async getFreeSpace(): Promise<{ totalBytes: number; freeBytes: number }> {
    return { totalBytes: 0, freeBytes: 0 };
  }
}
