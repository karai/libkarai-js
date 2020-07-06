# libkarai-js

Quickstart usage:

```ts
import { Channel, KeyRing } from "libkarai";

const keyring = new KeyRing("./keyring");
const channel = new Channel("ws://zeus.karai.io:4200", keyring);

// If you want to perform operations with the keyring, wait for the ready event.
keyring.on("ready", () => {
  const signed = keyring.sign(keyring.getPub());
  const verified = keyring.verify(keyring.getPub(), signed, keyring.getPub());

  if (verified) {
    console.log("The signature is verified!");
  }
});

keyring.on("error", (error: Error) => {
  // do something with the error
});

// the channel will automatically wait for the keyring ready event
// of the keyring it is passed.
channel.on("ready", async () => {
  console.log("Channel is connected!");
  console.log("Channel info: ", channel.info());

  const transactions = await channel.transactions.retrieve();
  console.log(transactions.length + " Transactions found.");

  const coordinatorInfo = await channel.coordinator.info();
  console.log("Coordinator info: ", coordinatorInfo);
});

channel.on("error", (error: Error) => {
  // do something with the error
});
```
