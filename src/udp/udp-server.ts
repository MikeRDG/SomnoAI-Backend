import * as dgram from 'dgram';

export class UdpServer {
  private server: dgram.Socket;
  private port: number;

  constructor(port: number = 5000) {
    this.port = port;
    this.server = dgram.createSocket('udp4');
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.server.on('error', (err) => {
      console.log(`UDP Server error:\n${err.stack}`);
      this.server.close();
    });

    this.server.on('message', (msg, rinfo) => {
      console.log(`UDP Server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
      this.handleMessage(msg, rinfo);
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      console.log(`UDP Server listening on ${address.address}:${address.port}`);
    });
  }

  private handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    try {
      const data = JSON.parse(msg.toString());
      let response: any;

      switch (data.pattern) {
        case 'ping':
          response = {
            message: 'pong',
            timestamp: new Date().toISOString(),
            received: data.data
          };
          break;
        case 'echo':
          response = {
            message: 'echo',
            echoed: data.data,
            timestamp: new Date().toISOString()
          };
          break;
        case 'status':
          response = {
            status: 'active',
            timestamp: new Date().toISOString(),
            server: 'UDP Server on port 5000'
          };
          break;
        default:
          response = {
            error: 'Unknown pattern',
            received: data,
            timestamp: new Date().toISOString()
          };
      }

      const responseMsg = JSON.stringify(response);
      this.server.send(responseMsg, rinfo.port, rinfo.address, (err) => {
        if (err) {
          console.log('Error sending response:', err);
        } else {
          console.log('Response sent:', responseMsg);
        }
      });
    } catch (error) {
      const errorResponse = JSON.stringify({
        error: 'Invalid JSON',
        timestamp: new Date().toISOString()
      });
      
      this.server.send(errorResponse, rinfo.port, rinfo.address);
    }
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
}