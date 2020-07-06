// this file borrowed from vex-chat at https://github.com/ExtraHash/vex-chat

import { EventEmitter } from "events";
import fs from "fs";
import { sign, SignKeyPair } from "tweetnacl";
import { Utils } from "./Utils";

const configFolder = {
  keyFolderName: "keys",
  privKey: "key.priv",
  pubKey: "key.pub",
};

/**
 * The KeyRing provides an interface that allows you to generate, store, sign, and
 * verify ed25519 signatures.
 *
 * @noInheritDoc
 */
export class KeyRing extends EventEmitter {
  private signKeyPair: SignKeyPair | null;
  private keyFolder: string;
  private pubKeyFile: string;
  private privKeyFile: string;
  private cert: Uint8Array | null;

  constructor(keyFolder: string) {
    super();
    this.init = this.init.bind(this);
    this.cert = null;
    this.keyFolder = keyFolder;
    this.pubKeyFile = `${this.keyFolder}/${configFolder.pubKey}`;
    this.privKeyFile = `${this.keyFolder}/${configFolder.privKey}`;
    this.signKeyPair = null;
  }

  /**
   * Signs a message with the keyring private key.
   *
   * @param message - The message to sign.
   * @returns The resulting signature.
   */
  public sign(message: Uint8Array): Uint8Array {
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
  public verify(
    message: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array
  ): boolean {
    return sign.detached.verify(message, signature, publicKey);
  }

  /**
   * Get the public key.
   *
   * @returns The public key.
   */
  public getPub(): Uint8Array {
    return this.signKeyPair!.publicKey;
  }

  /**
   * Get the current key folder path.
   *
   * @returns The key folder path.
   */
  public getKeyFolder(): string {
    return this.keyFolder;
  }

  /**
   * Get the current cert, if there is one. There will not be a cert if the keyring has never been used to connect to a cordinator before.
   *
   * @returns The cert, or null.
   */
  public getCert(): Uint8Array | null {
    return this.cert;
  }

  /**
   * Re-initializes the keyring. This may be useful if you've made changes to the key files on disk and want them to update.
   */
  public init(): void {
    try {
      if (!fs.existsSync(this.keyFolder)) {
        fs.mkdirSync(this.keyFolder);
      }

      // if the private key doesn't exist
      if (!fs.existsSync(this.privKeyFile)) {
        // generate and write keys to disk
        const signingKeys = sign.keyPair();
        fs.writeFileSync(
          this.pubKeyFile,
          Utils.toHexString(signingKeys.publicKey),
          {
            encoding: "utf8",
          }
        );
        fs.writeFileSync(
          this.privKeyFile,
          Utils.toHexString(signingKeys.secretKey),
          {
            encoding: "utf8",
          }
        );
      }

      if (fs.existsSync(this.keyFolder + "/cert")) {
        this.cert = Utils.fromHexString(
          fs.readFileSync(this.privKeyFile, {
            encoding: "utf8",
          })
        );
      }

      const priv = Utils.fromHexString(
        fs.readFileSync(this.privKeyFile, {
          encoding: "utf8",
        })
      );

      if (priv.length !== 64) {
        throw new Error(
          "Invalid keyfiles. Please generate new keyfiles and replace them in the signingKeys directory."
        );
      }

      const signKeyPair = sign.keyPair.fromSecretKey(priv);
      this.signKeyPair = signKeyPair;
      this.emit("ready");
    } catch (err) {
      this.emit("error", err);
    }
  }

  /**
   * Get the private key.
   *
   * @returns The public key.
   */
  public getPriv(): Uint8Array {
    return this.signKeyPair!.secretKey;
  }
}
