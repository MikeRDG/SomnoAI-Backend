import { UdpServer } from './udp-server';
import * as dgram from 'dgram';

describe('UdpServer', () => {
  let udpServer: UdpServer;
  let client: dgram.Socket;

  beforeEach(() => {
    udpServer = new UdpServer(5001);
    client = dgram.createSocket('udp4');
  });

  afterEach((done) => {
    udpServer.stop();
    client.close(done);
  });

  it('should be defined', () => {
    expect(udpServer).toBeDefined();
  });

  it('should start on specified port', async () => {
    await udpServer.start();
    expect(udpServer).toBeDefined();
  });

  it('should handle ping message', (done) => {
    const testMessage = JSON.stringify({
      pattern: 'ping',
      data: { test: 'hello' }
    });

    client.on('message', (msg) => {
      const response = JSON.parse(msg.toString());
      expect(response.message).toBe('pong');
      expect(response.received).toEqual({ test: 'hello' });
      expect(response.timestamp).toBeDefined();
      done();
    });

    udpServer.start().then(() => {
      client.send(testMessage, 5001, 'localhost');
    });
  });

  it('should handle echo message', (done) => {
    const testMessage = JSON.stringify({
      pattern: 'echo',
      data: { text: 'hello world' }
    });

    client.on('message', (msg) => {
      const response = JSON.parse(msg.toString());
      expect(response.message).toBe('echo');
      expect(response.echoed).toEqual({ text: 'hello world' });
      expect(response.timestamp).toBeDefined();
      done();
    });

    udpServer.start().then(() => {
      client.send(testMessage, 5001, 'localhost');
    });
  });

  it('should handle status request', (done) => {
    const testMessage = JSON.stringify({
      pattern: 'status'
    });

    client.on('message', (msg) => {
      const response = JSON.parse(msg.toString());
      expect(response.status).toBe('active');
      expect(response.server).toBe('UDP Server on port 5000');
      expect(response.timestamp).toBeDefined();
      done();
    });

    udpServer.start().then(() => {
      client.send(testMessage, 5001, 'localhost');
    });
  });

  it('should handle unknown pattern', (done) => {
    const testMessage = JSON.stringify({
      pattern: 'unknown',
      data: { test: 'data' }
    });

    client.on('message', (msg) => {
      const response = JSON.parse(msg.toString());
      expect(response.error).toBe('Unknown pattern');
      expect(response.received.pattern).toBe('unknown');
      done();
    });

    udpServer.start().then(() => {
      client.send(testMessage, 5001, 'localhost');
    });
  });
});