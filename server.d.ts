declare module 'static-server' {
  class StaticServer {
    constructor(config: StaticServerConfiguration);
    start: (callback: () => void) => void;
    on: (
      event: 'request' | 'symbolicLink' | 'response',
      handler: (req: any, res: any) => void
    ) => void;
    port: number;
  }

  export default StaticServer;
}

interface StaticServerConfiguration {
  /**
   * the root of the server file tree, e.g. `'.'`
   */
  rootPath: string;
  /**
   * the port to which to listen, e.g. `1337`
   */
  port: number;
  /**
   * will set "X-Powered-by" HTTP header
   */
  name?: string;
  /**
   *  defaults to any interface
   */
  host?: string;
  /**
   * defaults to undefined
   */
  cors?: string;
  /**
   * defaults to a 404 error
   */
  followSymlink?: boolean;

  templates?: {
    /**
     * defaults to 'index.html'
     */
    index?: string;
    /**
     * defaults to undefined
     */
    notFound?: string;
  };

  /**
   * Enables HTTPS
   */
  useSsl?: boolean;
  /**
   * HTTPS port to use
   */
  httpsPort?: number;
  /**
   * Path to SSL certificate
   */
  sslCertificate?: string;
  /**
   * Path to SSL Private key
   */
  sslPrivatekey?: string;
}
