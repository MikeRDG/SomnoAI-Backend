import { Test, TestingModule } from '@nestjs/testing';
import { UdpController } from './udp.controller';
import { UdpService } from './udp.service';

describe('UdpController', () => {
  let controller: UdpController;
  let service: UdpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UdpController],
      providers: [UdpService],
    }).compile();

    controller = module.get<UdpController>(UdpController);
    service = module.get<UdpService>(UdpService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handlePing', () => {
    it('should handle ping message', () => {
      const testData = { test: 'ping' };
      const expectedResult = {
        message: 'pong',
        timestamp: expect.any(String),
        received: testData,
      };

      jest.spyOn(service, 'handlePing').mockReturnValue(expectedResult);

      const result = controller.handlePing(testData);

      expect(service.handlePing).toHaveBeenCalledWith(testData);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('handleEcho', () => {
    it('should handle echo message', () => {
      const testData = { text: 'echo test' };
      const expectedResult = {
        message: 'echo',
        echoed: testData,
        timestamp: expect.any(String),
      };

      jest.spyOn(service, 'handleEcho').mockReturnValue(expectedResult);

      const result = controller.handleEcho(testData);

      expect(service.handleEcho).toHaveBeenCalledWith(testData);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('handleStatus', () => {
    it('should handle status request', () => {
      const expectedResult = {
        status: 'active',
        timestamp: expect.any(String),
        server: 'UDP Server on port 5000',
      };

      jest.spyOn(service, 'getStatus').mockReturnValue(expectedResult);

      const result = controller.handleStatus();

      expect(service.getStatus).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });
});