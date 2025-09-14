const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const nodemailer = require('nodemailer');
const multer = require('multer');
require('dotenv').config();

const app = express();
const port = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Multer Setup for Multiple File Uploads with All Fields
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'passportPhotos' && !['image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype)) {
            return cb(new Error('Passport photo must be JPG, JPEG, or PNG'));
        }
        cb(null, true);
    }
}).any(); // Use .any() to accept all fields, including files

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Nodemailer Setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Models
const User = require('./models/User');
const Member = require('./models/Member');
const News = require('./models/News');
const Contact = require('./models/Contact');

// JWT Verification Middleware
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Please login' });
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Invalid session' });
        req.userId = decoded.id;
        req.userRole = decoded.role;
        next();
    });
};

// Admin Role Check Middleware
const isAdmin = (req, res, next) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// Routes: Authentication
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'Email already used' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ email, password: hashedPassword, role: 'user' });
        await user.save();
        res.status(201).json({ message: 'Registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

app.get('/api/user', verifyToken, async (req, res) => {
    const user = await User.findById(req.userId).select('email role');
    res.json(user);
});

app.get('/api/members', verifyToken, isAdmin, async (req, res) => {
    const searchQuery = req.query.search ? req.query.search.toLowerCase() : '';
    let members = await Member.find();
    if (searchQuery) {
        members = members.filter(member => 
            (member.surname + ' ' + member.otherNames).toLowerCase().includes(searchQuery) ||
            member.location.toLowerCase().includes(searchQuery) ||
            member.phone.includes(searchQuery) ||
            member.contact.toLowerCase().includes(searchQuery)
        );
    }
    res.json(members);
});

app.post('/api/members', verifyToken, isAdmin, (req, res) => {
    upload(req, res, async (err) => {
        if (err) return res.status(400).json({ message: err.message });
        const { surname, otherNames, dateOfBirth, gender, occupation, qualification, localGovernmentOfOrigin, residentialAddress, phone, nextOfKin, enrollmentStatus, dateEnrollment, shortFarmHistory, refereeLgaCoordinator, refereeGroupCoordinator, cropVariety, farmingExperience, irrigationMethod, membershipStatus, location, farmSize, contact } = req.body;
        if (!surname || !otherNames || !dateOfBirth || !gender || !occupation || !qualification || !localGovernmentOfOrigin || !residentialAddress || !phone || !nextOfKin || !enrollmentStatus || !dateEnrollment || !shortFarmHistory || !cropVariety || !farmingExperience || !irrigationMethod || !location || !farmSize || !contact) {
            return res.status(400).json({ message: 'All required fields must be filled' });
        }
        const memberData = {
            surname,
            otherNames,
            dateOfBirth: new Date(dateOfBirth),
            gender,
            occupation,
            qualification,
            localGovernmentOfOrigin,
            residentialAddress,
            phone,
            nextOfKin,
            enrollmentStatus,
            dateEnrollment: new Date(dateEnrollment),
            shortFarmHistory,
            refereeLgaCoordinator,
            refereeGroupCoordinator,
            cropVariety,
            farmingExperience: parseInt(farmingExperience),
            irrigationMethod,
            membershipStatus,
            location,
            farmSize,
            contact
        };
        if (req.files && req.files.length > 0) {
            memberData.passportPhotos = req.files.map(file => `/uploads/${file.filename}`);
        }
        const member = new Member(memberData);
        try {
            await member.save();
            res.status(201).json(member);
        } catch (error) {
            console.error('Member save error:', error);
            res.status(500).json({ message: 'Error saving member' });
        }
    });
});

app.get('/api/members/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const member = await Member.findById(req.params.id);
        if (!member) return res.status(404).json({ message: 'Member not found' });
        res.json(member);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/news', async (req, res) => {
    const news = await News.find().sort({ createdAt: -1 });
    res.json(news);
});

app.post('/api/news', verifyToken, isAdmin, (req, res, next) => {
    upload(req, res, (err) => {
        if (err) return res.status(400).json({ message: err.message });
        next();
    });
}, async (req, res) => {
    console.log('Request body:', req.body); // Debug log
    console.log('Request files:', req.files); // Debug log
    const { title, description } = req.body;
    if (!title || !description) return res.status(400).json({ message: 'Title and description required' });
    const newsData = { title, description };
    if (req.files) {
        req.files.forEach(file => {
            if (file.fieldname === 'image') {
                newsData.imageUrl = `/uploads/${file.filename}`;
            } else if (file.fieldname === 'video') {
                newsData.videoUrl = `/uploads/${file.filename}`;
            }
        });
    }
    const news = new News(newsData);
    await news.save();
    res.status(201).json({ message: 'News added successfully' });
});

app.put('/api/news/:id', verifyToken, isAdmin, (req, res, next) => {
    upload(req, res, (err) => {
        if (err) return res.status(400).json({ message: err.message });
        next();
    });
}, async (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body;
    if (!title || !description) return res.status(400).json({ message: 'Title and description required' });
    const newsData = { title, description };
    if (req.files) {
        req.files.forEach(file => {
            if (file.fieldname === 'image') {
                newsData.imageUrl = `/uploads/${file.filename}`;
            } else if (file.fieldname === 'video') {
                newsData.videoUrl = `/uploads/${file.filename}`;
            }
        });
    }
    const news = await News.findByIdAndUpdate(id, newsData, { new: true });
    if (!news) return res.status(404).json({ message: 'News not found' });
    res.json({ message: 'News updated successfully' });
});

app.delete('/api/news/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const news = await News.findById(id);
        if (!news) return res.status(404).json({ message: 'News not found' });
        if (news.imageUrl) {
            const fs = require('fs');
            const path = `public${news.imageUrl}`;
            if (fs.existsSync(path)) fs.unlinkSync(path);
        }
        if (news.videoUrl) {
            const fs = require('fs');
            const path = `public${news.videoUrl}`;
            if (fs.existsSync(path)) fs.unlinkSync(path);
        }
        await News.findByIdAndDelete(id);
        res.json({ message: 'News deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ message: 'Error deleting news' });
    }
});

app.post('/api/contact', async (req, res) => {
    const { name, email, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ message: 'All fields required' });
    const contact = new Contact({ name, email, message });
    await contact.save();

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.ADMIN_EMAIL,
        subject: 'New Contact Form Submission',
        text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`
    };
    try {
        await transporter.sendMail(mailOptions);
        res.status(201).json({ message: 'Message sent successfully' });
    } catch (error) {
        console.error('Email error:', error);
        res.status(201).json({ message: 'Message saved, but email notification failed' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});