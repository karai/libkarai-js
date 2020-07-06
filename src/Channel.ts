import ax from "axios";
import { EventEmitter } from "events";
import fs from "fs";
import WebSocket, { MessageEvent } from "isomorphic-ws";
import { KeyRing } from "./KeyRing";
import { Utils } from "./Utils";

/**
 * The ITransaction interface contains the type for transactions on the
 * karai channel.
 */
interface ITransaction {
  tx_type: number;
  tx_hash: string;
  tx_prev: string;
  tx_data: any[] | string | undefined;
}

/**
 * @ignore
 */
interface ISubscription {
  type: string;
  // tslint:disable-next-line: ban-types
  callback: Function;
}

/**
 * The IChannelinfo interface contains the type for the channel.info() response.
 */
interface IChannelInfo {
  cert: string;
  clientID: string;
  host: string;
}

/**
 * The ICoordinatorInfo interface contains the type for the channel.coordinator.info() response.
 */
interface ICoordinatorInfo {
  peerID: string | null;
  pubKey: string | null;
  version: string | null;
}

/**
 * The ICoordinator interface contains the methods for dealing with the coordinator.
 */
interface ICoordinator {
  /**
   * Retrieves the transactions in the channel.
   *
   * @returns - The coordinator info
   */
  info: () => ICoordinatorInfo;
}

/**
 * The ITransactions interface contains methods for dealing with transactions.
 */
interface ITransactions {
  /**
   * Retrieves the transactions in the channel.
   *
   * @returns - The channel transactions as an array.
   */
  retrieve: () => Promise<ITransaction[]>;
}

/**
 * The Channel provides an interface that allows you to perform actions on karai channels.
 *
 * The Channel class requires a keyring as a parameter for the constructor, so you'll have to create
 * a keyring first.
 *
 * You must listen for the `ready` event before doing anything with the channel.
 *
 * ## Example Usage:
 * ```ts
 * import { Channel, KeyRing, Utils } from 'libkarai-js';
 *
 * const keyring = new KeyRing("./keyring");
 * const channel = new Channel("ws://zeus.karai.io:4200", keyring);
 *
 * channel.on("ready", async () => {
 *   console.log("Channel info: ", channel.info());
 *   console.log("My public key is " + Utils.toHexString(keyring.getPub()));
 * });
 *
 * channel.on("error", async (error) => {
 *   // handle the error
 * });
 *
 * ```
 * @noInheritDoc
 */

// tslint:disable-next-line: interface-name
export declare interface Channel {
  /**
   * This is emitted whenever the channel finishes the handshake process. You must
   * wait for it to do any channel operations.
   *
   * Example:
   *
   * ```ts
   * channel.on('ready', async () => {
   *     // do something with the channel
   *     const transactions = await channel.transactions.retrieve();
   * });
   * ```
   *
   * @event
   */
  on(event: "ready", callback: () => void): this;

  /**
   * This is emitted whenever the keyring experiences an error initializing.
   *
   * Example:
   *
   * ```ts
   *
   *   keyring.on("error", (error: Error) => {
   *     // do something with the error
   *   });
   * ```
   *
   * @event
   */
  on(event: "error", callback: (error: Error) => void): this;
}

export class Channel extends EventEmitter {
  /**
   * The transactions object contains the methods for interacting with transactions.
   */
  public transactions: ITransactions;
  /**
   * The coordinator object contains the methods for interacting with the coordinator.
   */
  public coordinator: ICoordinator;

  private host: string;
  private keyRing: KeyRing;
  private ws: WebSocket | null;
  private subscription: ISubscription | null;
  private signedPubKey: string | null;
  private serverPubKey: string | null;
  private clientID: string | null;
  private coordID: string | null;
  private coordVersion: string | null;

  /**
   * @param host The url of the host.
   *
   * @param keyRing  A KeyRing object to use.
   *
   */
  constructor(host: string, keyRing: KeyRing) {
    super();
    console.log(host);
    this.host = host;
    this.keyRing = keyRing;
    this.subscription = null;
    this.ws = null;
    this.clientID = null;
    this.serverPubKey = null;
    this.coordID = null;
    this.coordVersion = null;
    this.signedPubKey = null;
    this.coordVersion = null;

    this.transactions = {
      retrieve: this.returnChannelTransactions.bind(this),
    };

    this.coordinator = {
      info: this.retrieveCoord.bind(this),
    };

    this.init();
  }

  /**
   * Get the channel info.
   *
   * @returns - The info of the connected channel.
   */
  public info(): IChannelInfo {
    return {
      cert: Utils.toHexString(this.keyRing.getCert()!),
      clientID: this.getClientID(),
      host: this.getHost(),
    };
  }

