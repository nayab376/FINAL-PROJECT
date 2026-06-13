# Doctor Hub

Doctor Hub is a healthcare consultation and patient history management platform built as a final semester project.
It supports doctor search, appointment booking, medical history management, prescriptions, payment verification, and role-based access control.

## Features

- Doctor search and filtering by specialty and treatment type
- Appointment booking and payment verification workflow
- Medical history sharing with immutable record rules
- Prescription management by doctors
- Role-based access: patient, doctor, assistant, admin, super-admin
- JWT authentication with secure password hashing
- Protected medical records and secure REST APIs

## Running the project

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
3. Open a browser and visit `http://localhost:3000`

## APIs

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/doctors`
- `POST /api/appointments`
- `POST /api/payments`
- `GET /api/history`

## Notes

- The application uses an SQLite database created automatically on first run.
- Registration requires an uppercase letter, lowercase letter, digit, and special character.
- Dashboard and appointment views are available after login.
- Doctor search includes doctor name, details, availability, and specialty.
