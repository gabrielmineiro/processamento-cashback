import { Module } from '@nestjs/common';
import { OrdersRepository } from '../../repositories/contracts/orders_repository';
import { PostgresService } from '../../repositories/postgresql/orders_repository';
import { OrdersService } from './orders.service';

@Module({
  imports: [],
  providers: [
    {
      provide: OrdersRepository,
      useClass: PostgresService,
    },
    OrdersService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
