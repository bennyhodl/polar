import { debug } from 'electron-log';
import { LightningNode, OpenChannelOptions } from 'shared/types';
import { LightningService } from 'types';
import { httpGet, httpPost } from './senseiApi';
import * as SLN from './types';
import * as PLN from '../types';
import { waitFor } from 'utils/async';

class SenseiService implements LightningService {
  async getInfo(node: LightningNode): Promise<PLN.LightningNodeInfo> {
    const info = await httpGet<SLN.NodeInfoResponse>(node, 'v1/node/info');
    return {
      pubkey: info.node_info.node_pubkey,
      alias: 'sensei',
      rpcUrl: '',
      syncedToChain: true,
      blockHeight: 0,
      numActiveChannels: info.node_info.num_usable_channels,
      numPendingChannels: 0,
      numInactiveChannels: 0,
    };
  }

  async getBalances(node: LightningNode): Promise<PLN.LightningNodeBalances> {
    const balance = await httpGet<SLN.WalletBalanceResponse>(
      node,
      'v1/node/wallet/balance',
    );
    return {
      total: balance.balance_satoshis.toString(),
      confirmed: '0',
      unconfirmed: '0',
    };
  }

  async getNewAddress(node: LightningNode): Promise<PLN.LightningNodeAddress> {
    const address = await httpGet<string>(node, 'v1/node/wallet/address');
    return { address };
  }

  async getChannels(node: LightningNode): Promise<PLN.LightningNodeChannel[]> {
    const { channels: channels } = await httpGet<SLN.ChannelsResponse>(
      node,
      'v1/node/channels?page=0&take=100',
    );
    return channels
      .filter(c => c.is_outbound)
      .map(c => {
        return {
          pending: !c.is_usable,
          uniqueId: c.channel_id,
          channelPoint: `${c.funding_txid}:${c.funding_tx_index}`,
          pubkey: c.counterparty_pubkey,
          capacity: c.channel_value_satoshis.toString(),
          localBalance: this.toSats(c.outbound_capacity_msat).toString(),
          remoteBalance: this.toSats(c.inbound_capacity_msat).toString(),
          status: c.is_usable ? 'Open' : 'Closed',
          isPrivate: !c.is_public,
        };
      });
  }

  async getPeers(node: LightningNode): Promise<PLN.LightningNodePeer[]> {
    const { peers: peers } = await httpGet<SLN.PeerResponse>(node, 'v1/node/peers');
    return peers.map(p => ({
      pubkey: p.node_pubkey,
      address: '',
    }));
  }

  // To return peers we need the address from senseis API when getting peers
  // Will not connect to peers until issue is resolved
  async connectPeers(node: LightningNode, rpcUrls: string[]): Promise<void> {
    const peers = await this.getPeers(node);
    const keys = peers.map(p => p.pubkey);
    const newUrls = rpcUrls.filter(u => !keys.includes(u.split('@')[0]));
    for (const toRpcUrl of newUrls) {
      try {
        const body = { id: toRpcUrl };
        await httpPost<{ id: string }>(node, 'peer/connect', body);
      } catch (error: any) {
        debug(
          `Failed to connect peer '${toRpcUrl}' to c-lightning node ${node.name}:`,
          error.message,
        );
      }
    }
  }

  async openChannel({
    from,
    toRpcUrl,
    amount,
    isPrivate,
  }: OpenChannelOptions): Promise<PLN.LightningNodeChannelPoint> {
    // add peer if not connected already
    await this.connectPeers(from, [toRpcUrl]);

    const [toPubKey] = toRpcUrl.split('@');

    const body: SLN.OpenChannelRequest = {
      node_connection_string: toPubKey,
      amt_satoshis: Number(amount),
      public: !isPrivate,
    };

    const response = await httpPost<any>(from, 'v1/node/channels/open', body);
    return {
      txid: response.results[0].temp_channel_id,
      index: 0,
    };
  }

