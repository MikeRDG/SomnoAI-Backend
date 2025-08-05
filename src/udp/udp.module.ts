import { Module } from '@nestjs/common';
import { UdpController } from './udp.controller';
import { UdpService } from './udp.service';

@Module({
  controllers: [UdpController],
  providers: [UdpService],
  exports: [UdpService],
})
export class UdpModule {}