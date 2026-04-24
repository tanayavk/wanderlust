const mongoose = require("mongoose");
const Listing = require("../models/listing.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust"; 

async function main() {
    await mongoose.connect(MONGO_URL);
    console.log("Connected to DB");
    await patchData();
    mongoose.connection.close();
}

async function patchData() {
    const result = await Listing.updateMany(
        { category: { $exists: false } }, 
        { 
            $set: { 
                category: "Apartment", 
                vibe: "Peaceful", 
                maxGuests: 2, 
                amenities: ["Wifi"],
                tags: ["Trending"]
            } 
        }
    );
    console.log(`Database patched successfully! Modified ${result.modifiedCount} documents.`);
}

main().catch(err => console.log(err));