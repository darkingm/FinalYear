import mongoose, { Document, Schema } from 'mongoose';

export interface IPriceHistory extends Document {
  coinId: string;
  timestamp: Date;
  price: number;
  volume: number;
  marketCap: number;
}

const PriceHistorySchema = new Schema<IPriceHistory>(
  {
    coinId: { type: String, required: true },
    timestamp: { type: Date, required: true },
    price: { type: Number, required: true },
    volume: { type: Number, required: true },
    marketCap: { type: Number, required: true },
  },
  {
    timestamps: false,
  }
);

PriceHistorySchema.index({ coinId: 1, timestamp: -1 });

export default mongoose.model<IPriceHistory>('PriceHistory', PriceHistorySchema);

