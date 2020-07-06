import { Channel, KeyRing, Utils } from "../src/index";
const chalk = require("../node_modules/chalk/source/index");

const keyring = new KeyRing(":memory:");
const channel = new Channel("zeus.karai.io:4200", keyring, false);

function normalizeStr(s: string, length: number) {
  while (s.length < length) {
    s += " ";
  }

  return s;
}

const checks: Record<string, boolean> = {
  channelReady: false,
  keyringReady: false,
  retrieveTransactions: false,
};

setTimeout(() => {
  let checksFailed = false;

  for (const key in checks) {
    if (!checks[key]) {
      console.log(key + ": failed " + chalk.red.bold("❌"));
      checksFailed = true;
    }
  }

  if (checksFailed) {
    console.warn(chalk.red.bold("Checks failed."));
    process.exit(1);
  } else {
    console.log(chalk.green.bold("All tests successful."));
    process.exit(0);
  }
}, 5000);

keyring.on("ready", () => {
  console.log(
    normalizeStr('keyring.on("ready"):', 28) +
      normalizeStr("passed", 8) +
      chalk.green.bold("✔️")
  );
  checks.keyringReady = true;
});

channel.on("ready", async () => {
  console.log(
    normalizeStr('channel.on("ready"):', 28) +
      normalizeStr("passed", 8) +
      chalk.green.bold("✔️")
  );
  checks.channelReady = true;
  const transactions = await channel.transactions.retrieve();
  if (transactions) {
    console.log(
      normalizeStr("transactions.retrieve():", 28) +
        normalizeStr("passed", 8) +
        chalk.green.bold("✔️")
    );
    checks.retrieveTransactions = true;
  }
});
