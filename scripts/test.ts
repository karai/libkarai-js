import { Channel, KeyRing, Utils } from "../src/index";

const keyring = new KeyRing("./keyring");
const channel = new Channel("ws://zeus.karai.io:4200", keyring);

keyring.on("ready", () => {
  console.log("Keyring initialized!");
});

channel.on("ready", async () => {
  // do something with the channel
  const transactions = await channel.transactions.retrieve();

  for (const tx of transactions) {
    console.log(tx.tx_data);
  }
});
