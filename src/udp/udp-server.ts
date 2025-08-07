import * as dgram from 'dgram';
import { AdpcmProtocolHandler } from './adpcm-protocol';

export class UdpServer {
  private server: dgram.Socket;
  private port: number;
  private protocolHandler: AdpcmProtocolHandler;

  constructor(port: number = 5000) {
    this.port = port;
    this.server = dgram.createSocket('udp4');
    this.protocolHandler = new AdpcmProtocolHandler(this.server);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.server.on('error', (err) => {
      console.log(`UDP Server error:\n${err.stack}`);
      this.server.close();
    });

    this.server.on('message', (msg, rinfo) => {
      console.log(`UDP Server received ${msg.length} bytes from ${rinfo.address}:${rinfo.port}`);
      
      // Try to handle as ADPCM protocol first
      this.protocolHandler.handleMessage(msg, rinfo);
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      console.log(`UDP Server listening on ${address.address}:${address.port}`);
      console.log('ADPCM Protocol Handler initialized');
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.bind(this.port, '0.0.0.0', () => {
        resolve();
      });
    });
  }

  public stop(): void {
    this.server.close();
  }

  public getActiveSessions() {
    return this.protocolHandler.getActiveSessions();
  }
}