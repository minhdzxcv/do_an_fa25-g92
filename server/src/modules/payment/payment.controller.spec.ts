import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { Appointment } from '@/entities/appointment.entity';
import { AppointmentDetail } from '@/entities/appointmentDetails.entity';
import { Internal } from '@/entities/internal.entity';
import { Service } from '@/entities/service.entity';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentService: PaymentService;
  let appointmentRepository: any;

  const mockPaymentService = {
    createPaymentLink: jest.fn(),
    updatePaymentStatusDeposited: jest.fn(),
    updatePaymentStatusPaid: jest.fn(),
    getInvoices: jest.fn(),
    getPaymentStats: jest.fn(),
  };

  const mockAppointmentRepository = {
    update: jest.fn(),
  };

  const mockDetailRepository = {
    find: jest.fn(),
  };

  const mockInternalRepository = {
    findOne: jest.fn(),
  };

  const mockServiceRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockAppointmentRepository,
        },
        {
          provide: getRepositoryToken(AppointmentDetail),
          useValue: mockDetailRepository,
        },
        {
          provide: getRepositoryToken(Internal),
          useValue: mockInternalRepository,
        },
        {
          provide: getRepositoryToken(Service),
          useValue: mockServiceRepository,
        },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    paymentService = module.get<PaymentService>(PaymentService);
    appointmentRepository = module.get(getRepositoryToken(Appointment));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createLink', () => {
    it('should create payment link and update appointment', async () => {
      const body = {
        appointmentId: 'appointment-1',
        amount: 100000,
        description: 'Test payment',
        returnUrl: 'http://localhost:3000/return',
        cancelUrl: 'http://localhost:3000/cancel',
        customerName: 'Test Customer',
      };

      const mockPaymentLink = {
        checkoutUrl: 'https://payos.vn/checkout',
        orderCode: 12345,
      };

      mockPaymentService.createPaymentLink.mockResolvedValue(mockPaymentLink);
      appointmentRepository.update.mockResolvedValue({ affected: 1 });

      const result = await controller.createLink(body);

      expect(result).toEqual(mockPaymentLink);
      expect(paymentService.createPaymentLink).toHaveBeenCalled();
      expect(appointmentRepository.update).toHaveBeenCalledWith(
        body.appointmentId,
        expect.objectContaining({ orderCode: expect.any(Number) }),
      );
    });
  });

  describe('updateStatusDeposited', () => {
    it('should update payment status to deposited', async () => {
      const body = { orderCode: '12345' };
      const mockAppointment = {
        id: 'appointment-1',
        status: 'deposited',
      };

      mockPaymentService.updatePaymentStatusDeposited.mockResolvedValue(mockAppointment);

      const result = await controller.updateStatusDeposited(body);

      expect(result).toEqual(mockAppointment);
      expect(paymentService.updatePaymentStatusDeposited).toHaveBeenCalledWith(body);
    });
  });

  describe('updateStatusPaid', () => {
    it('should update payment status to paid', async () => {
      const body = {
        orderCode: '12345',
        paymentMethod: 'qr',
        staffId: 'staff-1',
      };
      const mockAppointment = {
        id: 'appointment-1',
        status: 'paid',
      };

      mockPaymentService.updatePaymentStatusPaid.mockResolvedValue(mockAppointment);

      const result = await controller.updateStatusPaid(body);

      expect(result).toEqual(mockAppointment);
      expect(paymentService.updatePaymentStatusPaid).toHaveBeenCalledWith(body);
    });

    it('should handle cash payment method', async () => {
      const body = {
        orderCode: '12345',
        paymentMethod: 'cash',
        staffId: 'staff-1',
      };
      const mockAppointment = {
        id: 'appointment-1',
        status: 'paid',
        paymentMethod: 'cash',
      };

      mockPaymentService.updatePaymentStatusPaid.mockResolvedValue(mockAppointment);

      const result = await controller.updateStatusPaid(body);

      expect(result).toEqual(mockAppointment);
      expect(paymentService.updatePaymentStatusPaid).toHaveBeenCalledWith(body);
    });
  });

  describe('getInvoice', () => {
    it('should return all invoices', async () => {
      const mockInvoices = [
        {
          id: 'invoice-1',
          total_amount: 100000,
        },
        {
          id: 'invoice-2',
          total_amount: 200000,
        },
      ];

      mockPaymentService.getInvoices.mockResolvedValue(mockInvoices);

      const result = await controller.getInvoice();

      expect(result).toEqual(mockInvoices);
      expect(paymentService.getInvoices).toHaveBeenCalled();
    });

    it('should return empty array when no invoices', async () => {
      mockPaymentService.getInvoices.mockResolvedValue([]);

      const result = await controller.getInvoice();

      expect(result).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return payment statistics with date range', async () => {
      const dto = {
        fromDate: '2025-11-01T00:00:00.000Z',
        toDate: '2025-11-30T23:59:59.999Z',
      };

      const mockStats = {
        totalCash: 500000,
        totalTransfer: 300000,
        totalCollected: 800000,
        cashiers: [
          { cashierId: 'staff-1', name: 'Staff A', total: 400000 },
          { cashierId: 'staff-2', name: 'Staff B', total: 400000 },
        ],
        fromDate: dto.fromDate,
        toDate: dto.toDate,
        countInvoices: 10,
      };

      mockPaymentService.getPaymentStats.mockResolvedValue(mockStats);

      const result = await controller.getStats(dto);

      expect(result).toEqual(mockStats);
      expect(paymentService.getPaymentStats).toHaveBeenCalledWith(dto);
    });

    it('should return statistics without date range', async () => {
      const dto = {};

      const mockStats = {
        totalCash: 100000,
        totalTransfer: 200000,
        totalCollected: 300000,
        cashiers: [],
        fromDate: null,
        toDate: null,
        countInvoices: 5,
      };

      mockPaymentService.getPaymentStats.mockResolvedValue(mockStats);

      const result = await controller.getStats(dto);

      expect(result).toEqual(mockStats);
      expect(paymentService.getPaymentStats).toHaveBeenCalledWith(dto);
    });
  });
});

