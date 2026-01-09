declare module 'tuyapi' {
  interface TuyaDeviceOptions {
    id: string;
    key: string;
    ip?: string;
    version?: '3.1' | '3.3' | '3.4';
    port?: number;
    gwId?: string;
    issueGetOnConnect?: boolean;
    nullPayloadOnJSONError?: boolean;
  }

  interface FindOptions {
    timeout?: number;
    all?: boolean;
  }

  interface SetOptions {
    dps?: number;
    set?: boolean | string | number | object;
    multiple?: boolean;
    data?: object;
  }

  class TuyAPI {
    constructor(options: TuyaDeviceOptions);

    find(options?: FindOptions): Promise<void>;
    connect(): Promise<boolean>;
    disconnect(): Promise<boolean>;

    get(options?: { dps?: number; schema?: boolean }): Promise<boolean | object>;
    set(options: SetOptions): Promise<boolean>;
    refresh(options?: { schema?: boolean }): Promise<object>;

    on(event: 'connected', listener: () => void): this;
    on(event: 'disconnected', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'data', listener: (data: object) => void): this;
    on(event: 'dp-refresh', listener: (data: object) => void): this;

    isConnected(): boolean;
  }

  export = TuyAPI;
}
