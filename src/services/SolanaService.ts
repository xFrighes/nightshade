import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

const RAT_HOLE_ADDRESS = import.meta.env.VITE_RAT_HOLE_ADDRESS || '11111111111111111111111111111111';
const DEVNET_RPC = 'https://api.devnet.solana.com';

declare global {
  interface Window {
    solana?: {
      isPhantom: boolean;
      connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
      disconnect: () => Promise<void>;
      signTransaction: (tx: Transaction) => Promise<Transaction>;
      publicKey: { toString: () => string } | null;
    };
  }
}

export class SolanaService {
  private static connection = new Connection(DEVNET_RPC, 'confirmed');

  static isAvailable(): boolean {
    return Boolean(window.solana?.isPhantom);
  }

  static async connect(): Promise<string> {
    if (!window.solana?.isPhantom) {
      throw new Error('Phantom wallet not found. Install the Phantom extension to bribe the rat.');
    }
    const response = await window.solana.connect();
    return response.publicKey.toString();
  }

  static async sendBribe(fromAddress: string): Promise<string> {
    if (!window.solana) throw new Error('Wallet not connected.');

    const from = new PublicKey(fromAddress);
    const to = new PublicKey(RAT_HOLE_ADDRESS);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports: Math.floor(0.01 * LAMPORTS_PER_SOL),
      })
    );

    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = from;

    const signed = await window.solana.signTransaction(transaction);
    const txId = await this.connection.sendRawTransaction(signed.serialize());
    await this.connection.confirmTransaction(txId, 'confirmed');

    return txId;
  }
}
