import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { env } from './shared/infrastructure/env'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors()
  app.setGlobalPrefix('api')
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Silver Adventure Brain')
    .setDescription(
      'Motor inteligente: clusters, recomendaciones y agente. ' +
        'API REST consumible desde el front Next y desde Laravel.',
    )
    .setVersion('0.1.0')
    .build()

  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('docs', app, document)

  await app.listen(env.PORT)
}

void bootstrap()
