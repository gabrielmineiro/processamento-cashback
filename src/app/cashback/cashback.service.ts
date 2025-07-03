import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CreditSecSerieService {
  constructor(
    private readonly configService: ConfigService,
  ) {
  }

  private async sendCashback({
    emai,
    numeroSerie,
  }: {
    numeroDebenture: number;
    numeroSerie: number;
  }) {
    try {
    } catch (error) {
      
    }
  }

  
}
