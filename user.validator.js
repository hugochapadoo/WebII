import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    street: {
      type: String,
      trim: true,
    },
    number: {
      type: String,
      trim: true,
    },
    postal: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    province: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const companySchema = new mongoose.Schema(
  {
    cif: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    address: {
      type: addressSchema,
      default: {},
    },
    isFreelance: {
      type: Boolean,
      default: false,
    },
    logo: {
      type: String,
      trim: true,
      default: null,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

companySchema.index({ cif: 1 });
companySchema.index({ owner: 1 });
companySchema.index({ name: 1 });

export const Company = mongoose.model("Company", companySchema);