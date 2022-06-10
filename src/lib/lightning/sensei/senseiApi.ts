import { debug } from 'electron-log';
import { LightningNode, SenseiNode } from 'shared/types';
import { httpRequest } from 'shared/utils';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

const request = async <T>(
  node: LightningNode,
  method: HttpMethod,
  path: string,
  bodyObj?: any,
): Promise<T> => {
  if (node.implementation !== 'sensei')
    throw new Error(`SenseiService cannot be used for '${node.implementation}' nodes`);

  const sln = node as SenseiNode;
  const id = Math.round(Math.random() * Date.now());
  const url = `http://127.0.0.1:${node.ports.rest}/${path}`;
  const macaroonHex = Buffer.from(sln.paths.macaroon).toString('hex');
  const body = bodyObj ? JSON.stringify(bodyObj) : undefined;
  debug(`sensei API: [request] ${sln.name} ${id} "${url}`);

  const response = await httpRequest(url, {
    method,
    headers: {
      macaroon: macaroonHex,
    },
    body,
  });

  const json = JSON.parse(response);
  debug(`sensei API: [response] ${sln.name} ${id} ${JSON.stringify(json, null, 2)}`);

  if (typeof json.error === 'object') {
    const { code, message } = json.error;
    throw new Error(`sensei ${code}: ${message}`);
  }

  return json as T;
};

export const httpGet = async <T>(node: LightningNode, path: string): Promise<T> => {
  return request<T>(node, 'GET', path);
};

export const httpPost = async <T>(
  node: LightningNode,
  path: string,
  body?: any,
): Promise<T> => {
  return request<T>(node, 'POST', path, body);
};

// {"alias":"Polar","macaroon":"02010773656e73656964027b7b226964223a2264356436366431642d653463362d343133652d393661352d393932356436643162363163222c227075626b6579223a22303239343838396632646133323663323963656534323337323334393261633832323062343731643539373165316533326530313635663064396165326637343065227d00000620331521cb159694976f1b954c7db50760df87d1eeb68758bdf5cba73af6f0a675","pubkey":"0294889f2da326c29cee423723492ac8220b471d5971e1e32e0165f0d9ae2f740e","role":0,"token":"f8ecf5770743af28a396c095cb27328aca4263c25f0ac1f60f22dbe9ea3e8706"}
