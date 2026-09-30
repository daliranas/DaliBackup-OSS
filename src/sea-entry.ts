import path from 'path';
import { isSea } from 'node:sea';

if (isSea()) {
  // Resolve .env and all relative repository paths from the executable's home,
  // independently of the directory from which Windows started the process.
  process.chdir(path.dirname(process.execPath));
}

require('./server');
