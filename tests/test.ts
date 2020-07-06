import { Channel, KeyRing, Utils } from "../src/index";

const keyring = new KeyRing(":memory:");
const channel = new Channel("ws://zeus.karai.io:4200", keyring);

keyring.on("ready", () => {
  console.log("Keyring initialized!");
});

channel.on("ready", async () => {
  // do something with the channel
  const transactions = await channel.transactions.retrieve();

  console.log("Coordinator initialized!");
});
