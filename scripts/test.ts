import { Channel, KeyRing, Utils } from "../src/index";

const keyring = new KeyRing("./keyring");
const channel = new Channel("ws://zeus.karai.io:4200", keyring);

channel.on("ready", async () => {
  // do something with the channel
  console.log(await channel.transactions.retrieve());
});
