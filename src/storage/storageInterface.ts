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
import { Readable } from 'stream';

export interface StorageConfig {
  id: string;
  name: string;
  type: 'NFS' | 'SFTP' | 'FTP';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  private_key?: string;
  remote_path: string;
}

export interface BackupFileInfo {
  filename: string;
  fullPath: string;
  sizeBytes: number;
  modifiedAt: Date;
}

export interface IStorageProvider {
  testConnection(): Promise<{ success: boolean; message: string; freeSpaceBytes?: number }>;
  uploadStream(remoteFilePath: string, readStream: Readable): Promise<{ bytesWritten: number; path: string }>;
  uploadLocalFile(localFilePath: string, remoteFilePath: string): Promise<{ bytesWritten: number; path: string }>;
  downloadStream(remoteFilePath: string): Promise<Readable>;
  listBackups(directoryPath?: string): Promise<BackupFileInfo[]>;
  deleteFile(remoteFilePath: string): Promise<boolean>;
  getFreeSpace(): Promise<{ totalBytes: number; freeBytes: number }>;
}
