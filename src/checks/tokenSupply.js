import BigNumber from 'bignumber.js';
import Table from 'cli-table2';

import discord from '../adapters/discord';

const alertThreshold = BigNumber(process.env.TOKEN_SUPPLY_ALERT_THRESHOLD || '0.1');

let initialized = false;
let balances;
let contracts;
let running = false;
let tokens;

const fetchSupply = async ({ contract, decimals }) => {
  const supply = await contract.totalSupply();
  return BigNumber(supply.toString()).dividedBy(10 ** decimals);
};

export default async ({
  controllerContract,
  database,
}) => {
  if (running) {
    return;
  }
  running = true;
  if (!initialized) {
    tokens = await controllerContract.getTokens();
    contracts = await Promise.all(tokens.map((token) => database.contract(token)));
    balances = await Promise.all(contracts.map(fetchSupply));
    initialized = true;
  }

  const newBalances = await Promise.all(contracts.map(fetchSupply));
  const diffs = newBalances.map((balance, index) => balance.minus(balances[index]));

  const shifts = {};
  let pushToDiscord = false;

  diffs.forEach((diff, index) => {
    const percentageShift = diff.dividedBy(balances[index]);
    if (alertThreshold.isLessThan(percentageShift)) {
      const message = `${tokens[index].toString()} shift exceeds alert threshold`;
      console.log(message);
      discord(message, true);
    }
    if (!diff.isZero()) {
      pushToDiscord = true;
    }
    shifts[tokens[index]] = `${percentageShift.multipliedBy(100).toFixed(2)}%`;
  });

  balances = newBalances;

  console.log('\n\ntoken total supplies\n--------');
  const payload = await Promise.all(tokens.map(async (token, index) => {
    const { symbol } = contracts[index];

    return [
      symbol,
      token,
      shifts[token],
      balances[index].toFixed(5),
    ];
  }));
  const table1 = new Table({ style: { head: [], border: [] } });
  const table2 = new Table({ style: { head: [], border: [] } });
  table1.push(['Symbol', 'Token', 'Change', 'Supply']);
  table2.push(['Symbol', 'Token', 'Change', 'Supply']);
  payload.forEach((record, index) => {
    table1.push(record);
    if (!diffs[index].isZero()) {
      table2.push(record);
    }
  });
  console.log(table1.toString());

  const poolName = await controllerContract.name();

  if (pushToDiscord) {
    const msg = `${poolName} underlying token total supply change detected:`;
    discord(`${msg}\n\`\`\`${table2.toString()}\`\`\``);
  }

  running = false;
};
