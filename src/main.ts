import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UdpServer } from './udp/udp-server';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
  console.log('HTTP Server running on port', process.env.PORT ?? 3000);

  const udpServer = new UdpServer(5000);
  await udpServer.start();
}
bootstrap();
