import { Controller, Post, Body, Logger, Res } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { OrdersService } from './orders.service';
import { OrderType } from './types';
import { Response } from 'express';

@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersService.name);
  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly ordersService: OrdersService,
  ) {}

  @Post()
  async createOrder(@Body() order: OrderType, @Res() res: Response) {
    try {
      this.logger.log('Criando pedido');
      const insert = await this.ordersService.createOrder(order);

      this.logger.log('Pedido Criado');
      this.logger.log('Enviando pedido para fila');

      await this.rabbitMQService.publishToQueue('main_queue', insert);

      this.logger.log('Pedido enviado para a fila com sucesso!');

      return res.status(201).json({
        message: 'Pedido criado com sucesso!',
        data: insert,
      });
    } catch (e) {
      this.logger.error('Ocorreu um erro na criação do pedido');
      return res.status(500).json({
        message: 'Erro ao criar pedido',
        data: e.message,
      });
    }
  }
}
