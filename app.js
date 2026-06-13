const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const db = require('./db');
const dbReady = db.ready;

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'doctorhub-secret-key';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  let user = null;
  const token = req.cookies.token;
  if (token) {
    try {
      user = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    } catch (err) {
      user = null;
    }
  }
  res.locals.user = user;
  req.user = req.user || user;
  next();
});

function generateToken(user) {
  return jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '6h' });
}

function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/login');
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.redirect('/login');
  }
}

function validatePassword(password) {
  const rule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]).{8,}$/;
  return rule.test(password);
}

app.get('/', (req, res) => {
  let user = null;
  try {
    const token = req.cookies.token;
    if (token) {
      user = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    }
  } catch (err) {
    user = null;
  }
  res.render('index', { user, active: 'home' });
});

app.get('/register', (req, res) => res.render('register', { error: null, active: 'register' }));
app.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.render('register', { error: 'All fields are required.', active: 'register' });
    }
    if (!validatePassword(password)) {
      return res.render('register', { error: 'Password must include uppercase, lowercase, number, special character and at least 8 characters.', active: 'register' });
    }
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.render('register', { error: 'Email is already registered.', active: 'register' });
    }
    const hashed = bcrypt.hashSync(password, 10);
    const user = await db.addUser(name, email, hashed, role);
    if (role === 'patient') {
      await db.addPatient(user.id, '');
    }
    if (role === 'assistant') {
      await db.addAssistant(user.id);
    }
    const token = generateToken(user);
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Registration failed. Please try again.', active: 'register' });
  }
});

app.get('/login', (req, res) => res.render('login', { error: null, active: 'login' }));
app.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const user = await db.getUserByEmail(email);
    if (!user || user.role !== role) {
      return res.render('login', { error: 'Invalid credentials or selected role.', active: 'login' });
    }
    const matched = bcrypt.compareSync(password, user.password);
    if (!matched) {
      return res.render('login', { error: 'Invalid credentials or selected role.', active: 'login' });
    }
    const token = generateToken(user);
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Login failed. Please try again.', active: 'login' });
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

app.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const doctorCount = await db.getDoctorCount();
    const appointmentCount = await db.getAppointmentCount();
    res.render('dashboard', { user, doctorCount, appointmentCount, active: 'dashboard' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error loading dashboard');
  }
});

app.get('/doctors', authMiddleware, async (req, res) => {
  try {
    const { specialty, treatment_type, query } = req.query;
    const doctors = await db.getDoctors({ specialty, treatment_type, query });
    res.render('doctors', { user: req.user, doctors, filters: { specialty, treatment_type, query }, active: 'doctors' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error loading doctors');
  }
});

app.get('/doctor/:id', authMiddleware, async (req, res) => {
  try {
    const doctor = await db.getDoctorById(req.params.id);
    if (!doctor) {
      return res.status(404).render('404', { url: req.originalUrl });
    }
    res.render('doctor_detail', { user: req.user, doctor, active: 'doctors' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error loading doctor details');
  }
});

app.get('/appointments', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    let appointments = [];
    if (user.role === 'patient') {
      appointments = await db.getAppointmentsForPatientUserId(user.id);
    } else if (user.role === 'doctor') {
      appointments = await db.getAppointmentsForDoctorUserId(user.id);
    } else {
      appointments = await db.getAllAppointments();
    }
    res.render('appointments', { user, appointments, active: 'appointments' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error loading appointments');
  }
});

app.post('/appointments/book', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).send('Only patients can book appointments');
    }
    const { doctor_id, date, time, payment_screenshot } = req.body;
    const patient = await db.getPatientByUserId(req.user.id);
    if (!patient) {
      return res.status(400).send('Patient account not found');
    }
    const doctor = await db.getDoctorById(doctor_id);
    if (!doctor) {
      return res.status(400).send('Doctor not found');
    }
    await db.addAppointment(patient.id, doctor.id, doctor.clinic_id, date, time, payment_screenshot);
    res.redirect('/appointments');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error booking appointment');
  }
});

