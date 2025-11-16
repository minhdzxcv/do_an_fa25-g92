import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import * as nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    use: jest.fn(),
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  })),
}));

describe('MailService', () => {
  let service: MailService;
  let configService: ConfigService;
  let transporter: any;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          EMAIL_USER: 'test@example.com',
          EMAIL_PASS: 'test-password',
        };
        return config[key];
      }),
    };

    transporter = {
      use: jest.fn(),
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(transporter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    configService = module.get<ConfigService>(ConfigService);

    // Call onModuleInit manually
    await service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('confirmAppointment', () => {
    it('should send appointment confirmation email', async () => {
      const appointmentData = {
        to: 'customer@test.com',
        text: 'Test confirmation',
        appointment: {
          customer: { full_name: 'Test Customer' },
          startTime: new Date(),
          services: [
            { name: 'Service 1', price: '100,000 VND' },
          ],
          staff: { name: 'Test Staff' },
          address: '123 Test Street',
        },
      };

      await service.confirmAppointment(appointmentData);

      expect(transporter.sendMail).toHaveBeenCalled();
      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe(appointmentData.to);
      expect(callArgs.subject).toContain('Xác nhận lịch hẹn');
      expect(callArgs.template).toBe('appointment-confirmation');
    });
  });

  describe('confirmAppointmentDeposit', () => {
    it('should send appointment deposit confirmation email', async () => {
      const appointmentData = {
        to: 'customer@test.com',
        text: 'Test deposit confirmation',
        appointment: {
          customer: { full_name: 'Test Customer' },
          startTime: new Date(),
          services: [
            { name: 'Service 1', price: '100,000 VND' },
          ],
          staff: { full_name: 'Test Staff' },
          address: '123 Test Street',
          depositAmount: '50,000 VND',
        },
      };

      await service.confirmAppointmentDeposit(appointmentData);

      expect(transporter.sendMail).toHaveBeenCalled();
      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.template).toBe('appointment-deposit-confirmation');
    });
  });

  describe('sendThankYouForUsingServiceEmail', () => {
    it('should send thank you email', async () => {
      const data = {
        to: 'customer@test.com',
        customerName: 'Test Customer',
        services: [
          { name: 'Service 1', price: '100,000 VND' },
        ],
        usedDate: '01/01/2024',
        specialistName: 'Test Doctor',
        spaName: 'GenSpa',
        spaHotline: '0123456789',
        feedbackUrl: 'http://localhost:3000/feedback',
      };

      await service.sendThankYouForUsingServiceEmail(data);

      expect(transporter.sendMail).toHaveBeenCalled();
      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.subject).toContain('Cảm ơn bạn đã sử dụng dịch vụ');
      expect(callArgs.template).toBe('appointment-completed');
    });
  });

  describe('sendResetPasswordEmail', () => {
    it('should send reset password email', async () => {
      const data = {
        to: 'customer@test.com',
        user: {
          full_name: 'Test Customer',
          email: 'customer@test.com',
        },
        token: 'reset-token',
        resetUrl: 'http://localhost:3000/reset-password?token=reset-token',
      };

      await service.sendResetPasswordEmail(data);

      expect(transporter.sendMail).toHaveBeenCalled();
      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe(data.user.email);
      expect(callArgs.subject).toContain('Đặt lại mật khẩu');
      expect(callArgs.template).toBe('forgot-password');
    });
  });

  describe('sendSuccessResetPasswordEmail', () => {
    it('should send success reset password email', async () => {
      const data = {
        to: 'customer@test.com',
        user: {
          full_name: 'Test Customer',
          email: 'customer@test.com',
        },
        spaHotline: '0123456789',
      };

      await service.sendSuccessResetPasswordEmail(data);

      expect(transporter.sendMail).toHaveBeenCalled();
      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.subject).toContain('Đặt lại mật khẩu thành công');
      expect(callArgs.template).toBe('forgot-password-success');
    });
  });

  describe('confirmInvoice', () => {
    it('should send invoice confirmation email', async () => {
      const invoiceData = {
        to: 'customer@test.com',
        text: 'Test invoice',
        invoice: {
          customerName: 'Test Customer',
          spaName: 'GenSpa',
          createdAt: new Date(),
          totalAmount: 100000,
          finalAmount: 90000,
          discountAmount: 10000,
          details: [
            {
              serviceName: 'Service 1',
              quantity: 1,
              price: 100000,
            },
          ],
        },
      };

      await service.confirmInvoice(invoiceData);

      expect(transporter.sendMail).toHaveBeenCalled();
      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.subject).toContain('Hóa đơn dịch vụ');
      expect(callArgs.template).toBe('invoice-confirmation');
    });
  });

  describe('notifySpaOfAppointment', () => {
    it('should send notification email to spa', async () => {
      const appointmentData = {
        to: 'spa@test.com',
        text: 'Test notification',
        appointment: {
          customer: { name: 'Test Customer' },
          spa: {
            name: 'GenSpa',
            address: '123 Test Street',
          },
          startTime: new Date(),
          service: { name: 'Test Service' },
        },
      };

      await service.notifySpaOfAppointment(appointmentData);

      expect(transporter.sendMail).toHaveBeenCalled();
      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.subject).toContain('Khách hàng mới đặt lịch');
      expect(callArgs.template).toBe('appointment-from-customer');
    });
  });
});
