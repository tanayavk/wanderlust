const Listing=require("../models/listing");
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken=process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

// A quick helper to ensure form data is always an array
const ensureArray = (field) => {
    if (!field) return [];
    return Array.isArray(field) ? field : [field];
};

module.exports.index = async (req,res)=>{
    let { category, price, location, vibe, guests, tag, amenity } = req.query;
    let filter = {};

    // 1. Filter by Category (Matching your icons)
    if (category) {
        filter.category = category;
    }
    // 2. Filter by Price (Under a certain amount)
    if (price) {
        filter.price = { $lte: Number(price) };
    }
    // 3. Search by City or Country
    if (location) {
        filter.$or = [
            { city: { $regex: location, $options: "i" } },
            { country: { $regex: location, $options: "i" } }
        ];
    }
    // 4. Filter by Vibe
    if (vibe) {
        filter.vibe = vibe;
    }
    // 5. Filter by Guest Capacity
    if (guests) {
        filter.maxGuests = { $gte: Number(guests) };
    }
    // 6. Filter by Amenity (Array search)
    if (amenity) {
        filter.amenities = { $in: [amenity] };
    }
    // 7. Filter by Tag (Array search)
    if (tag) {
        filter.tags = { $in: [tag] };
    }

    if (req.query.tag) {
        filter.tags = { $in: [req.query.tag] };
    }

    const allListings=await Listing.find(filter);
    res.render("listings/index.ejs", {allListings}); 
};

module.exports.renderNewForm=(req,res)=>{
    res.render("./listings/new.ejs");
};


module.exports.filter = async (req, res) => {
    try {
        let { category, price, location, guests, vibe, amenity, tag } = req.query;
        
        // 1. Start with an empty query object
        let query = {};

        // 2. Handle Simple Strings
        if (category) query.category = category;
        if (vibe) query.vibe = vibe;

        // 3. Handle Numbers
        if (price) query.price = { $lte: Number(price) };
        if (guests) query.maxGuests = { $gte: Number(guests) };

        // 4. Handle Location
        if (location) {
            query.$or = [
                { city: { $regex: location, $options: "i" } },
                { country: { $regex: location, $options: "i" } }
            ];
        }

        // 5. THE CRITICAL FIX FOR ARRAYS
        // Instead of letting Mongoose guess, we use the raw MongoDB operator
        if (amenity) {
            const values = Array.isArray(amenity) ? amenity : [amenity];
            // We use the plural field name from your schema
            query["amenities"] = { $in: values }; 
        }

        if (tag) {
            const values = Array.isArray(tag) ? tag : [tag];
            query["tags"] = { $in: values };
        }

        // 6. Execute with .lean() to bypass strict Mongoose validation if necessary
        const allListings = await Listing.find(query);
        
        console.log("Query sent to DB:", query); // Debugging line
        res.render("listings/index.ejs", { allListings });

    } catch (err) {
        console.error("STILL NOT SOLVED? Error:", err.message);
        res.status(500).send("Internal Server Error");
    }
};

module.exports.showListing=async (req,res)=>{
    let {id}=req.params;
    const listing=await Listing.findById(id)
        .populate({
            path: "reviews",
            populate: {
                path: "author",
            },
        })
        .populate("owner");
    if(!listing){
        req.flash("error", "The listing that you requested for does not exist");
        return res.redirect("/listings");
    }
    console.log(listing);
    res.render("listings/show.ejs", {listing})
}

module.exports.createListing = async (req, res, next) => {
    let response = await geocodingClient
        .forwardGeocode({
            query: req.body.listing.location,
            limit: 2 //will return one coordinate
        })
        .send()
    // console.log(url, "  ", filename);

    let { listing } = req.query; // or req.body depending on your setup
    
    if (req.body.listing.amenities && !Array.isArray(req.body.listing.amenities)) {
        req.body.listing.amenities = [req.body.listing.amenities];
    }
    
    if (req.body.listing.tags && !Array.isArray(req.body.listing.tags)) {
        req.body.listing.tags = [req.body.listing.tags];
    }

    const listingData = req.body.listing;
    const newListing=new Listing(listingData);

    newListing.city = listingData.city;
    newListing.state = listingData.state;
    newListing.country = listingData.country;
    
    listingData.amenities = ensureArray(listingData.amenities);
    listingData.tags = ensureArray(listingData.tags);
    // console.log(req.user);
    let url=req.file.secure_url;
    let filename=req.file.public_id;

    newListing.owner=req.user._id;
    newListing.image = {url, filename};
    newListing.geometry = response.body.features[0].geometry;
    
    let savedListing = await newListing.save();
    console.log(savedListing);

    req.flash("success", "New Listing Created!");
    res.redirect("/listings");
};

module.exports.renderEditForm = async(req, res)=>{
    let {id}=req.params;

    const listing = await Listing.findById(id);
    if(!listing){
        req.flash("error", "The listing that you requested for does not exist");
        return res.redirect("/listings");
    }

    let originalImageUrl=listing.image?.url;
    if(originalImageUrl) {
        originalImageUrl=originalImageUrl.replace("/upload", "/upload/h_300,w_250");
    }
    res.render("listings/edit.ejs", {listing, originalImageUrl});
};

module.exports.updateListing = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    // 1. fetch existing listing
    if (!listing) {
        req.flash("error", "Listing not found");
        return res.redirect("/listings");
    }
    
    const updateData = req.body.listing; 

    // 2. Normalize the arrays (so single amenities don't crash)
    if (updateData.amenities && !Array.isArray(updateData.amenities)) {
        updateData.amenities = [updateData.amenities];
    }
    if (updateData.tags && !Array.isArray(updateData.tags)) {
        updateData.tags = [updateData.tags];
    }

    listing.city = updateData.city;
    listing.state = updateData.state;
    listing.country = updateData.country;
    
    const oldLocation = listing.location;

    // 2. update basic fields FIRST
    listing.set(updateData);

    // 3. update image if uploaded
    if (req.file) {
        listing.image = {
            url: req.file.secure_url,
            filename: req.file.public_id
        };
    }

    // 4. 🔥 re-geocode if location changed
    if (
        updateData.location &&
        updateData.location !== oldLocation
    ) {
        console.log("GEOCODING:", updateData.location);

        const geoResponse = await geocodingClient
            .forwardGeocode({
                query: updateData.location,
                limit: 1
            })
            .send();

        if (!geoResponse.body.features.length) {
            req.flash("error", "Invalid location entered");
            return res.redirect(`/listings/${id}/edit`);
        }

        listing.geometry = geoResponse.body.features[0].geometry;

        console.log("NEW COORDS:", listing.geometry.coordinates);
    }

    // 5. save ONCE
    await listing.save();

    req.flash("success", "Listing Updated");
    res.redirect(`/listings/${listing._id}`);
};


module.exports.destroyListing=async (req,res)=>{
    let {id} = req.params;
    let deletedListing=await Listing.findByIdAndDelete(id);
    console.log(deletedListing);
    req.flash("success", "Listing Deleted");
    res.redirect("/listings");
};