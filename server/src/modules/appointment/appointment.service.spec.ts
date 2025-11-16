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
import { MailService } from '../mail/mail.service';
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
          provide: MailService,
          useValue: mockMailService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
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
        order: { appointment_date: 'ASC' },
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
      };

      serviceRepository.findBy.mockResolvedValue([]);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
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
      appointmentRepository.findOne.mockResolvedValue(mockAppointment);
      internalRepository.findOne.mockResolvedValue(mockStaff);
      spaRepository.findOne.mockResolvedValue(mockSpa);
      appointmentRepository.save.mockResolvedValue({
        ...mockAppointment,
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
});
