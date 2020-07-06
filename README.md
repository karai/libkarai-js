# libkarai-js

A library to interact with karai channels in javascript.

This library provides three exported classes. First, KeyRing, which you will initialize before the channel. This will contain your public and private keys as well as signing and verifying methods. Second, the Channel class will be initialized which takes the keyring as an argument. Third, there is a Utils class that contains some useful functions for converting between hex string and Uint8 array types.

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
