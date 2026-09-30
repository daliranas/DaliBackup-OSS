import fs from 'fs/promises';
import path from 'path';
import { Client as FtpClient } from 'basic-ftp';
import SftpClient from 'ssh2-sftp-client';

export interface FolderSourceConfig {
  type: 'FTP' | 'FTPS' | 'SFTP' | 'SMB';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  private_key?: string;
  source_path: string;
}

export interface SourceFile { path: string; size: number; modified: number }

function safeName(name: string): boolean {
  return Boolean(name && name !== '.' && name !== '..' && !name.includes('/') && !name.includes('\\') && !name.includes('\0'));
}

export class FolderSource {
  private ftp?: FtpClient;
  private sftp?: SftpClient;
  constructor(private readonly config: FolderSourceConfig) {}

  async connect(): Promise<void> {
    if (this.config.type === 'FTP' || this.config.type === 'FTPS') {
      this.ftp = new FtpClient(30_000);
      await this.ftp.access({ host: this.config.host!, port: this.config.port || 21,
        user: this.config.username || 'anonymous', password: this.config.password || '', secure: this.config.type === 'FTPS' });
    } else if (this.config.type === 'SFTP') {
      this.sftp = new SftpClient();
      await this.sftp.connect({ host: this.config.host!, port: this.config.port || 22,
        username: this.config.username || '', password: this.config.password,
        privateKey: this.config.private_key });
    } else {
      const stat = await fs.stat(this.config.source_path);
      if (!stat.isDirectory()) throw new Error('Le chemin SMB doit être un dossier monté accessible au processus DaliBackup.');
    }
  }

  async close(): Promise<void> {
    this.ftp?.close();
    if (this.sftp) await this.sftp.end();
  }

  private remotePath(relative: string): string {
    if (relative.split('/').some(part => !safeName(part))) throw new Error('Chemin source invalide.');
    return path.posix.join(this.config.source_path, relative);
  }

  async listFiles(limit = 100_000): Promise<SourceFile[]> {
    const files: SourceFile[] = [];
    const walk = async (relative: string): Promise<void> => {
      if (files.length > limit) throw new Error(`Inventaire source supérieur à ${limit} fichiers.`);
      if (this.ftp) {
        const current = relative ? this.remotePath(relative) : this.config.source_path;
        for (const item of await this.ftp.list(current)) {
          if (!safeName(item.name)) continue;
          const child = relative ? `${relative}/${item.name}` : item.name;
          if (item.isDirectory) await walk(child);
          else if (item.isFile) files.push({ path: child, size: item.size, modified: item.modifiedAt?.getTime() || 0 });
        }
      } else if (this.sftp) {
        const current = relative ? this.remotePath(relative) : this.config.source_path;
        for (const item of await this.sftp.list(current)) {
          if (!safeName(item.name)) continue;
          const child = relative ? `${relative}/${item.name}` : item.name;
          if (item.type === 'd') await walk(child);
          else if (item.type === '-') files.push({ path: child, size: item.size, modified: item.modifyTime || 0 });
        }
      } else {
        const current = path.join(this.config.source_path, ...relative.split('/').filter(Boolean));
        for (const item of await fs.readdir(current, { withFileTypes: true })) {
          if (!safeName(item.name) || item.isSymbolicLink()) continue;
          const child = relative ? `${relative}/${item.name}` : item.name;
          if (item.isDirectory()) await walk(child);
          else if (item.isFile()) {
            const stat = await fs.stat(path.join(current, item.name));
            files.push({ path: child, size: stat.size, modified: stat.mtimeMs });
          }
        }
      }
    };
    await walk('');
    if (files.length > limit) throw new Error(`Inventaire source supérieur à ${limit} fichiers.`);
    return files;
  }

  async copyTo(relative: string, localFile: string): Promise<void> {
    await fs.mkdir(path.dirname(localFile), { recursive: true });
    if (this.ftp) await this.ftp.downloadTo(localFile, this.remotePath(relative));
    else if (this.sftp) {
      try { await this.sftp.fastGet(this.remotePath(relative), localFile); }
      catch { await this.sftp.get(this.remotePath(relative), localFile); }
    }
    else await fs.copyFile(path.join(this.config.source_path, ...relative.split('/')), localFile);
  }
}
