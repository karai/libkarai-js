/////////////////////////////////////////////
//
// Copyright 2020, The TurtleCoin Developers
//
/////////////////////////////////////////////

import { Channel } from "./Channel";
import { KeyRing } from "./KeyRing";

const keyring = new KeyRing("./keyring2");
const channel = new Channel("ws://zeus.karai.io:4200", keyring);

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
