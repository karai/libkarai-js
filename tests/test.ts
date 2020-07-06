import { Channel, KeyRing, Utils } from "../src/index";

const keyring = new KeyRing(":memory:");
const channel = new Channel("zeus.karai.io:4200", keyring, false);

const checks: Record<string, boolean> = {
  channelReady: false,
  keyringReady: false,
  retrieveTransactions: false,
};

setTimeout(() => {
  let checksFailed = false;

  for (const key in checks) {
    if (!checks[key]) {
      console.log(key + ": failed ❌");
      checksFailed = true;
    }
  }

  if (checksFailed) {
    console.warn("Checks failed.");
    process.exit(1);
  } else {
    console.log("All tests successful.");
    process.exit(0);
  }
}, 5000);

keyring.on("ready", () => {
  console.log("keyring.on('ready'): passed ✔️");
  checks.keyringReady = true;
});

channel.on("ready", async () => {
  console.log("channel.on('ready'): passed ✔️");
  checks.channelReady = true;
  const transactions = await channel.transactions.retrieve();
  if (transactions) {
    console.log("transactions.retrieve(): passed ✔️");
    checks.retrieveTransactions = true;
  }
});
