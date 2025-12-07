// src/system/system.rate.service.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SystemRateService {
  private SPREAD: Record<string, number> = {
    BTCUSDT: 2.5,
    ETHUSDT: 0.5,
    XRPUSDT: 0.02,
    SOLUSDT: 0.2,
    DOTUSDT: 0.2,
    ADAUSDT: 0.01,
    LTCUSDT: 0.3,
    BNBUSDT: 0.5,
  };

  /** Binanceのリアル価格へスプレッドを加減して決済価格を作る */
  async getFinalClosePrice(symbol: string, side: string): Promise<number> {
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;

    const res: any = await axios.get(url);
    const market = Number(res.data.price);

    const spread = this.SPREAD[symbol] ?? 0;

    // BUY決済は Ask（価格＋スプレッド）、SELL決済は Bid（価格−スプレッド）
    return side === 'BUY' ? market + spread : market - spread;
  }
}


