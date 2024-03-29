import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { useContainer } from 'class-validator';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const articleShape = expect.objectContaining({
    id: expect.any(Number),
    body: expect.any(String),
    title: expect.any(String),
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
    published: expect.any(Boolean),
  })

  const articlesData = [
    {
      id: 100001,
      title: 'Article 1',
      description: 'Description 1',
      body: 'Body 1',
      published: true,
    },
    {
      id: 100002,
      title: 'Article 2',
      description: 'Description 2',
      body: 'Body 2',
      published: false,
    }
  ]

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    prisma = app.get<PrismaService>(PrismaService);

    useContainer(app.select(AppModule), { fallbackOnErrors: true })
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }))

    await app.init();

    articlesData.forEach(async (article) => {
      await prisma.article.create({
        data: article
      })
    })
  });

  describe('GET /articles', () => {
    it('should return a list of published articles', async () => {
      const { status, body } = await request(app.getHttpServer()).get('/articles')

      expect(status).toBe(200)
      expect(body).toStrictEqual(expect.arrayContaining([articleShape]))
      expect(body).toHaveLength(1)
      expect(body[0].published).toBeTruthy()
    })

    it('should return a list of unpublished articles', async () => {
      const { status, body } = await request(app.getHttpServer()).get('/articles/drafts')

      expect(status).toBe(200)
      expect(body).toStrictEqual(expect.arrayContaining([articleShape]))
      expect(body).toHaveLength(1)
      expect(body[0].published).toBeFalsy()
    })
  })

  describe('GET /articles/{id}', () => {
    it('should return a given article', async () => {
      const { status, body } = await request(app.getHttpServer()).get(
        `/articles/${articlesData[0].id}`,
      );

      expect(status).toBe(200);
      expect(body).toStrictEqual(articleShape);
      expect(body.id).toEqual(articlesData[0].id);
    });

    it('should not return non existing', async () => {
      const { status } = await request(app.getHttpServer()).get(
        `/articles/100`,
      );

      expect(status).toBe(404);
    });

    it('should failt to return article with invalid id type', async () => {
      const { status } = await request(app.getHttpServer()).get(
        `/articles/string-id`,
      );

      expect(status).toBe(400);
    });
  });

  describe('POST /articles', () => {
    it('creates an article', async () => {
      const beforeCount = await prisma.article.count();

      const { status, body } = await request(app.getHttpServer())
        .post('/articles')
        .send({
          title: 'title3',
          description: 'description3',
          body: 'body3a',
          published: false,
        });

      const afterCount = await prisma.article.count();

      expect(status).toBe(201);
      expect(afterCount - beforeCount).toBe(1);
    });

    it('fails to create article without title', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/articles')
        .send({
          description: 'description4',
          body: 'body4',
          published: true,
        });

      expect(status).toBe(400);
    });
  });
});
