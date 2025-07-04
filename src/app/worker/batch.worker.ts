import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { OrdersService } from '../orders/orders.service';
@Injectable()
export class BatchWorker implements OnModuleInit {
  private batch: any[] = [];
  private readonly BATCH_SIZE: number;
  private readonly logger = new Logger('BATCH_WORKER');

  constructor(
    private rabbitMQService: RabbitMQService,
    private configService: ConfigService,
    private ordersService: OrdersService,
  ) {
    const batchSize = this.configService.get('BATCH_SIZE', '10');
    this.BATCH_SIZE = parseInt(batchSize);
  }

  async onModuleInit() {
    setTimeout(async () => {
      await this.rabbitMQService.consumeFromQueueBatch(
        'main_queue',
        this.BATCH_SIZE,
        async (messages) => {
          await this.processBatch(messages);
        },
      );
    }, 1000);
  }

  private async processBatch(message: any) {
    try {
      const rawMsg = message.content.toString();
      const parse_message = JSON.parse(rawMsg);

      await this.ordersService.changeStatus(
        parse_message[0].id,
        'CASHBACK_PROCESSADO',
      );
      this.logger.log(`mensagem ${parse_message[0].id} processada com sucesso`);
    } catch (error) {
      this.logger.error(
        `Ocorreu um erro ao processar mensagem ${error.message}`,
      );
      console.error('Erro no lote:', error);
      throw error;
    }
  }
}
