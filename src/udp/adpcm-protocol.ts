import * as dgram from 'dgram';
import * as fs from 'fs';
import * as path from 'path';

export interface ClientSession {
  address: string;
  port: number;
  state: 'waiting_header' | 'waiting_data' | 'ready_to_send';
  dataType: 'ADPCM' | 'BIN' | null;
  receivedData: Buffer[];
  totalDataSize: number;
  lastActivity: number;
  sendingData?: {
    data: Buffer;
    totalPackets: number;
    currentPacket: number;
    offset: number;
    rinfo: dgram.RemoteInfo;
  };
}

export class AdpcmProtocolHandler {
  private sessions: Map<string, ClientSession> = new Map();
  private server: dgram.Socket;

  // Protocol constants
  private readonly ADPCM_HEADER = Buffer.from([0xFA, 0xFA]);
  private readonly BIN_HEADER = Buffer.from([0xFB, 0xFB]);
  private readonly READY_SIGNAL = Buffer.from([0xFD, 0xFD]);
  private readonly CONTINUE_PACKET = Buffer.from([0xFF, 0xFF]);
  private readonly FINAL_PACKET = Buffer.from([0x0F, 0x0F]);
  private readonly ACK_ADPCM = Buffer.from([0xFC, 0xFA]);
  private readonly ACK_BIN = Buffer.from([0xFC, 0xFB]);
  
  private readonly MAX_PACKET_SIZE = 1024;
  private readonly TIMEOUT_MS = 800;
  private readonly MAX_RETRIES = 2;

  constructor(server: dgram.Socket) {
    this.server = server;
    this.startSessionCleanup();
  }

  public handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    const clientKey = `${rinfo.address}:${rinfo.port}`;
    let session = this.sessions.get(clientKey);

    if (!session) {
      session = {
        address: rinfo.address,
        port: rinfo.port,
        state: 'waiting_header',
        dataType: null,
        receivedData: [],
        totalDataSize: 0,
        lastActivity: Date.now()
      };
      this.sessions.set(clientKey, session);
    }

    session.lastActivity = Date.now();

