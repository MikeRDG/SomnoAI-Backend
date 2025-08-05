import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UdpServer } from './udp/udp-server';

async function bootstrap() {
  const httpPort = process.env.PORT ?? 3000;
  const udpPort = parseInt(process.env.UDP_PORT ?? '5000');

  const app = await NestFactory.create(AppModule);
  await app.listen(httpPort);
  console.log('HTTP Server running on port', httpPort);

  const udpServer = new UdpServer(udpPort);
  await udpServer.start();
}
bootstrap();
