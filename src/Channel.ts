import ax from "axios";
import { EventEmitter } from "events";
import fs from "fs";
import WebSocket from "ws";
import { KeyRing } from "./KeyRing";
import { Utils } from "./Utils";
import { sleep } from "./utils/sleep";
import { toHexString } from "./utils/typeHelpers";

interface ISubscription {
  type: string;
  // tslint:disable-next-line: ban-types
  callback: Function;
}

interface ITransactions {
  /**
   * Retrieves the transactions in the channel.
   *
   * @returns - The connected coordinator Peer ID.
   */
  retrieve: () => Promise<any[]>;
}

/**
 * The Channel provides an interface that allows you to perform actions on karai channels.
 *
 * @noInheritDoc
 */
export class Channel extends EventEmitter {
  /**
   * Transactions contains the methods for interacting with transactions.
   */
  public transactions: ITransactions;
  public coordinator: {
    info: () => any;
  };
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

  public info(): any {
    return {
      cert: toHexString(this.keyRing.getCert()!),
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

  private subscribe(type: string, callback: (msg: string) => void) {
    this.subscription = { type, callback };
  }

  private initWS() {
    const endpoint = "/api/v1/channel";
    const ws = new WebSocket(`${this.host!}${endpoint}`);

    ws.on("message", (msg: string) => {
      if (this.subscription) {
        this.subscription.callback(msg);
        this.subscription = null;
      }
    });

    ws.on("open", async () => {
      if (this.keyRing!.getCert() == null) {
        this.subscribe("JOIN", (msg: string) => {
          this.signedPubKey = msg;
        });
        this.sendMessage(`JOIN`, Utils.toHexString(this.keyRing!.getPub()));

        let timeout = 1;
        while (this.subscription) {
          await sleep(timeout);
          timeout *= 2;
        }
        timeout = 1;

        this.subscribe("PUBK", (msg: string) => {
          this.serverPubKey = msg;
        });
        this.sendMessage("PUBK");

        timeout = 1;
        while (this.subscription) {
          await sleep(timeout);
          timeout *= 2;
        }
        timeout = 1;

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
            fs.writeFileSync(`${this.keyRing.getKeyFolder()}/cert`, data, {
              encoding: "utf-8",
            });
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
            throw new Error("Unexpected server response: " + msg);
          } else {
            this.clientID = parts[2];
          }
        });
        this.sendMessage(`JOIN`, Utils.toHexString(this.keyRing!.getPub()));

        let timeout = 1;
        while (this.subscription) {
          await sleep(timeout);
          timeout *= 2;
        }
        timeout = 1;

        this.subscribe("PUBK", (msg: string) => {
          this.serverPubKey = msg;
        });
        this.sendMessage("PUBK");

        timeout = 1;
        while (this.subscription) {
          await sleep(timeout);
          timeout *= 2;
        }
        timeout = 1;

        this.emit("ready");
      }
    });

    this.ws = ws;
  }

  private async returnCoordPeerID() {
    const endpoint = "/api/v1/peer";
    const res = await ax.get(`${this.host}${endpoint}`);
    if (!res.data || !res.data.p2p_peer_ID) {
      console.error(res);
      throw new Error("Unexpected response from " + endpoint);
    } else {
      return res.data.p2p_peer_ID;
    }
  }

  private async returnChannelTransactions() {
    console.log(this.host);

    const endpoint = "/api/v1/transactions";
    const res = await ax.get(`${this.host}${endpoint}`);

    return res.data;
  }

  private async checkOnline() {
    const endpoint = "/api/v1/version";
    const res = await ax.get(`${this.host}${endpoint}`);
    if (!res.data) {
      throw new Error("Coordinator is not online!");
    } else {
      this.coordVersion = res.data.karai_version;
    }
  }

  private async sendMessage(type: string, data: string = "") {
    if (!this.ws) {
      throw new Error("Can't call this until the ready event is emitted!");
    } else {
      this.getWS().send(type + " " + data);
    }
  }

  private async init() {
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
}
