export interface NodeInfoResponse {
  node_info: {
    version: string;
    node_pubkey: string;
    num_channels: number;
    num_usable_channels: number;
    num_peers: number;
    local_balance_msat: number;
  };
}

export interface WalletBalanceResponse {
  balance_satoshis: number;
}

export interface ChannelsResponse {
  channels: [
    {
      channel_id: string;
      funding_txid: string;
      funding_tx_index: number;
      short_channel_id: number;
      channel_value_satoshis: number;
      balance_msat: number;
      unspendable_punishment_reserve: number;
      user_channel_id: number;
      outbound_capacity_msat: number;
      inbound_capacity_msat: number;
      confirmations_required: number;
      force_close_spend_delay: number;
      is_outbound: boolean;
      is_funding_locked: boolean;
      is_usable: boolean;
      is_public: boolean;
      counterparty_pubkey: string;
      alias: string;
    },
  ];
  pagination: {
    has_more: boolean;
    total: number;
  };
}

export interface PeerResponse {
  peers: [
    {
      node_pubkey: string;
    },
  ];
}

export interface OpenChannelRequest {
  node_connection_string: string;
  amt_satoshis: number;
  public: boolean;
}

export interface CreateInvoiceRequest {
  amt_msat: number;
  description: string;
}

export interface CreateInvoiceResponse {
  invoice: string;
}

export interface PayInvoiceRequest {
  invoice: string;
}
