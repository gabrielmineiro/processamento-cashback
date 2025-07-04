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
  private CURRENT_ATTEMPT: number = 0;

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
      this.channel.on('error', (error) => {
        this.logger.error(`Erro no canal: ${error.message}`);
      });
      this.channel.on('close', () => {
        this.logger.warn('Canal fechado');
      });
      await this.setupQueues();
      this.logger.log('Conectado ao RabbitMQ!');
    } catch (error) {
      this.logger.error(`Falha na conexão: ${error.message}`);
      this.logger.warn(
        'RabbitMQ não disponível. Tentando reconectar em 5 segundos...',
      );
      setTimeout(() => this.connect(), 5000);
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
    try {
      if (!this.channel) {
        this.logger.warn('RabbitMQ não conectado. Tentando reconectar...');
        await this.connect();
      }

      this.logger.log('Enviando pedido para fila...');
      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        headers: message.headers || {},
      });
      this.logger.log('Pedido enviado para a fila com sucesso!');
    } catch (error) {
      this.logger.error(`Erro ao publicar mensagem na fila ${queue}:`, error);

      if (this.CURRENT_ATTEMPT < 3) {
        this.CURRENT_ATTEMPT++;
        this.logger.warn(
          `Tentativa ${this.CURRENT_ATTEMPT} de 3. Reenviando em 500ms...`,
        );
        setTimeout(() => {
          this.publishToQueue(queue, message);
        }, 500);
      } else {
        this.logger.error(
          'Número máximo de tentativas atingido. Desistindo de enviar a mensagem.',
        );
        this.CURRENT_ATTEMPT = 0;
      }
    }
  }

  async consumeFromQueueBatch(
    queue: string,
    batchSize: number,
    callback: (messages: any[]) => Promise<void>,
  ) {
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    this.logger.log(`Iniciando consumo em lotes de ${batchSize} mensagens`);

    while (true) {
      if (!this.channel) {
        this.logger.warn('Canal não está disponível. Tentando reconectar...');
        await this.connect();
        await sleep(5000);
        continue;
      }

      const queueInfo = await this.channel.checkQueue(queue);
      const messageCount = queueInfo.messageCount;

      if (messageCount >= batchSize) {
        const batch: any[] = [];

        for (let i = 0; i < batchSize; i++) {
          const msg = await this.channel.get(queue, { noAck: false });
          if (msg) {
            batch.push(msg);
          }
        }

        this.logger.log(`Consumindo lote de ${batch.length} mensagens`);

        for (const msg of batch) {
          if (!this.channel || this.channel.closed) {
            this.logger.warn('Canal fechado durante processamento');
            return;
          }

          const headers = msg.properties.headers || {};
          const retryCount = headers['x-retry-count'] || 0;

          try {
            await callback(msg);
            this.safeAck(msg);
          } catch (error) {
            this.logger.error(`Erro ao processar mensagem: ${error.message}`);

            if (retryCount >= this.MAX_RETRIES) {
              this.logger.warn(`Excedido limite de retries. Enviando para DLQ`);
              this.safeSendToQueue('dlq', msg.content, {
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
              this.safeSendToQueue('retry_queue', msg.content, {
                persistent: true,
                headers: updatedHeaders,
              });
            }
            this.safeAck(msg);
          }
        }
        this.logger.log(`Lote de ${batch.length} mensagens processado`);
      } else {
        this.logger.log(
          `Aguardando lote. Faltam ${batchSize - messageCount} mensagens...`,
        );
        await sleep(2000);
      }
    }
  }

  private safeSendToQueue(queue: string, content: Buffer, options: any) {
    try {
      if (this.channel && !this.channel.closed) {
        this.channel.sendToQueue(queue, content, options);
      }
    } catch (error) {
      this.logger.warn(`Erro ao enviar para fila ${queue}: ${error.message}`);
    }
  }

  private safeAck(msg: any) {
    try {
      if (this.channel && !this.channel.closed) {
        this.channel.ack(msg);
      } else {
        this.logger.warn(
          'Canal fechado - não é possível fazer ack da mensagem',
        );
      }
    } catch (error) {
      this.logger.warn(`Erro ao fazer ack da mensagem: ${error.message}`);
    }
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
