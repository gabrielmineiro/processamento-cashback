// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitMQModule } from './app/rabbitmq/rabbitmq.module';
import { EventsController } from './app/events/events.controller';
import { BatchWorker } from './app/worker/batch.worker';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RabbitMQModule
  ],
  controllers: [EventsController],
  providers: [BatchWorker],
})
export class AppModule {}