const Listing=require("./models/listing.js");
const Review=require("./models/review.js");
const ExpressError=require("./utils/ExpressError.js");
const {listingSchema, reviewSchema}=require("./schema.js");

module.exports.isLoggedIn=((req, res, next )=>{
    if(!req.isAuthenticated()){
        //store the redirect url if user was not logged in
        req.session.redirectUrl=req.originalUrl;
        req.flash("error", "You need to log in first!");
        return res.redirect("/login");
    }
    next();
});

module.exports.saveRedirectUrl=(req, res, next)=>{
    if(req.session.redirectUrl) {
        res.locals.redirectUrl=req.session.redirectUrl;
    }
    next();
};

module.exports.isOwner=async (req, res, next)=>{
    let {id} = req.params;
    const listing=await Listing.findById(id);    
    if(!listing.owner.equals(res.locals.currUser._id)) {
        req.flash("error","You are not the owner of this listing!");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

module.exports.validateListing=(req,res,next)=>{
    if (req.body.listing) {
        if (req.body.listing.amenities && !Array.isArray(req.body.listing.amenities)) {
            req.body.listing.amenities = [req.body.listing.amenities];
        }
        if (req.body.listing.tags && !Array.isArray(req.body.listing.tags)) {
            req.body.listing.tags = [req.body.listing.tags];
        }
    }
    let {error}=listingSchema.validate(req.body);
    if(error) {
        let errMsg=error.details.map((el)=>el.message).join(",");
        return next(new ExpressError(400, errMsg));    
    } 
    next();
};

module.exports.validateReview=(req,res,next)=>{
    let {error}=reviewSchema.validate(req.body);
    if(error) {
        let errMsg=error.details.map((el)=>el.message).join(",");
        return next(new ExpressError(400, errMsg));   
    } 
    next();
};

module.exports.isReviewAuthor=async (req, res, next)=>{
    let {id, reviewId} = req.params;
    const review=await Review.findById(reviewId);    
    if(!review.author.equals(res.locals.currUser._id)) {
        req.flash("error","You are not the author of this review!");
        return res.redirect(`/listings/${id}`);
    }
    next();
};