    try {
      if (session.state === 'waiting_header') {
        this.handleHeaderPacket(msg, session, rinfo);
      } else if (session.state === 'waiting_data') {
        this.handleDataPacket(msg, session, rinfo);
      } else if (session.state === 'ready_to_send') {
        this.handleReadySignal(msg, session, rinfo);
      }
    } catch (error) {
      console.error(`Error handling message from ${clientKey}:`, error);
      this.sessions.delete(clientKey);
    }
  }

  private handleHeaderPacket(msg: Buffer, session: ClientSession, rinfo: dgram.RemoteInfo): void {
    console.log(`Received header packet from ${rinfo.address}:${rinfo.port}, length: ${msg.length}`);
    
    if (msg.length !== 10) {
      console.log('Invalid header packet size, expected 10 bytes');
      return;
    }

    const header = msg.subarray(0, 2);
    const deviceId = msg.subarray(2, 10);
    
    console.log(`Header: ${header.toString('hex')}, Device ID: ${deviceId.toString('hex')}`);

    if (header.equals(this.ADPCM_HEADER)) {
      session.dataType = 'ADPCM';
      console.log('ADPCM data transmission initiated');
    } else if (header.equals(this.BIN_HEADER)) {
      session.dataType = 'BIN';
      console.log('BIN data transmission initiated');
    } else {
      console.log('Invalid header, ignoring packet');
      return;
    }

    // Send ready signal to client
    session.state = 'waiting_data';
    this.sendReadySignal(rinfo);
  }

  private handleDataPacket(msg: Buffer, session: ClientSession, rinfo: dgram.RemoteInfo): void {
    if (msg.length < 2) {
      console.log('Invalid data packet size');
      return;
    }

    const packetHeader = msg.subarray(0, 2);
    const payload = msg.subarray(2);

    console.log(`Received data packet, header: ${packetHeader.toString('hex')}, payload size: ${payload.length}`);

    if (packetHeader.equals(this.CONTINUE_PACKET)) {
      // Continue packet
      session.receivedData.push(payload);
      session.totalDataSize += payload.length;
      console.log(`Continue packet received, total data size: ${session.totalDataSize}`);
      
      // Send ready signal for next packet
      this.sendReadySignal(rinfo);
      
    } else if (packetHeader.equals(this.FINAL_PACKET)) {
      // Final packet
      session.receivedData.push(payload);
      session.totalDataSize += payload.length;
      console.log(`Final packet received, total data size: ${session.totalDataSize}`);
      
      // Process complete data
      this.processCompleteData(session, rinfo);
    } else {
      console.log('Invalid data packet header');
    }
  }

  private handleReadySignal(msg: Buffer, session: ClientSession, rinfo: dgram.RemoteInfo): void {
    if (msg.equals(this.READY_SIGNAL)) {
      console.log(`Received ready signal from ${rinfo.address}:${rinfo.port}, session state: ${session.state}`);
      
      // Only process ready signals during the download phase (when server is sending data back)
      if (session.state === 'ready_to_send' && session.sendingData) {
        const { data, totalPackets, currentPacket, offset } = session.sendingData;
        const maxPayloadSize = this.MAX_PACKET_SIZE - 2;
        
        if (offset < data.length) {
          const remainingData = data.length - offset;
          const payloadSize = Math.min(maxPayloadSize, remainingData);
          const payload = data.subarray(offset, offset + payloadSize);
          
          const isLastPacket = (offset + payloadSize) >= data.length;
          const header = isLastPacket ? this.FINAL_PACKET : this.CONTINUE_PACKET;
          
          const packet = Buffer.concat([header, payload]);
          
          console.log(`Sending packet ${currentPacket + 1}/${totalPackets}, size: ${packet.length}, isLast: ${isLastPacket}`);
          
          this.server.send(packet, rinfo.port, rinfo.address, (err) => {
            if (err) {
              console.error('Error sending packet:', err);
            } else {
              console.log(`Packet ${currentPacket + 1} sent successfully`);
              
              // Update session state
              session.sendingData.currentPacket = currentPacket + 1;
              session.sendingData.offset = offset + payloadSize;
              
              if (isLastPacket) {
                console.log('Final packet sent, resetting session');
                session.state = 'waiting_header';
                session.receivedData = [];
                session.totalDataSize = 0;
                delete session.sendingData;
              }
            }
          });
        }
      } else {
        console.log(`Ready signal ignored - session not in download phase (state: ${session.state})`);
      }
    }
  }

  private processCompleteData(session: ClientSession, rinfo: dgram.RemoteInfo): void {
    const completeData = Buffer.concat(session.receivedData);
    console.log(`Processing complete ${session.dataType} data, total size: ${completeData.length} bytes`);

    if (session.dataType === 'ADPCM') {
      this.processAdpcmData(completeData, session, rinfo);
    } else if (session.dataType === 'BIN') {
      this.processBinData(completeData, session, rinfo);
    }
  }

  private processAdpcmData(data: Buffer, session: ClientSession, rinfo: dgram.RemoteInfo): void {
    console.log(`Processing ADPCM data: ${data.length} bytes`);
    
    // Save received ADPCM data as received.wav
    const filename = 'received.wav';
    const filepath = path.join(process.cwd(), filename);
    
    fs.writeFileSync(filepath, data);
    console.log(`ADPCM data saved to: ${filepath}`);

    // Send ACK and prepare to send response
    this.sendAck(session.dataType, rinfo);
    
    // Send back the same audio data that was received
    console.log(`Sending received audio data back to client, size: ${data.length} bytes`);
    this.sendDataToClient(data, session, rinfo);
  }

  private processBinData(data: Buffer, session: ClientSession, rinfo: dgram.RemoteInfo): void {
    console.log(`Processing BIN data: ${data.length} bytes`);
    
    // Save received BIN data
    const timestamp = Date.now();
    const filename = `received_bin_${timestamp}.bin`;
    const filepath = path.join(process.cwd(), 'received_data', filename);
    
    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filepath, data);
    console.log(`BIN data saved to: ${filepath}`);

    // Send ACK
    this.sendAck(session.dataType, rinfo);
    
    // Reset session
    session.state = 'waiting_header';
    session.receivedData = [];
    session.totalDataSize = 0;
  }

  private sendDataToClient(data: Buffer, session: ClientSession, rinfo: dgram.RemoteInfo): void {
    session.state = 'ready_to_send';
    
    const maxPayloadSize = this.MAX_PACKET_SIZE - 2; // 2 bytes for header
    const totalPackets = Math.ceil(data.length / maxPayloadSize);
    let currentPacket = 0;
    let offset = 0;

    // Store the sending state in the session
    session.sendingData = {
      data: data,
      totalPackets: totalPackets,
      currentPacket: currentPacket,
      offset: offset,
      rinfo: rinfo
    };

    const sendNextPacket = () => {
      if (offset >= data.length) {
        console.log('All data sent successfully');
        // Reset session
        session.state = 'waiting_header';
        session.receivedData = [];
        session.totalDataSize = 0;
        delete session.sendingData;
        return;
      }

      const remainingData = data.length - offset;
      const payloadSize = Math.min(maxPayloadSize, remainingData);
      const payload = data.subarray(offset, offset + payloadSize);
      
      const isLastPacket = (offset + payloadSize) >= data.length;
      const header = isLastPacket ? this.FINAL_PACKET : this.CONTINUE_PACKET;
      
      const packet = Buffer.concat([header, payload]);
      
      console.log(`Sending packet ${currentPacket + 1}/${totalPackets}, size: ${packet.length}, isLast: ${isLastPacket}`);
      
      this.server.send(packet, rinfo.port, rinfo.address, (err) => {
        if (err) {
          console.error('Error sending packet:', err);
        } else {
          console.log(`Packet ${currentPacket + 1} sent successfully`);
          currentPacket++;
          offset += payloadSize;
          
          // Update session state
          if (session.sendingData) {
            session.sendingData.currentPacket = currentPacket;
            session.sendingData.offset = offset;
          }
          
          if (isLastPacket) {
            // Reset session after final packet
            console.log('Final packet sent, resetting session');
            session.state = 'waiting_header';
            session.receivedData = [];
            session.totalDataSize = 0;
            delete session.sendingData;
          }
          // For non-final packets, we'll wait for the ready signal
          // which will be handled in handleReadySignal method
        }
      });
    };

    // Start sending packets
    sendNextPacket();
  }

  private sendReadySignal(rinfo: dgram.RemoteInfo): void {
    this.server.send(this.READY_SIGNAL, rinfo.port, rinfo.address, (err) => {
      if (err) {
        console.error('Error sending ready signal:', err);
      } else {
        console.log(`Ready signal sent to ${rinfo.address}:${rinfo.port}`);
      }
    });
  }

  private sendAck(dataType: 'ADPCM' | 'BIN', rinfo: dgram.RemoteInfo): void {
    const ack = dataType === 'ADPCM' ? this.ACK_ADPCM : this.ACK_BIN;
    
    this.server.send(ack, rinfo.port, rinfo.address, (err) => {
      if (err) {
        console.error('Error sending ACK:', err);
      } else {
        console.log(`ACK sent for ${dataType} data to ${rinfo.address}:${rinfo.port}`);
      }
    });
  }

  private startSessionCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const timeoutThreshold = 30000; // 30 seconds
      
      for (const [key, session] of this.sessions.entries()) {
        if (now - session.lastActivity > timeoutThreshold) {
          console.log(`Cleaning up expired session: ${key}`);
          this.sessions.delete(key);
        }
      }
    }, 10000); // Check every 10 seconds
  }

  public getActiveSessions(): ClientSession[] {
    return Array.from(this.sessions.values());
  }
} 