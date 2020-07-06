var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import ax from "axios";
import { EventEmitter } from "events";
import WebSocket from "isomorphic-ws";
import { Utils } from "./Utils";
export class Channel extends EventEmitter {
    /**
     * @param host The url of the host.
     *
     * @param keyRing  A KeyRing object to use.
     *
     */
    constructor(host, keyRing) {
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
    info() {
        return {
            cert: Utils.toHexString(this.keyRing.getCert()),
            clientID: this.getClientID(),
            host: this.getHost(),
        };
    }
    /**
     * Get the coordinator peer ID.
     *
     * @returns - The connected coordinator Peer ID.
     */
    getCoordID() {
        return this.coordID;
    }
    /**
     * Get the client ID.
     *
     * @returns - The current client ID issued from the coordinator.
     */
    getClientID() {
        return this.clientID;
    }
    /**
     * Get the host URL / IP.
     *
     * @returns - The coordinator's hostname / IP.
     */
    getHost() {
        return this.host;
    }
    retrieveCoord() {
        return {
            peerID: this.getCoordID(),
            pubKey: this.serverPubKey,
            version: this.coordVersion,
        };
    }
    getWS() {
        if (!this.ws) {
            throw new Error("Websocket not yet initiated, can't get it.");
        }
        else {
            return this.ws;
        }
    }
    subscribe(type, callback) {
        this.subscription = { type, callback };
    }
    initWS() {
        const endpoint = "/api/v1/channel";
        const ws = new WebSocket(`${this.host}${endpoint}`);
        ws.onmessage = (event) => {
            if (this.subscription) {
                this.subscription.callback(event.data);
                this.subscription = null;
            }
        };
        ws.onopen = () => __awaiter(this, void 0, void 0, function* () {
            if (this.keyRing.getCert() == null) {
                this.subscribe("JOIN", (msg) => {
                    this.signedPubKey = msg;
                });
                this.sendMessage(`JOIN`, Utils.toHexString(this.keyRing.getPub()));
                yield this.untilReceived();
                this.subscribe("PUBK", (msg) => {
                    this.serverPubKey = msg;
                });
                this.sendMessage("PUBK");
                yield this.untilReceived();
                if (this.keyRing.verify(this.keyRing.getPub(), Utils.fromHexString(this.signedPubKey), Utils.fromHexString(this.serverPubKey))) {
                    const signed = this.keyRing.sign(this.keyRing.getPub());
                    this.subscribe("NSIG", (msg) => {
                        const [type, data] = msg.split(" ");
                        if (type !== "CERT") {
                            throw new Error("Invalid message from server: " + data);
                        }
                        this.keyRing.setCert(Utils.fromHexString(data));
                        ws.close();
                        this.init();
                    });
                    this.sendMessage("NSIG", Utils.toHexString(signed));
                }
                else {
                    throw new Error("Bad signature from coordinator");
                }
            }
            else {
                this.subscribe("JOIN", (msg) => {
                    const parts = msg.split(" ");
                    if (parts[0] !== "Welcome") {
                        throw new Error("Unexpected coordinator response: " + msg);
                    }
                    else {
                        this.clientID = parts[2];
                    }
                });
                this.sendMessage("JOIN", Utils.toHexString(this.keyRing.getPub()));
                yield this.untilReceived();
                this.subscribe("PUBK", (msg) => {
                    this.serverPubKey = msg;
                });
                this.sendMessage("PUBK");
                yield this.untilReceived();
                this.emit("ready");
            }
        });
        this.ws = ws;
    }
    returnCoordPeerID() {
        return __awaiter(this, void 0, void 0, function* () {
            const endpoint = "/api/v1/peer";
            const res = yield ax.get(`${this.host}${endpoint}`);
            if (!res.data || !res.data.p2p_peer_ID) {
                console.error(res);
                throw new Error("Unexpected response from " + endpoint);
            }
            else {
                return res.data.p2p_peer_ID;
            }
        });
    }
    returnChannelTransactions() {
        return __awaiter(this, void 0, void 0, function* () {
            const endpoint = "/api/v1/transactions";
            const res = yield ax.get(`${this.host}${endpoint}`);
            return res.data;
        });
    }
    checkOnline() {
        return __awaiter(this, void 0, void 0, function* () {
            const endpoint = "/api/v1/version";
            const res = yield ax.get(`${this.host}${endpoint}`);
            if (!res.data) {
                throw new Error("Coordinator is not online!");
            }
            else {
                this.coordVersion = res.data.karai_version;
            }
        });
    }
    sendMessage(type, data = "") {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.ws) {
                throw new Error("Can't call this untilReceived the ready event is emitted!");
            }
            else {
                this.getWS().send(type + " " + data);
            }
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.keyRing.init();
                // check if the coordinator is online
                yield this.checkOnline();
                this.coordID = yield this.returnCoordPeerID();
                this.initWS();
            }
            catch (err) {
                this.emit("error", err);
            }
        });
    }
    untilReceived() {
        return __awaiter(this, void 0, void 0, function* () {
            let timeout = 1;
            while (this.subscription !== null) {
                yield Utils.sleep(timeout);
                timeout *= 2;
            }
        });
    }
}
