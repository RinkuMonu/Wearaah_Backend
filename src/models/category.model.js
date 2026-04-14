import mongoose from "mongoose";
import slugify from "slugify";

const categorySchema = new mongoose.Schema(
  {
    createBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    name: {
      type: String,
      unique: true,
      index: true,
      required: true,
      trim: true,
      enum: [
        "Western Wear",
        "Ethnic Wear",
        "Innerwear",
        "Sportswear",
        "Sleepwear",
        "Swimwear",
        "Accessories",
        "Winter wear",
        "Summer wear",
      ]
    },
    description: {
      type: String,
    },
    slug: {
      type: String,
      unique: true
    },
    displayOrder: {
      type: Number,
      default: 0
    },
    showOnHome: {
      type: Boolean,
      default: false
    },
    smallimage: {
      type: String,
      // required: true,
    },
    bannerimage: {
      type: String,
      // required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

categorySchema.pre("validate", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true
    });
  }
  next();
});


const Category = mongoose.model("Category", categorySchema);
export default Category;
