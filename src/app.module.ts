import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UdpModule } from './udp/udp.module';

@Module({
  imports: [UdpModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