  /**
   * Get the coordinator peer ID.
   *
   * @returns - The connected coordinator Peer ID.
   */
  private getCoordID(): string {
    return this.coordID!;
  }

  /**
   * Get the client ID.
   *
   * @returns - The current client ID issued from the coordinator.
   */

  private getClientID(): string {
    return this.clientID!;
  }

  /**
   * Get the host URL / IP.
   *
   * @returns - The coordinator's hostname / IP.
   */

  private getHost(): string {
    return this.host;
  }

  private retrieveCoord() {
    return {
      peerID: this.getCoordID(),
      pubKey: this.serverPubKey,
      version: this.coordVersion,
    };
  }

  private getWS(): WebSocket {
    if (!this.ws) {
      throw new Error("Websocket not yet initiated, can't get it.");
    } else {
      return this.ws;
    }
  }

  private subscribe(type: string, callback: (msg: string) => void): void {
    this.subscription = { type, callback };
  }

  private initWS(): void {
    const endpoint = "/api/v1/channel";
    const ws = new WebSocket(`${this.host!}${endpoint}`);

    ws.onmessage = (event: MessageEvent) => {
      if (this.subscription) {
        this.subscription.callback(event.data);
        this.subscription = null;
      }
    };

    ws.onopen = async () => {
      if (this.keyRing!.getCert() == null) {
        this.subscribe("JOIN", (msg: string) => {
          this.signedPubKey = msg;
        });
        this.sendMessage(`JOIN`, Utils.toHexString(this.keyRing!.getPub()));
        await this.untilReceived();

        this.subscribe("PUBK", (msg: string) => {
          this.serverPubKey = msg;
        });
        this.sendMessage("PUBK");
        await this.untilReceived();

        if (
          this.keyRing!.verify(
            this.keyRing!.getPub(),
            Utils.fromHexString(this.signedPubKey!),
            Utils.fromHexString(this.serverPubKey!)
          )
        ) {
          const signed = this.keyRing!.sign(this.keyRing!.getPub());

          this.subscribe("NSIG", (msg: string) => {
            const [type, data] = msg.split(" ");
            if (type !== "CERT") {
              throw new Error("Invalid message from server: " + data);
            }
            this.keyRing.setCert(Utils.fromHexString(data));
            ws.close();
            this.init();
          });
          this.sendMessage("NSIG", Utils.toHexString(signed));
        } else {
          throw new Error("Bad signature from coordinator");
        }
      } else {
        this.subscribe("JOIN", (msg: string) => {
          const parts = msg.split(" ");
          if (parts[0] !== "Welcome") {
            throw new Error("Unexpected coordinator response: " + msg);
          } else {
            this.clientID = parts[2];
          }
        });
        this.sendMessage("JOIN", Utils.toHexString(this.keyRing!.getPub()));
        await this.untilReceived();

        this.subscribe("PUBK", (msg: string) => {
          this.serverPubKey = msg;
        });
        this.sendMessage("PUBK");
        await this.untilReceived();

        this.emit("ready");
      }
    };

    this.ws = ws;
  }

  private async returnCoordPeerID(): Promise<string> {
    const endpoint = "/api/v1/peer";
    const res = await ax.get(`${this.host}${endpoint}`);
    if (!res.data || !res.data.p2p_peer_ID) {
      console.error(res);
      throw new Error("Unexpected response from " + endpoint);
    } else {
      return res.data.p2p_peer_ID;
    }
  }

  private async returnChannelTransactions(): Promise<ITransaction[]> {
    const endpoint = "/api/v1/transactions";
    const res = await ax.get(`${this.host}${endpoint}`);

    return res.data;
  }

  private async checkOnline(): Promise<void> {
    const endpoint = "/api/v1/version";
    const res = await ax.get(`${this.host}${endpoint}`);
    if (!res.data) {
      throw new Error("Coordinator is not online!");
    } else {
      this.coordVersion = res.data.karai_version;
    }
  }

  private async sendMessage(type: string, data: string = ""): Promise<void> {
    if (!this.ws) {
      throw new Error(
        "Can't call this untilReceived the ready event is emitted!"
      );
    } else {
      this.getWS().send(type + " " + data);
    }
  }

  private async init(): Promise<void> {
    try {
      this.keyRing.init();
      // check if the coordinator is online
      await this.checkOnline();
      this.coordID = await this.returnCoordPeerID();
      this.initWS();
    } catch (err) {
      this.emit("error", err);
    }
  }

  private async untilReceived() {
    let timeout = 1;
    while (this.subscription !== null) {
      await Utils.sleep(timeout);
      timeout *= 2;
    }
  }
}
