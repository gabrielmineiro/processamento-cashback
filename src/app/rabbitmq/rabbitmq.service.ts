import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { connect, Channel, Connection } from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private channel: Channel;
  private connection: Connection;
  private readonly MAX_RETRIES = 3;

  async onModuleInit() {
    await this.connect();
  }

  async connect() {
    try {
      this.connection = await connect('amqp://localhost:5672');
      this.connection.on('close', () => {
        this.logger.error('Conexão com RabbitMQ fechada! Tentando reconectar...');
        setTimeout(() => this.connect(), 5000);
      });
      
      this.channel = await this.connection.createChannel();
      await this.setupQueues();
      this.logger.log('Conectado ao RabbitMQ!');
    } catch (error) {
      this.logger.error(`Falha na conexão: ${error.message}`);
      this.logger.warn('RabbitMQ não disponível. Tentando reconectar em 10 segundos...');
      setTimeout(() => this.connect(), 10000);
    }
  }

private async setupQueues() {
    try {
    await this.channel.deleteQueue('main_queue');
    await this.channel.deleteQueue('retry_queue'); 
    await this.channel.deleteQueue('dlq');
    } catch (error) {
        // Ignora se não existir
    }
    // Exchange de Dead Letter
    await this.channel.assertExchange('dlx_exchange', 'direct', { durable: true });

    // Fila principal → vai para retry_queue quando rejeitada
    await this.channel.assertQueue('main_queue', {
        durable: true,
        deadLetterExchange: 'dlx_exchange',
        deadLetterRoutingKey: 'retry',
    });

    // Fila de retry com TTL → volta para main_queue
    await this.channel.assertQueue('retry_queue', {
        durable: true,
        messageTtl: 10000, // 10 segundos
        deadLetterExchange: 'dlx_exchange',
        deadLetterRoutingKey: 'main', // volta para main
    });

    // DLQ final para mensagens que excederam retries
    await this.channel.assertQueue('dlq', { durable: true });

    // Bindings do exchange
    await this.channel.bindQueue('retry_queue', 'dlx_exchange', 'retry');
    await this.channel.bindQueue('main_queue', 'dlx_exchange', 'main');
    await this.channel.bindQueue('dlq', 'dlx_exchange', 'dlq');
}


  async publishToQueue(queue: string, message: any) {
    if (!this.channel) {
      console.log('RabbitMQ não conectado. Não é possível publicar mensagens.');
      this.logger.warn('RabbitMQ não conectado. Mensagem não enviada.');
      return;
    }
    try {
      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        headers: message.headers || {}, // Preserva headers se existirem
      });
      console.log(`Mensagem enviada para a fila ${queue}:`, message);
    } catch (error) {
      this.logger.error(`Erro ao publicar mensagem: ${error.message}`);
      throw error;
    }
  }


  async consumeFromQueueBatch(queue: string, batchSize: number, callback: (messages: any[]) => Promise<void>) {
    if (!this.channel) {
      this.logger.warn('RabbitMQ não conectado. Não é possível consumir mensagens.');
      return;
    }

    // Valida batchSize
    const validBatchSize = Number(batchSize) || 10;
    this.logger.log(`Configurando prefetch para ${validBatchSize} mensagens`);
    
    // Configura prefetch para controlar quantas mensagens não confirmadas
    await this.channel.prefetch(validBatchSize);

    const rawMessages: any[] = [];

    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;

      const content = JSON.parse(msg.content.toString());
      rawMessages.push(msg);

      // Quando atingir o tamanho do lote, processa
      if (rawMessages.length >= validBatchSize) {
        
        const batch = await Promise.all(rawMessages.map(async rawMsg => {
            const headers = rawMsg.properties.headers || {};
            const retryCount = headers['x-retry-count'] || 0;
            try {
                const message=rawMsg.content.toString()
                const parse_message=JSON.parse(message)
                if ('id' in parse_message) {
                    this.logger.log(`Processando mensagem com ID: ${parse_message.id}`);
                    throw new Error(`Erro simulado para mensagem com ID: ${parse_message.id}`);
                }
                console.log(message, 'sou')
                await callback(parse_message);

                this.channel.ack(rawMsg);
                console.log(' entrei')
                this.logger.log(`Mensagem ${message} processada com sucesso`);
            } catch (error) {
                this.logger.error(`Erro ao processar mensagem: ${error.message}`);

                if (retryCount >= this.MAX_RETRIES) {
                    this.logger.warn(`Excedido limite de retries. Enviando para DLQ`);
                    // Envia manualmente para DLQ
                    this.channel.sendToQueue('dlq', rawMsg.content, {
                        persistent: true,
                        headers,
                    });
                } else {
                    const updatedHeaders = {
                        ...headers,
                        'x-retry-count': retryCount + 1,
                    };

                    this.logger.warn(`Retry #${updatedHeaders['x-retry-count']} - mensagem encaminhada para retry_queue`);
                    this.channel.sendToQueue('retry_queue', rawMsg.content, {
                        persistent: true,
                        headers: updatedHeaders,
                    });
                }

               this.channel.ack(rawMsg); // Importante: sempre ACK após decisão
        }
        }));

        this.logger.log(`Lote de ${batch.length} mensagens processado com sucesso`);
          
        // Limpa os arrays para o próximo lote
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