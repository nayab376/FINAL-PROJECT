const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, 'data');
const dbPath = process.env.SQLITE_DB_PATH ||
  (process.env.VERCEL ? path.join('/tmp', 'doctorhub.sqlite') : path.join(dataDir, 'doctorhub.sqlite'));

if (!process.env.VERCEL) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

const sqlite = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqlite.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqlite.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqlite.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

async function init() {
  await run('PRAGMA foreign_keys = ON');

  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date_of_birth TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await run(`CREATE TABLE IF NOT EXISTS assistants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await run(`CREATE TABLE IF NOT EXISTS clinics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    open_hours TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    specialty TEXT,
    treatment_type TEXT,
    details TEXT,
    availability TEXT,
    clinic_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE SET NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    doctor_id INTEGER NOT NULL,
    clinic_id INTEGER,
    date TEXT,
    time TEXT,
    status TEXT NOT NULL,
    payment_verified INTEGER NOT NULL DEFAULT 0,
    payment_screenshot TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY(doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE SET NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL,
    assistant_id INTEGER,
    amount REAL,
    status TEXT,
    verified_at TEXT,
    FOREIGN KEY(appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY(assistant_id) REFERENCES assistants(id) ON DELETE SET NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS medical_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    doctor_id INTEGER NOT NULL,
    description TEXT,
    recorded_at TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY(doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
  )`);

  const row = await get('SELECT COUNT(*) AS count FROM users');
  if (!row || row.count === 0) {
    await seedData();
  }
}

async function seedData() {
  const adminPassword = bcrypt.hashSync('Admin@1234', 10);
  const superAdminPassword = bcrypt.hashSync('SuperAdmin@1234', 10);
  const doctorPassword = bcrypt.hashSync('Doctor@1234', 10);
  const patientPassword = bcrypt.hashSync('Patient@1234', 10);
  const assistantPassword = bcrypt.hashSync('Assistant@1234', 10);

  await addUser('Admin', 'admin@doctorhub.com', adminPassword, 'admin');
  await addUser('Super Admin', 'superadmin@doctorhub.com', superAdminPassword, 'superadmin');
  const doctor1 = await addUser('Dr. Ayesha Khan', 'doctor@doctorhub.com', doctorPassword, 'doctor');
  const doctor2 = await addUser('Dr. Omar Siddiqui', 'omar@doctorhub.com', doctorPassword, 'doctor');
  const doctor3 = await addUser('Dr. Nadia Ahmed', 'nadia@doctorhub.com', doctorPassword, 'doctor');
  const doctor4 = await addUser('Dr. Faizan Malik', 'faizan@doctorhub.com', doctorPassword, 'doctor');
  const patientUser = await addUser('Patient Ali', 'patient@doctorhub.com', patientPassword, 'patient');
  const assistantUser = await addUser('Assistant Sara', 'assistant@doctorhub.com', assistantPassword, 'assistant');

  const clinicResult = await run(
    `INSERT INTO clinics (name, address, open_hours) VALUES (?, ?, ?)`,
    ['City Care Center', '123 Main Street, Downtown', 'Mon-Fri 09:00 - 18:00']
  );
  const clinicId = clinicResult.lastID;

  await run(
    `INSERT INTO doctors (user_id, specialty, treatment_type, details, availability, clinic_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [doctor1.id, 'General Physician', 'Allopathic', 'Experienced in family medicine, preventive care, and acute consultation.', 'Available today 10:00 - 16:00', clinicId]
  );
  await run(
    `INSERT INTO doctors (user_id, specialty, treatment_type, details, availability, clinic_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [doctor2.id, 'Cardiologist', 'Allopathic', 'Focused on heart care, hypertension management and lifestyle coaching.', 'Next availability Wed 13:00 - 18:00', clinicId]
  );
  await run(
    `INSERT INTO doctors (user_id, specialty, treatment_type, details, availability, clinic_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [doctor3.id, 'Dermatologist', 'Homeopathic', 'Specialist in skin health, acne treatment and dermatology wellness.', 'Available Mon/Fri 09:30 - 13:30', clinicId]
  );
  await run(
    `INSERT INTO doctors (user_id, specialty, treatment_type, details, availability, clinic_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [doctor4.id, 'Physiotherapist', 'Herbal', 'Expert in rehabilitation, pain relief and recovery planning.', 'Fully booked this week', clinicId]
  );

  const patientRecord = await addPatient(patientUser.id, '1990-08-15');
  await addAssistant(assistantUser.id);

  await run(
    `INSERT INTO medical_history (patient_id, doctor_id, description, recorded_at) VALUES (?, ?, ?, ?)`,
    [patientRecord.id, 1, 'Routine checkup with stable vitals and updates to care plan.', new Date().toISOString()]
  );
}

async function getUserByEmail(email) {
  return get(`SELECT * FROM users WHERE lower(email) = ?`, [normalize(email)]);
}

async function addUser(name, email, password, role) {
  const result = await run(
    `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
    [name, normalize(email), password, role]
  );
  return { id: result.lastID, name, email: normalize(email), password, role };
}

async function addPatient(userId, dateOfBirth) {
  const result = await run(
    `INSERT INTO patients (user_id, date_of_birth) VALUES (?, ?)`,
    [Number(userId), dateOfBirth || '']
  );
  return { id: result.lastID, user_id: Number(userId), date_of_birth: dateOfBirth || '' };
}

async function addAssistant(userId) {
  const result = await run(
    `INSERT INTO assistants (user_id) VALUES (?)`,
    [Number(userId)]
  );
  return { id: result.lastID, user_id: Number(userId) };
}

async function getDoctorCount() {
  const row = await get(`SELECT COUNT(*) AS count FROM doctors`);
  return row ? row.count : 0;
}

async function getAppointmentCount() {
  const row = await get(`SELECT COUNT(*) AS count FROM appointments`);
  return row ? row.count : 0;
}

async function getDoctorById(id) {
  const doctor = await get(
    `SELECT d.*, u.name AS doctor_name, c.name AS clinic_name, c.address AS clinic_address, c.open_hours
     FROM doctors d
     LEFT JOIN users u ON u.id = d.user_id
     LEFT JOIN clinics c ON c.id = d.clinic_id
     WHERE d.id = ?`,
    [Number(id)]
  );
  return doctor || null;
}

async function getDoctors(filters) {
  const search = normalize(filters.query || '');
  const specialty = normalize(filters.specialty || '');
  const treatmentType = normalize(filters.treatment_type || '');

  let query = `SELECT d.*, u.name AS doctor_name, c.name AS clinic_name, c.address AS clinic_address, c.open_hours
               FROM doctors d
               LEFT JOIN users u ON u.id = d.user_id
               LEFT JOIN clinics c ON c.id = d.clinic_id`;
  const clauses = [];
  const params = [];

  if (search) {
    clauses.push(`(lower(u.name) LIKE ? OR lower(d.specialty) LIKE ? OR lower(d.details) LIKE ? OR lower(d.availability) LIKE ?)`);
    const value = `%${search}%`;
    params.push(value, value, value, value);
  }
  if (specialty) {
    clauses.push(`lower(d.specialty) LIKE ?`);
    params.push(`%${specialty}%`);
  }
  if (treatmentType) {
    clauses.push(`lower(d.treatment_type) = ?`);
    params.push(treatmentType);
  }
  if (clauses.length) {
    query += ` WHERE ${clauses.join(' AND ')}`;
  }
  query += ` ORDER BY d.id DESC`;

  return all(query, params);
}

async function getPatientByUserId(userId) {
  return get(`SELECT * FROM patients WHERE user_id = ?`, [Number(userId)]);
}

async function getDoctorByUserId(userId) {
  return get(`SELECT * FROM doctors WHERE user_id = ?`, [Number(userId)]);
}

async function getAppointmentsForPatientUserId(userId) {
  const patient = await getPatientByUserId(userId);
  if (!patient) return [];
  return all(
    `SELECT a.*, u.name AS doctor_name, c.name AS clinic_name
     FROM appointments a
     LEFT JOIN doctors d ON d.id = a.doctor_id
     LEFT JOIN users u ON u.id = d.user_id
     LEFT JOIN clinics c ON c.id = a.clinic_id
     WHERE a.patient_id = ?
     ORDER BY a.date DESC`,
    [patient.id]
  );
}

async function getAppointmentsForDoctorUserId(userId) {
  const doctor = await getDoctorByUserId(userId);
  if (!doctor) return [];
  return all(
    `SELECT a.*, p.user_id AS patient_user_id, u.name AS patient_name, c.name AS clinic_name
     FROM appointments a
     LEFT JOIN patients p ON p.id = a.patient_id
     LEFT JOIN users u ON u.id = p.user_id
     LEFT JOIN clinics c ON c.id = a.clinic_id
     WHERE a.doctor_id = ?
     ORDER BY a.date DESC`,
    [doctor.id]
  );
}

async function getAllAppointments() {
  return all(
    `SELECT a.*, up.name AS patient_name, ud.name AS doctor_name, c.name AS clinic_name
     FROM appointments a
     LEFT JOIN patients p ON p.id = a.patient_id
     LEFT JOIN users up ON up.id = p.user_id
     LEFT JOIN doctors d ON d.id = a.doctor_id
     LEFT JOIN users ud ON ud.id = d.user_id
     LEFT JOIN clinics c ON c.id = a.clinic_id
     ORDER BY a.date DESC`
  );
}

async function addAppointment(patientId, doctorId, clinicId, date, time, payment_screenshot) {
  const appointmentResult = await run(
    `INSERT INTO appointments (patient_id, doctor_id, clinic_id, date, time, status, payment_verified, payment_screenshot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [Number(patientId), Number(doctorId), clinicId ? Number(clinicId) : null, date, time, 'pending', 0, payment_screenshot || '']
  );

  await run(
    `INSERT INTO payments (appointment_id, assistant_id, amount, status, verified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [appointmentResult.lastID, null, 50.0, 'awaiting_verification', null]
  );

  return { id: appointmentResult.lastID };
}

async function getAssistantByUserId(userId) {
  return get(`SELECT * FROM assistants WHERE user_id = ?`, [Number(userId)]);
}

async function verifyPayment(assistantId, appointmentId) {
  const payment = await get(`SELECT * FROM payments WHERE appointment_id = ?`, [Number(appointmentId)]);
  const appointment = await get(`SELECT * FROM appointments WHERE id = ?`, [Number(appointmentId)]);
  if (!payment || !appointment) return false;
  await run(
    `UPDATE payments SET assistant_id = ?, status = ?, verified_at = ? WHERE appointment_id = ?`,
    [Number(assistantId), 'verified', new Date().toISOString(), Number(appointmentId)]
  );
  await run(
    `UPDATE appointments SET payment_verified = ?, status = ? WHERE id = ?`,
    [1, 'confirmed', Number(appointmentId)]
  );
  return true;
}

async function getHistoryForPatientUserId(userId) {
  const patient = await getPatientByUserId(userId);
  if (!patient) return [];
  return all(
    `SELECT mh.*, u.name AS doctor_name, up.name AS patient_name
     FROM medical_history mh
     LEFT JOIN doctors d ON d.id = mh.doctor_id
     LEFT JOIN users u ON u.id = d.user_id
     LEFT JOIN patients p ON p.id = mh.patient_id
     LEFT JOIN users up ON up.id = p.user_id
     WHERE mh.patient_id = ?
     ORDER BY mh.recorded_at DESC`,
    [patient.id]
  );
}

async function getHistoryForDoctorUserId(userId) {
  const doctor = await getDoctorByUserId(userId);
  if (!doctor) return [];
  return all(
    `SELECT mh.*, u.name AS doctor_name, up.name AS patient_name
     FROM medical_history mh
     LEFT JOIN doctors d ON d.id = mh.doctor_id
     LEFT JOIN users u ON u.id = d.user_id
     LEFT JOIN patients p ON p.id = mh.patient_id
     LEFT JOIN users up ON up.id = p.user_id
     WHERE mh.doctor_id = ?
     ORDER BY mh.recorded_at DESC`,
    [doctor.id]
  );
}

async function getAllHistory() {
  return all(
    `SELECT mh.*, u.name AS doctor_name, up.name AS patient_name
     FROM medical_history mh
     LEFT JOIN doctors d ON d.id = mh.doctor_id
     LEFT JOIN users u ON u.id = d.user_id
     LEFT JOIN patients p ON p.id = mh.patient_id
     LEFT JOIN users up ON up.id = p.user_id
     ORDER BY mh.recorded_at DESC`
  );
}

const ready = init();

module.exports = {
  ready,
  getUserByEmail,
  addUser,
  addPatient,
  addAssistant,
  getDoctorCount,
  getAppointmentCount,
  getDoctors,
  getDoctorById,
  getPatientByUserId,
  getDoctorByUserId,
  getAppointmentsForPatientUserId,
  getAppointmentsForDoctorUserId,
  getAllAppointments,
  addAppointment,
  getAssistantByUserId,
  verifyPayment,
  getHistoryForPatientUserId,
  getHistoryForDoctorUserId,
  getAllHistory
};
