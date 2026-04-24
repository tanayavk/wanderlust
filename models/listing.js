const mongoose=require("mongoose");
const Schema=mongoose.Schema;
const Review=require("./review.js");
const { CATEGORIES, VIBES, AMENITIES, TAGS } = require('../utils/constants');

const listingSchema=new Schema({
    title: {
        type: String,
        required: true,
    },
    description: String,
    image: {
        url: String,
        filename: String,
    },
    price: { type: Number, required: true, min: 0 },
    location: { type: String, required: true },
    country: String,
    reviews: [
        {
            type: Schema.Types.ObjectId,
            ref: "Review"
        }
    ],
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    geometry: {
        type: {
            type: String, // Don't do `{ location: { type: String } }`
            enum: ['Point'], // 'location.type' must be 'Point'
            required: true
        },
        coordinates: {
            type: [Number],
            required: true,
        }
    },
    category: {
        type: String,
        enum: CATEGORIES,
        required: true
    },
    vibe: { 
        type: String, 
        enum: VIBES,  
    },
    tags: [{ 
        type: String, 
        enum: TAGS 
    }],
    amenities: [{ 
        type: String, 
        enum: AMENITIES 
    }],
    maxGuests: { 
        type: Number, 
        required: true, 
        min: 1 
    },
    rating: { 
        type: Number, 
        default: 4.5, 
        min: 0, 
        max: 5 
    }
}, { timestamps: true })

listingSchema.post("findOneAndDelete", async(listing)=>{
    if(listing){
        await Review.deleteMany({_id: {$in: listing.reviews}});
    }
});

const Listing=mongoose.model("Listing", listingSchema);
module.exports=Listing;