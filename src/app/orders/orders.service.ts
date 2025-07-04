import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersRepository } from '../../repositories/contracts/orders_repository';
import { OrderType } from './types';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly configService: ConfigService,
  ) {}

  public async sendCashback() {
    try {
      const query = await this.ordersRepository.query('SELECT * FROM orders');
      return query;
    } catch (error) {}
  }
  public async createOrder(objOrder: OrderType) {
    try {
      const query = `
        INSERT INTO orders (percentage_cashback, email, value, status)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;

      const result = await this.ordersRepository.query(query, [
        objOrder.percentage_cashback,
        objOrder.email,
        objOrder.value,
        'CASHBACK_PENDENTE',
      ]);

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  public async changeStatus(orderId: number, status: string) {
    try {
      const query = `
      UPDATE orders
      SET status = $1
      WHERE id=$2;
      `;

      const result = await this.ordersRepository.query(query, [
        status,
        orderId,
      ]);

      return result.rows;
    } catch (error) {
      throw error;
    }
  }
}
