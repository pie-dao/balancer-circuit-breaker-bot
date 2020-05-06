import ws from 'ws';

import { BlockchainDatabase } from '@pie-dao/blockchain';
import { ethers } from 'ethers';
import { pieSmartPool } from '@pie-dao/abis';

import poolBalances from './checks/poolBalances';
import tokenSupply from './checks/tokenSupply';

const checks = [poolBalances, tokenSupply];

const blocknativeDappId = '523b279d-0fe0-42e8-8977-e688c3686e57';
const database = new BlockchainDatabase({ blocknativeDappId, ws });

const controller = '0x0327112423F3A68efdF1fcF402F6c5CB9f7C33fd'.toLowerCase();

let checkPid;
let controllerContract;
let pool;

const main = async () => {
  controllerContract = new ethers.Contract(controller, pieSmartPool, database.provider);
  pool = await controllerContract.getBPool();

  console.log('Initialized - (token:', controller, ', pool:', pool, ')');

  const payload = {
    controller,
    controllerContract,
    database,
    pool,
  };

  database.provider.on('block', async (block) => {
    const {
      difficulty,
      hash,
      miner,
      nonce,
      number,
      timestamp,
    } = await database.provider.getBlock(block);
    console.log('\n\nNew Block\n-------');
    console.table({
      difficulty,
      hash,
      miner,
      nonce,
      number,
      timestamp,
    });
    clearTimeout(checkPid);
    checkPid = setTimeout(() => {
      checks.forEach((check) => { check(payload); });
    }, 5000);
  });

  setInterval(() => { console.log((new Date()).toString()); }, 60000);
};

main();
