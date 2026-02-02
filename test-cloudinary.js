require('dotenv').config();
const cloudinary = require('cloudinary').v2;

const config = cloudinary.config();
console.log('Cloud Name:', config.cloud_name);
console.log('API Key:', config.api_key);
console.log('Has Secret:', !!config.api_secret);
