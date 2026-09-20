import dotenv from 'dotenv';
if (process.env.NODE_ENV) {
  dotenv.config({ override: true, path: `.env.${process.env.NODE_ENV}` });
}

import fs from 'node:fs';
import { readdir } from 'node:fs/promises';
import { GridFSBucket } from 'mongodb';

import logger from '../utils/logger.js';
import db, { getClient } from '../utils/dbUtil.js';
import initializeDatabase from '../utils/dbMigrationUtil.js';

const sampleFolder = process.argv[2] || 'ins';

// mongodb에 GridFS를 이용한 이미지 저장
async function uploadFileToGridFS(filePath, fileName) {
  return new Promise((resolve, reject) => {
    try {
      const bucket = new GridFSBucket(db, {
        bucketName: 'upload'
      });
  
      const uploadStream = bucket.openUploadStream(fileName);
      const fileStream = fs.createReadStream(filePath);
  
      fileStream.on('data', (chunk) => {
        uploadStream.write(chunk);
      });
      
      fileStream.on('end', () => {
        uploadStream.end(() => {
          logger.log('파일 업로드: ', fileName);
          resolve();
        });
      });
    } catch (err) {
      logger.error(err);
      reject();
    }
  });
  
}

async function initDB(initData) {
  // 데이터 등록
  for(const collection in initData){
    const data = initData[collection];
    if(data.length > 0){
      await db[collection].insertMany(data);
    }
    logger.debug(`${collection} ${data.length}건 등록.`);
  }

  // 이미지 등록
  const sampleFileFolder = `./samples/${sampleFolder}/uploadFiles`;
  const files = await readdir(sampleFileFolder);
  for(const fileName of files){
    await uploadFileToGridFS(`${sampleFileFolder}/${fileName}`, fileName);
  }
}

await db.dropDatabase();
logger.info('DB 삭제.');

import(`./${sampleFolder}/dbinit-data.js`).then(async ({ initData }) => {
  await initDB(initData);
  // dbUtil 초기화 뒤 dropDatabase()를 실행하므로, 새 sample 데이터에도
  // 위치 백필과 인덱스를 다시 적용한 다음 연결을 닫는다.
  await initializeDatabase(db);
  getClient().close();
  logger.info('DB 초기화 완료.');
});

