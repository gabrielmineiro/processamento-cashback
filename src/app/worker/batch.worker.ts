// src/workers/batch.worker.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class BatchWorker implements OnModuleInit {
  private batch: any[] = [];
  private readonly BATCH_SIZE: number;

  constructor(
    private rabbitMQService: RabbitMQService,
    private configService: ConfigService,
  ) {
    const batchSize = this.configService.get('BATCH_SIZE', '10');
    this.BATCH_SIZE = parseInt(batchSize);
    console.log('BATCH_SIZE configurado:', this.BATCH_SIZE);
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

  private async processBatch(messages: any[]) {
    try {
      console.log(`Processando mensagem:`, messages);
      
      // Simula processamento (ex.: salvar no banco)
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      console.log('Lote processado com sucesso!');
    } catch (error) {
      console.error('Erro no lote:', error);
      throw error;
    }
  }
}