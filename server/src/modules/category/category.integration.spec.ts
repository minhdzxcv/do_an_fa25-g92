import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { CategoryModule } from './category.module';
import { CategoryService } from './category.service';
import { Category } from '@/entities/category.entity';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

describe('Category Module Integration Tests', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let dataSource: DataSource;
  let categoryRepository: Repository<Category>;

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

    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
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
        JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '1d' } }),
        CategoryModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    categoryRepository = moduleFixture.get<Repository<Category>>(getRepositoryToken(Category));
  });

  afterAll(async () => {
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
    await dataSource.query('DELETE FROM category');
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
    await dataSource.destroy();
    await app.close();
  });

  // 🧪 Tests
  describe('POST /category', () => {
    it('should create a new category', async () => {
      const res = await request(app.getHttpServer())
        .post('/category')
        .send({
          name: 'Category Test',
          description: 'Category for testing',
          isActive: true,
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Category Test');
    });

    it('should fail when name is missing', async () => {
      await request(app.getHttpServer())
        .post('/category')
        .send({ description: 'Missing name' })
        .expect(400);
    });
  });

  describe('GET /category', () => {
    it('should return all categories', async () => {
      const res = await request(app.getHttpServer()).get('/category').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /category/:id', () => {
    it('should return category by id', async () => {
      const cat = await categoryRepository.save({
        name: 'Specific Category',
        description: 'Find me',
        isActive: true,
      });

      const res = await request(app.getHttpServer())
        .get(`/category/${cat.id}`)
        .expect(200);

      expect(res.body.id).toBe(cat.id);
    });

    it('should return 404 if not found', async () => {
      await request(app.getHttpServer())
        .get('/category/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PUT /category/:id', () => {
    it('should update category', async () => {
      const cat = await categoryRepository.save({
        name: 'Old Category',
        description: 'Before update',
        isActive: true,
      });

      const res = await request(app.getHttpServer())
        .put(`/category/${cat.id}`)
        .send({
          name: 'Updated Category',
          description: 'After update',
          isActive: false,
        })
        .expect(200);

      expect(res.body.name).toBe('Updated Category');
      expect(res.body.isActive).toBe(false);
    });
  });

  describe('DELETE /category/:id', () => {
    it('should soft delete category', async () => {
      const cat = await categoryRepository.save({
        name: 'To Delete',
        description: 'Should be soft deleted',
        isActive: true,
      });

      await request(app.getHttpServer()).delete(`/category/${cat.id}`).expect(200);

      const deleted = await categoryRepository.findOne({
        where: { id: cat.id },
        withDeleted: true,
      });
      expect(deleted?.deletedAt).not.toBeNull();
    });
  });
});
