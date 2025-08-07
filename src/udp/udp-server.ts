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
      console.log(`[UDP-SERVER] ===== NEW MESSAGE =====`);
      console.log(`[UDP-SERVER] From: ${rinfo.address}:${rinfo.port}`);
      console.log(`[UDP-SERVER] Size: ${msg.length} bytes`);
      console.log(`[UDP-SERVER] Raw hex: ${msg.toString('hex')}`);
      console.log(`[UDP-SERVER] As string: "${msg.toString()}"`);
      
      // Check if it looks like JSON
      try {
        const asString = msg.toString().trim();
        if (asString.startsWith('{') && asString.endsWith('}')) {
          console.log(`[UDP-SERVER] Detected JSON data:`);
          const parsed = JSON.parse(asString);
          console.log(`[UDP-SERVER] Parsed JSON:`, parsed);
          
          // Send back a JSON response
          const response = {
            status: 'received',
            timestamp: new Date().toISOString(),
            message: 'UDP server received your JSON',
            received: parsed,
            server: 'SomnoAI-Backend UDP Server'
          };
          const responseBuffer = Buffer.from(JSON.stringify(response));
          this.server.send(responseBuffer, rinfo.port, rinfo.address, (err) => {
            if (err) {
              console.log(`[UDP-SERVER] Error sending JSON response:`, err);
            } else {
              console.log(`[UDP-SERVER] JSON response sent back to ${rinfo.address}:${rinfo.port}`);
              console.log(`[UDP-SERVER] Response: ${JSON.stringify(response)}`);
            }
          });
          return;
        }
      } catch (e) {
        console.log(`[UDP-SERVER] Not JSON data, proceeding with ADPCM protocol`);
      }
      
      // Try to handle as ADPCM protocol
      console.log(`[UDP-SERVER] Passing to ADPCM protocol handler...`);
      this.protocolHandler.handleMessage(msg, rinfo);
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      console.log(`[UDP-SERVER] ===== SERVER STARTED =====`);
      console.log(`[UDP-SERVER] Listening on ${address.address}:${address.port}`);
      console.log(`[UDP-SERVER] ADPCM Protocol Handler initialized`);
      console.log(`[UDP-SERVER] Ready to receive JSON or ADPCM data`);
      console.log(`[UDP-SERVER] Test with: echo '{"pattern":"ping","data":{"message":"hello"}}' | nc -u <server_ip> ${this.port}`);
      console.log(`[UDP-SERVER] ================================`);
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