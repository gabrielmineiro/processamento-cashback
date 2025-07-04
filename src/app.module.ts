import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitMQModule } from './app/rabbitmq/rabbitmq.module';
import { OrdersModule } from './app/orders/orders.module';
import { OrdersController } from './app/orders/orders.controller';
import { BatchWorker } from './app/worker/batch.worker';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RabbitMQModule,
    OrdersModule,
  ],
  controllers: [OrdersController],
  providers: [BatchWorker],
})
export class AppModule {}
