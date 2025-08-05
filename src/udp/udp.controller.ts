import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UdpService } from './udp.service';

@Controller()
export class UdpController {
  constructor(private readonly udpService: UdpService) {}

  @MessagePattern('ping')
  handlePing(@Payload() data: any) {
    return this.udpService.handlePing(data);
  }

  @MessagePattern('echo')
  handleEcho(@Payload() data: any) {
    return this.udpService.handleEcho(data);
  }

  @MessagePattern('status')
  handleStatus() {
    return this.udpService.getStatus();
  }
}