app.post('/payments/verify', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'assistant') {
      return res.status(403).send('Only assistants can verify payments');
    }
    const { appointment_id } = req.body;
    const assistant = await db.getAssistantByUserId(req.user.id);
    if (!assistant) {
      return res.status(400).send('Assistant account not found');
    }
    await db.verifyPayment(assistant.id, appointment_id);
    res.redirect('/appointments');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error verifying payment');
  }
});

app.get('/history', authMiddleware, async (req, res) => {
  try {
    let history = [];
    if (req.user.role === 'patient') {
      history = await db.getHistoryForPatientUserId(req.user.id);
    } else if (req.user.role === 'doctor') {
      history = await db.getHistoryForDoctorUserId(req.user.id);
    } else {
      history = await db.getAllHistory();
    }
    res.render('history', { user: req.user, history, active: 'history' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error loading medical history');
  }
});

app.get('/api/doctors', async (req, res) => {
  try {
    const doctors = await db.getDoctors({});
    res.json(doctors.map(doctor => ({
      id: doctor.id,
      doctor_name: doctor.doctor_name,
      specialty: doctor.specialty,
      treatment_type: doctor.treatment_type,
      details: doctor.details,
      availability: doctor.availability,
      clinic_name: doctor.clinic_name
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching doctors.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    if (!validatePassword(password)) {
      return res.status(400).json({ message: 'Password must include uppercase, lowercase, number, special character and at least 8 characters.' });
    }
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }
    const hashed = bcrypt.hashSync(password, 10);
    const user = await db.addUser(name, email, hashed, role);
    if (role === 'patient') {
      await db.addPatient(user.id, '');
    }
    if (role === 'assistant') {
      await db.addAssistant(user.id);
    }
    const token = generateToken(user);
    res.cookie('token', token, { httpOnly: true });
    res.json({ message: 'Registration successful', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error registering user.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const user = await db.getUserByEmail(email);
    if (!user || user.role !== role) {
      return res.status(401).json({ message: 'Invalid credentials or selected role.' });
    }
    const matched = bcrypt.compareSync(password, user.password);
    if (!matched) {
      return res.status(401).json({ message: 'Invalid credentials or selected role.' });
    }
    const token = generateToken(user);
    res.cookie('token', token, { httpOnly: true });
    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

app.post('/api/appointments', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ message: 'Only patients can book appointments.' });
    }
    const { doctor_id, date, time, payment_screenshot } = req.body;
    const patient = await db.getPatientByUserId(req.user.id);
    const doctor = await db.getDoctorById(doctor_id);
    if (!patient || !doctor) {
      return res.status(400).json({ message: 'Patient or doctor not found.' });
    }
    await db.addAppointment(patient.id, doctor.id, doctor.clinic_id, date, time, payment_screenshot);
    res.json({ message: 'Appointment booked successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error booking appointment.' });
  }
});

app.post('/api/payments', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'assistant') {
      return res.status(403).json({ message: 'Only assistants can verify payments.' });
    }
    const { appointment_id } = req.body;
    const assistant = await db.getAssistantByUserId(req.user.id);
    if (!assistant) {
      return res.status(400).json({ message: 'Assistant account not found.' });
    }
    await db.verifyPayment(assistant.id, appointment_id);
    res.json({ message: 'Payment verified successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error verifying payment.' });
  }
});

app.get('/api/history', authMiddleware, async (req, res) => {
  try {
    let history = [];
    if (req.user.role === 'patient') {
      history = await db.getHistoryForPatientUserId(req.user.id);
    } else if (req.user.role === 'doctor') {
      history = await db.getHistoryForDoctorUserId(req.user.id);
    } else {
      history = await db.getAllHistory();
    }
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error loading history.' });
  }
});

app.use((req, res) => {
  res.status(404).render('404', { url: req.originalUrl });
});

module.exports = app;

if (require.main === module) {
  dbReady
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Doctor Hub is running at http://localhost:${PORT}`);
      });
    })
    .catch(err => {
      console.error('Failed to initialize database', err);
      process.exit(1);
    });
}
