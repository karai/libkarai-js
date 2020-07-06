import { Channel, KeyRing, Utils } from "../src/index";

const keyring = new KeyRing(":memory:");
const channel = new Channel("ws://zeus.karai.io:4200", keyring);

channel.on("ready", async () => {
  // do something with the channel
  const transactions = await channel.transactions.retrieve();

  for (const tx of transactions) {
    console.log(tx.tx_data);
  }
});
