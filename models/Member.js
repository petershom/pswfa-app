const mongoose = require('mongoose');
const memberSchema = new mongoose.Schema({
    surname: { type: String, required: true },
    otherNames: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, required: true, enum: ['Not specified', 'Male', 'Female'] },
    occupation: { type: String, required: true },
    qualification: { type: String, required: true },
    localGovernmentOfOrigin: { type: String, required: true },
    residentialAddress: { type: String, required: true },
    phone: { type: String, required: true },
    nextOfKin: { type: String, required: true },
    enrollmentStatus: { type: String, required: true, enum: ['Direct Farmer', 'Group Farmer'] },
    dateEnrollment: { type: Date, required: true },
    shortFarmHistory: { type: String, required: true },
    refereeLgaCoordinator: { type: String },
    refereeGroupCoordinator: { type: String },
    passportPhotos: [{ type: String }], // Array for multiple photo paths
    cropVariety: { type: String, required: true },
    farmingExperience: { type: Number, required: true },
    irrigationMethod: { type: String, required: true, enum: ['Rainfed', 'Drip', 'Flood'] },
    membershipStatus: { type: String, required: true, enum: ['Active', 'Inactive', 'Pending'], default: 'Pending' },
    location: { type: String, required: true },
    farmSize: { type: String, required: true },
    contact: { type: String, required: true }
});
module.exports = mongoose.model('Member', memberSchema);