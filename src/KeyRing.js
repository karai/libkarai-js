// this file borrowed from vex-chat at https://github.com/ExtraHash/vex-chat
import { EventEmitter } from "events";
import fs from "fs";
import { sign } from "tweetnacl";
import { Utils } from "./Utils";
/**
 * @ignore
 */
const configFolder = {
    keyFolderName: "keys",
    privKey: "key.priv",
    pubKey: "key.pub",
};
/**
 * The KeyRing provides an interface that allows you to generate
 * and store a pair of ed25519 keys, as well as sign and
 * verify ed25519 signatures.
 *
 * It takes a directory as the only argument of the constructor.
 * It will create a new keyring in this directory or load the keyring
 * from the directory if it is already present.
 *
 * It also takes the special string `:memory:` as a parameter to only
 * store the keys in memory, so this module an run in a browser.
 * Make sure you provide a way for the client to export the keys and
 * cert if you do this.
 *
 * Keyrings can only be used with one coordinator. You can not connect
 * to two different  coordinators with one keyring, you must generate
 * a new keyring for each coordinator.
 *
 * Example Usage:
 *
 * ```ts
 * const keyring = new KeyRing("./keyring");
 *
 * // If you want to perform operations with the keyring, wait for the ready event.
 *   keyring.on("ready", () => {
 *   const signed = keyring.sign(keyring.getPub());
 *   const verified = keyring.verify(keyring.getPub(), signed, keyring.getPub());
 *
 *   if (verified) {
 *     console.log("The signature is verified!");
 *   }
 * });
 *
 *   keyring.on("error", (error: Error) => {
 *     // do something with the error
 *   });
 * ```
 *
 * Note that the sign() and verify() functions take uint8 arrays.
 * If you need to convert hex strings into Uint8 arrays, use the
 * helper functions in the Utils class.
 *
 * @noInheritDoc
 */
export class KeyRing extends EventEmitter {
    /**
     * @param keyFolder - The folder where you want the keys to be saved.
     * If the folder does not exist, it will be created.
     * Keys are saved as utf8 encoded hex strings on the disk.
     */
    constructor(keyFolder, secretKey = null) {
        super();
        this.memoryOnly = keyFolder === ":memory:";
        this.init = this.init.bind(this);
        this.cert = null;
        this.keyFolder = keyFolder;
        this.pubKeyFile = `${this.keyFolder}/${configFolder.pubKey}`;
        this.privKeyFile = `${this.keyFolder}/${configFolder.privKey}`;
        this.signKeyPair = null;
        this.providedKey = secretKey;
    }
    /**
     * Signs a message with the keyring private key.
     *
     * @param message - The message to sign.
     * @returns The resulting signature.
     */
    sign(message) {
        return sign.detached(message, this.getPriv());
    }
    /**
     * Verifies a message signature is valid for a given public key.
     *
     * @param message - The message to sign.
     * @param signature - The signature to verify.
     * @param publicKey - The public key to verify against.
     * @returns true if the signature verifies, false if it doesn't.
     */
    verify(message, signature, publicKey) {
        return sign.detached.verify(message, signature, publicKey);
    }
    /**
     * Get the public key.
     *
     * @returns The public key.
     */
    getPub() {
        return this.signKeyPair.publicKey;
    }
    /**
     * Get the keyring directory path.
     *
     * @returns The key folder path.
     */
    getKeyFolder() {
        return this.keyFolder;
    }
    /**
     * Get the current cert, if there is one. There will not be a cert if the keyring has never been used to connect to a cordinator before.
     *
     * @returns The cert, or null.
     */
    getCert() {
        return this.cert;
    }
    /**
     * Sets the current cert. This is used internally by the Channel class.
     */
    setCert(cert) {
        if (!this.memoryOnly) {
            fs.writeFileSync(`${this.getKeyFolder()}/cert`, Utils.toHexString(cert), {
                encoding: "utf-8",
            });
        }
        this.cert = cert;
    }
    /**
     * Re-initializes the keyring. This may be useful if you've made changes to the key files on disk and want them to update.
     */
    init() {
        if (this.memoryOnly) {
            this.signKeyPair = this.providedKey
                ? sign.keyPair.fromSecretKey(Utils.fromHexString(this.providedKey))
                : sign.keyPair();
            if (!this.providedKey) {
                this.providedKey = Utils.toHexString(this.signKeyPair.secretKey);
            }
            this.emit("ready");
            return;
        }
        try {
            if (!fs.existsSync(this.keyFolder)) {
                fs.mkdirSync(this.keyFolder);
            }
            // if the private key doesn't exist
            if (!fs.existsSync(this.privKeyFile)) {
                // generate and write keys to disk
                const signingKeys = sign.keyPair();
                fs.writeFileSync(this.pubKeyFile, Utils.toHexString(signingKeys.publicKey), {
                    encoding: "utf8",
                });
                fs.writeFileSync(this.privKeyFile, Utils.toHexString(signingKeys.secretKey), {
                    encoding: "utf8",
                });
            }
            if (fs.existsSync(this.keyFolder + "/cert")) {
                this.cert = Utils.fromHexString(fs.readFileSync(this.privKeyFile, {
                    encoding: "utf8",
                }));
            }
            const priv = Utils.fromHexString(fs.readFileSync(this.privKeyFile, {
                encoding: "utf8",
            }));
            if (priv.length !== 64) {
                throw new Error("Invalid keyfiles. Please generate new keyfiles and replace them in the signingKeys directory.");
            }
            const signKeyPair = sign.keyPair.fromSecretKey(priv);
            this.signKeyPair = signKeyPair;
            this.emit("ready");
        }
        catch (err) {
            this.emit("error", err);
        }
    }
    /**
     * Get the private key.
     *
     * @returns The public key.
     */
    getPriv() {
        return this.signKeyPair.secretKey;
    }
}
