import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UdpServer } from './udp/udp-server';

async function bootstrap() {
  const httpPort = parseInt(process.env.PORT ?? '80');
  const udpPort = parseInt(process.env.UDP_PORT ?? '5000');

  const app = await NestFactory.create(AppModule);
  await app.listen(httpPort, '0.0.0.0');
  console.log(`HTTP Server running on 0.0.0.0:${httpPort}`);

  const udpServer = new UdpServer(udpPort);
  await udpServer.start();
}
bootstrap();
