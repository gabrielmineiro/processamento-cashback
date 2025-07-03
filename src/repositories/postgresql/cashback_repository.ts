// postgres.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {CashbackRepository} from '../contracts/cashback_repository'
import { Client } from 'pg';

@Injectable()
export class PostgresService implements OnModuleInit,OnModuleDestroy, CashbackRepository {
  private client: Client;

  async onModuleInit() {
    this.client = new Client({
      user: 'seu_usuario',
      host: 'localhost',
      database: 'seu_banco',
      password: 'sua_senha',
      port: 5432,
    });

    await this.client.connect();
  }

  async query(sql: string, params?: any[]) {
    return this.client.query(sql, params);
  }

  async onModuleDestroy() {
    await this.client.end();
  }
}
