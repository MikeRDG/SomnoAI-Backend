import { Injectable } from '@nestjs/common';

@Injectable()
export class UdpService {
  handlePing(data: any): any {
    return {
      message: 'pong',
      timestamp: new Date().toISOString(),
      received: data,
    };
  }

  handleEcho(data: any): any {
    return {
      message: 'echo',
      echoed: data,
      timestamp: new Date().toISOString(),
    };
  }

  getStatus(): any {
    return {
      status: 'active',
      timestamp: new Date().toISOString(),
      server: 'UDP Server on port 5000',
    };
  }
}