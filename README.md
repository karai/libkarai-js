# libkarai-js

[![npm version](https://badge.fury.io/js/libkarai-js.svg)](https://badge.fury.io/js/libkarai-js)

A library to interact with karai channels in javascript.

This library provides three exported classes.

- KeyRing class, which contains a pair of ed25519 keys and sign / verify methods
- Channel class, which you can use to interact with a channel
- Utils class, which contains a couple useful type conversion functions

## Install

```
yarn add libkarai-js
```

## Documentation

You can find a link to the documentation [here](https://karai.io/libkarai-js/)

## Quickstart

```ts
import { Channel, KeyRing, Utils } from "libkarai-js";

const keyring = new KeyRing(":memory:");
const channel = new Channel("zeus.karai.io:4200", keyring, false);

channel.on("ready", async () => {
  console.log("Channel info: ", channel.info());
  console.log("My public key is " + Utils.toHexString(keyring.getPub()));
});

channel.on("error", (error) => {
  // do something with the error
});
```
