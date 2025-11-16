import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { Appointment } from '@/entities/appointment.entity';
import { Spa } from '@/entities/spa.entity';
import { Internal } from '@/entities/internal.entity';
import { Doctor } from '@/entities/doctor.entity';
import { MailService } from '../mail/mail.service';
import { AppointmentStatus } from '@/entities/enums/appointment-status';

// Mock PayOS
jest.mock('@payos/node', () => {
  return jest.fn().mockImplementation(() => ({
    createPaymentLink: jest.fn(),
  }));
});

describe('PaymentService', () => {
  let service: PaymentService;
  let appointmentRepository: any;
  let spaRepository: any;
  let internalRepository: any;
  let doctorRepository: any;
  let mailService: MailService;
  let configService: ConfigService;
  let payos: any;

  const mockSpa = {
    id: 'spa-1',
    name: 'GenSpa',
    address: '123 Test Street',
    phone: '0123456789',
  };

  const mockCustomer = {
    id: 'customer-1',
    email: 'customer@test.com',
    full_name: 'Test Customer',
  };

  const mockStaff = {
    id: 'staff-1',
    full_name: 'Test Staff',
  };

  const mockDoctor = {
    id: 'doctor-1',
    full_name: 'Test Doctor',
  };

  const mockService = {
    id: 'service-1',
    name: 'Test Service',
    price: 100000,
  };

  const mockAppointment = {
    id: 'appointment-1',
    orderCode: 12345,
    customer: mockCustomer,
    customerId: 'customer-1',
    staffId: 'staff-1',
    doctorId: 'doctor-1',
    status: AppointmentStatus.Confirmed,
    startTime: new Date(),
    details: [
      {
        service: mockService,
        price: 100000,
      },
    ],
    totalAmount: 100000,
    depositAmount: 0,
  };

  beforeEach(async () => {
    const mockAppointmentRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const mockSpaRepository = {
      findOne: jest.fn(),
    };

    const mockInternalRepository = {
      findOne: jest.fn(),
    };

    const mockDoctorRepository = {
      findOne: jest.fn(),
    };

    const mockMailService = {
      confirmAppointmentDeposit: jest.fn().mockResolvedValue(undefined),
      sendThankYouForUsingServiceEmail: jest.fn().mockResolvedValue(undefined),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          API_KEY_PAYMENT: 'test-api-key',
          CLIENT_ID_PAYMENT: 'test-client-id',
          CHECKSUM_KEY_PAYMENT: 'test-checksum-key',
          FRONTEND_URL: 'http://localhost:3000',
        };
        return config[key];
      }),
    };

    const PayOS = require('@payos/node');
    payos = new PayOS();
    payos.createPaymentLink = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockAppointmentRepository,
        },
        {
          provide: getRepositoryToken(Spa),
          useValue: mockSpaRepository,
        },
        {
          provide: getRepositoryToken(Internal),
          useValue: mockInternalRepository,
        },
        {
          provide: getRepositoryToken(Doctor),
          useValue: mockDoctorRepository,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    appointmentRepository = module.get(getRepositoryToken(Appointment));
    spaRepository = module.get(getRepositoryToken(Spa));
    internalRepository = module.get(getRepositoryToken(Internal));
    doctorRepository = module.get(getRepositoryToken(Doctor));
    mailService = module.get<MailService>(MailService);
    configService = module.get<ConfigService>(ConfigService);

    // Mock loadSpa
    spaRepository.findOne.mockResolvedValue(mockSpa);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentLink', () => {
    it('should create payment link successfully', async () => {
      const order = {
        orderCode: 12345,
        amount: 100000,
        description: 'Test payment',
        cancelUrl: 'http://localhost:3000/cancel',
        returnUrl: 'http://localhost:3000/return',
      };

      const mockPaymentLink = {
        checkoutUrl: 'https://payos.vn/checkout',
        orderCode: order.orderCode,
      };

      payos.createPaymentLink.mockResolvedValue(mockPaymentLink);

      const result = await service.createPaymentLink(order);

      expect(result).toEqual(mockPaymentLink);
      expect(payos.createPaymentLink).toHaveBeenCalledWith(order);
    });

    it('should throw error when payment link creation fails', async () => {
      const order = {
        orderCode: 12345,
        amount: 100000,
        description: 'Test payment',
        cancelUrl: 'http://localhost:3000/cancel',
        returnUrl: 'http://localhost:3000/return',
      };

      payos.createPaymentLink.mockResolvedValue(null);

      await expect(service.createPaymentLink(order)).rejects.toThrow(
        'Failed to create payment link',
      );
    });
  });

  describe('updatePaymentStatusDeposited', () => {
    it('should update payment status to deposited successfully', async () => {
      const body = { orderCode: '12345' };
      const appointmentWithConfirmed = {
        ...mockAppointment,
        status: AppointmentStatus.Confirmed,
      };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithConfirmed);
      internalRepository.findOne.mockResolvedValue(mockStaff);
      spaRepository.findOne.mockResolvedValue(mockSpa);
      appointmentRepository.save.mockResolvedValue({
        ...appointmentWithConfirmed,
        status: AppointmentStatus.Deposited,
        depositAmount: 50000,
      });

      await service.updatePaymentStatusDeposited(body);

      expect(mailService.confirmAppointmentDeposit).toHaveBeenCalled();
      expect(appointmentRepository.save).toHaveBeenCalled();
      const savedAppointment = appointmentRepository.save.mock.calls[0][0];
      expect(savedAppointment.status).toBe(AppointmentStatus.Deposited);
    });

    it('should throw error when appointment not found', async () => {
      const body = { orderCode: '12345' };

      appointmentRepository.findOne.mockResolvedValue(null);

      await expect(service.updatePaymentStatusDeposited(body)).rejects.toThrow(
        'Không tìm thấy lịch hẹn',
      );
    });

    it('should throw error when appointment status is invalid', async () => {
      const body = { orderCode: '12345' };
      const appointmentWithInvalidStatus = {
        ...mockAppointment,
        status: AppointmentStatus.Pending,
      };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithInvalidStatus);

      await expect(service.updatePaymentStatusDeposited(body)).rejects.toThrow(
        'Trạng thái lịch hẹn không hợp lệ để cập nhật thanh toán',
      );
    });
  });

  describe('updatePaymentStatusPaid', () => {
    it('should update payment status to paid successfully', async () => {
      const body = { orderCode: '12345' };
      const appointmentWithCompleted = {
        ...mockAppointment,
        status: AppointmentStatus.Completed,
      };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithCompleted);
      doctorRepository.findOne.mockResolvedValue(mockDoctor);
      spaRepository.findOne.mockResolvedValue(mockSpa);
      appointmentRepository.save.mockResolvedValue({
        ...appointmentWithCompleted,
        status: AppointmentStatus.Paid,
        paymentMethod: 'qr',
      });

      await service.updatePaymentStatusPaid(body);

      expect(mailService.sendThankYouForUsingServiceEmail).toHaveBeenCalled();
      expect(appointmentRepository.save).toHaveBeenCalled();
      const savedAppointment = appointmentRepository.save.mock.calls[0][0];
      expect(savedAppointment.status).toBe(AppointmentStatus.Paid);
      expect(savedAppointment.paymentMethod).toBe('qr');
    });

    it('should throw error when appointment not found', async () => {
      const body = { orderCode: '12345' };

      appointmentRepository.findOne.mockResolvedValue(null);

      await expect(service.updatePaymentStatusPaid(body)).rejects.toThrow(
        'Không tìm thấy lịch hẹn',
      );
    });

    it('should throw error when appointment status is invalid', async () => {
      const body = { orderCode: '12345' };
      const appointmentWithInvalidStatus = {
        ...mockAppointment,
        status: AppointmentStatus.Pending,
      };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithInvalidStatus);

      await expect(service.updatePaymentStatusPaid(body)).rejects.toThrow(
        'Trạng thái lịch hẹn không hợp lệ để cập nhật thanh toán',
      );
    });
  });
});
