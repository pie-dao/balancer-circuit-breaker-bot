import BigNumber from 'bignumber.js';
import Table from 'cli-table2';

import discord from '../adapters/discord';

const alertThreshold = BigNumber(process.env.POOL_BALANCE_ALERT_THRESHOLD || '0.2');

let initialized = false;
let balances;
let running = false;
let tokens;

export default async ({
  controllerContract,
  database,
  pool,
}) => {
  if (running) {
    return;
  }
  running = true;
  const address = pool;

  if (!initialized) {
    tokens = await controllerContract.getTokens();
    balances = await Promise.all(tokens.map((token) => database.balance({ address, token })));
    initialized = true;
  }

  const newBalances = await Promise.all(
    tokens.map(
      (token) => database.balance({ address, token }),
    ),
  );
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

  const total = balances.reduce((sum, balance) => sum.plus(balance), BigNumber(0));

  console.log('\n\npool balances\n--------');
  const payload = await Promise.all(tokens.map(async (token, index) => {
    const { symbol } = await database.contract(token);

    return [
      symbol,
      token,
      shifts[token],
      balances[index].toFixed(5),
      balances[index].dividedBy(total).multipliedBy(100).toFixed(2),
    ];
  }));
  const table = new Table({ style: { head: [], border: [] } });
  table.push(['Symbol', 'Token', 'Change', 'Balance', 'Weight']);
  payload.forEach((record) => { table.push(record); });
  const content = table.toString();
  console.log(content);

  const poolName = await controllerContract.name();
  const poolBalance = total.dividedBy(balances.length).toFixed(5);

  if (pushToDiscord) {
    discord(`${poolName} pool balance changed - total: ${poolBalance}\n\`\`\`${content}\`\`\``);
  }

  running = false;
};
