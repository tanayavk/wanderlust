const Joi=require("joi");
const { CATEGORIES, VIBES, AMENITIES, TAGS } = require("./utils/constants");

module.exports.listingSchema=Joi.object({
    listing : Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        location: Joi.string().required(),
        country: Joi.string().required(),
        price: Joi.number().required().min(0),
        image: Joi.string().allow("", null),
        category: Joi.string().valid(...CATEGORIES).required(),
        vibe: Joi.string().valid(...VIBES),
        tags: Joi.array().items(Joi.string().valid(...TAGS)),
        amenities: Joi.array().items(Joi.string().valid(...AMENITIES)),
        maxGuests: Joi.number().min(1).required(),
    }).required()
});

module.exports.reviewSchema=Joi.object({
    review: Joi.object({
        rating: Joi.number().required().min(1).max(5),
        comment: Joi.string().required(),
    }).required()
});