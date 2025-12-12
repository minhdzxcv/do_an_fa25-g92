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

    it('should handle appointment without staff', async () => {
      const appointmentData = {
        to: 'customer@test.com',
        text: 'Test confirmation',
        appointment: {
          customer: { full_name: 'Test Customer' },
          startTime: new Date(),
          services: [
            { name: 'Service 1', price: '100,000 VND' },
          ],
          staff: null,
          address: '123 Test Street',
        },
      };

      await service.confirmAppointment(appointmentData);

      expect(transporter.sendMail).toHaveBeenCalled();
      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.context.staffName).toBe('Đang cập nhật');
    });

    it('should format appointment date correctly', async () => {
      const startTime = new Date('2025-01-15T10:30:00');
      const appointmentData = {
        to: 'customer@test.com',
        text: 'Test confirmation',
        appointment: {
          customer: { full_name: 'Test Customer' },
          startTime,
          services: [
            { name: 'Service 1', price: '100,000 VND' },
          ],
          staff: { name: 'Test Staff' },
          address: '123 Test Street',
        },
      };

      await service.confirmAppointment(appointmentData);

      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.context.startTime).toBe(startTime.toLocaleString());
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

    it('should use default values when optional fields not provided', async () => {
      const data = {
        to: 'customer@test.com',
        customerName: 'Test Customer',
        services: [
          { name: 'Service 1', price: '100,000 VND' },
        ],
        usedDate: '01/01/2024',
        spaName: 'GenSpa',
      };

      await service.sendThankYouForUsingServiceEmail(data);

      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.context.specialistName).toBe('Đang cập nhật');
      expect(callArgs.context.spaHotline).toBe('1900 1234');
      expect(callArgs.context.feedbackUrl).toBe('https://vicompose.vn/feedback');
    });

    it('should include current year in context', async () => {
      const data = {
        to: 'customer@test.com',
        customerName: 'Test Customer',
        services: [
          { name: 'Service 1', price: '100,000 VND' },
        ],
        usedDate: '01/01/2024',
        spaName: 'GenSpa',
      };

      await service.sendThankYouForUsingServiceEmail(data);

      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.context.year).toBe(new Date().getFullYear());
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

  describe('sendVerifyEmail', () => {
    it('should send verify email', async () => {
      const data = {
        to: 'customer@test.com',
        customerName: 'Test Customer',
        verifyUrl: 'http://localhost:3000/verify?token=abc123',
        spaName: 'GenSpa',
        spaHotline: '0123456789',
      };

      await service.sendVerifyEmail(data);

      expect(transporter.sendMail).toHaveBeenCalled();
      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe(data.to);
      expect(callArgs.subject).toContain('Xác thực email');
      expect(callArgs.template).toBe('verify-email');
      expect(callArgs.context.verifyUrl).toBe(data.verifyUrl);
    });

    it('should use default spa info when not provided', async () => {
      const data = {
        to: 'customer@test.com',
        customerName: 'Test Customer',
        verifyUrl: 'http://localhost:3000/verify?token=abc123',
      };

      await service.sendVerifyEmail(data);

      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.context.spaName).toBe('GenSpa');
      expect(callArgs.context.spaHotline).toBe('1900 1234');
    });
  });

  describe('sendVoucherEmail', () => {
    it('should send voucher email', async () => {
      const mockVoucher = {
        id: 'voucher-1',
        code: 'SAVE50K',
        description: 'Giảm 50,000 VND',
        discountAmount: 50000,
        validFrom: new Date(),
        validTo: new Date(),
      } as any;

      const data = {
        to: 'customer@test.com',
        customerName: 'Test Customer',
        voucher: mockVoucher,
        deadUseDate: '31/12/2025',
        spaName: 'GenSpa',
        spaHotline: '0123456789',
      };

      await service.sendVoucherEmail(data);

      expect(transporter.sendMail).toHaveBeenCalled();
      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe(data.to);
      expect(callArgs.subject).toContain('voucher mới');
      expect(callArgs.template).toBe('new-voucher');
      expect(callArgs.context.voucher).toEqual(mockVoucher);
    });

    it('should use default values when optional fields not provided', async () => {
      const mockVoucher = {
        id: 'voucher-1',
        code: 'SAVE50K',
      } as any;

      const data = {
        to: 'customer@test.com',
        customerName: 'Test Customer',
        voucher: mockVoucher,
      };

      await service.sendVoucherEmail(data);

      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.context.usedDate).toBe('Đang cập nhật');
      expect(callArgs.context.spaName).toBe('GenSpa');
    });
  });

  describe('remindUpcomingAppointment', () => {
    it('should send reminder email', async () => {
      const appointmentData = {
        to: 'customer@test.com',
        text: 'Test reminder',
        appointment: {
          customer: { full_name: 'Test Customer' },
          startTime: new Date(),
          services: [
            { name: 'Service 1', price: '100,000 VND' },
          ],
          staff: { name: 'Test Staff' },
        },
      };

      await service.remindUpcomingAppointment(appointmentData);

      expect(transporter.sendMail).toHaveBeenCalled();
      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe(appointmentData.to);
      expect(callArgs.subject).toContain('Nhắc nhở lịch hẹn');
      expect(callArgs.template).toBe('appointment-reminder');
    });

    it('should handle reminder without staff', async () => {
      const appointmentData = {
        to: 'customer@test.com',
        text: 'Test reminder',
        appointment: {
          customer: { full_name: 'Test Customer' },
          startTime: new Date(),
          services: [
            { name: 'Service 1', price: '100,000 VND' },
          ],
          staff: null,
        },
      };

      await service.remindUpcomingAppointment(appointmentData);

      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.context.staffName).toBe('Đang cập nhật');
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

    it('should format currency correctly', async () => {
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
              quantity: 2,
              price: 50000,
            },
          ],
        },
      };

      await service.confirmInvoice(invoiceData);

      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.context.totalAmountFormatted).toContain('100.000');
      expect(callArgs.context.finalAmountFormatted).toContain('90.000');
      expect(callArgs.context.discountAmountFormatted).toContain('10.000');
    });

    it('should handle invoice without discount', async () => {
      const invoiceData = {
        to: 'customer@test.com',
        text: 'Test invoice',
        invoice: {
          customerName: 'Test Customer',
          spaName: 'GenSpa',
          createdAt: new Date(),
          totalAmount: 100000,
          finalAmount: 100000,
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

      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.context.discountAmountFormatted).toBeNull();
    });

    it('should calculate total for each detail correctly', async () => {
      const invoiceData = {
        to: 'customer@test.com',
        text: 'Test invoice',
        invoice: {
          customerName: 'Test Customer',
          spaName: 'GenSpa',
          createdAt: new Date(),
          totalAmount: 300000,
          finalAmount: 300000,
          details: [
            {
              serviceName: 'Service 1',
              quantity: 2,
              price: 100000,
            },
            {
              serviceName: 'Service 2',
              quantity: 1,
              price: 100000,
            },
          ],
        },
      };

      await service.confirmInvoice(invoiceData);

      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.context.details).toHaveLength(2);
      expect(callArgs.context.details[0].quantity).toBe(2);
      expect(callArgs.context.details[0].totalFormatted).toContain('200.000');
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
