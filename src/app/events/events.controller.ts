// src/events/events.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

@Controller('events')
export class EventsController {
  constructor(private readonly rabbitMQService: RabbitMQService) {}

  @Post()
  async createEvent(@Body() event: any) {
    await this.rabbitMQService.publishToQueue('main_queue', event);
    return { message: 'Evento enviado para a fila!' };
  }
}