import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AccountModule } from './account.module';
import { Customer } from '@/entities/customer.entity';
import { Internal } from '@/entities/internal.entity';
import { Doctor } from '@/entities/doctor.entity';
import { Role } from '@/entities/role.entity';
import { Service } from '@/entities/service.entity';
import { Category } from '@/entities/category.entity';
import { Gender } from '@/entities/enums/gender.enum';
import { CustomerType } from '@/entities/enums/customer-type.enum';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

describe('Account Module Integration Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let customerRepository: Repository<Customer>;
  let internalRepository: Repository<Internal>;
  let doctorRepository: Repository<Doctor>;
  let roleRepository: Repository<Role>;
  let serviceRepository: Repository<Service>;
  let categoryRepository: Repository<Category>;
  // Test data
  let createdRoleId: number;
  let createdServiceId: string;
  let createdCategoryId: string;

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
          secret: process.env.JWT_SECRET || 'test-secret-key-12345',
          signOptions: { expiresIn: '1d' },
        }),
        AccountModule,
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
    customerRepository = moduleFixture.get<Repository<Customer>>(
      getRepositoryToken(Customer),
    );
    internalRepository = moduleFixture.get<Repository<Internal>>(
      getRepositoryToken(Internal),
    );
    doctorRepository = moduleFixture.get<Repository<Doctor>>(
      getRepositoryToken(Doctor),
    );
    roleRepository = moduleFixture.get<Repository<Role>>(
      getRepositoryToken(Role),
    );
    serviceRepository = moduleFixture.get<Repository<Service>>(
      getRepositoryToken(Service),
    );
    categoryRepository = moduleFixture.get<Repository<Category>>(
      getRepositoryToken(Category),
    );

    // Setup test data
    await setupTestData();
  }, 60000); // Increase timeout for database setup

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
  }, 30000);

  beforeEach(async () => {
    // Clean database before each test to ensure test isolation
    try {
      // Use SQL queries to delete data to avoid foreign key constraints
      if (dataSource && dataSource.isInitialized) {
        try {
          // Disable foreign key checks temporarily
          await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
          // Delete test data in correct order (child tables first)
          await dataSource.query('DELETE FROM cart_detail');
          await dataSource.query('DELETE FROM cart');
          await dataSource.query('DELETE FROM appointment_detail');
          await dataSource.query('DELETE FROM appointment');
          await dataSource.query('DELETE FROM customer');
          await dataSource.query('DELETE FROM internal');
          await dataSource.query('DELETE FROM doctor');
          // Don't delete service, category, role - they are needed for tests
          // Re-enable foreign key checks
          await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
        } catch (error) {
          // Re-enable foreign key checks in case of error
          await dataSource.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
          // If deletion fails, just log warning
          if (!error.message?.includes('foreign key')) {
            console.warn('⚠️ Error cleaning test data:', error.message);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Error cleaning test data:', error);
    }
  });

  async function setupTestData() {
    try {
      // Create test role if it doesn't exist
      let role = await roleRepository.findOne({ where: { name: 'staff' } });
      if (!role) {
        role = roleRepository.create({
          name: 'staff',
          description: 'Staff role for testing',
        });
        role = await roleRepository.save(role);
      }
      createdRoleId = role.id;

      // Create test category if it doesn't exist
      let category = await categoryRepository.findOne({
        where: { name: 'Test Category' },
      });
      if (!category) {
        category = categoryRepository.create({
          name: 'Test Category',
          description: 'Test category for testing',
          isActive: true,
        });
        category = await categoryRepository.save(category);
      }
      createdCategoryId = category.id;

      // Create test service if it doesn't exist
      let service = await serviceRepository.findOne({
        where: { name: 'Test Service' },
      });
      if (!service) {
        service = serviceRepository.create({
          name: 'Test Service',
          price: 100000,
          images: [],
          categoryId: createdCategoryId,
          isActive: true,
        });
        service = await serviceRepository.save(service);
      }
      createdServiceId = service.id;
    } catch (error) {
      console.error('❌ Error setting up test data:', error);
      throw error;
    }
  }

  async function cleanupTestData() {
    try {
      // Use SQL queries to delete data to avoid foreign key constraints
      if (dataSource && dataSource.isInitialized) {
        try {
          // Disable foreign key checks temporarily
          await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
          // Delete test data in correct order (child tables first)
          await dataSource.query('DELETE FROM cart_detail');
          await dataSource.query('DELETE FROM cart');
          await dataSource.query('DELETE FROM appointment_detail');
          await dataSource.query('DELETE FROM appointment');
          await dataSource.query('DELETE FROM customer');
          await dataSource.query('DELETE FROM internal');
          await dataSource.query('DELETE FROM doctor');
          await dataSource.query('DELETE FROM service');
          await dataSource.query('DELETE FROM category');
          await dataSource.query('DELETE FROM role');
          // Re-enable foreign key checks
          await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
        } catch (error) {
          // Re-enable foreign key checks in case of error
          await dataSource.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
          throw error;
        }
      }
    } catch (error) {
      console.error('❌ Error cleaning up test data:', error);
    }
  }

  describe('Customer Management', () => {
    describe('POST /account/create-customer', () => {
      it('should create a new customer successfully', async () => {
        const createCustomerDto = {
          full_name: 'Test Customer',
          email: 'testcustomer@example.com',
          password: 'password123',
          phone: '0123456789',
          gender: Gender.Male,
          customer_type: CustomerType.Regular,
        };

        const response = await request(app.getHttpServer())
          .post('/account/create-customer')
          .send(createCustomerDto)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.email).toBe(createCustomerDto.email);
        expect(response.body.full_name).toBe(createCustomerDto.full_name);
        expect(response.body).not.toHaveProperty('password');
        expect(response.body).not.toHaveProperty('refreshToken');
      });

      it('should fail when email already exists', async () => {
        const createCustomerDto = {
          full_name: 'Test Customer',
          email: 'duplicate@example.com',
          password: 'password123',
          phone: '0123456789',
          gender: Gender.Male,
        };

        // Create first customer
        await request(app.getHttpServer())
          .post('/account/create-customer')
          .send(createCustomerDto)
          .expect(201);

        // Try to create duplicate
        await request(app.getHttpServer())
          .post('/account/create-customer')
          .send(createCustomerDto)
          .expect(409);
      });

      it('should fail when required fields are missing', async () => {
        const invalidDto = {
          full_name: 'Test Customer',
          // Missing email, password, phone
        };

        await request(app.getHttpServer())
          .post('/account/create-customer')
          .send(invalidDto)
          .expect(400);
      });
    });

    describe('GET /account/customers', () => {
      it('should return all customers', async () => {
        // Create test customers
        const customer1 = customerRepository.create({
          full_name: 'Customer 1',
          email: 'customer1@test.com',
          password: 'hashedPassword',
          phone: '0123456789',
          gender: Gender.Male,
          refreshToken: '',
        });
        const customer2 = customerRepository.create({
          full_name: 'Customer 2',
          email: 'customer2@test.com',
          password: 'hashedPassword',
          phone: '0987654321',
          gender: Gender.Female,
          refreshToken: '',
        });

        await customerRepository.save([customer1, customer2]);

        const response = await request(app.getHttpServer())
          .get('/account/customers')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(2);
        expect(response.body[0]).not.toHaveProperty('password');
        expect(response.body[0]).not.toHaveProperty('refreshToken');
      });
    });

    describe('GET /account/customer/:id', () => {
      it('should return a customer by id', async () => {
        const customer = customerRepository.create({
          full_name: 'Test Customer',
          email: 'getcustomer@test.com',
          password: 'hashedPassword',
          phone: '0123456789',
          gender: Gender.Male,
          refreshToken: '',
        });
        const savedCustomer = await customerRepository.save(customer);

        const response = await request(app.getHttpServer())
          .get(`/account/customer/${savedCustomer.id}`)
          .expect(200);

        expect(response.body.id).toBe(savedCustomer.id);
        expect(response.body.email).toBe(savedCustomer.email);
      });

      it('should return 404 when customer not found', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        await request(app.getHttpServer())
          .get(`/account/customer/${fakeId}`)
          .expect(404);
      });
    });

    describe('PATCH /account/customer/:id', () => {
      it('should update a customer successfully', async () => {
        const customer = customerRepository.create({
          full_name: 'Original Name',
          email: 'updatecustomer@test.com',
          password: 'hashedPassword',
          phone: '0123456789',
          gender: Gender.Male,
          refreshToken: '',
        });
        const savedCustomer = await customerRepository.save(customer);

        const updateDto = {
          full_name: 'Updated Name',
          phone: '0987654321',
          email: 'updatecustomer@test.com', // Required field
          gender: Gender.Male, // Required field
        };

        const response = await request(app.getHttpServer())
          .patch(`/account/customer/${savedCustomer.id}`)
          .send(updateDto)
          .expect(200);

        // Service returns a simplified response, not full customer object
        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toBe(savedCustomer.id);
        // Verify update in database
        const updatedCustomer = await customerRepository.findOne({
          where: { id: savedCustomer.id },
        });
        expect(updatedCustomer).not.toBeNull();
        if (updatedCustomer) {
          expect(updatedCustomer.full_name).toBe(updateDto.full_name);
          expect(updatedCustomer.phone).toBe(updateDto.phone);
        }
      });
    });

    describe('PATCH /account/customers/:id/active', () => {
      it('should toggle customer active status', async () => {
        const customer = customerRepository.create({
          full_name: 'Test Customer',
          email: 'togglecustomer@test.com',
          password: 'hashedPassword',
          phone: '0123456789',
          gender: Gender.Male,
          isActive: true,
          refreshToken: '',
        });
        const savedCustomer = await customerRepository.save(customer);

        const response = await request(app.getHttpServer())
          .patch(`/account/customers/${savedCustomer.id}/active`)
          .expect(200);

        expect(response.body.isActive).toBe(false);
      });
    });

    describe('POST /account/update-customer-password', () => {
      it('should update customer password successfully', async () => {
        const customer = customerRepository.create({
          full_name: 'Test Customer',
          email: 'passwordcustomer@test.com',
          password: '$2b$10$abcdefghijklmnopqrstuv', // Already hashed password
          phone: '0123456789',
          gender: Gender.Male,
          refreshToken: '',
        });
        const savedCustomer = await customerRepository.save(customer);
        const oldPasswordHash = savedCustomer.password;

        const updatePasswordDto = {
          id: savedCustomer.id,
          newPassword: 'newPassword123',
        };

        const response = await request(app.getHttpServer())
          .post('/account/update-customer-password')
          .send(updatePasswordDto)
          .expect(201);

        // Password should not be in response for security reasons
        expect(response.body).not.toHaveProperty('password');
        // Verify customer exists (password was updated in database)
        const updatedCustomer = await customerRepository.findOne({
          where: { id: savedCustomer.id },
        });
        expect(updatedCustomer).not.toBeNull();
        if (updatedCustomer) {
          expect(updatedCustomer.password).not.toBe(oldPasswordHash);
          expect(updatedCustomer.password).not.toBe('newPassword123'); // Should be hashed
        }
      });
    });

    describe('DELETE /account/customer/:id', () => {
      it('should delete a customer successfully', async () => {
        const customer = customerRepository.create({
          full_name: 'Test Customer',
          email: 'deletecustomer@test.com',
          password: 'hashedPassword',
          phone: '0123456789',
          gender: Gender.Male,
          refreshToken: '',
        });
        const savedCustomer = await customerRepository.save(customer);

        await request(app.getHttpServer())
          .delete(`/account/customer/${savedCustomer.id}`)
          .expect(200);

        // Verify customer is deleted
        const found = await customerRepository.findOne({
          where: { id: savedCustomer.id },
        });
        expect(found).toBeNull();
      });
    });
  });

  describe('Internal Staff Management', () => {
    describe('POST /account/create-internal', () => {
      it('should create a new internal staff successfully', async () => {
        const role = await roleRepository.findOne({
          where: { id: createdRoleId },
        });

        if (!role) {
          throw new Error('Test role not found');
        }

        const createInternalDto = {
          full_name: 'Test Staff',
          email: 'teststaff@example.com',
          password: 'password123',
          phone: '0123456789',
          gender: Gender.Female,
          positionID: role.id.toString(),
        };

        const response = await request(app.getHttpServer())
          .post('/account/create-internal')
          .send(createInternalDto)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.email).toBe(createInternalDto.email);
        expect(response.body.full_name).toBe(createInternalDto.full_name);
        expect(response.body).not.toHaveProperty('password');
        expect(response.body.role).toBeDefined();
      });

      it('should fail when email already exists', async () => {
        const role = await roleRepository.findOne({
          where: { id: createdRoleId },
        });

        if (!role) {
          throw new Error('Test role not found');
        }

        const createInternalDto = {
          full_name: 'Test Staff',
          email: 'duplicatestaff@example.com',
          password: 'password123',
          phone: '0123456789',
          gender: Gender.Female,
          positionID: role.id.toString(),
        };

        // Create first staff
        await request(app.getHttpServer())
          .post('/account/create-internal')
          .send(createInternalDto)
          .expect(201);

        // Try to create duplicate
        await request(app.getHttpServer())
          .post('/account/create-internal')
          .send(createInternalDto)
          .expect(409);
      });
    });

    describe('GET /account/internals', () => {
      it('should return all internal staff', async () => {
        const role = await roleRepository.findOne({
          where: { id: createdRoleId },
        });

        if (!role) {
          throw new Error('Test role not found');
        }

        const staff1 = internalRepository.create({
          full_name: 'Staff 1',
          email: 'staff1@test.com',
          password: 'hashedPassword',
          gender: Gender.Male,
          role: role,
          refreshToken: '',
        });
        const staff2 = internalRepository.create({
          full_name: 'Staff 2',
          email: 'staff2@test.com',
          password: 'hashedPassword',
          gender: Gender.Female,
          role: role,
          refreshToken: '',
        });

        await internalRepository.save([staff1, staff2]);

        const response = await request(app.getHttpServer())
          .get('/account/internals')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('GET /account/internals/:id', () => {
      it('should return an internal staff by id', async () => {
        const role = await roleRepository.findOne({
          where: { id: createdRoleId },
        });

        if (!role) {
          throw new Error('Test role not found');
        }

        const staff = internalRepository.create({
          full_name: 'Test Staff',
          email: 'getstaff@test.com',
          password: 'hashedPassword',
          gender: Gender.Male,
          role: role,
          refreshToken: '',
        });
        const savedStaff = await internalRepository.save(staff);

        const response = await request(app.getHttpServer())
          .get(`/account/internals/${savedStaff.id}`)
          .expect(200);

        expect(response.body.id).toBe(savedStaff.id);
        expect(response.body.email).toBe(savedStaff.email);
        expect(response.body.role).toBeDefined();
      });

      it('should return 404 when staff not found', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        await request(app.getHttpServer())
          .get(`/account/internals/${fakeId}`)
          .expect(404);
      });
    });

    describe('PATCH /account/internals/:id/active', () => {
      it('should toggle internal staff active status', async () => {
        const role = await roleRepository.findOne({
          where: { id: createdRoleId },
        });

        if (!role) {
          throw new Error('Test role not found');
        }

        const staff = internalRepository.create({
          full_name: 'Test Staff',
          email: 'togglestaff@test.com',
          password: 'hashedPassword',
          gender: Gender.Male,
          isActive: true,
          role: role,
          refreshToken: '',
        });
        const savedStaff = await internalRepository.save(staff);

        const response = await request(app.getHttpServer())
          .patch(`/account/internals/${savedStaff.id}/active`)
          .expect(200);

        expect(response.body.isActive).toBe(false);
      });
    });

    describe('DELETE /account/internals/:id', () => {
      it('should soft delete an internal staff successfully', async () => {
        const role = await roleRepository.findOne({
          where: { id: createdRoleId },
        });

        if (!role) {
          throw new Error('Test role not found');
        }

        const staff = internalRepository.create({
          full_name: 'Test Staff',
          email: 'deletestaff@test.com',
          password: 'hashedPassword',
          gender: Gender.Male,
          role: role,
          refreshToken: '',
        });
        const savedStaff = await internalRepository.save(staff);

        const response = await request(app.getHttpServer())
          .delete(`/account/internals/${savedStaff.id}`)
          .expect(200);

        expect(response.body).toHaveProperty('message');
      });
    });

    describe('GET /account/internals/roles/all', () => {
      it('should return all internal roles', async () => {
        const response = await request(app.getHttpServer())
          .get('/account/internals/roles/all')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Doctor Management', () => {
    describe('POST /account/create-doctor', () => {
      it('should create a new doctor successfully', async () => {
        const service = await serviceRepository.findOne({
          where: { id: createdServiceId },
        });

        if (!service) {
          throw new Error('Test service not found');
        }

        const createDoctorDto = {
          full_name: 'Test Doctor',
          email: 'testdoctor@example.com',
          password: 'password123',
          phone: '0123456789',
          gender: Gender.Male,
          specialization: 'Dermatology',
          experience_years: '5',
          serviceIds: [service.id],
        };

        const response = await request(app.getHttpServer())
          .post('/account/create-doctor')
          .send(createDoctorDto)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.email).toBe(createDoctorDto.email);
        expect(response.body.full_name).toBe(createDoctorDto.full_name);
        expect(response.body).not.toHaveProperty('password');
        expect(response.body.services).toBeDefined();
      });

      it('should fail when email already exists', async () => {
        const service = await serviceRepository.findOne({
          where: { id: createdServiceId },
        });

        if (!service) {
          throw new Error('Test service not found');
        }

        const createDoctorDto = {
          full_name: 'Test Doctor',
          email: 'duplicatedoctor@example.com',
          password: 'password123',
          phone: '0123456789',
          gender: Gender.Male,
          specialization: 'Dermatology',
          experience_years: '5',
          serviceIds: [service.id],
        };

        // Create first doctor
        await request(app.getHttpServer())
          .post('/account/create-doctor')
          .send(createDoctorDto)
          .expect(201);

        // Try to create duplicate
        await request(app.getHttpServer())
          .post('/account/create-doctor')
          .send(createDoctorDto)
          .expect(409);
      });
    });

    describe('GET /account/doctors', () => {
      it('should return all doctors', async () => {
        const service = await serviceRepository.findOne({
          where: { id: createdServiceId },
        });

        if (!service) {
          throw new Error('Test service not found');
        }

        const doctor1 = doctorRepository.create({
          full_name: 'Doctor 1',
          email: 'doctor1@test.com',
          password: 'hashedPassword',
          gender: Gender.Male,
          specialization: 'Dermatology',
          services: [service],
          refreshToken: '',
        });
        const doctor2 = doctorRepository.create({
          full_name: 'Doctor 2',
          email: 'doctor2@test.com',
          password: 'hashedPassword',
          gender: Gender.Female,
          specialization: 'Cardiology',
          services: [service],
          refreshToken: '',
        });

        await doctorRepository.save([doctor1, doctor2]);

        const response = await request(app.getHttpServer())
          .get('/account/doctors')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(2);
        expect(response.body[0]).not.toHaveProperty('password');
        expect(response.body[0]).not.toHaveProperty('refreshToken');
        expect(response.body[0].services).toBeDefined();
      });
    });

    describe('GET /account/doctors/:id', () => {
      it('should return a doctor by id', async () => {
        const service = await serviceRepository.findOne({
          where: { id: createdServiceId },
        });

        if (!service) {
          throw new Error('Test service not found');
        }

        const doctor = doctorRepository.create({
          full_name: 'Test Doctor',
          email: 'getdoctor@test.com',
          password: 'hashedPassword',
          gender: Gender.Male,
          specialization: 'Dermatology',
          services: [service],
          refreshToken: '',
        });
        const savedDoctor = await doctorRepository.save(doctor);

        const response = await request(app.getHttpServer())
          .get(`/account/doctors/${savedDoctor.id}`)
          .expect(200);

        expect(response.body.id).toBe(savedDoctor.id);
        expect(response.body.email).toBe(savedDoctor.email);
        expect(response.body.services).toBeDefined();
      });

      it('should return 404 when doctor not found', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        await request(app.getHttpServer())
          .get(`/account/doctors/${fakeId}`)
          .expect(404);
      });
    });

    describe('PATCH /account/doctors/:id/active', () => {
      it('should toggle doctor active status', async () => {
        const service = await serviceRepository.findOne({
          where: { id: createdServiceId },
        });

        if (!service) {
          throw new Error('Test service not found');
        }

        const doctor = doctorRepository.create({
          full_name: 'Test Doctor',
          email: 'toggledoctor@test.com',
          password: 'hashedPassword',
          gender: Gender.Male,
          specialization: 'Dermatology',
          isActive: true,
          services: [service],
          refreshToken: '',
        });
        const savedDoctor = await doctorRepository.save(doctor);

        const response = await request(app.getHttpServer())
          .patch(`/account/doctors/${savedDoctor.id}/active`)
          .expect(200);

        expect(response.body.isActive).toBe(false);
      });
    });

    describe('DELETE /account/doctors/:id', () => {
      it('should soft delete a doctor successfully', async () => {
        const service = await serviceRepository.findOne({
          where: { id: createdServiceId },
        });

        if (!service) {
          throw new Error('Test service not found');
        }

        const doctor = doctorRepository.create({
          full_name: 'Test Doctor',
          email: 'deletedoctor@test.com',
          password: 'hashedPassword',
          gender: Gender.Male,
          specialization: 'Dermatology',
          services: [service],
          refreshToken: '',
        });
        const savedDoctor = await doctorRepository.save(doctor);

        const response = await request(app.getHttpServer())
          .delete(`/account/doctors/${savedDoctor.id}`)
          .expect(200);

        expect(response.body).toHaveProperty('message');
      });
    });

    describe('GET /account/doctors/public-profile/:id', () => {
      it('should return public doctor profile', async () => {
        const service = await serviceRepository.findOne({
          where: { id: createdServiceId },
        });

        if (!service) {
          throw new Error('Test service not found');
        }

        const doctor = doctorRepository.create({
          full_name: 'Public Doctor',
          email: 'publicdoctor@test.com',
          password: 'hashedPassword',
          gender: Gender.Male,
          specialization: 'Dermatology',
          biography: 'Experienced doctor',
          experience_years: 10,
          services: [service],
          refreshToken: '',
        });
        const savedDoctor = await doctorRepository.save(doctor);

        const response = await request(app.getHttpServer())
          .get(`/account/doctors/public-profile/${savedDoctor.id}`)
          .expect(200);

        expect(response.body.id).toBe(savedDoctor.id);
        expect(response.body).not.toHaveProperty('password');
        expect(response.body).not.toHaveProperty('refreshToken');
        expect(response.body.services).toBeDefined();
      });
    });
  });
});

