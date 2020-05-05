import BigNumber from 'bignumber.js';

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
      console.log('ALERT!!!', tokens[index], 'shift exceeds alert threshold');
    }
    if (!diff.isZero()) {
      pushToDiscord = true;
    }
    shifts[tokens[index]] = `${percentageShift.multipliedBy(100).toFixed(2)}%`;
  });

  balances = newBalances;

  console.log('\n\npool balances\n--------');
  console.table(shifts);

  if (pushToDiscord) {
    let message = `${await controllerContract.name()} pool balance change:
\`\`\`
┌────────────────────────────────────────────┬─────────┬─────────┐
│               TOKEN ADDRESS                │ CHANGE  │ BALANCE │
├────────────────────────────────────────────┼─────────┼─────────┤`;
    tokens.forEach((token, index) => {
      message += `\n│ ${token} │  ${shifts[token]}  │ ${newBalances[index].toFixed(5)} │`;
    });
    message += '\n└────────────────────────────────────────────┴─────────┴─────────┘\n```';
    discord(message);
  }

  running = false;
};
