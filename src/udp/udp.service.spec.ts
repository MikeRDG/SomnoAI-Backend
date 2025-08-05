import { Test, TestingModule } from '@nestjs/testing';
import { UdpService } from './udp.service';

describe('UdpService', () => {
  let service: UdpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UdpService],
    }).compile();

    service = module.get<UdpService>(UdpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handlePing', () => {
    it('should return pong with correct data', () => {
      const testData = { test: 'data' };
      const result = service.handlePing(testData);

      expect(result).toEqual({
        message: 'pong',
        timestamp: expect.any(String),
        received: testData,
      });
    });
  });

  describe('handleEcho', () => {
    it('should echo back the data', () => {
      const testData = { message: 'hello world' };
      const result = service.handleEcho(testData);

      expect(result).toEqual({
        message: 'echo',
        echoed: testData,
        timestamp: expect.any(String),
      });
    });
  });

  describe('getStatus', () => {
    it('should return server status', () => {
      const result = service.getStatus();

      expect(result).toEqual({
        status: 'active',
        timestamp: expect.any(String),
        server: 'UDP Server on port 5000',
      });
    });
  });
});