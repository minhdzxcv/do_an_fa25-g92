import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { Appointment } from '@/entities/appointment.entity';
import { Spa } from '@/entities/spa.entity';
import { Internal } from '@/entities/internal.entity';
import { Doctor } from '@/entities/doctor.entity';
import { Invoice } from '@/entities/invoice.entity';
import { InvoiceDetail } from '@/entities/invoiceDetail.entity';
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
  let invoiceRepository: any;
  let invoiceDetailRepository: any;
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
      update: jest.fn(),
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

    const mockInvoiceRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockInvoiceDetailRepository = {
      create: jest.fn(),
      save: jest.fn(),
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
          provide: getRepositoryToken(Invoice),
          useValue: mockInvoiceRepository,
        },
        {
          provide: getRepositoryToken(InvoiceDetail),
          useValue: mockInvoiceDetailRepository,
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
    invoiceRepository = module.get(getRepositoryToken(Invoice));
    invoiceDetailRepository = module.get(getRepositoryToken(InvoiceDetail));
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

      // Mock the service's payos instance directly
      (service as any).payos.createPaymentLink = jest.fn().mockResolvedValue(mockPaymentLink);

      const result = await service.createPaymentLink(order);

      expect(result).toEqual(mockPaymentLink);
      expect((service as any).payos.createPaymentLink).toHaveBeenCalledWith(order);
    });

    it('should throw error when payment link creation fails', async () => {
      const order = {
        orderCode: 12345,
        amount: 100000,
        description: 'Test payment',
        cancelUrl: 'http://localhost:3000/cancel',
        returnUrl: 'http://localhost:3000/return',
      };

      // Mock the service's payos instance to return null
      (service as any).payos.createPaymentLink = jest.fn().mockResolvedValue(null);

      await expect(service.createPaymentLink(order)).rejects.toThrow(
        'Failed to create payment link',
      );
    });

    it('should throw error when checkoutUrl is missing', async () => {
      const order = {
        orderCode: 12345,
        amount: 100000,
        description: 'Test payment',
        cancelUrl: 'http://localhost:3000/cancel',
        returnUrl: 'http://localhost:3000/return',
      };

      // Mock the service's payos instance to return object without checkoutUrl
      (service as any).payos.createPaymentLink = jest.fn().mockResolvedValue({
        orderCode: order.orderCode,
      });

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

      const mockInvoice = {
        id: 'invoice-1',
        total_amount: 50000,
        status: 'completed',
      };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithConfirmed);
      internalRepository.findOne.mockResolvedValue(mockStaff);
      spaRepository.findOne.mockResolvedValue(mockSpa);
      invoiceRepository.create.mockReturnValue(mockInvoice);
      invoiceRepository.save.mockResolvedValue(mockInvoice);
      appointmentRepository.save.mockResolvedValue({
        ...appointmentWithConfirmed,
        status: AppointmentStatus.Deposited,
        depositAmount: 50000,
      });

      await service.updatePaymentStatusDeposited(body);

      expect(invoiceRepository.create).toHaveBeenCalled();
      expect(invoiceRepository.save).toHaveBeenCalledWith(mockInvoice);
      expect(mailService.confirmAppointmentDeposit).toHaveBeenCalled();
      expect(appointmentRepository.save).toHaveBeenCalled();
      const savedAppointment = appointmentRepository.save.mock.calls[0][0];
      expect(savedAppointment.status).toBe(AppointmentStatus.Deposited);
    });

    it('should calculate deposit amount as 50% of total amount', async () => {
      const body = { orderCode: '12345' };
      const appointmentWithConfirmed = {
        ...mockAppointment,
        totalAmount: 200000,
        status: AppointmentStatus.Confirmed,
      };

      const mockInvoice = { id: 'invoice-1' };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithConfirmed);
      internalRepository.findOne.mockResolvedValue(mockStaff);
      spaRepository.findOne.mockResolvedValue(mockSpa);
      invoiceRepository.create.mockReturnValue(mockInvoice);
      invoiceRepository.save.mockResolvedValue(mockInvoice);
      appointmentRepository.save.mockResolvedValue({
        ...appointmentWithConfirmed,
        status: AppointmentStatus.Deposited,
        depositAmount: 100000,
      });

      await service.updatePaymentStatusDeposited(body);

      const savedAppointment = appointmentRepository.save.mock.calls[0][0];
      expect(savedAppointment.depositAmount).toBe(100000); // 50% of 200000
    });

    it('should handle appointment with zero total amount', async () => {
      const body = { orderCode: '12345' };
      const appointmentWithZeroAmount = {
        ...mockAppointment,
        totalAmount: 0,
        status: AppointmentStatus.Confirmed,
      };

      const mockInvoice = { id: 'invoice-1' };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithZeroAmount);
      internalRepository.findOne.mockResolvedValue(mockStaff);
      spaRepository.findOne.mockResolvedValue(mockSpa);
      invoiceRepository.create.mockReturnValue(mockInvoice);
      invoiceRepository.save.mockResolvedValue(mockInvoice);
      appointmentRepository.save.mockResolvedValue({
        ...appointmentWithZeroAmount,
        status: AppointmentStatus.Deposited,
        depositAmount: 0,
      });

      await service.updatePaymentStatusDeposited(body);

      const savedAppointment = appointmentRepository.save.mock.calls[0][0];
      expect(savedAppointment.depositAmount).toBe(0);
    });

    it('should handle appointment with empty details array', async () => {
      const body = { orderCode: '12345' };
      const appointmentWithNoDetails = {
        ...mockAppointment,
        details: [],
        status: AppointmentStatus.Confirmed,
      };

      const mockInvoice = { id: 'invoice-1' };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithNoDetails);
      internalRepository.findOne.mockResolvedValue(mockStaff);
      spaRepository.findOne.mockResolvedValue(mockSpa);
      invoiceRepository.create.mockReturnValue(mockInvoice);
      invoiceRepository.save.mockResolvedValue(mockInvoice);
      appointmentRepository.save.mockResolvedValue({
        ...appointmentWithNoDetails,
        status: AppointmentStatus.Deposited,
      });

      await service.updatePaymentStatusDeposited(body);

      expect(mailService.confirmAppointmentDeposit).toHaveBeenCalled();
      const emailCall = (mailService.confirmAppointmentDeposit as jest.Mock).mock.calls[0][0];
      expect(emailCall.appointment.services).toEqual([]);
    });

    it('should handle service with null price using default from service entity', async () => {
      const body = { orderCode: '12345' };
      const appointmentWithNullPrice = {
        ...mockAppointment,
        status: AppointmentStatus.Confirmed,
        details: [
          {
            service: { ...mockService, price: 150000 },
            price: null, // null price in detail
          },
        ],
      };

      const mockInvoice = { id: 'invoice-1' };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithNullPrice);
      internalRepository.findOne.mockResolvedValue(mockStaff);
      spaRepository.findOne.mockResolvedValue(mockSpa);
      invoiceRepository.create.mockReturnValue(mockInvoice);
      invoiceRepository.save.mockResolvedValue(mockInvoice);
      appointmentRepository.save.mockResolvedValue({
        ...appointmentWithNullPrice,
        status: AppointmentStatus.Deposited,
      });

      await service.updatePaymentStatusDeposited(body);

      expect(invoiceRepository.create).toHaveBeenCalled();
      const createCall = invoiceRepository.create.mock.calls[0][0];
      expect(createCall.details[0].price).toBe(150000); // Falls back to service.price
    });

    it('should default to 0 when both detail price and service price are null', async () => {
      const body = { orderCode: '12345' };
      const appointmentWithAllNullPrices = {
        ...mockAppointment,
        status: AppointmentStatus.Confirmed,
        totalAmount: 0,
        details: [
          {
            service: { ...mockService, price: null },
            price: null,
          },
        ],
      };

      const mockInvoice = { id: 'invoice-1' };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithAllNullPrices);
      internalRepository.findOne.mockResolvedValue(mockStaff);
      spaRepository.findOne.mockResolvedValue(mockSpa);
      invoiceRepository.create.mockReturnValue(mockInvoice);
      invoiceRepository.save.mockResolvedValue(mockInvoice);
      appointmentRepository.save.mockResolvedValue({
        ...appointmentWithAllNullPrices,
        status: AppointmentStatus.Deposited,
      });

      await service.updatePaymentStatusDeposited(body);

      expect(invoiceRepository.create).toHaveBeenCalled();
      const createCall = invoiceRepository.create.mock.calls[0][0];
      expect(createCall.details[0].price).toBe(0); // Falls back to 0
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

    it('should handle staff not found with default value', async () => {
      const body = { orderCode: '12345' };
      const appointmentWithConfirmed = {
        ...mockAppointment,
        status: AppointmentStatus.Confirmed,
      };

      const mockInvoice = { id: 'invoice-1' };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithConfirmed);
      internalRepository.findOne.mockResolvedValue(null);
      spaRepository.findOne.mockResolvedValue(mockSpa);
      invoiceRepository.create.mockReturnValue(mockInvoice);
      invoiceRepository.save.mockResolvedValue(mockInvoice);
      appointmentRepository.save.mockResolvedValue({
        ...appointmentWithConfirmed,
        status: AppointmentStatus.Deposited,
      });

      await service.updatePaymentStatusDeposited(body);

      expect(mailService.confirmAppointmentDeposit).toHaveBeenCalled();
      const emailCall = (mailService.confirmAppointmentDeposit as jest.Mock).mock.calls[0][0];
      expect(emailCall.appointment.staff.full_name).toBe('Đang cập nhật');
    });
  });

  describe('updatePaymentStatusPaid', () => {
    it('should update payment status to paid successfully', async () => {
      const body = { orderCode: '12345', paymentMethod: 'qr', staffId: 'staff-1' };
      const appointmentWithCompleted = {
        ...mockAppointment,
        status: AppointmentStatus.Completed,
      };

      const mockInvoice = {
        id: 'invoice-2',
        finalAmount: 50000,
        status: 'completed',
      };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithCompleted);
      doctorRepository.findOne.mockResolvedValue(mockDoctor);
      spaRepository.findOne.mockResolvedValue(mockSpa);
      invoiceRepository.create.mockReturnValue(mockInvoice);
      invoiceRepository.save.mockResolvedValue(mockInvoice);
      appointmentRepository.save.mockResolvedValue({
        ...appointmentWithCompleted,
        status: AppointmentStatus.Paid,
        paymentMethod: 'qr',
      });

      await service.updatePaymentStatusPaid(body);

      expect(invoiceRepository.create).toHaveBeenCalled();
      expect(invoiceRepository.save).toHaveBeenCalledWith(mockInvoice);
      expect(mailService.sendThankYouForUsingServiceEmail).toHaveBeenCalled();
      expect(appointmentRepository.save).toHaveBeenCalled();
      const savedAppointment = appointmentRepository.save.mock.calls[0][0];
      expect(savedAppointment.status).toBe(AppointmentStatus.Paid);
      expect(savedAppointment.paymentMethod).toBe('qr');
    });

    it('should calculate final amount as 50% of total amount', async () => {
      const body = { orderCode: '12345', paymentMethod: 'cash', staffId: 'staff-1' };
      const appointmentWithCompleted = {
        ...mockAppointment,
        totalAmount: 300000,
        status: AppointmentStatus.Completed,
      };

      const mockInvoice = { id: 'invoice-2' };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithCompleted);
      doctorRepository.findOne.mockResolvedValue(mockDoctor);
      spaRepository.findOne.mockResolvedValue(mockSpa);
      invoiceRepository.create.mockReturnValue(mockInvoice);
      invoiceRepository.save.mockResolvedValue(mockInvoice);
      appointmentRepository.save.mockResolvedValue({
        ...appointmentWithCompleted,
        status: AppointmentStatus.Paid,
      });

      await service.updatePaymentStatusPaid(body);

      const createCall = invoiceRepository.create.mock.calls[0][0];
      expect(createCall.total_amount).toBe(150000); // 50% of 300000
      expect(createCall.finalAmount).toBe(150000);
    });

    it('should set payment method from request body', async () => {
      const body = { orderCode: '12345', paymentMethod: 'cash', staffId: 'staff-1' };
      const appointmentWithCompleted = {
        ...mockAppointment,
        status: AppointmentStatus.Completed,
      };

      const mockInvoice = { id: 'invoice-2' };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithCompleted);
      doctorRepository.findOne.mockResolvedValue(mockDoctor);
      spaRepository.findOne.mockResolvedValue(mockSpa);
      invoiceRepository.create.mockReturnValue(mockInvoice);
      invoiceRepository.save.mockResolvedValue(mockInvoice);
      appointmentRepository.save.mockResolvedValue({
        ...appointmentWithCompleted,
        status: AppointmentStatus.Paid,
      });

      await service.updatePaymentStatusPaid(body);

      const createCall = invoiceRepository.create.mock.calls[0][0];
      expect(createCall.payment_method).toBe('cash');
      expect(createCall.cashierId).toBe('staff-1');
    });

    it('should include feedback URL in thank you email', async () => {
      const body = { orderCode: '12345', paymentMethod: 'qr', staffId: 'staff-1' };
      const appointmentWithCompleted = {
        ...mockAppointment,
        id: 'test-appointment-id',
        status: AppointmentStatus.Completed,
      };

      const mockInvoice = { id: 'invoice-2' };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithCompleted);
      doctorRepository.findOne.mockResolvedValue(mockDoctor);
      spaRepository.findOne.mockResolvedValue(mockSpa);
      invoiceRepository.create.mockReturnValue(mockInvoice);
      invoiceRepository.save.mockResolvedValue(mockInvoice);
      appointmentRepository.save.mockResolvedValue({
        ...appointmentWithCompleted,
        status: AppointmentStatus.Paid,
      });

      await service.updatePaymentStatusPaid(body);

      expect(mailService.sendThankYouForUsingServiceEmail).toHaveBeenCalled();
      const emailCall = (mailService.sendThankYouForUsingServiceEmail as jest.Mock).mock.calls[0][0];
      expect(emailCall.feedbackUrl).toContain('test-appointment-id');
      expect(emailCall.feedbackUrl).toContain('http://localhost:3000/feedback');
    });

    it('should throw error when appointment not found', async () => {
      const body = { orderCode: '12345', paymentMethod: 'qr', staffId: 'staff-1' };

      appointmentRepository.findOne.mockResolvedValue(null);

      await expect(service.updatePaymentStatusPaid(body)).rejects.toThrow(
        'Không tìm thấy lịch hẹn',
      );
    });

    it('should throw error when appointment status is invalid', async () => {
      const body = { orderCode: '12345', paymentMethod: 'qr', staffId: 'staff-1' };
      const appointmentWithInvalidStatus = {
        ...mockAppointment,
        status: AppointmentStatus.Pending,
      };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithInvalidStatus);

      await expect(service.updatePaymentStatusPaid(body)).rejects.toThrow(
        'Trạng thái lịch hẹn không hợp lệ để cập nhật thanh toán',
      );
    });

    it('should handle doctor not found with default value', async () => {
      const body = { orderCode: '12345', paymentMethod: 'cash', staffId: 'staff-1' };
      const appointmentWithCompleted = {
        ...mockAppointment,
        status: AppointmentStatus.Completed,
      };

      const mockInvoice = { id: 'invoice-2' };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithCompleted);
      doctorRepository.findOne.mockResolvedValue(null);
      spaRepository.findOne.mockResolvedValue(mockSpa);
      invoiceRepository.create.mockReturnValue(mockInvoice);
      invoiceRepository.save.mockResolvedValue(mockInvoice);
      appointmentRepository.save.mockResolvedValue({
        ...appointmentWithCompleted,
        status: AppointmentStatus.Paid,
      });

      await service.updatePaymentStatusPaid(body);

      expect(mailService.sendThankYouForUsingServiceEmail).toHaveBeenCalled();
      const emailCall = (mailService.sendThankYouForUsingServiceEmail as jest.Mock).mock.calls[0][0];
      expect(emailCall.specialistName).toBe('Đang cập nhật');
    });
  });

  describe('getPaymentStats', () => {
    it('should return payment statistics with date range', async () => {
      const dto = {
        fromDate: '2025-11-01T00:00:00.000Z',
        toDate: '2025-11-30T23:59:59.999Z',
      };

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
        getRawMany: jest.fn(),
      };

      invoiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      invoiceRepository.count.mockResolvedValue(10);

      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({ totalCash: '500000' })
        .mockResolvedValueOnce({ totalTransfer: '300000' })
        .mockResolvedValueOnce({ totalNullCashier: '0' });

      mockQueryBuilder.getRawMany.mockResolvedValue([
        { cashierId: 'staff-1', cashierName: 'Staff A', totalPerCashier: '400000' },
        { cashierId: 'staff-2', cashierName: 'Staff B', totalPerCashier: '400000' },
      ]);

      const result = await service.getPaymentStats(dto);

      expect(result.totalCash).toBe(500000);
      expect(result.totalTransfer).toBe(300000);
      expect(result.totalCollected).toBe(800000);
      expect(result.cashiers).toHaveLength(2);
      expect(result.countInvoices).toBe(10);
      expect(result.fromDate).toBe(dto.fromDate);
      expect(result.toDate).toBe(dto.toDate);
    });

    it('should use default 30 days when no date range provided', async () => {
      const dto = {};

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
        getRawMany: jest.fn(),
      };

      invoiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      invoiceRepository.count.mockResolvedValue(5);

      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({ totalCash: '100000' })
        .mockResolvedValueOnce({ totalTransfer: '200000' })
        .mockResolvedValueOnce({ totalNullCashier: '0' });

      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getPaymentStats(dto);

      expect(result.totalCash).toBe(100000);
      expect(result.totalTransfer).toBe(200000);
      expect(result.totalCollected).toBe(300000);
      expect(result.cashiers).toHaveLength(0);
    });

    it('should include null cashier when exists', async () => {
      const dto = {};

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
        getRawMany: jest.fn(),
      };

      invoiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      invoiceRepository.count.mockResolvedValue(3);

      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({ totalCash: '0' })
        .mockResolvedValueOnce({ totalTransfer: '0' })
        .mockResolvedValueOnce({ totalNullCashier: '150000' });

      mockQueryBuilder.getRawMany.mockResolvedValue([
        { cashierId: 'staff-1', cashierName: 'Staff A', totalPerCashier: '100000' },
      ]);

      const result = await service.getPaymentStats(dto);

      expect(result.cashiers).toHaveLength(2);
      expect(result.cashiers[0].cashierId).toBeNull();
      expect(result.cashiers[0].name).toBe('Không có thu ngân');
      expect(result.cashiers[0].total).toBe(150000);
    });

    it('should correctly sum total collected from cash and transfer', async () => {
      const dto = {};

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
        getRawMany: jest.fn(),
      };

      invoiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      invoiceRepository.count.mockResolvedValue(5);

      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({ totalCash: '750000' })
        .mockResolvedValueOnce({ totalTransfer: '250000' })
        .mockResolvedValueOnce({ totalNullCashier: '0' });

      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getPaymentStats(dto);

      expect(result.totalCollected).toBe(1000000); // 750000 + 250000
    });
  });

  describe('getInvoices', () => {
    it('should return all invoices with relations', async () => {
      const mockInvoices = [
        {
          id: 'invoice-1',
          total_amount: 100000,
          customer: mockCustomer,
          details: [{ serviceId: 'service-1', price: 100000 }],
        },
        {
          id: 'invoice-2',
          total_amount: 200000,
          customer: mockCustomer,
          details: [{ serviceId: 'service-2', price: 200000 }],
        },
      ];

      invoiceRepository.find.mockResolvedValue(mockInvoices);

      const result = await service.getInvoices();

      expect(result).toEqual(mockInvoices);
      expect(invoiceRepository.find).toHaveBeenCalledWith({
        relations: ['customer', 'appointment', 'details', 'details.service', 'cashier'],
        order: { createdAt: 'DESC' },
      });
    });

    it('should return empty array when no invoices', async () => {
      invoiceRepository.find.mockResolvedValue([]);

      const result = await service.getInvoices();

      expect(result).toEqual([]);
    });

    it('should order invoices by createdAt descending', async () => {
      invoiceRepository.find.mockResolvedValue([]);

      await service.getInvoices();

      expect(invoiceRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'DESC' },
        }),
      );
    });

    it('should include all required relations', async () => {
      invoiceRepository.find.mockResolvedValue([]);

      await service.getInvoices();

      const findCall = invoiceRepository.find.mock.calls[0][0];
      expect(findCall.relations).toContain('customer');
      expect(findCall.relations).toContain('appointment');
      expect(findCall.relations).toContain('details');
      expect(findCall.relations).toContain('details.service');
      expect(findCall.relations).toContain('cashier');
    });
  });
});
