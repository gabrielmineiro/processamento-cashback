import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
    private readonly transporter;
    
    constructor(
     private configService: ConfigService,
    ) {
        const originEmail = this.configService.get<string>('ORIGIN_EMAIL');
        const originPassword = this.configService.get<string>('ORIGIN_PASSWORD');

        this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: originEmail,
            pass: originPassword,
        },
        });

    }

  async sendMail(to: string, subject: string, html: string) {
    const mailOptions = {
      from: '"Seu App" <seuemail@gmail.com>',
      to,
      subject,
      html,
    };

    return this.transporter.sendMail(mailOptions);
  }
}
