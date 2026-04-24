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
    const allListings=await Listing.find({});
    res.render("listings/index.ejs", {allListings}); 
};

module.exports.renderNewForm=(req,res)=>{
    res.render("./listings/new.ejs");
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

    const listingData = req.body.listing;
    
    listingData.amenities = ensureArray(listingData.amenities);
    listingData.tags = ensureArray(listingData.tags);
    const newListing=new Listing(listingData);
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

    const oldLocation = listing.location;
    const updateData = req.body.listing;

    // NEW: Normalize checkbox arrays for Update too
    updateData.amenities = ensureArray(updateData.amenities);
    updateData.tags = ensureArray(updateData.tags);
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