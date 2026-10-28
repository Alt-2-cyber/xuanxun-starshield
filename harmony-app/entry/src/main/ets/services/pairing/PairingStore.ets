import preferences from '@ohos.data.preferences';
import common from '@ohos.app.ability.common';
import { PairingConfig } from '../../models/EdgeModels';
import { isTokenUsable, normalizeServiceUrl } from './PairingParser';

const STORE_NAME: string = 'starshield_pairing';
const SERVICE_URL_KEY: string = 'service_url';
const TOKEN_KEY: string = 'token';
const EXPIRY_KEY: string = 'token_expires_at_ms';

export default class PairingStore {
  private readonly context: common.Context;

  public constructor(context: common.Context) {
    this.context = context;
  }

  public async load(): Promise<PairingConfig | undefined> {
    try {
      const store: preferences.Preferences = await preferences.getPreferences(this.context, STORE_NAME);
      const storedUrl: preferences.ValueType = await store.get(SERVICE_URL_KEY, '');
      const serviceUrl: string | undefined = typeof storedUrl === 'string' ? normalizeServiceUrl(storedUrl) : undefined;
      if (serviceUrl === undefined) {
        return undefined;
      }

      const storedToken: preferences.ValueType = await store.get(TOKEN_KEY, '');
      const storedExpiry: preferences.ValueType = await store.get(EXPIRY_KEY, 0);
      const token: string | undefined = typeof storedToken === 'string' && storedToken.length > 0
        ? storedToken
        : undefined;
      const expiresAtMs: number | undefined = typeof storedExpiry === 'number' && storedExpiry > 0
        ? storedExpiry
        : undefined;

      if (token !== undefined && !isTokenUsable(token, expiresAtMs)) {
        await store.delete(TOKEN_KEY);
        await store.delete(EXPIRY_KEY);
        await store.flush();
        return { serviceUrl };
      }
      return {
        serviceUrl,
        token,
        expiresAtMs
      };
    } catch (_) {
      return undefined;
    }
  }

  public async save(config: PairingConfig): Promise<void> {
    try {
      const store: preferences.Preferences = await preferences.getPreferences(this.context, STORE_NAME);
      await store.put(SERVICE_URL_KEY, config.serviceUrl);
      if (isTokenUsable(config.token, config.expiresAtMs)) {
        await store.put(TOKEN_KEY, config.token as string);
        await store.put(EXPIRY_KEY, config.expiresAtMs as number);
      } else {
        await store.delete(TOKEN_KEY);
        await store.delete(EXPIRY_KEY);
      }
      await store.flush();
    } catch (_) {
      throw new Error('Pairing storage save failed');
    }
  }

  public async clear(): Promise<void> {
    try {
      const store: preferences.Preferences = await preferences.getPreferences(this.context, STORE_NAME);
      await store.clear();
      await store.flush();
    } catch (_) {
      throw new Error('Pairing storage clear failed');
    }
  }
}
