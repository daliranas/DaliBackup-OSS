import path from 'path';
import { isSea } from 'node:sea';

// A standalone executable keeps mutable state beside the .exe.  The source
// and Docker distributions retain their existing repository-relative path.
export const dataDirectory = process.env.DALIBACKUP_DATA_DIR
  ? path.resolve(process.env.DALIBACKUP_DATA_DIR)
  : isSea()
    ? path.join(path.dirname(process.execPath), 'data')
    : path.join(__dirname, '../../data');
