import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { OrdersRepository } from '../contracts/orders_repository';
import { Client } from 'pg';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class PostgresService
  implements OnModuleInit, OnModuleDestroy, OrdersRepository
{
  private client: Client;
  private db_user: string;
  private db_password: string;
  private db_host: string;
  private db_database: string;
  private db_port: string;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.client = new Client({
      user: this.configService.get('DB_USER'),
      host: this.configService.get('DB_HOST'),
      database: this.configService.get('DB_DATABASE'),
      password: this.configService.get('DB_PASSWORD'),
      port: this.configService.get('DB_PORT'),
    });

    await this.client.connect();
  }

  async query(sql: string, params?: any[]) {
    try {
      const result = await this.client.query(sql, params);
      return result;
    } catch (e) {
      throw e;
    }
  }

  async onModuleDestroy() {
    await this.client.end();
  }
}
