import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppointmentService } from './appointment.service';
import { Appointment } from '@/entities/appointment.entity';
import { AppointmentDetail } from '@/entities/appointmentDetails.entity';
import { Service } from '@/entities/service.entity';
import { Spa } from '@/entities/spa.entity';
import { Internal } from '@/entities/internal.entity';
import { Cart } from '@/entities/cart.entity';
import { CartDetail } from '@/entities/cartDetails.entity';
import { Voucher } from '@/entities/voucher.entity';
import { CustomerVoucher } from '@/entities/customerVoucher.entity';
import { Invoice } from '@/entities/invoice.entity';
import { InvoiceDetail } from '@/entities/invoiceDetail.entity';
import { DoctorCancelRequest } from '@/entities/doctorCancelRequest.entity';
import { MailService } from '../mail/mail.service';
import { NotificationService } from '../notification/notification.service';
import { VoucherService } from '../voucher/voucher.service';
import { AppointmentStatus } from '@/entities/enums/appointment-status';
import { CreateAppointmentDto, UpdateAppointmentDto } from './appointment/appointment.dto';

describe('AppointmentService', () => {
  let service: AppointmentService;
  let appointmentRepository: any;
  let detailRepository: any;
  let serviceRepository: any;
  let spaRepository: any;
  let internalRepository: any;
  let mailService: MailService;
  let dataSource: DataSource;
  let voucherRepository: any;
  let customerVoucherRepository: any;
  let cartRepository: any;
  let cartDetailRepository: any;

  const mockCustomer = {
    id: 'customer-1',
    email: 'customer@test.com',
    full_name: 'Test Customer',
  };

  const mockDoctor = {
    id: 'doctor-1',
    full_name: 'Test Doctor',
  };

  const mockStaff = {
    id: 'staff-1',
    full_name: 'Test Staff',
  };

  const mockService = {
    id: 'service-1',
    name: 'Test Service',
    price: 100000,
  };

  const mockSpa = {
    id: 'spa-1',
    name: 'GenSpa',
    address: '123 Test Street',
  };

  const mockAppointment = {
    id: 'appointment-1',
    customerId: 'customer-1',
    customer: mockCustomer,
    doctorId: 'doctor-1',
    doctor: mockDoctor,
    appointment_date: new Date(),
    status: AppointmentStatus.Pending,
    startTime: new Date(),
    endTime: new Date(),
    totalAmount: 100000,
    depositAmount: 0,
    details: [
      {
        id: 'detail-1',
        serviceId: 'service-1',
        service: mockService,
        price: 100000,
      },
    ],
  };

  beforeEach(async () => {
    const mockAppointmentRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
    };

    const mockDetailRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      })),
    };

    const mockServiceRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      findBy: jest.fn(),
    };

    const mockSpaRepository = {
      findOne: jest.fn(),
    };

    const mockInternalRepository = {
      findOne: jest.fn(),
    };

    const mockCartRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const mockCartDetailRepository = {
      find: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };

    const mockVoucherRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const mockCustomerVoucherRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const mockInvoiceRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockInvoiceDetailRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockCancelRequestRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockNotificationService = {
      create: jest.fn().mockResolvedValue(undefined),
      sendNotificationToCustomer: jest.fn().mockResolvedValue(undefined),
    };

    const mockVoucherService = {
      findVouchersByCustomer: jest.fn(),
    };

    const mockMailService = {
      confirmAppointment: jest.fn().mockResolvedValue(undefined),
      confirmAppointmentDeposit: jest.fn().mockResolvedValue(undefined),
      sendThankYouForUsingServiceEmail: jest.fn().mockResolvedValue(undefined),
    };

    const mockDataSource = {
      transaction: jest.fn((callback) => {
        const mockManager = {
          getRepository: jest.fn((entity) => {
            if (entity === Appointment) return mockAppointmentRepository;
            if (entity === AppointmentDetail) return mockDetailRepository;
            if (entity === Service) return mockServiceRepository;
            return {};
          }),
        };
        return callback(mockManager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockAppointmentRepository,
        },
        {
          provide: getRepositoryToken(AppointmentDetail),
          useValue: mockDetailRepository,
        },
        {
          provide: getRepositoryToken(Service),
          useValue: mockServiceRepository,
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
          provide: getRepositoryToken(Cart),
          useValue: mockCartRepository,
        },
        {
          provide: getRepositoryToken(CartDetail),
          useValue: mockCartDetailRepository,
        },
        {
          provide: getRepositoryToken(Voucher),
          useValue: mockVoucherRepository,
        },
        {
          provide: getRepositoryToken(CustomerVoucher),
          useValue: mockCustomerVoucherRepository,
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
          provide: getRepositoryToken(DoctorCancelRequest),
          useValue: mockCancelRequestRepository,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: VoucherService,
          useValue: mockVoucherService,
        },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    appointmentRepository = module.get(getRepositoryToken(Appointment));
    detailRepository = module.get(getRepositoryToken(AppointmentDetail));
    serviceRepository = module.get(getRepositoryToken(Service));
    spaRepository = module.get(getRepositoryToken(Spa));
    internalRepository = module.get(getRepositoryToken(Internal));
    mailService = module.get<MailService>(MailService);
    dataSource = module.get<DataSource>(DataSource);
    voucherRepository = module.get(getRepositoryToken(Voucher));
    customerVoucherRepository = module.get(getRepositoryToken(CustomerVoucher));
    cartRepository = module.get(getRepositoryToken(Cart));
    cartDetailRepository = module.get(getRepositoryToken(CartDetail));

    // Mock loadSpa
    spaRepository.findOne.mockResolvedValue(mockSpa);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all appointments', async () => {
      const appointments = [mockAppointment];
      appointmentRepository.find.mockResolvedValue(appointments);

      const result = await service.findAll();

      expect(result).toEqual(appointments);
      expect(appointmentRepository.find).toHaveBeenCalled();
    });
  });

  describe('findAllAppointmentsManaged', () => {
    it('should return appointments managed by doctor', async () => {
      const appointments = [mockAppointment];
      appointmentRepository.find.mockResolvedValue(appointments);

      const result = await service.findAllAppointmentsManaged('doctor-1');

      expect(result).toEqual(appointments);
      expect(appointmentRepository.find).toHaveBeenCalledWith({
        where: { doctorId: 'doctor-1' },
        relations: ['customer', 'doctor', 'details', 'details.service'],
      });
    });
  });

  describe('findAllAppointmentsBooked', () => {
    it('should return booked appointments for doctor', async () => {
      const appointments = [
        {
          id: 'appointment-1',
          startTime: new Date(Date.now() + 86400000),
          endTime: new Date(Date.now() + 90000000),
          status: AppointmentStatus.Confirmed,
        },
      ];
      appointmentRepository.find.mockResolvedValue(appointments);

      const result = await service.findAllAppointmentsBooked('doctor-1');

      expect(result).toEqual(appointments);
      expect(appointmentRepository.find).toHaveBeenCalled();
    });
  });

  describe('findAllAppointmentsBookedByCustomer', () => {
    it('should return booked appointments for customer', async () => {
      const appointments = [
        {
          id: 'appointment-1',
          startTime: new Date(Date.now() + 86400000),
          endTime: new Date(Date.now() + 90000000),
          status: AppointmentStatus.Confirmed,
        },
      ];
      appointmentRepository.find.mockResolvedValue(appointments);

      const result = await service.findAllAppointmentsBookedByCustomer('customer-1');

      expect(result).toEqual(appointments);
      expect(appointmentRepository.find).toHaveBeenCalled();
    });
  });

  describe('findByCustomer', () => {
    it('should return appointments by customer', async () => {
      const appointments = [mockAppointment];
      appointmentRepository.find.mockResolvedValue(appointments);

      const result = await service.findByCustomer('customer-1');

      expect(result).toEqual(appointments);
      expect(appointmentRepository.find).toHaveBeenCalledWith({
        where: { customerId: 'customer-1' },
        relations: ['doctor', 'details', 'details.service', 'customer'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return an appointment by id', async () => {
      appointmentRepository.findOne.mockResolvedValue(mockAppointment);

      const result = await service.findOne('appointment-1');

      expect(result).toEqual(mockAppointment);
      expect(appointmentRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'appointment-1' },
        relations: ['customer', 'doctor', 'details', 'details.service'],
      });
    });

    it('should throw NotFoundException when appointment not found', async () => {
      appointmentRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        'Không tìm thấy lịch hẹn',
      );
    });
  });

  describe('create', () => {
    it('should create a new appointment successfully', async () => {
      const createDto: CreateAppointmentDto = {
        customerId: 'customer-1',
        doctorId: 'doctor-1',
        appointment_date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        details: [
          {
            serviceId: 'service-1',
            price: 100000,
          },
        ],
        totalAmount: 100000,
      };

      serviceRepository.findBy.mockResolvedValue([mockService]);
      appointmentRepository.create.mockReturnValue(mockAppointment);
      appointmentRepository.save.mockResolvedValue(mockAppointment);
      appointmentRepository.findOne.mockResolvedValue(mockAppointment);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(appointmentRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when service is invalid', async () => {
      const createDto: CreateAppointmentDto = {
        customerId: 'customer-1',
        doctorId: 'doctor-1',
        appointment_date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        details: [
          {
            serviceId: 'invalid-service',
            price: 100000,
          },
        ],
        totalAmount: 100000,
      };

      serviceRepository.findBy.mockResolvedValue([]);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should apply voucher with discountAmount successfully', async () => {
      const mockVoucher = {
        id: 'voucher-1',
        code: 'DISCOUNT50K',
        discountAmount: 50000,
        validFrom: new Date('2025-01-01'),
        validTo: new Date('2025-12-31'),
      };

      const mockCustomerVoucher = {
        id: 'cv-1',
        customerId: 'customer-1',
        voucherId: 'voucher-1',
        isUsed: false,
      };

      const createDto: CreateAppointmentDto = {
        customerId: 'customer-1',
        doctorId: 'doctor-1',
        appointment_date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        details: [{ serviceId: 'service-1', price: 100000 }],
        totalAmount: 100000,
        voucherId: 'voucher-1',
      };

      serviceRepository.findBy.mockResolvedValue([mockService]);
      voucherRepository.findOne.mockResolvedValue(mockVoucher);
      customerVoucherRepository.findOne.mockResolvedValue(mockCustomerVoucher);
      customerVoucherRepository.update.mockResolvedValue({});
      appointmentRepository.create.mockReturnValue({ ...mockAppointment, totalAmount: 50000 });
      appointmentRepository.save.mockResolvedValue({ ...mockAppointment, totalAmount: 50000 });
      appointmentRepository.findOne.mockResolvedValue({ ...mockAppointment, totalAmount: 50000 });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
    });

    it('should apply voucher with discountPercent successfully', async () => {
      const mockVoucher = {
        id: 'voucher-2',
        code: 'DISCOUNT20',
        discountPercent: 20,
        validFrom: new Date('2025-01-01'),
        validTo: new Date('2025-12-31'),
      };

      const mockCustomerVoucher = {
        id: 'cv-2',
        customerId: 'customer-1',
        voucherId: 'voucher-2',
        isUsed: false,
      };

      const createDto: CreateAppointmentDto = {
        customerId: 'customer-1',
        doctorId: 'doctor-1',
        appointment_date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        details: [{ serviceId: 'service-1', price: 100000 }],
        totalAmount: 100000,
        voucherId: 'voucher-2',
      };

      serviceRepository.findBy.mockResolvedValue([mockService]);
      voucherRepository.findOne.mockResolvedValue(mockVoucher);
      customerVoucherRepository.findOne.mockResolvedValue(mockCustomerVoucher);
      customerVoucherRepository.update.mockResolvedValue({});
      appointmentRepository.create.mockReturnValue({ ...mockAppointment, totalAmount: 80000 });
      appointmentRepository.save.mockResolvedValue({ ...mockAppointment, totalAmount: 80000 });
      appointmentRepository.findOne.mockResolvedValue({ ...mockAppointment, totalAmount: 80000 });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when voucher is expired', async () => {
      const expiredVoucher = {
        id: 'voucher-expired',
        code: 'EXPIRED',
        discountAmount: 50000,
        validFrom: new Date('2024-01-01'),
        validTo: new Date('2024-12-31'),
      };

      const createDto: CreateAppointmentDto = {
        customerId: 'customer-1',
        doctorId: 'doctor-1',
        appointment_date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        details: [{ serviceId: 'service-1', price: 100000 }],
        totalAmount: 100000,
        voucherId: 'voucher-expired',
      };

      serviceRepository.findBy.mockResolvedValue([mockService]);
      voucherRepository.findOne.mockResolvedValue(expiredVoucher);

      await expect(service.create(createDto)).rejects.toThrow('Voucher đã hết hạn');
    });

    it('should throw BadRequestException when customer voucher is invalid', async () => {
      const mockVoucher = {
        id: 'voucher-1',
        code: 'VALID',
        discountAmount: 50000,
        validFrom: new Date('2025-01-01'),
        validTo: new Date('2025-12-31'),
      };

      const createDto: CreateAppointmentDto = {
        customerId: 'customer-1',
        doctorId: 'doctor-1',
        appointment_date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        details: [{ serviceId: 'service-1', price: 100000 }],
        totalAmount: 100000,
        voucherId: 'voucher-1',
      };

      serviceRepository.findBy.mockResolvedValue([mockService]);
      voucherRepository.findOne.mockResolvedValue(mockVoucher);
      customerVoucherRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow('Voucher không hợp lệ cho khách hàng');
    });

    it('should apply membership discount successfully', async () => {
      const createDto: CreateAppointmentDto = {
        customerId: 'customer-1',
        doctorId: 'doctor-1',
        appointment_date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        details: [{ serviceId: 'service-1', price: 100000 }],
        totalAmount: 100000,
        membershipDiscount: 10,
      };

      serviceRepository.findBy.mockResolvedValue([mockService]);
      appointmentRepository.create.mockReturnValue({ ...mockAppointment, totalAmount: 90000 });
      appointmentRepository.save.mockResolvedValue({ ...mockAppointment, totalAmount: 90000 });
      appointmentRepository.findOne.mockResolvedValue({ ...mockAppointment, totalAmount: 90000 });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.totalAmount).toBeLessThan(100000);
    });

    it('should apply maxDiscount limit when voucher discount exceeds it', async () => {
      const mockVoucher = {
        id: 'voucher-3',
        code: 'BIG_DISCOUNT',
        discountPercent: 50,
        maxDiscount: 30000,
        validFrom: new Date('2025-01-01'),
        validTo: new Date('2025-12-31'),
      };

      const mockCustomerVoucher = {
        id: 'cv-3',
        customerId: 'customer-1',
        voucherId: 'voucher-3',
        isUsed: false,
      };

      const createDto: CreateAppointmentDto = {
        customerId: 'customer-1',
        doctorId: 'doctor-1',
        appointment_date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        details: [{ serviceId: 'service-1', price: 100000 }],
        totalAmount: 100000,
        voucherId: 'voucher-3',
      };

      serviceRepository.findBy.mockResolvedValue([mockService]);
      voucherRepository.findOne.mockResolvedValue(mockVoucher);
      customerVoucherRepository.findOne.mockResolvedValue(mockCustomerVoucher);
      customerVoucherRepository.update.mockResolvedValue({});
      appointmentRepository.create.mockReturnValue({ ...mockAppointment, totalAmount: 70000 });
      appointmentRepository.save.mockResolvedValue({ ...mockAppointment, totalAmount: 70000 });
      appointmentRepository.findOne.mockResolvedValue({ ...mockAppointment, totalAmount: 70000 });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
    });

    it('should delete cart after creating appointment', async () => {
      const mockCart = {
        id: 'cart-1',
        customerId: 'customer-1',
        details: [
          { id: 'cd-1', serviceId: 'service-1', cartId: 'cart-1' },
        ],
      };

      const createDto: CreateAppointmentDto = {
        customerId: 'customer-1',
        doctorId: 'doctor-1',
        appointment_date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        details: [{ serviceId: 'service-1', price: 100000 }],
        totalAmount: 100000,
      };

      serviceRepository.findBy.mockResolvedValue([mockService]);
      cartRepository.findOne.mockResolvedValue(mockCart);
      cartDetailRepository.delete.mockResolvedValue({});
      cartDetailRepository.count.mockResolvedValue(0);
      cartRepository.delete.mockResolvedValue({});
      appointmentRepository.create.mockReturnValue(mockAppointment);
      appointmentRepository.save.mockResolvedValue(mockAppointment);
      appointmentRepository.findOne.mockResolvedValue(mockAppointment);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update appointment successfully', async () => {
      const updateDto: UpdateAppointmentDto = {
        appointment_date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        details: [
          {
            serviceId: 'service-1',
            price: 100000,
          },
        ],
      };

      appointmentRepository.findOne.mockResolvedValue(mockAppointment);
      serviceRepository.findOne.mockResolvedValue(mockService);
      detailRepository.create.mockReturnValue({
        service: mockService,
        price: 100000,
      });
      detailRepository.save.mockResolvedValue({});
      appointmentRepository.save.mockResolvedValue(mockAppointment);

      const result = await service.update('appointment-1', updateDto);

      expect(result).toBeDefined();
      expect(appointmentRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when appointment not found', async () => {
      const updateDto: UpdateAppointmentDto = {
        appointment_date: new Date(),
      };

      appointmentRepository.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when service not found in details', async () => {
      const updateDto: UpdateAppointmentDto = {
        appointment_date: new Date(),
        details: [
          {
            serviceId: 'invalid-service-id',
            price: 100000,
          },
        ],
      };

      appointmentRepository.findOne.mockResolvedValue(mockAppointment);
      serviceRepository.findOne.mockResolvedValue(null);

      await expect(service.update('appointment-1', updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('reschedule', () => {
    it('should reschedule appointment successfully', async () => {
      const newDate = new Date(Date.now() + 86400000);

      appointmentRepository.findOne.mockResolvedValue(mockAppointment);
      appointmentRepository.save.mockResolvedValue({
        ...mockAppointment,
        appointment_date: newDate,
      });

      const result = await service.reschedule('appointment-1', newDate);

      expect(result.appointment_date).toEqual(newDate);
      expect(appointmentRepository.save).toHaveBeenCalled();
    });
  });

  describe('confirmAppointment', () => {
    it('should confirm appointment successfully', async () => {
      const appointmentWithDetails = {
        ...mockAppointment,
        details: [
          {
            id: 'detail-1',
            serviceId: 'service-1',
            service: mockService,
            price: 100000,
          },
        ],
      };
      
      appointmentRepository.findOne.mockResolvedValue(appointmentWithDetails);
      internalRepository.findOne.mockResolvedValue(mockStaff);
      spaRepository.findOne.mockResolvedValue(mockSpa);
      appointmentRepository.save.mockResolvedValue({
        ...appointmentWithDetails,
        status: AppointmentStatus.Confirmed,
        staffId: 'staff-1',
      });

      const result = await service.confirmAppointment('appointment-1', 'staff-1');

      expect(result.status).toBe(AppointmentStatus.Confirmed);
      expect(mailService.confirmAppointment).toHaveBeenCalled();
      expect(appointmentRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when staff not found', async () => {
      appointmentRepository.findOne.mockResolvedValue(mockAppointment);
      internalRepository.findOne.mockResolvedValue(null);

      await expect(service.confirmAppointment('appointment-1', 'nonexistent-staff')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update appointment status successfully', async () => {
      appointmentRepository.findOne.mockResolvedValue(mockAppointment);
      appointmentRepository.save.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.Confirmed,
      });

      const result = await service.updateStatus('appointment-1', AppointmentStatus.Confirmed);

      expect(result.status).toBe(AppointmentStatus.Confirmed);
      expect(appointmentRepository.save).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should cancel appointment successfully', async () => {
      const reason = 'Customer request';

      appointmentRepository.findOne.mockResolvedValue(mockAppointment);
      appointmentRepository.save.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.Cancelled,
        cancelledAt: new Date(),
        cancelReason: reason,
      });

      const result = await service.cancel('appointment-1', reason);

      expect(result.status).toBe(AppointmentStatus.Cancelled);
      expect(result.cancelReason).toBe(reason);
      expect(appointmentRepository.save).toHaveBeenCalled();
    });

    it('should return voucher when cancelling appointment with voucher', async () => {
      const reason = 'Customer request';
      const appointmentWithVoucher = {
        ...mockAppointment,
        voucherId: 'voucher-1',
      };

      const mockCustomerVoucher = {
        id: 'cv-1',
        customerId: 'customer-1',
        voucherId: 'voucher-1',
        isUsed: true,
        usedAt: new Date(),
      };

      appointmentRepository.findOne.mockResolvedValue(appointmentWithVoucher);
      customerVoucherRepository.findOne.mockResolvedValue(mockCustomerVoucher);
      customerVoucherRepository.save.mockResolvedValue({ ...mockCustomerVoucher, isUsed: false, usedAt: undefined });
      appointmentRepository.save.mockResolvedValue({
        ...appointmentWithVoucher,
        status: AppointmentStatus.Cancelled,
        cancelReason: reason,
      });

      const result = await service.cancel('appointment-1', reason);

      expect(result.status).toBe(AppointmentStatus.Cancelled);
    });
  });

  describe('reject', () => {
    it('should reject appointment successfully', async () => {
      const reason = 'No available slot';

      appointmentRepository.findOne.mockResolvedValue(mockAppointment);
      appointmentRepository.save.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.Rejected,
        rejectionReason: reason,
      });

      const result = await service.reject('appointment-1', reason);

      expect(result.status).toBe(AppointmentStatus.Rejected);
      expect(result.rejectionReason).toBe(reason);
      expect(appointmentRepository.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete appointment successfully', async () => {
      appointmentRepository.findOne.mockResolvedValue(mockAppointment);
      appointmentRepository.softRemove.mockResolvedValue(mockAppointment);

      const result = await service.remove('appointment-1');

      expect(result).toEqual({ message: 'Đã xoá lịch hẹn' });
      expect(appointmentRepository.softRemove).toHaveBeenCalled();
    });
  });

  describe('getDashboard', () => {
    it('should return dashboard statistics for full year', async () => {
      const mockInvoices = [
        {
          id: 'invoice-1',
          finalAmount: 200000,
          payment_status: 'paid',
          customer: mockCustomer,
          details: [
            {
              service: mockService,
              quantity: 2,
            },
          ],
          createdAt: new Date(2024, 5, 1),
        },
      ];

      const mockServices = [mockService];

      const mockInvoiceRepository = {
        find: jest.fn().mockResolvedValue(mockInvoices),
      };

      const mockServiceRepository = {
        find: jest.fn().mockResolvedValue(mockServices),
        findOne: jest.fn(),
        findBy: jest.fn(),
      };

      // Inject mocks directly
      (service as any).invoiceRepo = mockInvoiceRepository;
      (service as any).serviceRepo = mockServiceRepository;

      const result = await service.getDashboard({ year: 2024 });

      expect(result).toHaveProperty('totalCustomers');
      expect(result).toHaveProperty('totalAmount');
      expect(result).toHaveProperty('totalInvoices');
      expect(result).toHaveProperty('totalServices');
      expect(result).toHaveProperty('topServices');
      expect(result).toHaveProperty('topCustomers');
      expect(result.totalInvoices).toBe(1);
      expect(result.totalAmount).toBe(200000);
    });

    it('should return dashboard statistics for specific month', async () => {
      const mockInvoices = [];
      const mockServices = [];

      const mockInvoiceRepository = {
        find: jest.fn().mockResolvedValue(mockInvoices),
      };

      const mockServiceRepository = {
        find: jest.fn().mockResolvedValue(mockServices),
        findOne: jest.fn(),
        findBy: jest.fn(),
      };

      (service as any).invoiceRepo = mockInvoiceRepository;
      (service as any).serviceRepo = mockServiceRepository;

      const result = await service.getDashboard({ year: 2024, month: 6 });

      expect(result).toHaveProperty('totalCustomers', 0);
      expect(result).toHaveProperty('totalAmount', 0);
      expect(result).toHaveProperty('totalInvoices', 0);
    });
  });

  describe('requestCancelByDoctorBulk', () => {
    it('should create cancel requests for valid appointments', async () => {
      const appointmentIds = ['appointment-1'];
      const doctorId = 'doctor-1';
      const reason = 'Doctor emergency';

      const mockCancelRequestRepository = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue({ appointmentId: 'appointment-1', doctorId, reason }),
        save: jest.fn().mockResolvedValue({}),
        find: jest.fn(),
      };

      (service as any).cancelRepo = mockCancelRequestRepository;

      appointmentRepository.findOne.mockResolvedValue({
        ...mockAppointment,
        doctorId: 'doctor-1',
      });

      const result = await service.requestCancelByDoctorBulk(appointmentIds, doctorId, reason);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('Gửi yêu cầu thành công');
      expect(mockCancelRequestRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when no appointments selected', async () => {
      await expect(
        service.requestCancelByDoctorBulk([], 'doctor-1', 'reason'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle unauthorized doctor', async () => {
      const appointmentIds = ['appointment-1'];
      const doctorId = 'doctor-2';
      const reason = 'Test';

      appointmentRepository.findOne.mockResolvedValue({
        ...mockAppointment,
        doctorId: 'doctor-1',
      });

      const result = await service.requestCancelByDoctorBulk(appointmentIds, doctorId, reason);

      expect(result[0].status).toBe('Không có quyền hủy');
    });
  });

  describe('approveRequest', () => {
    it('should approve cancel request and cancel appointment', async () => {
      const mockRequest = {
        id: 'request-1',
        appointmentId: 'appointment-1',
        doctorId: 'doctor-1',
        reason: 'Doctor emergency',
        status: 'pending',
      };

      const mockCancelRequestRepository = {
        findOne: jest.fn().mockResolvedValue(mockRequest),
        save: jest.fn().mockResolvedValue({ ...mockRequest, status: 'approved' }),
        find: jest.fn(),
        create: jest.fn(),
      };

      const mockVoucherService = {
        createForCustomers: jest.fn().mockResolvedValue({}),
        findVouchersByCustomer: jest.fn(),
      };

      const mockNotificationService = {
        create: jest.fn().mockResolvedValue(undefined),
        sendNotificationToCustomer: jest.fn(),
      };

      (service as any).cancelRepo = mockCancelRequestRepository;
      (service as any).voucherService = mockVoucherService;
      (service as any).notificationService = mockNotificationService;

      appointmentRepository.findOne.mockResolvedValue(mockAppointment);
      appointmentRepository.update = jest.fn().mockResolvedValue({});

      const result = await service.approveRequest('request-1');

      expect(result.message).toBe('Đã duyệt yêu cầu và hủy appointment.');
      expect(mockCancelRequestRepository.save).toHaveBeenCalled();
      expect(appointmentRepository.update).toHaveBeenCalled();
      expect(mockNotificationService.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when request not found', async () => {
      const mockCancelRequestRepository = {
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
      };

      (service as any).cancelRepo = mockCancelRequestRepository;

      await expect(service.approveRequest('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('should create notification for customer when approving request', async () => {
      const mockRequest = {
        id: 'request-1',
        appointmentId: 'appointment-1',
        doctorId: 'doctor-1',
        reason: 'Doctor emergency',
        status: 'pending',
      };

      const mockCancelRequestRepository = {
        findOne: jest.fn().mockResolvedValue(mockRequest),
        save: jest.fn().mockResolvedValue({ ...mockRequest, status: 'approved' }),
        find: jest.fn(),
        create: jest.fn(),
      };

      const mockNotificationService = {
        create: jest.fn().mockResolvedValue(undefined),
        sendNotificationToCustomer: jest.fn(),
      };

      const mockVoucherService = {
        createForCustomers: jest.fn().mockResolvedValue({}),
      };

      (service as any).cancelRepo = mockCancelRequestRepository;
      (service as any).notificationService = mockNotificationService;
      (service as any).voucherService = mockVoucherService;

      appointmentRepository.findOne.mockResolvedValue(mockAppointment);
      appointmentRepository.update = jest.fn().mockResolvedValue({});

      await service.approveRequest('request-1');

      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Lịch hẹn của bạn đã bị hủy',
          userId: mockAppointment.customer.id,
          userType: 'customer',
        }),
      );
    });

    it('should create compensation voucher when approving request', async () => {
      const mockRequest = {
        id: 'request-1',
        appointmentId: 'appointment-1',
        doctorId: 'doctor-1',
        reason: 'Doctor emergency',
        status: 'pending',
      };

      const mockCancelRequestRepository = {
        findOne: jest.fn().mockResolvedValue(mockRequest),
        save: jest.fn().mockResolvedValue({ ...mockRequest, status: 'approved' }),
        find: jest.fn(),
        create: jest.fn(),
      };

      const mockVoucherService = {
        createForCustomers: jest.fn().mockResolvedValue({}),
      };

      const mockNotificationService = {
        create: jest.fn().mockResolvedValue(undefined),
      };

      (service as any).cancelRepo = mockCancelRequestRepository;
      (service as any).voucherService = mockVoucherService;
      (service as any).notificationService = mockNotificationService;

      appointmentRepository.findOne.mockResolvedValue(mockAppointment);
      appointmentRepository.update = jest.fn().mockResolvedValue({});

      await service.approveRequest('request-1');

      expect(mockVoucherService.createForCustomers).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Voucher bù đắp do hủy lịch hẹn',
          discountAmount: mockAppointment.depositAmount,
          customerIds: [mockAppointment.customer.id],
        }),
      );
    });

    it('should handle voucher creation error gracefully', async () => {
      const mockRequest = {
        id: 'request-1',
        appointmentId: 'appointment-1',
        doctorId: 'doctor-1',
        reason: 'Doctor emergency',
        status: 'pending',
      };

      const mockCancelRequestRepository = {
        findOne: jest.fn().mockResolvedValue(mockRequest),
        save: jest.fn().mockResolvedValue({ ...mockRequest, status: 'approved' }),
        find: jest.fn(),
        create: jest.fn(),
      };

      const mockVoucherService = {
        createForCustomers: jest.fn().mockRejectedValue(new Error('Voucher creation failed')),
      };

      const mockNotificationService = {
        create: jest.fn().mockResolvedValue(undefined),
      };

      (service as any).cancelRepo = mockCancelRequestRepository;
      (service as any).voucherService = mockVoucherService;
      (service as any).notificationService = mockNotificationService;

      appointmentRepository.findOne.mockResolvedValue(mockAppointment);
      appointmentRepository.update = jest.fn().mockResolvedValue({});

      const result = await service.approveRequest('request-1');

      expect(result.message).toBe('Đã duyệt yêu cầu và hủy appointment.');
    });
  });

  describe('rejectRequest', () => {
    it('should reject cancel request successfully', async () => {
      const mockRequest = {
        id: 'request-1',
        appointmentId: 'appointment-1',
        doctorId: 'doctor-1',
        reason: 'Test',
        status: 'pending',
      };

      const mockCancelRequestRepository = {
        findOne: jest.fn().mockResolvedValue(mockRequest),
        save: jest.fn().mockResolvedValue({ ...mockRequest, status: 'rejected' }),
        find: jest.fn(),
        create: jest.fn(),
      };

      (service as any).cancelRepo = mockCancelRequestRepository;

      const result = await service.rejectRequest('request-1');

      expect(result.message).toBe('Đã từ chối yêu cầu.');
      expect(mockCancelRequestRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when request not found', async () => {
      const mockCancelRequestRepository = {
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
      };

      (service as any).cancelRepo = mockCancelRequestRepository;

      await expect(service.rejectRequest('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllPending', () => {
    it('should return all pending cancel requests', async () => {
      const mockRequests = [
        {
          id: 'request-1',
          appointmentId: 'appointment-1',
          doctorId: 'doctor-1',
          status: 'pending',
          appointment: mockAppointment,
          doctor: mockDoctor,
        },
      ];

      const mockCancelRequestRepository = {
        find: jest.fn().mockResolvedValue(mockRequests),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
      };

      (service as any).cancelRepo = mockCancelRequestRepository;

      const result = await service.findAllPending();

      expect(result).toEqual(mockRequests);
      expect(mockCancelRequestRepository.find).toHaveBeenCalledWith({
        where: { status: 'pending' },
        relations: ['appointment', 'doctor'],
      });
    });
  });
});
