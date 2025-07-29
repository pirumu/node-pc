import * as fs from 'node:fs';

import { Logger } from '@nestjs/common';
import * as csv from 'csv-parse';

export async function parseCsv(filePath: string, onRow: (row: any) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv.parse({ columns: true, trim: true, escape: '\\' }))
      .on('data', (row) => {
        try {
          Logger.debug('CSV Row:', row);
          onRow(row);
        } catch (err) {
          reject(err);
        }
      })
      .on('error', (err) => {
        reject(err);
      })
      .on('end', () => {
        resolve();
      });
  });
}
