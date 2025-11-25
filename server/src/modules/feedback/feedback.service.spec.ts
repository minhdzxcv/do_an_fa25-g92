import { Test, TestingModule } from '@nestjs/testing';
import { FeedbackService } from './feedback.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Feedback } from '@/entities/feedback.entity';
import { Appointment } from '@/entities/appointment.entity';
import { AppointmentDetail } from '@/entities/appointmentDetails.entity';
import { NotFoundException } from '@nestjs/common';
import { FeedbackStatus } from '@/entities/enums/feedback-status';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  softDelete: jest.fn(),
  update: jest.fn(),
});

describe('FeedbackService - Unit Test', () => {
  let service: FeedbackService;
  let feedbackRepo: ReturnType<typeof mockRepo>;
  let appointmentRepo: ReturnType<typeof mockRepo>;
  let detailRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        { provide: getRepositoryToken(Feedback), useFactory: mockRepo },
        { provide: getRepositoryToken(Appointment), useFactory: mockRepo },
        { provide: getRepositoryToken(AppointmentDetail), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<FeedbackService>(FeedbackService);
    feedbackRepo = module.get(getRepositoryToken(Feedback));
    appointmentRepo = module.get(getRepositoryToken(Appointment));
    detailRepo = module.get(getRepositoryToken(AppointmentDetail));
  });

  // ----------------------------------------------------------
  // CREATE
  // ----------------------------------------------------------
  describe('create()', () => {
    it('should create a feedback successfully', async () => {
      const dto = {
        appointmentId: 'A1',
        customerId: 'C1',
        serviceId: 'S1',
        rating: 4.5,
      };

      const created = { id: 'F1', ...dto, status: FeedbackStatus.Pending };

      feedbackRepo.create.mockReturnValue(created);
      feedbackRepo.save.mockResolvedValue(created);

      const result = await service.create(dto);
      expect(result).toEqual(created);
      expect(feedbackRepo.create).toHaveBeenCalledWith({
        ...dto,
        status: FeedbackStatus.Pending,
      });
      expect(feedbackRepo.save).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // CREATE MANY
  // ----------------------------------------------------------
  describe('createMany()', () => {
    it('should throw error if appointment does not exist', async () => {
      appointmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createMany([
          {
            appointmentId: 'A1',
            customerId: 'C1',
            serviceId: 'S1',
            rating: 5,
          },
        ]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create multiple feedbacks', async () => {
      const dtoList = [
        {
          appointmentId: 'A1',
          customerId: 'C1',
          serviceId: 'S1',
          rating: 5,
        },
        {
          appointmentId: 'A1',
          customerId: 'C1',
          serviceId: 'S1',
          rating: 4.5,
        },
      ];

      const appointment = { id: 'A1', isFeedbackGiven: false };
      appointmentRepo.findOne.mockResolvedValue(appointment);
      appointmentRepo.save.mockResolvedValue({ ...appointment, isFeedbackGiven: true });

      feedbackRepo.create.mockImplementation((dto) => ({
        ...dto,
        status: FeedbackStatus.Pending,
      }));

      feedbackRepo.save.mockResolvedValue(dtoList);

      const result = await service.createMany(dtoList);

      expect(result.length).toBe(2);
      expect(appointmentRepo.save).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // FIND ALL
  // ----------------------------------------------------------
  describe('findAll()', () => {
    it('should return all feedbacks', async () => {
      const list = [{ id: 'F1' }, { id: 'F2' }];
      feedbackRepo.find.mockResolvedValue(list);

      const result = await service.findAll();
      expect(result).toEqual(list);

      expect(feedbackRepo.find).toHaveBeenCalledWith({
        relations: ['customer', 'appointmentDetail'],
      });
    });
  });

  // ----------------------------------------------------------
  // FIND ONE
  // ----------------------------------------------------------
  describe('findOne()', () => {
    it('should return feedback', async () => {
      const fb = { id: 'F1' };
      feedbackRepo.findOne.mockResolvedValue(fb);

      const result = await service.findOne('F1');
      expect(result).toEqual(fb);
    });

    it('should throw if feedback not found', async () => {
      feedbackRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('X')).rejects.toThrow(NotFoundException);
    });
  });

  // ----------------------------------------------------------
  // UPDATE
  // ----------------------------------------------------------
  describe('update()', () => {
    it('should update feedback', async () => {
      const fb = { id: 'F1', rating: 4 };

      feedbackRepo.update.mockResolvedValue({ affected: 1 });
      feedbackRepo.findOne.mockResolvedValue({ ...fb, rating: 5 });

      const result = await service.update('F1', { rating: 5 });
      expect(result.rating).toBe(5);
    });

    it('should throw NotFoundException if update fails', async () => {
      feedbackRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.update('X', { rating: 3 })).rejects.toThrow(NotFoundException);
    });
  });

  // ----------------------------------------------------------
  // REMOVE
  // ----------------------------------------------------------
  describe('remove()', () => {
    it('should remove feedback', async () => {
      const fb = { id: 'F1' };

      feedbackRepo.findOne.mockResolvedValue(fb);
      feedbackRepo.remove.mockResolvedValue(fb);

      const result = await service.remove('F1');
      expect(result).toEqual(fb);
    });
  });

  // ----------------------------------------------------------
  // FIND BY APPOINTMENT DETAIL
  // ----------------------------------------------------------
  describe('findByAppointmentDetail()', () => {
    it('should return approved feedbacks for appointment detail', async () => {
      const list = [{ id: 'F1' }];

      feedbackRepo.find.mockResolvedValue(list);

      const result = await service.findByAppointmentDetail('D1');
      expect(result).toEqual(list);
    });
  });

  // ----------------------------------------------------------
  // FIND BY APPOINTMENT
  // ----------------------------------------------------------
  describe('findByAppointment()', () => {
    it('should return feedback by appointment', async () => {
      const list = [{ id: 'F1' }];
      feedbackRepo.find.mockResolvedValue(list);

      const result = await service.findByAppointment('A1');
      expect(result).toEqual(list);
    });
  });

  // ----------------------------------------------------------
  // FIND BY CUSTOMER
  // ----------------------------------------------------------
  describe('findByCustomer()', () => {
    it('should return feedback by customer', async () => {
      const list = [{ id: 'F1' }];
      feedbackRepo.find.mockResolvedValue(list);

      const result = await service.findByCustomer('C1');
      expect(result).toEqual(list);
    });
  });

  // ----------------------------------------------------------
  // APPROVE FEEDBACK
  // ----------------------------------------------------------
  describe('approveFeedback()', () => {
    it('should approve feedback', async () => {
      const fb = { id: 'F1', status: FeedbackStatus.Pending };

      feedbackRepo.findOne.mockResolvedValue(fb);
      feedbackRepo.save.mockResolvedValue({
        ...fb,
        status: FeedbackStatus.Approved,
      });

      const result = await service.approveFeedback('F1');
      expect(result.status).toBe(FeedbackStatus.Approved);
    });
  });

  // ----------------------------------------------------------
  // REJECT FEEDBACK
  // ----------------------------------------------------------
  describe('rejectFeedback()', () => {
    it('should reject feedback', async () => {
      const fb = { id: 'F1', status: FeedbackStatus.Pending };

      feedbackRepo.findOne.mockResolvedValue(fb);
      feedbackRepo.save.mockResolvedValue({
        ...fb,
        status: FeedbackStatus.Rejected,
      });

      const result = await service.rejectFeedback('F1');
      expect(result.status).toBe(FeedbackStatus.Rejected);
    });
  });
});
