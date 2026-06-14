import mongoose from "mongoose";

export interface ICoupon extends mongoose.Document {
  code: string;
  duration: string;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
  createdAt: Date;
}

const CouponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  duration: {
    type: String,
    required: true,
    enum: ["1M", "3M", "1Y", "UNLIMITED"],
  },
  maxUses: {
    type: Number,
    required: true,
    default: 0,
  },
  currentUses: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Coupon = mongoose.models.Coupon || mongoose.model<ICoupon>("Coupon", CouponSchema);