  async closeChannel(node: LightningNode, channelPoint: string): Promise<any> {
    const body = {
      channel_id: channelPoint,
      force: true,
    };

    return await httpPost(node, 'v1/node/channels/close', body);
  }

  async createInvoice(
    node: LightningNode,
    amount: number,
    memo?: string | undefined,
  ): Promise<string> {
    const body: SLN.CreateInvoiceRequest = {
      description: memo || `Payment to ${node.name}`,
      amt_msat: amount * 1000,
    };

    const invoice = await httpPost<SLN.CreateInvoiceResponse>(
      node,
      'v1/node/invoices',
      body,
    );

    return invoice.invoice;
  }

  async payInvoice(
    node: LightningNode,
    invoice: string,
    amount?: number | undefined,
  ): Promise<PLN.LightningNodePayReceipt> {
    const amountMsat = amount ? amount * 1000 : undefined;
    const body: SLN.PayInvoiceRequest = { invoice: amountMsat?.toString() || '' };
    const payment = await httpPost<any>(node, 'payinvoice', body);

    // await waitFor(() => this.getPaymentStatus(node, id), 1000, 5 * 1000);

    // const { status, paymentRequest } = await this.getPaymentStatus(node, id);

    // idk if this is what is returned
    return {
      preimage: payment.paymentPreimage,
      amount: payment.amount,
      destination: payment.nodeId,
    };
  }

  // async getPaymentStatus(node: LightningNode, id: string): Promise<any> {
  //     const transaction = await httpGet<any>(node, 'v1/node/payments');
  //     const sent = attempts.find(a => a.status.type === 'sent');
  //     if (!sent) {
  //     // throw an error with the failureMessage
  //     let msg = 'Failed to send payment';
  //     const failed = attempts.find(a => a.status.type === 'failed');
  //     if (failed) {
  //         const { failures } = failed.status;
  //         if (failures && failures.length) {
  //         msg = failures[0].failureMessage;
  //         }
  //     }
  //     throw new Error(msg);
  //     }

  //     return sent;
  // }

  /**
   * Helper function to continually query the LND node until a successful
   * response is received or it times out
   */
  async waitUntilOnline(
    node: LightningNode,
    interval = 3 * 1000, // check every 3 seconds
    timeout = 120 * 1000, // timeout after 120 seconds
  ): Promise<void> {
    return waitFor(
      async () => {
        await this.getInfo(node);
      },
      interval,
      timeout,
    );
  }

  private toSats(msats: number): string {
    return (msats / 1000).toFixed(0).toString();
  }
}

export default new SenseiService();

// "{"channels":[{"node_connection_string":"027a2540c23664a4b98b295fa078c77f13f90f94e56cce5f1770fe874b642e92d6@127.0.0.1:9638","amt_satoshis":16000000,"public":true}]}"

// .route("/v1/node/payments", get(handle_get_payments))
// .route("/v1/node/wallet/address", get(get_unused_address))
// .route("/v1/node/wallet/balance", get(get_wallet_balance))
// .route("/v1/node/channels", get(get_channels))
// .route("/v1/node/transactions", get(get_transactions))
// .route("/v1/node/info", get(get_info))
// .route("/v1/node/peers", get(get_peers))
// .route("/v1/node/stop", get(stop_node))
// .route("/v1/node/start", post(start_node))
// .route("/v1/node/invoices", post(create_invoice))
// .route("/v1/node/invoices/pay", post(pay_invoice))
// .route("/v1/node/invoices/decode", post(decode_invoice))
// .route("/v1/node/payments/label", post(label_payment))
// .route("/v1/node/payments/delete", post(delete_payment))
// .route("/v1/node/channels/open", post(open_channels))
// .route("/v1/node/channels/close", post(close_channel))
// .route("/v1/node/keysend", post(keysend))
// .route("/v1/node/peers/connect", post(connect_peer))
// .route("/v1/node/sign/message", post(sign_message))
// .route("/v1/node/verify/message", post(verify_message))
