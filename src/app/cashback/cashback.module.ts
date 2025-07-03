import { Module } from '@nestjs/common';
import {CashbackRepository} from '../../repositories/contracts/cashback_repository'
import {PostgresService} from '../../repositories/postgresql/cashback_repository'


@Module({
  imports: [ ],
  providers: [
    {
      provide: CashbackRepository,
      useClass: PostgresService,
    }
  ],
  exports: [CreditSecSerieService, CreditSecRemessaService],
})
export class CashbackModule {}
