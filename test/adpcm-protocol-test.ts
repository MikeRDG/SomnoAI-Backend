import * as dgram from 'dgram';
import * as fs from 'fs';
import * as path from 'path';

export class AdpcmTestClient {
  private client: dgram.Socket;
  private serverHost: string;
  private serverPort: number;

  // Protocol constants
  private readonly ADPCM_HEADER = Buffer.from([0xFA, 0xFA]);
  private readonly BIN_HEADER = Buffer.from([0xFB, 0xFB]);
  private readonly READY_SIGNAL = Buffer.from([0xFD, 0xFD]);
  private readonly CONTINUE_PACKET = Buffer.from([0xFF, 0xFF]);
  private readonly FINAL_PACKET = Buffer.from([0x0F, 0x0F]);
  private readonly ACK_ADPCM = Buffer.from([0xFC, 0xFA]);
  private readonly ACK_BIN = Buffer.from([0xFC, 0xFB]);
  
  private readonly DEVICE_ID = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
  private readonly MAX_PACKET_SIZE = 1024;

  constructor(serverHost: string = 'localhost', serverPort: number = 5000) {
    this.serverHost = serverHost;
    this.serverPort = serverPort;
    this.client = dgram.createSocket('udp4');
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('message', (msg, rinfo) => {
      console.log(`Client received ${msg.length} bytes from ${rinfo.address}:${rinfo.port}`);
      this.handleServerResponse(msg, rinfo);
    });

    this.client.on('error', (err) => {
      console.error('Client error:', err);
    });
  }

  private handleServerResponse(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    const hex = msg.toString('hex');
    console.log(`Received response: ${hex}`);

    if (msg.equals(this.READY_SIGNAL)) {
      console.log('Server is ready to receive data');
    } else if (msg.equals(this.ACK_ADPCM)) {
      console.log('Server ACK for ADPCM data - will send audio response');
    } else if (msg.equals(this.ACK_BIN)) {
      console.log('Server ACK for BIN data');
    } else if (msg.length >= 2) {
      const header = msg.subarray(0, 2);
      if (header.equals(this.CONTINUE_PACKET)) {
        console.log('Received continue packet from server');
        // Send ready signal back
        this.sendReadySignal();
      } else if (header.equals(this.FINAL_PACKET)) {
        console.log('Received final packet from server');
        const payload = msg.subarray(2);
        console.log(`Final payload size: ${payload.length} bytes`);
        
        // Save received audio data
        this.saveReceivedAudio(payload, true);
        
        // Send ready signal back
        this.sendReadySignal();
      }
    }
  }

  private receivedAudioData: Buffer[] = [];

  private saveReceivedAudio(data: Buffer, isFinal: boolean = false): void {
    this.receivedAudioData.push(data);
    
    if (isFinal) {
      const completeAudio = Buffer.concat(this.receivedAudioData);
      const filename = 'received.wav';
      const filepath = path.join(process.cwd(), filename);
      
      fs.writeFileSync(filepath, completeAudio);
      console.log(`Complete audio response saved to: ${filepath} (${completeAudio.length} bytes)`);
      
      // Reset
      this.receivedAudioData = [];
    }
  }

  private sendReadySignal(): void {
    this.client.send(this.READY_SIGNAL, this.serverPort, this.serverHost, (err) => {
      if (err) {
        console.error('Error sending ready signal:', err);
      } else {
        console.log('Ready signal sent to server');
      }
    });
  }

  public async sendAdpcmData(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Starting ADPCM transmission, data size: ${data.length} bytes`);

      // Step 1: Send header packet
      const headerPacket = Buffer.concat([this.ADPCM_HEADER, this.DEVICE_ID]);
      
      this.client.send(headerPacket, this.serverPort, this.serverHost, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log('Header packet sent');
        
        // Wait for ready signal, then send data
        setTimeout(() => {
          this.sendDataPackets(data)
            .then(resolve)
            .catch(reject);
        }, 100);
      });
    });
  }

  public async sendBinData(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Starting BIN transmission, data size: ${data.length} bytes`);

      // Step 1: Send header packet
      const headerPacket = Buffer.concat([this.BIN_HEADER, this.DEVICE_ID]);
      
      this.client.send(headerPacket, this.serverPort, this.serverHost, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log('Header packet sent');
        
        // Wait for ready signal, then send data
        setTimeout(() => {
          this.sendDataPackets(data)
            .then(resolve)
            .catch(reject);
        }, 100);
      });
    });
  }

  private async sendDataPackets(data: Buffer): Promise<void> {
    const maxPayloadSize = this.MAX_PACKET_SIZE - 2; // 2 bytes for header
    const totalPackets = Math.ceil(data.length / maxPayloadSize);
    let currentPacket = 0;
    let offset = 0;

    console.log(`Sending ${totalPackets} data packets`);

    while (offset < data.length) {
      const remainingData = data.length - offset;
      const payloadSize = Math.min(maxPayloadSize, remainingData);
      const payload = data.subarray(offset, offset + payloadSize);
      
      const isLastPacket = (offset + payloadSize) >= data.length;
      const header = isLastPacket ? this.FINAL_PACKET : this.CONTINUE_PACKET;
      
      const packet = Buffer.concat([header, payload]);
      
      await new Promise<void>((resolve, reject) => {
        this.client.send(packet, this.serverPort, this.serverHost, (err) => {
          if (err) {
            reject(err);
          } else {
            console.log(`Packet ${currentPacket + 1}/${totalPackets} sent (${packet.length} bytes, isLast: ${isLastPacket})`);
            currentPacket++;
            offset += payloadSize;
            resolve();
          }
        });
      });

      // Small delay between packets
      if (!isLastPacket) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }

  public async sendTestAudioFile(): Promise<void> {
    const testWavPath = path.join(process.cwd(), 'test.wav');
    
    if (!fs.existsSync(testWavPath)) {
      console.log('test.wav not found, creating sample ADPCM data');
      // Create sample ADPCM data
      const sampleData = Buffer.alloc(2048);
      for (let i = 0; i < sampleData.length; i++) {
        sampleData[i] = Math.floor(Math.random() * 256);
      }
      return this.sendAdpcmData(sampleData);
    }

    const wavData = fs.readFileSync(testWavPath);
    console.log(`Sending test.wav file (${wavData.length} bytes)`);
    return this.sendAdpcmData(wavData);
  }

  public async sendTestBinData(): Promise<void> {
    const testData = Buffer.from('This is test binary data for the protocol test');
    console.log(`Sending test BIN data (${testData.length} bytes)`);
    return this.sendBinData(testData);
  }

  public close(): void {
    this.client.close();
  }
}

// Test script
async function runTest() {
  console.log('Starting ADPCM Protocol Test');
  
  const client = new AdpcmTestClient();
  
  try {
    console.log('\n=== Testing ADPCM Data Transmission ===');
    await client.sendTestAudioFile();
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n=== Testing BIN Data Transmission ===');
    await client.sendTestBinData();
    
    console.log('\nTest completed successfully');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
  
  // Keep client alive to receive responses
  setTimeout(() => {
    client.close();
    console.log('Test client closed');
  }, 10000);
}

// Run test if this file is executed directly
if (require.main === module) {
  runTest();
} 