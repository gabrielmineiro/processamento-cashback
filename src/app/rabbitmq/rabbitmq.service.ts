import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { connect, Channel, Connection } from 'amqplib';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private channel: Channel;
  private connection: Connection;
  private readonly MAX_RETRIES: number;

  constructor(private configService: ConfigService) {
    const maxRetries = this.configService.get('MAX_RETRIES', '3');
    this.MAX_RETRIES = parseInt(maxRetries);
  }

  async onModuleInit() {
    await this.connect();
  }

  async connect() {
    try {
      const rabbitmqUrl = this.configService.get<string>('RABBITMQ_URL');
      this.logger.log(rabbitmqUrl);
      if (!rabbitmqUrl) {
        throw new Error('RABBITMQ_URL environment variable is not set!');
      }

      this.connection = await connect(rabbitmqUrl);
      this.connection.on('close', () => {
        this.logger.error(
          'Conexão com RabbitMQ fechada! Tentando reconectar...',
        );
        setTimeout(() => this.connect(), 5000);
      });

      this.channel = await this.connection.createChannel();
      await this.setupQueues();
      this.logger.log('Conectado ao RabbitMQ!');
    } catch (error) {
      this.logger.error(`Falha na conexão: ${error.message}`);
      this.logger.warn(
        'RabbitMQ não disponível. Tentando reconectar em 10 segundos...',
      );
      setTimeout(() => this.connect(), 10000);
    }
  }

  private async setupQueues() {
    try {
      await this.channel.assertExchange('dlx_exchange', 'direct', {
        durable: true,
      });

      await this.channel.assertQueue('main_queue', {
        durable: true,
        deadLetterExchange: 'dlx_exchange',
        deadLetterRoutingKey: 'retry',
      });

      await this.channel.assertQueue('retry_queue', {
        durable: true,
        messageTtl: 10000,
        deadLetterExchange: 'dlx_exchange',
        deadLetterRoutingKey: 'main',
      });

      await this.channel.assertQueue('dlq', { durable: true });

      await this.channel.bindQueue('retry_queue', 'dlx_exchange', 'retry');
      await this.channel.bindQueue('main_queue', 'dlx_exchange', 'main');
      await this.channel.bindQueue('dlq', 'dlx_exchange', 'dlq');
    } catch (e) {
      this.logger.error(`Falha ao configurar as filas: ${e.message}`);
      throw e;
    }
  }

  async publishToQueue(queue: string, message: any) {
    if (!this.channel) {
      this.logger.warn('RabbitMQ não conectado. Mensagem não enviada.');
      return;
    }
    try {
      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        headers: message.headers || {},
      });
    } catch (error) {
      this.logger.error(`Erro ao publicar mensagem: ${error.message}`);
      throw error;
    }
  }

  async consumeFromQueueBatch(
    queue: string,
    batchSize: number,
    callback: (messages: any[]) => Promise<void>,
  ) {
    this.logger.log('entrei no consumeFromQueueBatch');

    if (!this.channel) {
      this.logger.warn(
        'RabbitMQ não conectado. Não é possível consumir mensagens.',
      );
      return;
    }

    const validBatchSize = Number(batchSize) || 10;
    this.logger.log(`Configurando prefetch para ${validBatchSize} mensagens`);

    await this.channel.prefetch(validBatchSize);

    const rawMessages: any[] = [];

    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;

      const content = JSON.parse(msg.content.toString());
      rawMessages.push(msg);

      if (rawMessages.length >= validBatchSize) {
        const batch = await Promise.all(
          rawMessages.map(async (rawMsg) => {
            const headers = rawMsg.properties.headers || {};
            const retryCount = headers['x-retry-count'] || 0;
            try {
              await callback(rawMsg);

              this.channel.ack(rawMsg);
            } catch (error) {
              this.logger.error(`Erro ao processar mensagem: ${error.message}`);

              if (retryCount >= this.MAX_RETRIES) {
                this.logger.warn(
                  `Excedido limite de retries. Enviando para DLQ`,
                );

                this.channel.sendToQueue('dlq', rawMsg.content, {
                  persistent: true,
                  headers,
                });
              } else {
                const updatedHeaders = {
                  ...headers,
                  'x-retry-count': retryCount + 1,
                };

                this.logger.warn(
                  `Retry #${updatedHeaders['x-retry-count']} - mensagem encaminhada para retry_queue`,
                );
                this.channel.sendToQueue('retry_queue', rawMsg.content, {
                  persistent: true,
                  headers: updatedHeaders,
                });
              }

              this.channel.ack(rawMsg);
            }
          }),
        );

        this.logger.log(
          `Lote de ${batch.length} mensagens processado com sucesso`,
        );

        rawMessages.length = 0;
      }
    });
  }

  async onModuleDestroy() {
    await this.close();
  }

  async close() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch (error) {
      this.logger.error(`Erro ao fechar conexão: ${error.message}`);
    }
  }
}
