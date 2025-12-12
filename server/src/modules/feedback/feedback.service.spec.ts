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
        comment: 'Great service',
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

    it('should create feedback without comment', async () => {
      const dto = {
        appointmentId: 'A1',
        customerId: 'C1',
        serviceId: 'S1',
        rating: 5,
      };

      const created = { id: 'F2', ...dto, status: FeedbackStatus.Pending };

      feedbackRepo.create.mockReturnValue(created);
      feedbackRepo.save.mockResolvedValue(created);

      const result = await service.create(dto);
      expect(result).toEqual(created);
      expect(result.status).toBe(FeedbackStatus.Pending);
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
      expect(appointmentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'A1' },
      });
    });

    it('should create multiple feedbacks and mark appointment', async () => {
      const dtoList = [
        {
          appointmentId: 'A1',
          customerId: 'C1',
          serviceId: 'S1',
          rating: 5,
          comment: 'Excellent',
        },
        {
          appointmentId: 'A1',
          customerId: 'C1',
          serviceId: 'S2',
          rating: 4.5,
          comment: 'Good',
        },
      ];

      const appointment = { id: 'A1', isFeedbackGiven: false };
      appointmentRepo.findOne.mockResolvedValue(appointment);
      appointmentRepo.save.mockResolvedValue({ ...appointment, isFeedbackGiven: true });

      feedbackRepo.create.mockImplementation((dto) => ({
        id: `F-${dto.serviceId}`,
        ...dto,
        status: FeedbackStatus.Pending,
      }));

      const savedFeedbacks = [
        { id: 'F-S1', ...dtoList[0], status: FeedbackStatus.Pending },
        { id: 'F-S2', ...dtoList[1], status: FeedbackStatus.Pending },
      ];
      feedbackRepo.save.mockResolvedValue(savedFeedbacks);

      const result = await service.createMany(dtoList);

      expect(result).toEqual(savedFeedbacks);
      expect(appointmentRepo.save).toHaveBeenCalledWith({
        ...appointment,
        isFeedbackGiven: true,
      });
      expect(feedbackRepo.create).toHaveBeenCalledTimes(2);
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

    it('should return empty array when no feedbacks', async () => {
      feedbackRepo.find.mockResolvedValue([]);

      const result = await service.findAll();
      expect(result).toEqual([]);
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
      const fb = { id: 'F1', rating: 4, comment: 'Good' };
      const updateDto = { rating: 5, comment: 'Excellent' };

      feedbackRepo.findOne.mockResolvedValue(fb);
      feedbackRepo.save.mockResolvedValue({ ...fb, ...updateDto });

      const result = await service.update('F1', updateDto);
      expect(result.rating).toBe(5);
      expect(result.comment).toBe('Excellent');
      expect(feedbackRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if feedback not found', async () => {
      feedbackRepo.findOne.mockResolvedValue(null);

      await expect(service.update('X', { rating: 3 })).rejects.toThrow(NotFoundException);
    });

    it('should update only status field', async () => {
      const fb = { id: 'F1', rating: 4, status: FeedbackStatus.Pending };
      const updateDto = { status: FeedbackStatus.Approved };

      feedbackRepo.findOne.mockResolvedValue(fb);
      feedbackRepo.save.mockResolvedValue({ ...fb, ...updateDto });

      const result = await service.update('F1', updateDto);
      expect(result.status).toBe(FeedbackStatus.Approved);
    });
  });

  // ----------------------------------------------------------
  // REMOVE
  // ----------------------------------------------------------
  describe('remove()', () => {
    it('should remove feedback', async () => {
      const fb = { id: 'F1', rating: 5 };

      feedbackRepo.findOne.mockResolvedValue(fb);
      feedbackRepo.remove.mockResolvedValue(fb);

      const result = await service.remove('F1');
      expect(result).toEqual(fb);
      expect(feedbackRepo.remove).toHaveBeenCalledWith(fb);
    });

    it('should throw NotFoundException if feedback not found', async () => {
      feedbackRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('X')).rejects.toThrow(NotFoundException);
    });
  });

  // ----------------------------------------------------------
  // FIND BY APPOINTMENT DETAIL
  // ----------------------------------------------------------
  describe('findByAppointmentDetail()', () => {
    it('should return approved feedbacks for appointment detail', async () => {
      const list = [{ id: 'F1', status: FeedbackStatus.Approved }];

      feedbackRepo.find.mockResolvedValue(list);

      const result = await service.findByAppointmentDetail('D1');
      expect(result).toEqual(list);
      expect(feedbackRepo.find).toHaveBeenCalledWith({
        where: { id: 'D1', status: FeedbackStatus.Approved },
        relations: ['customer'],
      });
    });

    it('should return empty array when no approved feedbacks', async () => {
      feedbackRepo.find.mockResolvedValue([]);

      const result = await service.findByAppointmentDetail('D1');
      expect(result).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // FIND BY APPOINTMENT
  // ----------------------------------------------------------
  describe('findByAppointment()', () => {
    it('should return feedback by appointment', async () => {
      const list = [{ id: 'F1', rating: 5 }];
      feedbackRepo.find.mockResolvedValue(list);

      const result = await service.findByAppointment('A1');
      expect(result).toEqual(list);
      expect(feedbackRepo.find).toHaveBeenCalledWith({
        where: { appointmentId: 'A1' },
        select: ['id', 'rating', 'comment', 'status', 'createdAt', 'service'],
        relations: ['service'],
      });
    });

    it('should return empty array when no feedbacks for appointment', async () => {
      feedbackRepo.find.mockResolvedValue([]);

      const result = await service.findByAppointment('A1');
      expect(result).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // FIND BY CUSTOMER
  // ----------------------------------------------------------
  describe('findByCustomer()', () => {
    it('should return feedback by customer', async () => {
      const list = [{ id: 'F1', customerId: 'C1' }];
      feedbackRepo.find.mockResolvedValue(list);

      const result = await service.findByCustomer('C1');
      expect(result).toEqual(list);
      expect(feedbackRepo.find).toHaveBeenCalledWith({
        where: { customerId: 'C1' },
        relations: ['appointmentDetail'],
      });
    });

    it('should return empty array when customer has no feedbacks', async () => {
      feedbackRepo.find.mockResolvedValue([]);

      const result = await service.findByCustomer('C1');
      expect(result).toEqual([]);
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
      expect(feedbackRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if feedback not found', async () => {
      feedbackRepo.findOne.mockResolvedValue(null);

      await expect(service.approveFeedback('X')).rejects.toThrow(NotFoundException);
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
      expect(feedbackRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if feedback not found', async () => {
      feedbackRepo.findOne.mockResolvedValue(null);

      await expect(service.rejectFeedback('X')).rejects.toThrow(NotFoundException);
    });
  });
});
