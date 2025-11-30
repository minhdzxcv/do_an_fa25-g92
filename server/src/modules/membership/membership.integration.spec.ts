import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { MembershipModule } from './membership.module';
import { MembershipService } from './membership.service';
import { Membership } from '@/entities/membership.entity';
import { Customer } from '@/entities/customer.entity';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Gender } from '@/entities/enums/gender.enum';
import { CustomerType } from '@/entities/enums/customer-type.enum';

describe('Membership Module Integration Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let membershipRepository: Repository<Membership>;
  let customerRepository: Repository<Customer>;
  let membershipService: MembershipService;

  // Test data
  let createdMembershipId1: string;
  let createdMembershipId2: string;
  let createdMembershipId3: string;
  let createdCustomerId: string;

  beforeAll(async () => {
    // Setup test database connection - use real database from .env
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = parseInt(process.env.DB_PORT || '3306');
    const dbUsername = process.env.DB_USERNAME || 'root';
    const dbPassword = process.env.DB_PASSWORD || 'root';
    const dbName = process.env.DB_DATABASE || 'gen_spa';

    // Create test data source - connect to real database
    dataSource = new DataSource({
      type: 'mysql',
      host: dbHost,
      port: dbPort,
      username: dbUsername,
      password: dbPassword,
      database: dbName,
      entities: [__dirname + '/../../entities/*.entity.{js,ts}'],
      synchronize: false, // Don't sync, use existing schema
      logging: false,
    });

    try {
      await dataSource.initialize();
      console.log(`✅ Connected to database: ${dbName}`);
    } catch (error) {
      console.error('❌ Failed to connect to database:', error);
      throw error;
    }

    // Create test module with TypeORM
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
        TypeOrmModule.forRoot({
          type: 'mysql',
          host: dbHost,
          port: dbPort,
          username: dbUsername,
          password: dbPassword,
          database: dbName,
          entities: [__dirname + '/../../entities/*.entity.{js,ts}'],
          synchronize: false, // Don't sync, use existing schema
          logging: false,
        }),
        JwtModule.register({
          global: true,
          secret: process.env.JWT_SECRET || 'test-secret',
          signOptions: { expiresIn: '1d' },
        }),
        MembershipModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    // Get repositories
    membershipRepository = moduleFixture.get<Repository<Membership>>(
      getRepositoryToken(Membership),
    );
    customerRepository = moduleFixture.get<Repository<Customer>>(
      getRepositoryToken(Customer),
    );
    membershipService = moduleFixture.get<MembershipService>(
      MembershipService,
    );

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup
    try {
      await cleanupTestData();
      if (dataSource && dataSource.isInitialized) {
        await dataSource.destroy();
        console.log('✅ Test database connection closed');
      }
      if (app) {
        await app.close();
      }
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }, 30000); // Increase timeout for cleanup

  beforeEach(async () => {
    // Clean database before each test to ensure test isolation
    try {
      // Only delete test customers, not memberships
      if (createdCustomerId) {
        await customerRepository.delete({ id: createdCustomerId });
      }
      
      // Ensure test memberships exist (in case previous test deleted them)
      if (!createdMembershipId1 || !createdMembershipId2 || !createdMembershipId3) {
        await setupTestData();
      }
    } catch (error) {
      console.warn('⚠️ Error cleaning test data:', error);
    }
  });

  async function setupTestData() {
    try {
      // Create test memberships if they don't exist
      // Bronze membership (lowest tier)
      let bronzeMembership = await membershipRepository.findOne({
        where: { name: 'Bronze' },
      });
      if (!bronzeMembership) {
        bronzeMembership = membershipRepository.create({
          name: 'Bronze',
          minSpent: 0,
          maxSpent: 1000000,
          discountPercent: 0,
        });
        bronzeMembership = await membershipRepository.save(bronzeMembership);
      }
      createdMembershipId1 = bronzeMembership.id;

      // Silver membership (middle tier)
      let silverMembership = await membershipRepository.findOne({
        where: { name: 'Silver' },
      });
      if (!silverMembership) {
        silverMembership = membershipRepository.create({
          name: 'Silver',
          minSpent: 1000000,
          maxSpent: 5000000,
          discountPercent: 5,
        });
        silverMembership = await membershipRepository.save(silverMembership);
      }
      createdMembershipId2 = silverMembership.id;

      // Gold membership (highest tier)
      let goldMembership = await membershipRepository.findOne({
        where: { name: 'Gold' },
      });
      if (!goldMembership) {
        goldMembership = membershipRepository.create({
          name: 'Gold',
          minSpent: 5000000,
          maxSpent: undefined, // No upper limit
          discountPercent: 10,
        });
        goldMembership = await membershipRepository.save(goldMembership);
      }
      createdMembershipId3 = goldMembership.id;
    } catch (error) {
      console.error('❌ Error setting up test data:', error);
      throw error;
    }
  }

  async function cleanupTestData() {
    try {
      // Use direct SQL to delete all rows (bypass TypeORM empty criteria check)
      await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
      await dataSource.query('DELETE FROM customer');
      await dataSource.query('DELETE FROM membership');
      await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (error) {
      console.error('❌ Error cleaning up test data:', error);
      // Re-enable foreign key checks in case of error
      if (dataSource && dataSource.isInitialized) {
        await dataSource.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
      }
    }
  }

  describe('GET /membership', () => {
    it('should return all memberships ordered by minSpent ASC', async () => {
      const response = await request(app.getHttpServer())
        .get('/membership')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(3);

      // Verify ordering by minSpent
      for (let i = 0; i < response.body.length - 1; i++) {
        expect(Number(response.body[i].minSpent)).toBeLessThanOrEqual(
          Number(response.body[i + 1].minSpent),
        );
      }

      // Verify structure
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('minSpent');
      expect(response.body[0]).toHaveProperty('discountPercent');
    });

    it('should return empty array when no memberships exist', async () => {
      // Delete test memberships only
      if (createdMembershipId1) {
        await membershipRepository.delete({ id: createdMembershipId1 });
      }
      if (createdMembershipId2) {
        await membershipRepository.delete({ id: createdMembershipId2 });
      }
      if (createdMembershipId3) {
        await membershipRepository.delete({ id: createdMembershipId3 });
      }

      const response = await request(app.getHttpServer())
        .get('/membership')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);

      // Restore test data
      await setupTestData();
    });
  });

  describe('GET /membership/:id', () => {
    it('should return a membership by id', async () => {
      const membership = await membershipRepository.findOne({
        where: { id: createdMembershipId1 },
      });

      expect(membership).not.toBeNull();

      const response = await request(app.getHttpServer())
        .get(`/membership/${createdMembershipId1}`)
        .expect(200);

      expect(response.body.id).toBe(createdMembershipId1);
      if (membership) {
        expect(response.body.name).toBe(membership.name);
      }
      expect(response.body.minSpent).toBeDefined();
      expect(response.body.discountPercent).toBeDefined();
    });

    it('should return 404 when membership not found', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app.getHttpServer())
        .get(`/membership/${fakeId}`)
        .expect(404);

      expect(response.body.message).toContain('Không tìm thấy Membership');
    });

    it('should handle invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/membership/invalid-uuid')
        .expect(404);
    });
  });

  describe('PUT /membership/:id', () => {
    it('should update membership name successfully', async () => {
      const updateDto = {
        name: 'Updated Bronze',
      };

      const response = await request(app.getHttpServer())
        .put(`/membership/${createdMembershipId1}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.name).toBe(updateDto.name);
      expect(response.body.id).toBe(createdMembershipId1);

      // Verify in database
      const updated = await membershipRepository.findOne({
        where: { id: createdMembershipId1 },
      });
      expect(updated).not.toBeNull();
      if (updated) {
        expect(updated.name).toBe(updateDto.name);
      }

      // Restore original name
      await membershipRepository.update(createdMembershipId1, {
        name: 'Bronze',
      });
    });

    it('should update membership minSpent successfully', async () => {
      const updateDto = {
        minSpent: 500000,
      };

      const response = await request(app.getHttpServer())
        .put(`/membership/${createdMembershipId1}`)
        .send(updateDto)
        .expect(200);

      expect(Number(response.body.minSpent)).toBe(updateDto.minSpent);

      // Verify in database
      const updated = await membershipRepository.findOne({
        where: { id: createdMembershipId1 },
      });
      expect(updated).not.toBeNull();
      if (updated) {
        expect(Number(updated.minSpent)).toBe(updateDto.minSpent);
      }

      // Restore original minSpent
      await membershipRepository.update(createdMembershipId1, {
        minSpent: 0,
      });
    });

    it('should update membership maxSpent successfully', async () => {
      const updateDto = {
        maxSpent: 2000000,
      };

      const response = await request(app.getHttpServer())
        .put(`/membership/${createdMembershipId2}`)
        .send(updateDto)
        .expect(200);

      expect(Number(response.body.maxSpent)).toBe(updateDto.maxSpent);

      // Restore original maxSpent
      await membershipRepository.update(createdMembershipId2, {
        maxSpent: 5000000,
      });
    });

    it('should update membership discountPercent successfully', async () => {
      const updateDto = {
        discountPercent: 7.5,
      };

      const response = await request(app.getHttpServer())
        .put(`/membership/${createdMembershipId2}`)
        .send(updateDto)
        .expect(200);

      expect(Number(response.body.discountPercent)).toBe(updateDto.discountPercent);

      // Verify in database
      const updated = await membershipRepository.findOne({
        where: { id: createdMembershipId2 },
      });
      expect(updated).not.toBeNull();
      if (updated) {
        expect(Number(updated.discountPercent)).toBe(updateDto.discountPercent);
      }

      // Restore original discountPercent
      await membershipRepository.update(createdMembershipId2, {
        discountPercent: 5,
      });
    });

    it('should update multiple fields at once', async () => {
      const updateDto = {
        name: 'Premium Silver',
        minSpent: 1500000,
        maxSpent: 6000000,
        discountPercent: 8,
      };

      const response = await request(app.getHttpServer())
        .put(`/membership/${createdMembershipId2}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.name).toBe(updateDto.name);
      expect(Number(response.body.minSpent)).toBe(updateDto.minSpent);
      expect(Number(response.body.maxSpent)).toBe(updateDto.maxSpent);
      expect(Number(response.body.discountPercent)).toBe(
        updateDto.discountPercent,
      );

      // Restore original values
      await membershipRepository.update(createdMembershipId2, {
        name: 'Silver',
        minSpent: 1000000,
        maxSpent: 5000000,
        discountPercent: 5,
      });
    });

    it('should return 404 when membership not found', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const updateDto = {
        name: 'Updated Name',
      };

      await request(app.getHttpServer())
        .put(`/membership/${fakeId}`)
        .send(updateDto)
        .expect(404);
    });

    it('should fail validation when minSpent is negative', async () => {
      const updateDto = {
        minSpent: -100,
      };

      await request(app.getHttpServer())
        .put(`/membership/${createdMembershipId1}`)
        .send(updateDto)
        .expect(400);
    });

    it('should fail validation when maxSpent is negative', async () => {
      const updateDto = {
        maxSpent: -100,
      };

      await request(app.getHttpServer())
        .put(`/membership/${createdMembershipId1}`)
        .send(updateDto)
        .expect(400);
    });

    it('should fail validation when discountPercent is negative', async () => {
      const updateDto = {
        discountPercent: -5,
      };

      await request(app.getHttpServer())
        .put(`/membership/${createdMembershipId1}`)
        .send(updateDto)
        .expect(400);
    });

    it('should fail validation when name is not a string', async () => {
      const updateDto = {
        name: 123,
      };

      await request(app.getHttpServer())
        .put(`/membership/${createdMembershipId1}`)
        .send(updateDto)
        .expect(400);
    });

    it('should fail validation when minSpent is not a number', async () => {
      const updateDto = {
        minSpent: 'not-a-number',
      };

      await request(app.getHttpServer())
        .put(`/membership/${createdMembershipId1}`)
        .send(updateDto)
        .expect(400);
    });

    it('should handle empty update body (no changes)', async () => {
      const membershipBefore = await membershipRepository.findOne({
        where: { id: createdMembershipId1 },
      });

      expect(membershipBefore).not.toBeNull();

      const response = await request(app.getHttpServer())
        .put(`/membership/${createdMembershipId1}`)
        .send({})
        .expect(200);

      // Should return the same membership without changes
      if (membershipBefore) {
        expect(response.body.id).toBe(membershipBefore.id);
        expect(response.body.name).toBe(membershipBefore.name);
      }
    });
  });

  describe('Membership-Customer Relationship', () => {
    it('should maintain relationship when membership is updated', async () => {
      // Create a customer with membership
      const customer = customerRepository.create({
        full_name: 'Test Customer',
        email: 'testcustomer@membership.com',
        password: 'hashedPassword',
        phone: '0123456789',
        gender: Gender.Male,
        customer_type: CustomerType.Regular,
        membershipId: createdMembershipId1,
        refreshToken: '',
      });
      const savedCustomer = await customerRepository.save(customer);
      createdCustomerId = savedCustomer.id;

      // Update membership
      const updateDto = {
        name: 'Updated Bronze Name',
      };

      await request(app.getHttpServer())
        .put(`/membership/${createdMembershipId1}`)
        .send(updateDto)
        .expect(200);

      // Verify customer still has the membership relationship
      const customerAfter = await customerRepository.findOne({
        where: { id: savedCustomer.id },
        relations: ['membership'],
      });

      expect(customerAfter).not.toBeNull();
      if (customerAfter) {
        expect(customerAfter.membershipId).toBe(createdMembershipId1);
        expect(customerAfter.membership).toBeDefined();
        if (customerAfter.membership) {
          expect(customerAfter.membership.id).toBe(createdMembershipId1);
          expect(customerAfter.membership.name).toBe(updateDto.name);
        }
      }

      // Restore original name
      await membershipRepository.update(createdMembershipId1, {
        name: 'Bronze',
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very large numbers for minSpent and maxSpent', async () => {
      // Use values within DECIMAL(10,2) range (max 99999999.99)
      const updateDto = {
        minSpent: 99999999.99,
        maxSpent: 99999999.99,
      };

      const response = await request(app.getHttpServer())
        .put(`/membership/${createdMembershipId3}`)
        .send(updateDto)
        .expect(200);

      expect(Number(response.body.minSpent)).toBe(updateDto.minSpent);
      expect(Number(response.body.maxSpent)).toBe(updateDto.maxSpent);

      // Restore original values
      await membershipRepository.update(createdMembershipId3, {
        minSpent: 5000000,
        maxSpent: undefined,
      });
    });

    it('should handle decimal values for discountPercent', async () => {
      const updateDto = {
        discountPercent: 12.75,
      };

      const response = await request(app.getHttpServer())
        .put(`/membership/${createdMembershipId2}`)
        .send(updateDto)
        .expect(200);

      expect(Number(response.body.discountPercent)).toBe(updateDto.discountPercent);

      // Restore original value
      await membershipRepository.update(createdMembershipId2, {
        discountPercent: 5,
      });
    });

    it('should handle null maxSpent (no upper limit)', async () => {
      const updateDto = {
        maxSpent: null,
      };

      const response = await request(app.getHttpServer())
        .put(`/membership/${createdMembershipId3}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.maxSpent).toBeNull();
    });

    it('should handle special characters in name', async () => {
      const updateDto = {
        name: 'Gold & Platinum VIP',
      };

      const response = await request(app.getHttpServer())
        .put(`/membership/${createdMembershipId3}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.name).toBe(updateDto.name);

      // Restore original name
      await membershipRepository.update(createdMembershipId3, {
        name: 'Gold',
      });
    });
  });
});

