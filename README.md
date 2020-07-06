# libkarai-js

A library to interact with karai channels in javascript.

This library provides three exported classes.

- KeyRing class, which contains a pair of ed25519 keys and sign / verify methods
- Channel class, which you can use to interact with a channel
- Utils class, which contains a couple useful type conversion functions

## Install

```
yarn add libkarai-js
```

## Quickstart

```ts
import { Channel, KeyRing, Utils } from "libkarai";

const keyring = new KeyRing("./keyring");
const channel = new Channel("ws://zeus.karai.io:4200", keyring);

channel.on("ready", async () => {
  console.log("Channel info: ", channel.info());
  console.log("My public key is " + Utils.toHexString(keyring.getPub()));
});

channel.on("error", (error: Error) => {
  // do something with the error
});
```
